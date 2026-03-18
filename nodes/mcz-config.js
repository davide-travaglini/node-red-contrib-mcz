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
        
        node.serialNumber = config.serialNumber;
        node.macAddress = config.macAddress;
        node.templateType = config.templateType || 'aria';
        node.customTemplate = config.customTemplate || '';

        node._subscribers = new Set();
        node.socket = null;
        node.pollTimer = null;
        node.connected = false;

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
                node.log(`[mcz-config] Connected (SN=${node.serialNumber})`);

                node.socket.emit('join', {
                    serialNumber: node.serialNumber,
                    macAddress: node.macAddress,
                    type: 'Android-App'
                });

                if (node.interval > 0) {
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
                node._emit({ event: 'disconnect', serialNumber: node.serialNumber, reason });
            });

            node.socket.on('connect_error', (err) => {
                node.warn(`[mcz-config] Connection error (SN=${node.serialNumber}): ${err.message}`);
                node._emit({ event: 'error', serialNumber: node.serialNumber, error: err.message });
            });

            node.socket.on('rispondo', (response) => {
                const trama = (response && response.stringaRicevuta) || '';
                if (!trama) return;

                try {
                    const parsed = node.parser.parse(trama);
                    node._emit({ event: 'data', serialNumber: node.serialNumber, data: parsed, raw: trama });
                } catch (e) {
                    node.error(`[mcz-config] Parse error (SN=${node.serialNumber}): ${e.message}`);
                    node._emit({ event: 'error', serialNumber: node.serialNumber, error: e.message });
                }
            });
        };

        node.disconnectStove = function() {
            if (node.pollTimer) { clearInterval(node.pollTimer); node.pollTimer = null; }
            if (node.socket) {
                node.socket.removeAllListeners();
                node.socket.disconnect();
                node.socket = null;
            }
            node.connected = false;
        };

        node.requestInfo = function() {
            if (node.socket && node.socket.connected) {
                node.socket.emit('chiedo', {
                    serialNumber: node.serialNumber,
                    macAddress: node.macAddress,
                    tipoChiamata: 1,
                    richiesta: 'C|RecuperoInfo'
                });
            }
        };

        node.writeCommand = function(command) {
            if (node.socket && node.socket.connected && command) {
                node.socket.emit('chiedo', {
                    serialNumber: node.serialNumber,
                    macAddress: node.macAddress,
                    tipoChiamata: 1,
                    richiesta: command
                });
            }
        };

        node.on('close', function(done) {
            node.disconnectStove();
            done();
        });
    }

    RED.nodes.registerType('mcz-config', MCZConfigNode);
};
