'use strict';

// ── Lookup tables shared across templates ──────────────────────────────────────
// Templates reference these by name (e.g. "map": "STATI_STUFA").
// Custom templates can also embed inline maps via "values": { "0": "...", ... }.

const STOVE_STATES = {
    0: 'Off',
    1: 'Cold/Hot Control',
    2: 'Cold Cleaning',
    3: 'Cold Pellet Load',
    4: 'Cold Ignition 1',
    5: 'Cold Ignition 2',
    6: 'Hot Cleaning',
    7: 'Hot Pellet Load',
    8: 'Hot Ignition 1',
    9: 'Hot Ignition 2',
    10: 'Stabilization',
    11: 'Power 1',
    12: 'Power 2',
    13: 'Power 3',
    14: 'Power 4',
    15: 'Power 5',
    30: 'Diagnostics',
    31: 'On',
    40: 'Shutting Down',
    41: 'Cooling',
    42: 'Low Pressure Cleaning',
    43: 'High Pressure Cleaning',
    44: 'Worm Wheel Unblocking',
    45: 'Auto Eco',
    46: 'Standby',
    48: 'Diagnostics',
    49: 'Worm Wheel Loading',
    50: 'Error A01 - Ignition Failed',
    51: 'Error A02 - No Flame',
    52: 'Error A03 - Tank Overheating',
    53: 'Error A04 - Fumes Temperature Too High',
    54: 'Error A05 - Duct Obstruction / Wind',
    55: 'Error A06 - Insufficient Draft',
    56: 'Error A09 - Fumes Probe Fault',
    57: 'Error A11 - Gearmotor Fault',
    58: 'Error A13 - Motherboard Temperature Too High',
    59: 'Error A14 - Active Defect',
    60: 'Error A18 - Water Temperature Too High',
    61: 'Error A19 - Water Temperature Probe Fault',
    62: 'Error A20 - Auxiliary Probe Fault',
    63: 'Error A21 - Pressure Switch Alarm',
    64: 'Error A22 - Ambient Probe Fault',
    65: 'Error A23 - Brazier Closing Fault',
    66: 'Error A12 - Gearmotor Controller Fault',
    67: 'Error A17 - Worm Wheel Jammed',
    69: 'Waiting for safety alarms',
};

const FAN_STATES = {
    0: 'Disabled',
    1: 'Level 1',
    2: 'Level 2',
    3: 'Level 3',
    4: 'Level 4',
    5: 'Level 5',
    6: 'Automatic',
};

const PROFILES = {
    // Base profiles (selected, not necessarily in active mode)
    0: 'Manual',
    1: 'Dynamic',
    2: 'Overnight',
    3: 'Comfort',
    4: 'Power 110%',
    // +10 offset variants — same profiles with Active Mode engaged
    // Confirmed from real data: pos 18 = 0x0d = 13 → "Comfort (Active)" (user-verified)
    10: 'Manual (Active)',
    11: 'Dynamic (Active)',
    12: 'Overnight (Active)',
    13: 'Comfort (Active)',
    14: 'Power 110% (Active)',
};

const BRAZIER_STATES = {
    0: 'OK',
    100: 'Closing',
    101: 'Opening',
};

const PELLET_LEVELS = {
    0: 'Probe Not Active',
    10: 'Sufficient Level',
    11: 'Almost Empty',
};

const IGNITOR_STATES = {
    0: 'OK',
    1: 'Worn Out',
};

const REGULATION_MODES = {
    0: 'Manual',
    1: 'Dynamic',
};

const SEASON_MODES = {
    0: 'Winter',
    1: 'Summer',
};

const THREE_WAY_VALVE = {
    0: 'Heating',   // Risc (default – heat the rooms)
    1: 'Sanitary',  // Sani (domestic hot water priority)
};

module.exports = {
    STOVE_STATES,
    FAN_STATES,
    PROFILES,
    BRAZIER_STATES,
    PELLET_LEVELS,
    IGNITOR_STATES,
    REGULATION_MODES,
    SEASON_MODES,
    THREE_WAY_VALVE,
};
