'use strict';

// ── Tabella comandi (da reverse engineering Chibald/maestrogateway) ───────────
// Formato stringa WebSocket:  C|WriteParametri|<ID>|<valore>
// Eccezioni:
//   Power (accensione): onoff40 → ON=1, OFF=40   →  C|WriteParametri|34|1 o 34|40
//   Temperature: valore * 2                       →  C|WriteParametri|42|43  (21.5°C)
//   Diagnostica:                                  →  C|Diagnostica|<ID>|<valore>

const COMMANDS = {
    "Power":            { id: 34,   type: "onoff40" },
    "Temperature":      { id: 42,   type: "temperature" },
    "Boiler_Setpoint":  { id: 51,   type: "temperature" },
    "Power_Level":      { id: 36,   type: "int" },
    "Fan_State":        { id: 37,   type: "int" },
    "DuctedFan1":       { id: 38,   type: "int" },
    "DuctedFan2":       { id: 39,   type: "int" },
    "Eco_Mode":         { id: 41,   type: "onoff" },
    "Silent_Mode":      { id: 45,   type: "onoff" },
    "Active_Mode":      { id: 35,   type: "onoff" },
    "Control_Mode":     { id: 40,   type: "onoff" },
    "Chronostat":       { id: 1111, type: "onoff" },
    "Sleep":            { id: 57,   type: "int" },
    "Summer_Mode":      { id: 58,   type: "onoff" },
    "AntiFreeze":       { id: 154,  type: "int" },
    "Sound_Effects":    { id: 50,   type: "onoff" },
    "Reset_Alarm":      { id: 1,    type: "fixed:255" },
    "Reset_Active":     { id: 2,    type: "fixed:255" },
    "Diagnostics":      { id: 100,  type: "diag:onoff" },
    "RPM_Fam_Fume":     { id: 1,    type: "diag:int" },
    "RPM_WormWheel":    { id: 2,    type: "diag:int" },
    "Ignitor":          { id: 4,    type: "diag:onoff" },
    "Pump_PWM":         { id: 8,    type: "diag:percent" },
    "3wayvalve":        { id: 9,    type: "diag:onoff" }
};

/**
 * Parses an incoming logical command and returns the raw string for the cloud.
 * 
 * @param {string} name - e.g. "Power", "Temperature"
 * @param {string|number|boolean} rawValue - e.g. 1, "ON", true, 21.5
 * @returns {string|null} The formatted raw string, or null if invalid
 */
function buildCommandString(name, rawValue) {
    if (!COMMANDS.hasOwnProperty(name)) return null;

    const cmd = COMMANDS[name];
    let v_num = 0;

    // Normalize text ON/OFF to 1/0
    const strVal = String(rawValue).toUpperCase();
    if (["ON", "1", "TRUE"].includes(strVal)) {
        v_num = 1;
    } else if (["OFF", "0", "FALSE"].includes(strVal)) {
        v_num = 0;
    } else {
        v_num = parseFloat(rawValue);
        if (isNaN(v_num)) return null;
    }

    let write_val = 0;
    let base_cmd = "WriteParametri";
    let id_ = cmd.id;

    if (cmd.type === "temperature") {
        write_val = Math.round(v_num * 2);
    } else if (cmd.type === "onoff40") {
        write_val = v_num === 1 ? 1 : 40;
    } else if (cmd.type === "onoff") {
        write_val = v_num === 1 ? 1 : 0;
    } else if (cmd.type === "int") {
        write_val = Math.round(v_num);
    } else if (cmd.type.startsWith("fixed:")) {
        write_val = parseInt(cmd.type.split(":")[1], 10);
    } else if (cmd.type.startsWith("diag:")) {
        base_cmd = "Diagnostica";
        const sub = cmd.type.split(":")[1];
        if (sub === "onoff") {
            write_val = v_num === 1 ? 1 : 0;
        } else if (sub === "percent") {
            write_val = Math.max(0, Math.min(100, Math.round(v_num)));
        } else {
            write_val = Math.round(v_num);
        }
    } else {
        write_val = Math.round(v_num);
    }

    return `C|${base_cmd}|${id_}|${write_val}`;
}

module.exports = {
    COMMANDS,
    buildCommandString
};
