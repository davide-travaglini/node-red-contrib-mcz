'use strict';

module.exports = function(RED) {
    const MAPS = require('../lib/maps');

    // ── Helper ────────────────────────────────────────────────────────────────

    /**
     * Decodes a single hex token into every useful interpretation:
     *   hex        → original string (e.g. "4A")
     *   dec        → integer  (74)
     *   dec_div2   → /2       (37.0)  ← temperature encoding
     *   bool       → Boolean  (true)
     *   maps       → object   { MAP_NAME: "label" | null }  for every built-in map
     */
    function decodeToken(token) {
        if (token === undefined || token === null || token === '') {
            return { hex: token, dec: null, dec_div2: null, bool: null, maps: {} };
        }

        const dec = parseInt(token, 16);
        if (isNaN(dec)) {
            // Not a valid hex byte (e.g. the leading "C")
            return { hex: token, dec: null, dec_div2: null, bool: null, maps: {} };
        }

        const maps = {};
        for (const [mapName, mapObj] of Object.entries(MAPS)) {
            maps[mapName] = mapObj[dec] !== undefined ? mapObj[dec] : null;
        }

        return {
            hex:      token,
            dec,
            dec_div2: parseFloat((dec / 2).toFixed(1)),   // useful for temp fields
            bool:     Boolean(dec),
            // also include ≥0xFE sentinel (used by parser for absent temp probes)
            absent_temp: dec >= 0xFE,
            maps,
        };
    }

    // ── Node ────────────────────────────────────────────────────────────────

    function MCZDebugNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.name = config.name;

        const cfg = RED.nodes.getNode(config.stoveConfig);
        if (!cfg) {
            node.status({ fill: 'red', shape: 'ring', text: 'No config' });
            node.error('mcz-debug: config node is missing');
            return;
        }

        node.status({ fill: 'grey', shape: 'ring', text: 'Waiting…' });

        function onEvent(evt) {
            if (evt.event !== 'data') return;          // only react to data frames

            const trama = evt.raw || '';
            if (!trama) return;

            const parts = trama.split('|');
            const positions = {};

            parts.forEach((token, idx) => {
                positions[idx] = decodeToken(token);
            });

            const msg = {
                topic:   `mcz/${evt.serialNumber}/debug`,
                payload: {
                    _raw:     trama,
                    _length:  parts.length,
                    _note:    'Each key is a pipe-separated position index (0-based). ' +
                              'Use dec/dec_div2/bool/maps to identify what a position represents.',
                    positions,
                    // Convenience flat views for quick inspection
                    flat_dec:     parts.map((t, i) => ({ i, hex: t, dec: parseInt(t, 16) || null })),
                    flat_div2:    parts.map((t, i) => ({ i, hex: t, div2: isNaN(parseInt(t, 16)) ? null : parseFloat((parseInt(t, 16) / 2).toFixed(1)) })),
                    map_names:    Object.keys(MAPS),
                },
            };

            const now = new Date().toLocaleTimeString('it-IT');
            node.status({ fill: 'green', shape: 'dot', text: `${now} — ${parts.length} tokens` });
            node.send(msg);
        }

        cfg.subscribe(onEvent);

        node.on('close', function(done) {
            cfg.unsubscribe(onEvent);
            node.status({});
            done();
        });
    }

    RED.nodes.registerType('mcz-debug', MCZDebugNode);
};
