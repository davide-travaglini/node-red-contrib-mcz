'use strict';

module.exports = function(RED) {
    const { buildCommandString } = require('../lib/commands');

    function MCZOutNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.name = config.name;

        const cfg = RED.nodes.getNode(config.stoveConfig);
        if (!cfg) {
            node.status({ fill: 'red', shape: 'ring', text: RED._('mcz-out.status.noConfig') });
            node.error('mcz-out: config node is missing');
            return;
        }

        node.status({ fill: 'blue', shape: 'dot', text: 'Ready' });

        node.on('input', function(msg, send, done) {
            try {
                let cmdName = config.command;
                let cmdValue = null;

                // Resolve name
                if (!cmdName || cmdName === '') {
                    if (typeof msg.payload === 'object' && msg.payload.command !== undefined) {
                        cmdName = msg.payload.command;
                    }
                }

                // Resolve value
                if (config.payloadType === 'fixed') {
                    cmdValue = config.fixedValue;
                } else {
                    if (typeof msg.payload === 'object' && msg.payload.value !== undefined) {
                        cmdValue = msg.payload.value;
                    } else if (typeof msg.payload === 'string' || typeof msg.payload === 'number' || typeof msg.payload === 'boolean') {
                        // Fallback to bare payload if no .value is passed but we need a value
                        cmdValue = msg.payload;
                    }
                }

                let commandStr = null;

                // Scenario 1: Fully raw SocketIO string bypass (e.g. "C|WriteParametri|..." or
                // a bare "RecuperoParametri"-style request with no pipe separator)
                if ((!config.command || config.command === '') && typeof msg.payload === 'string' &&
                    (msg.payload.includes('|') || msg.payload.startsWith('Recupero'))) {
                    commandStr = msg.payload;
                }
                // Scenario 2: Structured command builder
                else if (cmdName && cmdValue !== null && cmdValue !== undefined) {
                    commandStr = buildCommandString(cmdName, cmdValue);
                    if (!commandStr) {
                        const err = new Error(`mcz-out: Failed to build command: invalid name or value for "${cmdName}"="${cmdValue}"`);
                        node.status({ fill: 'red', shape: 'ring', text: 'Invalid command' });
                        if (done) return done(err);
                        node.error(err.message, msg);
                        return;
                    }
                }
                else {
                    const err = new Error('mcz-out: msg.payload must either be a raw string OR provide valid command/value via UI or msg.payload properties.');
                    node.status({ fill: 'red', shape: 'ring', text: 'Invalid input' });
                    if (done) return done(err);
                    node.error(err.message, msg);
                    return;
                }

                // Invia il comando di scrittura
                if (!cfg.connected) {
                    const err = new Error('mcz-out: stove is not connected, command dropped');
                    node.status({ fill: 'red', shape: 'ring', text: 'Not connected' });
                    if (done) return done(err);
                    node.error(err.message, msg);
                    return;
                }

                cfg.sendRaw(commandStr);
                node.status({ fill: 'green', shape: 'dot', text: `Sent: ${commandStr.substring(0, 15)}...` });
                node.send({ topic: `mcz/${cfg.serialNumber}/command`, payload: { command: cmdName, value: cmdValue, raw: commandStr } });
                setTimeout(() => {
                    node.status({ fill: 'blue', shape: 'dot', text: 'Ready' });
                }, 2000);
                if (done) done();
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: RED._('mcz-out.status.sendError') });
                if (done) done(err); else node.error(`mcz-out: Error writing command: ${err.message}`, msg);
            }
        });

        node.on('close', function() {
            node.status({});
        });
    }

    RED.nodes.registerType('mcz-out', MCZOutNode);
};
