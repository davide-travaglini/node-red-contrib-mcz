'use strict';

const MAPS = require('./maps');

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToInt(parts, pos) {
    const s = parts[pos];
    if (s === undefined || s === null || s === '') return null;
    const v = parseInt(s, 16);
    return isNaN(v) ? null : v;
}

function hexToTemp(parts, pos) {
    const v = hexToInt(parts, pos);
    if (v === null || v >= 0xFE) return null;
    return v / 2.0;
}

function secondsToHours(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
}

function resolveMap(field) {
    // named map  →  "map": "STATI_STUFA"
    if (field.map && typeof field.map === 'string') {
        const m = MAPS[field.map];
        if (!m) throw new Error(`Map "${field.map}" not found in lib/maps.js`);
        return m;
    }
    // inline map  →  "values": { "0": "Manuale", "1": "Dinamico" }
    if (field.values && typeof field.values === 'object') {
        // keys may be strings; normalise to integer keys
        const m = {};
        for (const [k, v] of Object.entries(field.values)) m[parseInt(k, 10)] = v;
        return m;
    }
    return {};
}

// ── Parser class ──────────────────────────────────────────────────────────────

class Parser {
    /**
     * @param {Object} template  Parsed JSON template (see templates/aria.json for the schema)
     */
    constructor(template) {
        if (!template || !Array.isArray(template.fields)) {
            throw new Error('Invalid template: missing "fields" array');
        }
        this.template = template;
    }

    /**
     * Parse a raw pipe-separated trama string into a structured object.
     * All hex values ≥ 0xFE for temperature fields are returned as null (sensor absent).
     *
     * @param {string} trama  e.g. "C|00|00|05|00|4A|27|FF|..."
     * @returns {Object}
     */
    parse(trama) {
        const parts = trama.split('|');
        const result = {
            _raw:       trama,
            _parts:     parts,
            _template:  this.template.name,
            _timestamp: new Date().toISOString(),
        };

        for (const field of this.template.fields) {
            try {
                result[field.key] = this._parseField(field, parts);
            } catch (e) {
                result[field.key] = null;
            }
        }

        return result;
    }

    _parseField(field, parts) {
        switch (field.type) {

            // ── Primitives ────────────────────────────────────────────────────

            case 'int': {
                return hexToInt(parts, field.pos);
            }

            case 'temp': {
                // hex integer ÷ 2 → °C; 0xFE/0xFF = sensor absent
                return hexToTemp(parts, field.pos);
            }

            case 'bool': {
                const v = hexToInt(parts, field.pos);
                return v === null ? null : Boolean(v);
            }

            // ── Derived ───────────────────────────────────────────────────────

            case 'bool_gte': {
                // true when value >= threshold  (used for in_errore)
                const v = hexToInt(parts, field.pos);
                return v !== null && v >= (field.threshold || 50);
            }

            case 'map': {
                const v = hexToInt(parts, field.pos);
                if (v === null) return null;
                const m = resolveMap(field);
                return m[v] !== undefined ? m[v] : `Unknown (${v})`;
            }

            case 'range_offset': {
                // Returns (value + offset) only when value is within [min, max], else null.
                // Used for potenza: raw 11–15 → 1–5
                const v = hexToInt(parts, field.pos);
                if (v === null) return null;
                if (v >= field.min && v <= field.max) return v + field.offset;
                return null;
            }

            case 'hours': {
                // Interprets raw integer as seconds → "Xh MMm"
                const v = hexToInt(parts, field.pos) || 0;
                return secondsToHours(v);
            }

            case 'clock': {
                // Assembles date/time from multiple positions.
                // NOTE: year is stored as a full 4-digit integer (e.g. 0x07EA = 2026).
                // NOTE: minutes are stored as actual minutes (0-59), NOT as half-minutes.
                const p = field.positions;
                const hour  = hexToInt(parts, p.hour);
                const min   = hexToInt(parts, p.min);
                const day   = hexToInt(parts, p.day);
                const month = hexToInt(parts, p.month);
                const year  = hexToInt(parts, p.year);
                if ([hour, min, day, month, year].some(v => v === null)) return null;
                return (
                    `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}` +
                    `/${year} ` +
                    `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`
                );
            }

            default:
                return null;
        }
    }
}

module.exports = Parser;
