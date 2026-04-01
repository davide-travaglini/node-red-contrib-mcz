'use strict';

const assert = require('assert');
const { buildCommandString, COMMANDS } = require('../lib/commands');

describe('buildCommandString — Power (onoff40)', () => {

    it('Power ON (numeric 1)', () => {
        assert.strictEqual(buildCommandString('Power', 1), 'C|WriteParametri|34|1');
    });

    it('Power OFF (numeric 0)', () => {
        assert.strictEqual(buildCommandString('Power', 0), 'C|WriteParametri|34|40');
    });

    it('Power ON (string "ON")', () => {
        assert.strictEqual(buildCommandString('Power', 'ON'), 'C|WriteParametri|34|1');
    });

    it('Power OFF (string "OFF")', () => {
        assert.strictEqual(buildCommandString('Power', 'OFF'), 'C|WriteParametri|34|40');
    });

    it('Power ON (boolean true)', () => {
        assert.strictEqual(buildCommandString('Power', true), 'C|WriteParametri|34|1');
    });

});

describe('buildCommandString — Temperature (×2 encoding)', () => {

    it('21.5°C → raw value 43', () => {
        assert.strictEqual(buildCommandString('Temperature', 21.5), 'C|WriteParametri|42|43');
    });

    it('10°C → raw value 20', () => {
        assert.strictEqual(buildCommandString('Temperature', 10), 'C|WriteParametri|42|20');
    });

    it('35°C → raw value 70', () => {
        assert.strictEqual(buildCommandString('Temperature', 35), 'C|WriteParametri|42|70');
    });

});

describe('buildCommandString — onoff commands', () => {

    it('Eco_Mode ON', () => {
        assert.strictEqual(buildCommandString('Eco_Mode', 'ON'), 'C|WriteParametri|41|1');
    });

    it('Eco_Mode OFF', () => {
        assert.strictEqual(buildCommandString('Eco_Mode', 'OFF'), 'C|WriteParametri|41|0');
    });

    it('Silent_Mode ON', () => {
        assert.strictEqual(buildCommandString('Silent_Mode', 1), 'C|WriteParametri|45|1');
    });

    it('Summer_Mode OFF', () => {
        assert.strictEqual(buildCommandString('Summer_Mode', 0), 'C|WriteParametri|58|0');
    });

});

describe('buildCommandString — int commands', () => {

    it('Fan_State 3', () => {
        assert.strictEqual(buildCommandString('Fan_State', 3), 'C|WriteParametri|37|3');
    });

    it('Power_Level 5', () => {
        assert.strictEqual(buildCommandString('Power_Level', 5), 'C|WriteParametri|36|5');
    });

    it('DuctedFan1 6', () => {
        assert.strictEqual(buildCommandString('DuctedFan1', 6), 'C|WriteParametri|38|6');
    });

    it('Sleep (minutes)', () => {
        assert.strictEqual(buildCommandString('Sleep', 30), 'C|WriteParametri|57|30');
    });

});

describe('buildCommandString — fixed commands', () => {

    it('Reset_Alarm always sends 255', () => {
        assert.strictEqual(buildCommandString('Reset_Alarm', 0), 'C|WriteParametri|1|255');
    });

    it('Reset_Active always sends 255', () => {
        assert.strictEqual(buildCommandString('Reset_Active', 99), 'C|WriteParametri|2|255');
    });

});

describe('buildCommandString — diagnostic commands', () => {

    it('Diagnostics ON → Diagnostica prefix', () => {
        assert.strictEqual(buildCommandString('Diagnostics', 'ON'), 'C|Diagnostica|100|1');
    });

    it('Pump_PWM 75% → clamped', () => {
        assert.strictEqual(buildCommandString('Pump_PWM', 75), 'C|Diagnostica|8|75');
    });

    it('Pump_PWM 110% → clamped to 100', () => {
        assert.strictEqual(buildCommandString('Pump_PWM', 110), 'C|Diagnostica|8|100');
    });

    it('Ignitor ON', () => {
        assert.strictEqual(buildCommandString('Ignitor', 1), 'C|Diagnostica|4|1');
    });

});

describe('buildCommandString — error cases', () => {

    it('unknown command returns null', () => {
        assert.strictEqual(buildCommandString('UnknownCommand', 1), null);
    });

    it('non-numeric string value returns null', () => {
        assert.strictEqual(buildCommandString('Temperature', 'invalid'), null);
    });

});

describe('COMMANDS table', () => {

    const expected = [
        'Power', 'Temperature', 'Boiler_Setpoint', 'Power_Level',
        'Fan_State', 'DuctedFan1', 'DuctedFan2', 'Eco_Mode',
        'Silent_Mode', 'Active_Mode', 'Control_Mode', 'Chronostat',
        'Sleep', 'Summer_Mode', 'AntiFreeze', 'Sound_Effects',
        'Reset_Alarm', 'Reset_Active'
    ];

    for (const name of expected) {
        it(`${name} is defined`, () => {
            assert.ok(COMMANDS[name], `Missing command: ${name}`);
        });
    }

});
