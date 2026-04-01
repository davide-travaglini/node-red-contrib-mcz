'use strict';

const assert = require('assert');
const Parser = require('../lib/parser');

// Build a pipe-separated trama from a sparse position map.
// parts[0] is always 'C' (the MCZ framing prefix).
function makeTrama(overrides = {}, length = 70) {
    const parts = new Array(length + 1).fill('00');
    parts[0] = 'C';
    for (const [pos, val] of Object.entries(overrides)) {
        parts[parseInt(pos)] = val;
    }
    return parts.join('|');
}

// Minimal template helper
function makeTemplate(fields) {
    return { name: 'Test', fields };
}

describe('Parser — primitive types', () => {

    it('int: converts hex token to integer', () => {
        const tpl = makeTemplate([{ key: 'v', pos: 1, type: 'int' }]);
        const p = new Parser(tpl);
        const r = p.parse(makeTrama({ 1: '1F' }));
        assert.strictEqual(r.v, 31); // 0x1F = 31
    });

    it('int: returns null for missing position', () => {
        const tpl = makeTemplate([{ key: 'v', pos: 1, type: 'int' }]);
        const p = new Parser(tpl);
        const r = p.parse('C'); // only pos 0
        assert.strictEqual(r.v, null);
    });

    it('temp: converts hex / 2 to °C', () => {
        const tpl = makeTemplate([{ key: 't', pos: 1, type: 'temp' }]);
        const p = new Parser(tpl);
        const r = p.parse(makeTrama({ 1: '2B' })); // 0x2B = 43 → 21.5°C
        assert.strictEqual(r.t, 21.5);
    });

    it('temp: returns null for 0xFF (sensor absent)', () => {
        const tpl = makeTemplate([{ key: 't', pos: 1, type: 'temp' }]);
        const p = new Parser(tpl);
        const r = p.parse(makeTrama({ 1: 'FF' }));
        assert.strictEqual(r.t, null);
    });

    it('temp: returns null for 0xFE (sensor absent)', () => {
        const tpl = makeTemplate([{ key: 't', pos: 1, type: 'temp' }]);
        const p = new Parser(tpl);
        const r = p.parse(makeTrama({ 1: 'FE' }));
        assert.strictEqual(r.t, null);
    });

    it('bool: 0x00 → false', () => {
        const tpl = makeTemplate([{ key: 'b', pos: 1, type: 'bool' }]);
        const p = new Parser(tpl);
        const r = p.parse(makeTrama({ 1: '00' }));
        assert.strictEqual(r.b, false);
    });

    it('bool: 0x01 → true', () => {
        const tpl = makeTemplate([{ key: 'b', pos: 1, type: 'bool' }]);
        const p = new Parser(tpl);
        const r = p.parse(makeTrama({ 1: '01' }));
        assert.strictEqual(r.b, true);
    });

    it('bool_gte: true when value >= threshold', () => {
        const tpl = makeTemplate([{ key: 'e', pos: 1, type: 'bool_gte', threshold: 50 }]);
        const p = new Parser(tpl);
        const r = p.parse(makeTrama({ 1: '32' })); // 0x32 = 50
        assert.strictEqual(r.e, true);
    });

    it('bool_gte: false when value < threshold', () => {
        const tpl = makeTemplate([{ key: 'e', pos: 1, type: 'bool_gte', threshold: 50 }]);
        const p = new Parser(tpl);
        const r = p.parse(makeTrama({ 1: '0F' })); // 0x0F = 15
        assert.strictEqual(r.e, false);
    });

});

describe('Parser — map types', () => {

    it('map with named map (STOVE_STATES): 0x00 → "Off"', () => {
        const tpl = makeTemplate([{ key: 's', pos: 1, type: 'map', map: 'STOVE_STATES' }]);
        const p = new Parser(tpl);
        const r = p.parse(makeTrama({ 1: '00' }));
        assert.strictEqual(r.s, 'Off');
    });

    it('map with named map (FAN_STATES): 0x06 → "Automatic"', () => {
        const tpl = makeTemplate([{ key: 'f', pos: 2, type: 'map', map: 'FAN_STATES' }]);
        const p = new Parser(tpl);
        const r = p.parse(makeTrama({ 2: '06' }));
        assert.strictEqual(r.f, 'Automatic');
    });

    it('map with inline values', () => {
        const tpl = makeTemplate([
            { key: 'v', pos: 1, type: 'map', values: { '0': 'Closed', '1': 'Open' } }
        ]);
        const p = new Parser(tpl);
        const r = p.parse(makeTrama({ 1: '01' }));
        assert.strictEqual(r.v, 'Open');
    });

    it('map: unknown value → "Unknown (N)"', () => {
        const tpl = makeTemplate([{ key: 'f', pos: 1, type: 'map', map: 'FAN_STATES' }]);
        const p = new Parser(tpl);
        const r = p.parse(makeTrama({ 1: '63' })); // 99 — not in FAN_STATES
        assert.ok(r.f.startsWith('Unknown'));
    });

    it('map: throws for missing named map', () => {
        const tpl = makeTemplate([{ key: 'x', pos: 1, type: 'map', map: 'NONEXISTENT_MAP' }]);
        const p = new Parser(tpl);
        const r = p.parse(makeTrama({ 1: '01' }));
        assert.strictEqual(r.x, null); // parser catches the error and returns null
    });

});

describe('Parser — derived types', () => {

    it('range_offset: maps in-range value', () => {
        // power: raw 13 (0x0D), min=11, max=15, offset=-10 → result = 3
        const tpl = makeTemplate([{ key: 'p', pos: 1, type: 'range_offset', min: 11, max: 15, offset: -10 }]);
        const p = new Parser(tpl);
        const r = p.parse(makeTrama({ 1: '0D' })); // 0x0D = 13
        assert.strictEqual(r.p, 3);
    });

    it('range_offset: returns null for out-of-range value', () => {
        const tpl = makeTemplate([{ key: 'p', pos: 1, type: 'range_offset', min: 11, max: 15, offset: -10 }]);
        const p = new Parser(tpl);
        const r = p.parse(makeTrama({ 1: '05' })); // 5 — below min
        assert.strictEqual(r.p, null);
    });

    it('hours: converts raw integer (seconds) to "Xh MMm"', () => {
        const tpl = makeTemplate([{ key: 'h', pos: 1, type: 'hours' }]);
        const p = new Parser(tpl);
        // 3661 seconds = 1h 01m. In hex: 3661 = 0xE4D
        const r = p.parse(makeTrama({ 1: 'E4D' }));
        assert.strictEqual(r.h, '1h 01m');
    });

    it('clock: assembles date string from multiple positions', () => {
        const tpl = makeTemplate([{
            key: 'clk',
            type: 'clock',
            positions: { hour: 1, min: 2, day: 3, month: 4, year: 5 }
        }]);
        const p = new Parser(tpl);
        // 10:30 on 28/03/2026 → hour=0x0A, min=0x1E, day=0x1C, month=0x03, year=0x7EA
        const r = p.parse(makeTrama({ 1: '0A', 2: '1E', 3: '1C', 4: '03', 5: '7EA' }));
        assert.strictEqual(r.clk, '28/03/2026 10:30');
    });

    it('clock: returns null if any position is missing', () => {
        const tpl = makeTemplate([{
            key: 'clk',
            type: 'clock',
            positions: { hour: 1, min: 2, day: 3, month: 4, year: 5 }
        }]);
        const p = new Parser(tpl);
        const r = p.parse('C|0A|1E|1C'); // year and month positions missing
        assert.strictEqual(r.clk, null);
    });

});

describe('Parser — metadata', () => {

    it('adds _raw, _template and _timestamp to output', () => {
        const tpl = makeTemplate([]);
        const p = new Parser(tpl);
        const trama = makeTrama();
        const r = p.parse(trama);
        assert.strictEqual(r._raw, trama);
        assert.strictEqual(r._template, 'Test');
        assert.ok(typeof r._timestamp === 'string');
    });

});

describe('Parser — constructor validation', () => {

    it('throws when template has no fields array', () => {
        assert.throws(() => new Parser({}), /Invalid template/);
    });

    it('throws when template is null', () => {
        assert.throws(() => new Parser(null), /Invalid template/);
    });

});
