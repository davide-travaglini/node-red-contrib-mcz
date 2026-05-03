# node-red-contrib-mcz

[![npm version](https://img.shields.io/npm/v/node-red-contrib-mcz.svg)](https://www.npmjs.com/package/node-red-contrib-mcz)
[![npm downloads](https://img.shields.io/npm/dm/node-red-contrib-mcz.svg)](https://www.npmjs.com/package/node-red-contrib-mcz)
[![Node.js ≥16](https://img.shields.io/badge/node-%3E%3D16-brightgreen.svg)](https://nodejs.org)
[![Node-RED ≥2](https://img.shields.io/badge/node--red-%3E%3D2.0-red.svg)](https://nodered.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

If you'd like to support me, [![Ko-fi](https://img.shields.io/badge/Buy%20me%20a%20coffee-%23FF5E5B?logo=ko-fi&logoColor=white&style=flat)](https://ko-fi.com/davidetravaglini)

A complete Node-RED module for connecting to **legacy MCZ pellet stoves** via the official MCZ Cloud API (Socket.IO `app.mcz.it:9000`) it also works with the local IP address of the stove `192.168.120.1:81` or `[IP_ADDRESS:PORT]`.
This node package allows you to monitor stove metrics (temperatures, fans, alarms) in real-time and send logical execution commands (power on/off, temperature setpoint, etc.).

> **Note**: This is for stoves using the *old* MCZ app (which communicates via Socket.IO). It is **not** designed for the newer MCZ Maestro REST architecture, although many concepts are similar.

> **V1.1**: Second output on `mcz-in` for system events, confirmation output on `mcz-out`, full bilingual UI (**English / Italian**) with translated labels, help panels and command dropdowns, and a complete unit-test suite (109 tests).

---

## Installation

To install, you can run the following command in your Node-RED user directory (typically `~/.node-red`):

```bash
npm install node-red-contrib-mcz
```

Or you can install it via the Palette Manager in the Node-RED UI.

---

## Nodes Overview

The package provides 4 components:
1. **mcz-config**: The hidden configuration node representing a single stove connection. 
2. **mcz-in**: The Read node. Outputs the current stove state.
3. **mcz-out**: The Write node. Accepts inputs to control the stove.
4. **mcz-debug**: A read-only diagnostic node that outputs raw hexadecimal arrays and visualizes internal mappings. Useful for identifying unknown model fields to build custom templates.

### 1. Configuration Node (`mcz-config`)
This behaves like a physical device connection. You must configure **one config node per stove**. The package natively supports **connecting to multiple stoves simultaneously** (e.g. your house and your vacation home); just create multiple config nodes and the underlying engine will multiplex the connections without conflicts.
- **Serial Number (SN)**: The 13-digit serial number of your stove.
- **MAC Address**: The MAC address of the stove Wi-Fi module (without colons, e.g. `4A3FDAA538CD`).
- **Interval**: If $> 0$, the node will automatically request stove metrics every X seconds (Auto-Polling). If set to `0`, Auto-Polling is disabled.
- **Template**: The stove dictionary template. Available options:
  - *Aria*: Air stoves with standard fan.
  - *Aria Comfort Air*: Air stoves with multizone ducted fans.
  - *Idro*: Standard Hydro stoves (puffer/boiler).
  - *Musa Hydro*: Hydro stoves with 3-way valve and internal pump (e.g., Musa, Club, Suite).
  - *Custom*: If selected, a box will appear allowing you to drop in a JSON mapping file to parse the proprietary data string.

### 2. Read Node (`mcz-in`)
Receives telemetry data from the associated `mcz-config` node and pushes it into your flow.

**Output 1 — Telemetry:**
- `msg.topic`: `mcz/SERIAL_NUMBER`
- `msg.payload`: A structured JSON object containing all the parsed metrics (Temperatures, Fan RPM, Potency, Active States).
- `msg.raw`: A raw pipe-separated string received from the cloud (if "Output raw data" is checked).
- On connect with HA Discovery enabled: emits the MQTT Auto-Discovery config payload.

**Output 2 — Events:**
System-level events: `connect`, `disconnect`, `error`, `reconnecting`.
- `msg.topic`: `mcz/SERIAL_NUMBER/event`
- `msg.payload.event`: event type string.

**Home Assistant (MQTT Auto-Discovery):**
By checking the **"HA Discovery"** box in the node settings, `mcz-in` will emit an MQTT Auto-Discovery configuration payload on **Output 1** whenever it connects to the cloud. By routing this output directly to a standard Node-RED **MQTT Out** node (with a blank topic), your MCZ Stove will instantly and automatically pop up as a fully-featured native `Climate` Thermostat inside Home Assistant, requiring zero YAML configuration. Fan mode labels use the human-readable strings from the built-in `FAN_STATES` map (`"Disabled"`, `"Level 1"` … `"Automatic"`).

**Manual Control (Input):**
You can interact with the underlying Socket.IO connection by injecting strings into the `mcz-in` node's `msg.payload`:
- `"connect"`: Connects the Socket.IO client.
- `"disconnect"`: Gracefully disconnects from the cloud.
- `"get"`: Forces an immediate telemetry update. **(Required if `Interval` is set to `0` in your config).**

### 3. Write Node (`mcz-out`)
This node sends commands to the stove. You can configure the command you want to send directly **from the Node's UI** using dropdowns, or you can send dynamic payloads into it.

**Usage (UI Configuration):**
Simply double click the node and select your desired `Command` (e.g. `Power`) and `Value` (e.g. `1` or `ON`) from the dropdowns. If a UI setting is provided, it always overrides incoming messages. 

**Usage (JSON Object):**
Alternatively, if you leave the configuration empty ("From msg.payload"), you can pass a JSON object to `msg.payload` specifying the `command` and its `value`. The module automatically takes care of mathematical conversions (like multiplying temperatures by 2 for the internal MCZ registry).

**Examples:**
```javascript
// Turn Stove ON
msg.payload = { "command": "Power", "value": 1 };

// Turn Stove OFF
msg.payload = { "command": "Power", "value": 0 };

// Set Target Temperature to 21.5°C
msg.payload = { "command": "Temperature", "value": 21.5 };

// Set Fan state to Auto (6)
msg.payload = { "command": "Fan_State", "value": 6 };

// Turn Eco Mode ON
msg.payload = { "command": "Eco_Mode", "value": "ON" };
```

**Supported Commands:**
- `Power` (1/0 or ON/OFF)
- `Temperature` (e.g. 21.5 — auto-multiplied ×2 internally)
- `Boiler_Setpoint` (e.g. 50 — hydro stoves only, ×2 encoding)
- `Power_Level` (1 to 5)
- `Fan_State` (0 to 6 — 0=Disabled, 6=Automatic)
- `DuctedFan1` / `DuctedFan2` (0 to 6)
- `Eco_Mode` (1/0 or ON/OFF)
- `Silent_Mode` (1/0 or ON/OFF)
- `Active_Mode` (1/0 or ON/OFF)
- `Control_Mode` (1/0 or ON/OFF)
- `Chronostat` (1/0 or ON/OFF)
- `Sleep` (minutes as integer)
- `Summer_Mode` (1/0 or ON/OFF)
- `AntiFreeze` (temperature setpoint)
- `Sound_Effects` (1/0 or ON/OFF)
- `Reset_Alarm` (trigger — value ignored)
- `Reset_Active` (trigger — value ignored)

**Output:**
On every successful send, `mcz-out` emits a confirmation message:
- `msg.topic`: `mcz/SERIAL_NUMBER/command`
- `msg.payload`: `{ command, value, raw }` — the command name, value used, and raw Socket.IO string sent.

**Usage (Raw Strings):**
If you know undocumented codes, you can pass a direct pipeline string to `msg.payload`. The `mcz-out` node will forward it directly.
```javascript
// Bypass the dictionary parser completely
msg.payload = "C|WriteParametri|34|1";
```

## Custom Templates & Fields Mapping

MCZ cloud socket communication responds with a long string of HEX values separated by pipes (`C|00|00|05|00|4A|FF|...`).
By default, this package includes internal parsing maps for all four built-in templates (*Aria*, *Aria Comfort Air*, *Idro*, *Musa Hydro*).

If you have a customized stove or want to read undocumented fields, you can select the **Custom** template in the configuration node and supply your own mapping JSON.

### How the Mapping JSON works
A template is a JSON object with an array of `fields`. The package's parser loops through these fields and extracts data by reading the HEX string segment found at `pos` (0-indexed).

```json
{
  "name": "My Custom Stove",
  "fields": [
    { "key": "fan_ambient", "pos": 2, "type": "map", "map": "FAN_STATES", "label": "Ambient Fan" },
    { "key": "temp_fumes", "pos": 5, "type": "temp", "label": "Fumes Temp (°C)" },
    { "key": "my_new_sensor", "pos": 102, "type": "int", "label": "Secret Metric" },
    { "key": "custom_dropdown", "pos": 103, "type": "map", "values": { "0": "Closed", "1": "Half", "2": "Open" } }
  ]
}
```

### Available Parsing Types:
- `int`: Converts HEX directly to an Integer.
- `temp`: Converts HEX to Integer and divides by 2 (`v / 2.0`). Checks for `0xFF/0xFE` (missing probe returning `null`).
- `bool`: Converts hex `0/1` to `false/true`.
- `bool_gte`: True if the HEX value is $\geq$ than a `threshold` config (e.g. used to determine "In Error" states).
- `map`: Extremely powerful. Maps an Integer to a readable string. 
  - Use `"map": "FAN_STATES"` to use one of the built-in system dictionaries.
  - Or define inline mapping using `"values": { "0": "String1", "1": "String2" }` exactly as shown in the example above.
- `range_offset`: Transforms an internal value using ranges (useful for power levels).
- `hours`: Converts an integer to an `HH:MM` time string.
- `clock`: Merges multiple positions to form a readable Date String.

This fully eliminates the need for any internal hardcoding if MCZ updates firmware, you can just tweak your Custom JSON right from the Node-RED panel.

---

## Example Flows

Here are a few quick scenarios to integrate this package (you can copy-paste the JSON code into Node-RED via `Menu -> Import`):

### 1. Simple Polling and Debug
Configure your config node to fetch data every 30s. Connect an **mcz-in** to read the state and an **mcz-debug** node to spot unknown fields if you notice missing data in your specific stove model.

```json
[{"id":"mcz_in_1","type":"mcz-in","name":"My Stove","stoveConfig":"config_1","topic":"","outputRaw":false,"x":200,"y":100,"wires":[["debug_state"],[]]},{"id":"debug_state","type":"debug","name":"State JSON","active":true,"tosidebar":true,"console":false,"complete":"payload","targetType":"msg","x":400,"y":100,"wires":[]},{"id":"mcz_debug_1","type":"mcz-debug","name":"Debug Raw","stoveConfig":"config_1","x":210,"y":160,"wires":[["debug_raw"]]},{"id":"debug_raw","type":"debug","name":"Position Array","active":false,"tosidebar":true,"console":false,"complete":"payload.flat_dec","targetType":"msg","x":410,"y":160,"wires":[]}]
```

### 2. Manual Polling
If you don't want Node-RED pinging the MCZ server 24/7 every 30 seconds, configure the Stove with an **Interval of 0**.
Then, set up an `Inject` node to trigger `"get"` via msg.payload:

```text
[Inject Node: interval every 5 mins] --> [msg.payload = "get"] --> [mcz-in] --> [Debug]
```

### 3. Dashboard Control
Use standard Node-RED dashboard widgets (like numeric inputs or sliders) to control the target temperature and send it to the stove dynamically.

```json
[{"id":"dash_temp","type":"ui_numeric","name":"Target Temp","group":"dash_group","order":1,"format":"{{value}}","min":10,"max":35,"step":0.5,"x":210,"y":300,"wires":[["function_temp"]]},{"id":"function_temp","type":"function","name":"Format Command","func":"msg.payload = {\n    command: \"Temperature\",\n    value: msg.payload\n};\nreturn msg;","outputs":1,"x":410,"y":300,"wires":[["mcz_out_1"]]},{"id":"mcz_out_1","type":"mcz-out","name":"Set Stove","stoveConfig":"config_1","command":"","commandValue":"","x":600,"y":300,"wires":[[]]}]
```

## Testing

The package includes a unit-test suite covering the parser, commands, maps, and template loading:

```bash
npm test
```

Tests use **Mocha** and Node.js built-in `assert`. No physical stove or network connection is required — all tests use synthetic hex strings and known-good inputs.

---

## Contributing
Pull requests to support more proprietary data formats, templates, and newer firmware versions are heavily encouraged! 

---

## Roadmap & Future Developments
Here are some features and ideas planned for future releases (Contributions are welcome!):
- **Local Network Auto-Discovery**: Automatically find stoves connected to the local Wi-Fi to eliminate the need to manually type IP/MAC/SN.
- **Node-RED Dashboard Widgets**: Pre-configured UI nodes that automatically spawn beautiful thermostats and charts purely for MCZ stoves on the Node-RED Dashboard.
- **Native Chronostat Management**: Dedicated nodes to visually manage the stove's internal weekly scheduling (Crono) without relying on external Node-RED inject loops.
- **Maestro Support (REST API)**: Parallel support for the newer generation of MCZ Maestro stoves which use an entirely different local REST/WebSocket interface.
- **Additional Built-in Brands Templates**: Including default maps for MCZ-group subsidiary brands (such as Cadel, Red, Sergio Leoni) which share similar backend architectures.
