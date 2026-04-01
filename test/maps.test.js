'use strict';

const assert = require('assert');
const MAPS = require('../lib/maps');

describe('Maps — presence and structure', () => {

    const expectedMaps = [
        'STOVE_STATES',
        'FAN_STATES',
        'PROFILES',
        'BRAZIER_STATES',
        'PELLET_LEVELS',
        'IGNITOR_STATES',
        'REGULATION_MODES',
        'SEASON_MODES',
        'THREE_WAY_VALVE'
    ];

    for (const name of expectedMaps) {
        it(`${name} is exported and is an object`, () => {
            assert.ok(MAPS[name], `Missing map: ${name}`);
            assert.strictEqual(typeof MAPS[name], 'object');
        });
    }

});

describe('STOVE_STATES', () => {

    it('0 → "Off"', () => assert.strictEqual(MAPS.STOVE_STATES[0], 'Off'));
    it('31 → "On"', () => assert.strictEqual(MAPS.STOVE_STATES[31], 'On'));
    it('40 → "Shutting Down"', () => assert.strictEqual(MAPS.STOVE_STATES[40], 'Shutting Down'));
    it('50 → starts with "Error"', () => assert.ok(MAPS.STOVE_STATES[50].startsWith('Error')));

});

describe('FAN_STATES', () => {

    it('0 → "Disabled"', () => assert.strictEqual(MAPS.FAN_STATES[0], 'Disabled'));
    it('1 → "Level 1"', () => assert.strictEqual(MAPS.FAN_STATES[1], 'Level 1'));
    it('6 → "Automatic"', () => assert.strictEqual(MAPS.FAN_STATES[6], 'Automatic'));
    it('has exactly 7 entries (0–6)', () => assert.strictEqual(Object.keys(MAPS.FAN_STATES).length, 7));

});

describe('SEASON_MODES', () => {

    it('0 → "Winter"', () => assert.strictEqual(MAPS.SEASON_MODES[0], 'Winter'));
    it('1 → "Summer"', () => assert.strictEqual(MAPS.SEASON_MODES[1], 'Summer'));

});
