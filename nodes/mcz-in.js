'use strict';

module.exports = function(RED) {
    function MCZInNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.name = config.name;
        node.outputRaw = config.outputRaw === true;

        const cfg = RED.nodes.getNode(config.stoveConfig);
        if (!cfg) {
            node.status({ fill: 'red', shape: 'ring', text: 'Nessuna configurazione' });
            node.error('mcz-in: config node is missing');
            return;
        }

        function setStatus(fill, shape, text) {
            node.status({ fill, shape, text });
        }

        setStatus('grey', 'ring', 'Waiting…');

        function onEvent(evt) {

            switch (evt.event) {
                case 'connect':
                    setStatus('green', 'dot', `Connected — ${evt.serialNumber}`);
                    node.send({ topic: `mcz/${evt.serialNumber}/event`, payload: evt });
                    break;
                case 'disconnect':
                    setStatus('yellow', 'ring', `Disconnected ${evt.serialNumber || ''}`);
                    node.send({ topic: `mcz/${evt.serialNumber}/event`, payload: evt });
                    break;
                case 'data':
                    const now = new Date().toLocaleTimeString('en-US');
                    const stato = evt.data.stato || '';
                    setStatus(
                        evt.data.in_errore ? 'red' : 'green',
                        'dot',
                        `${now} — ${stato}`
                    );
                    const msg = {
                        payload: evt.data,
                        topic: `mcz/${evt.serialNumber}`
                    };
                    if (node.outputRaw) msg.raw = evt.raw;
                    node.send(msg);
                    break;
                case 'error':
                    setStatus('red', 'ring', `Error: ${evt.error}`);
                    node.send({ topic: `mcz/${evt.serialNumber}/event`, payload: evt });
                    break;
            }
        }

        cfg.subscribe(onEvent);

        node.on('input', function(msg) {
            let cmd = '';
            if (typeof msg.payload === 'string') cmd = msg.payload.toLowerCase().trim();
            else if (msg.payload && typeof msg.payload.command === 'string') cmd = msg.payload.command.toLowerCase().trim();

            switch (cmd) {
                case 'connect':
                    cfg.connectStove();
                    break;
                case 'disconnect':
                    cfg.disconnectStove();
                    setStatus('grey', 'ring', 'Disconnected manually');
                    break;
                case 'get':
                    cfg.requestInfo();
                    break;
                default:
                    node.warn(`mcz-in: Unknown command "${cmd}". Use connect / disconnect / get`);
            }
        });

        node.on('close', function(done) {
            cfg.unsubscribe(onEvent);
            setStatus('grey', 'ring', 'Fermato');
            done();
        });
    }

    RED.nodes.registerType('mcz-in', MCZInNode);
};
