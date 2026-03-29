'use strict';

module.exports = function(RED) {
    function MCZInNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.name = config.name;
        node.outputRaw = config.outputRaw === true;
        node.enableHaDiscovery = config.enableHaDiscovery === true;

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
                    if (node.enableHaDiscovery) {
                        const haTopicState = `mcz/${evt.serialNumber}`;
                        const haTopicCmd = `mcz/${evt.serialNumber}/set`;
                        const haPayload = {
                            name: node.name || "MCZ Stove",
                            unique_id: `mcz_stove_${evt.serialNumber}`,
                            icon: "mdi:fire",
                            temperature_command_topic: haTopicCmd,
                            temperature_command_template: '{"command":"Temperature", "value": {{value}}}',
                            temperature_state_topic: haTopicState,
                            temperature_state_template: '{{value_json.temp_ambient}}',
                            current_temperature_topic: haTopicState,
                            current_temperature_template: '{{value_json.temp_ambient}}',
                            mode_state_topic: haTopicState,
                            mode_state_template: '{% if value_json.stato == "Spento" %}off{% else %}heat{% endif %}',
                            mode_command_topic: haTopicCmd,
                            mode_command_template: '{% if value == "off" %}{"command":"Power", "value": 0}{% else %}{"command":"Power", "value": 1}{% endif %}',
                            modes: ["off", "heat"],
                            fan_mode_state_topic: haTopicState,
                            fan_mode_state_template: '{{value_json.fan_ambient}}',
                            fan_mode_command_topic: haTopicCmd,
                            fan_mode_command_template: '{"command":"Fan_State", "value": "{{value}}"}',
                            fan_modes: ["0", "1", "2", "3", "4", "5", "6"],
                            min_temp: 10,
                            max_temp: 35,
                            temp_step: 0.5,
                            device: {
                                identifiers: [`mcz_${evt.serialNumber}`],
                                name: "MCZ Stove",
                                manufacturer: "MCZ",
                                model: "Pellet Stove"
                            }
                        };
                        node.send({ topic: `homeassistant/climate/mcz_${evt.serialNumber}/config`, payload: haPayload, retain: true });
                    }
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
                case 'reconnecting':
                    setStatus('yellow', 'ring', `Reconnecting (Attempt ${evt.attempt})...`);
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
