'use strict';

const path = require('path');
const fs   = require('fs');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

const BUILTIN = ['aria', 'idro'];

/**
 * Returns the parsed template object for the given name/payload.
 *
 * @param {string} name            'aria' | 'idro' | 'custom'
 * @param {string} customJson      Used when name === 'custom'; raw JSON string
 * @returns {Object}               Parsed template
 */
function get(name, customJson) {
    if (name === 'custom') {
        if (!customJson) throw new Error('Custom template selected but no JSON provided');
        try {
            return JSON.parse(customJson);
        } catch (e) {
            throw new Error(`Custom template JSON parse error: ${e.message}`);
        }
    }

    const file = path.join(TEMPLATES_DIR, `${name}.json`);
    if (!fs.existsSync(file)) {
        throw new Error(`Template "${name}" not found (expected ${file})`);
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Returns the list of built-in template names.
 */
function list() {
    return [...BUILTIN];
}

module.exports = { get, list };
