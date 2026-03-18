'use strict';

module.exports = function(RED) {
    const { buildCommandString } = require('../lib/commands');

    function MCZOutNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.name = config.name;

        const cfg = RED.nodes.getNode(config.stoveConfig);
        if (!cfg) {
            node.status({ fill: 'red', shape: 'ring', text: 'Nessuna configurazione' });
            node.error('mcz-out: config node is missing');
            return;
        }

        node.status({ fill: 'blue', shape: 'dot', text: 'Ready' });

        node.on('input', function(msg) {

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

            // Scenario 1: Fully raw SocketIO string bypass (e.g. "C|WriteParametri|...")
            if ((!config.command || config.command === '') && typeof msg.payload === 'string' && msg.payload.includes('|')) {
                commandStr = msg.payload;
            } 
            // Scenario 2: Structured command builder
            else if (cmdName && cmdValue !== null && cmdValue !== undefined) {
                commandStr = buildCommandString(cmdName, cmdValue);
                if (!commandStr) {
                    node.error(`mcz-out: Failed to build command: invalid name or value for "${cmdName}"="${cmdValue}"`);
                    return;
                }
            } 
            else {
                node.error('mcz-out: msg.payload must either be a raw string OR provide valid command/value via UI or msg.payload properties.');
                return;
            }

            // Invia il comando di scrittura
            try {
                cfg.writeCommand(commandStr);
                node.status({ fill: 'green', shape: 'dot', text: `Sent: ${commandStr.substring(0, 15)}...` });
                setTimeout(() => {
                    node.status({ fill: 'blue', shape: 'dot', text: 'Ready' });
                }, 2000);
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: 'Errore invio' });
                node.error(`mcz-out: Error writing command: ${err.message}`);
            }
        });

        node.on('close', function() {
            node.status({});
        });
    }

    RED.nodes.registerType('mcz-out', MCZOutNode);
};
