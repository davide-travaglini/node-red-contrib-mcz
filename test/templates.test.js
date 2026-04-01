'use strict';

const assert = require('assert');
const Templates = require('../lib/templates');
const Parser = require('../lib/parser');

const BUILTIN = ['aria', 'aria_comfort', 'idro', 'musa_hydro'];

describe('Templates — loading', () => {

    for (const name of BUILTIN) {
        it(`${name}: loads without error`, () => {
            assert.doesNotThrow(() => Templates.get(name));
        });

        it(`${name}: has a name string`, () => {
            const tpl = Templates.get(name);
            assert.ok(typeof tpl.name === 'string' && tpl.name.length > 0);
        });

        it(`${name}: has a non-empty fields array`, () => {
            const tpl = Templates.get(name);
            assert.ok(Array.isArray(tpl.fields) && tpl.fields.length > 0);
        });

        it(`${name}: every field has key and type`, () => {
            const tpl = Templates.get(name);
            for (const f of tpl.fields) {
                assert.ok(typeof f.key === 'string' && f.key.length > 0,
                    `field missing "key": ${JSON.stringify(f)}`);
                assert.ok(typeof f.type === 'string' && f.type.length > 0,
                    `field missing "type": ${JSON.stringify(f)}`);
            }
        });

        it(`${name}: can be used to construct a Parser`, () => {
            const tpl = Templates.get(name);
            assert.doesNotThrow(() => new Parser(tpl));
        });
    }

});

describe('Templates — custom', () => {

    it('custom: parses valid JSON', () => {
        const json = JSON.stringify({ name: 'My Stove', fields: [{ key: 'v', pos: 1, type: 'int' }] });
        const tpl = Templates.get('custom', json);
        assert.strictEqual(tpl.name, 'My Stove');
    });

    it('custom: throws on empty JSON', () => {
        assert.throws(() => Templates.get('custom', ''), /no JSON provided/);
    });

    it('custom: throws on malformed JSON', () => {
        assert.throws(() => Templates.get('custom', '{bad json'), /JSON parse error/);
    });

    it('unknown name: throws', () => {
        assert.throws(() => Templates.get('nonexistent'), /not found/);
    });

});

describe('Templates — list()', () => {

    it('returns all 4 built-in names', () => {
        const list = Templates.list();
        assert.deepStrictEqual(list.sort(), [...BUILTIN].sort());
    });

});

describe('Templates — aria smoke parse', () => {

    it('parses a minimal trama with aria template', () => {
        const tpl = Templates.get('aria');
        const p = new Parser(tpl);
        // Build a minimal trama: 70 zeros, pos[1]=0x0F (Power 5), pos[6]=0x2A (21°C)
        const parts = new Array(71).fill('00');
        parts[0] = 'C';
        parts[1] = '0F'; // state_raw=15, state="Power 5", in_error=false
        parts[6] = '2A'; // temp_ambient = 0x2A/2 = 21.0°C
        parts[26] = '2B'; // temp_setpoint = 0x2B/2 = 21.5°C
        const r = p.parse(parts.join('|'));
        assert.strictEqual(r.state, 'Power 5');
        assert.strictEqual(r.in_error, false);
        assert.strictEqual(r.temp_ambient, 21.0);
        assert.strictEqual(r.temp_setpoint, 21.5);
    });

});
