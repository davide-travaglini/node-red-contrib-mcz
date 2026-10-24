'use strict';

module.exports = function(RED) {
    const { io } = require('socket.io-client');
    const Parser = require('../lib/parser');
    const Templates = require('../lib/templates');

    function MCZConfigNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.name = config.name;
        node.server = config.server || 'http://app.mcz.it:9000';
        
        node.interval = parseInt(config.interval, 10);
        if (isNaN(node.interval)) node.interval = 30;
        
        node.serialNumber = (config.serialNumber || '').trim();
        node.macAddress = (config.macAddress || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        node.templateType = config.templateType || 'aria';
        node.customTemplate = config.customTemplate || '';

        node._subscribers = new Set();
        node.socket = null;
        node.pollTimer = null;
        node.connected = false;
        node.lastSeen = null;
        node.lastReply = null;
        node._lastRequestType = null; // 'data' | 'parameters' — tags the next 'rispondo' reply

        // Outgoing 'chiedo' requests share a single request/reply channel with the
        // cloud, so sends are serialized here: only one request is in flight at a
        // time, which keeps _lastRequestType correctly paired with its reply instead
        // of being clobbered by a second send issued before the first reply arrives.
        node._sendQueue = [];
        node._sendBusy = false;
        node._sendTimer = null;

        let parser = null;
        try {
            const tpl = Templates.get(node.templateType, node.customTemplate);
            parser = new Parser(tpl);
        } catch (e) {
            node.error(`[mcz-config] Template error: ${e.message}`);
        }
        node.parser = parser;

        // Pub/Sub API for read/write nodes
        node.subscribe = function(cb) {
            node._subscribers.add(cb);
            if (node._subscribers.size === 1) {
                node.connectStove();
            }
        };

        node.unsubscribe = function(cb) {
            node._subscribers.delete(cb);
            if (node._subscribers.size === 0) {
                node.disconnectStove();
            }
        };

        node._emit = function(event) {
            node._subscribers.forEach(cb => {
                try { cb(event); } catch (e) { /* isolate subscriber errors */ }
            });
        };

        // Connection management
        node.connectStove = function() {
            if (!node.serialNumber || !node.macAddress || !node.parser) return;
            if (node.socket && node.socket.connected) return;

            node.log(`[mcz-config] Connecting to ${node.server} (SN=${node.serialNumber})`);

            node.socket = io(node.server, {
                transports: ['websocket'],
                reconnection: true,
                reconnectionDelay: 5000,
                reconnectionDelayMax: 30000,
                timeout: 10000
            });

            node.socket.on('connect', () => {
                node.connected = true;
                node.lastSeen = new Date();
                node.log(`[mcz-config] Connected (SN=${node.serialNumber})`);

                node.socket.emit('join', {
                    serialNumber: node.serialNumber,
                    macAddress: node.macAddress,
                    type: 'Android-App'
                });

                if (node.interval > 0) {
                    // NOTE: requesting parameters (tipoChiamata 0 / RecuperoParametri) on
                    // every connect was tried and broke live telemetry entirely — the
                    // cloud stopped answering 'chiedo' for the rest of the session. Only
                    // request telemetry automatically; parameters stay available as a
                    // manual trigger ("parameters"/"param" input on mcz-in).
                    node.requestInfo();
                    if (node.pollTimer) clearInterval(node.pollTimer);
                    node.pollTimer = setInterval(() => node.requestInfo(), node.interval * 1000);
                } else {
                    node.log(`[mcz-config] Auto-polling disabled. Waiting for manual requests (SN=${node.serialNumber})`);
                }

                node._emit({ event: 'connect', serialNumber: node.serialNumber });
            });

            node.socket.on('disconnect', (reason) => {
                node.connected = false;
                node.log(`[mcz-config] Disconnected (SN=${node.serialNumber}): ${reason}`);
                if (node.pollTimer) { clearInterval(node.pollTimer); node.pollTimer = null; }
                if (node._sendTimer) { clearTimeout(node._sendTimer); node._sendTimer = null; }
                node._sendQueue = [];
                node._sendBusy = false;
                node._emit({ event: 'disconnect', serialNumber: node.serialNumber, reason });
            });

            node.socket.on('connect_error', (err) => {
                node.warn(`[mcz-config] Connection error (SN=${node.serialNumber}): ${err.message}`);
                node._emit({ event: 'error', serialNumber: node.serialNumber, error: err.message });
            });

            node.socket.io.on('reconnect_attempt', (attempt) => {
                node._emit({ event: 'reconnecting', serialNumber: node.serialNumber, attempt });
            });

            node.socket.io.on('reconnect_error', (err) => {
                node._emit({ event: 'error', serialNumber: node.serialNumber, error: 'Reconnect failed: ' + err.message });
            });

            node.socket.on('rispondo', (response) => {
                node._sendDone();
                node.lastReply = new Date();
                const trama = (response && response.stringaRicevuta) || '';
                if (!trama) return;

                try {
                    const parsed = node.parser.parse(trama);
                    // The cloud answers one request at a time on this single channel, so
                    // we tag the reply with whatever request we last sent to tell a
                    // parameters-dump apart from a live-telemetry reply.
                    const eventType = node._lastRequestType === 'parameters' ? 'parameters' : 'data';
                    node._emit({ event: eventType, serialNumber: node.serialNumber, data: parsed, raw: trama });
                } catch (e) {
                    node.error(`[mcz-config] Parse error (SN=${node.serialNumber}): ${e.message}`);
                    node._emit({ event: 'error', serialNumber: node.serialNumber, error: e.message });
                }
            });
        };

        node.disconnectStove = function() {
            if (node.pollTimer) { clearInterval(node.pollTimer); node.pollTimer = null; }
            if (node._sendTimer) { clearTimeout(node._sendTimer); node._sendTimer = null; }
            node._sendQueue = [];
            node._sendBusy = false;
            if (node.socket) {
                node.socket.removeAllListeners();
                if (node.socket.io) {
                    node.socket.io.removeAllListeners('reconnect_attempt');
                    node.socket.io.removeAllListeners('reconnect_error');
                }
                node.socket.disconnect();
                node.socket = null;
            }
            node.connected = false;
        };

        // Serializes outgoing 'chiedo' requests: at most one in flight at a time
        // (see note by _sendQueue above). A safety timeout unblocks the queue if
        // the cloud never answers, so one dropped reply can't wedge future sends.
        node._sendDone = function() {
            if (node._sendTimer) { clearTimeout(node._sendTimer); node._sendTimer = null; }
            node._sendBusy = false;
            node._processSendQueue();
        };

        node._processSendQueue = function() {
            if (node._sendBusy || node._sendQueue.length === 0) return;
            if (!node.socket || !node.socket.connected) { node._sendQueue = []; return; }

            const job = node._sendQueue.shift();
            node._sendBusy = true;
            node._lastRequestType = job.type;
            node.socket.emit('chiedo', job.payload);
            node._sendTimer = setTimeout(() => node._sendDone(), 10000);
        };

        node._enqueueSend = function(type, payload) {
            if (!node.socket || !node.socket.connected) return false;
            node._sendQueue.push({ type, payload });
            node._processSendQueue();
            return true;
        };

        node.requestInfo = function() {
            node._enqueueSend('data', {
                serialNumber: node.serialNumber,
                macAddress: node.macAddress,
                tipoChiamata: 1,
                richiesta: 'C|RecuperoInfo'
            });
        };

        // Requests stove configuration parameters (as opposed to live telemetry),
        // same call the Android app makes once after connecting.
        node.requestParameters = function() {
            const queued = node._enqueueSend('parameters', {
                serialNumber: node.serialNumber,
                macAddress: node.macAddress,
                tipoChiamata: 0,
                richiesta: 'RecuperoParametri'
            });
            if (queued) node.log(`[mcz-config] Requested parameters (SN=${node.serialNumber})`);
        };

        node.writeCommand = function(command) {
            if (!command) return;
            node._enqueueSend('data', {
                serialNumber: node.serialNumber,
                macAddress: node.macAddress,
                tipoChiamata: 1,
                richiesta: command
            });
        };

        // Alias kept for callers that prefer a protocol-agnostic name — same
        // transport as writeCommand, no separate implementation to keep in sync.
        node.sendRaw = node.writeCommand;

        node.on('close', function(done) {
            node.disconnectStove();
            done();
        });
    }

    RED.nodes.registerType('mcz-config', MCZConfigNode);
};
