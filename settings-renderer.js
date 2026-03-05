/**
 * @fileoverview Settings renderer process.
 * Dynamically generates the settings UI based on the application configuration
 * and handles real-time updates via IPC.
 */

const { ipcRenderer } = require('electron');
const { EVENT_TYPES, LABELS } = require('./constants');

/** @type {HTMLElement} Container for the settings cards */
const container = document.getElementById('settings-list');

/** @type {Object} Local copy of settings for the UI to manipulate */
let settings = ipcRenderer.sendSync('get-settings');

/**
 * Renders the entire settings UI by iterating through supported event types.
 * Each event type is displayed as a card with various control sliders and inputs.
 */
function render() {
    container.innerHTML = '';
    EVENT_TYPES.forEach(type => {
        const config = settings[type];
        const label = LABELS[type];
        const section = document.createElement('div');
        section.className = 'card section';
        section.innerHTML = `
            <h2>${label}</h2>
            <div class="row">
                <label>Enabled</label>
                <input type="checkbox" ${config.enabled ? 'checked' : ''} data-type="${type}" data-key="enabled">
            </div>
            <div class="row">
                <label title="Precision volume control (3 decimals)">Volume</label>
                <input type="range" min="0" max="1" step="0.001" value="${config.volume}" data-type="${type}" data-key="volume">
                <span id="${type}-volume-val">${config.volume.toFixed(3)}</span>
            </div>
            <div class="row">
                <label>Variation</label>
                <input type="range" min="0" max="1" step="0.01" value="${config.pitchVar}" data-type="${type}" data-key="pitchVar">
                <span id="${type}-pitchVar-val">${config.pitchVar}</span>
            </div>
            <div class="row">
                <label>Cutoff (Hz)</label>
                <input type="range" min="20" max="20000" step="10" value="${config.cutoff}" data-type="${type}" data-key="cutoff">
                <span id="${type}-cutoff-val">${config.cutoff}</span>
            </div>
            <div class="row">
                <label>Brightness</label>
                <input type="range" min="-20" max="20" step="1" value="${config.brightness || 0}" data-type="${type}" data-key="brightness">
                <span id="${type}-brightness-val">${config.brightness || 0}</span>
            </div>
            <div class="row">
                <label>Stereo</label>
                <input type="range" min="0" max="1" step="0.01" value="${config.stereo !== undefined ? config.stereo : 1.0}" data-type="${type}" data-key="stereo">
                <span id="${type}-stereo-val">${config.stereo !== undefined ? config.stereo : 1.0}</span>
            </div>
            <div class="row">
                <label>Resonance</label>
                <input type="range" min="0.1" max="20" step="0.1" value="${config.resonance}" data-type="${type}" data-key="resonance">
                <span id="${type}-resonance-val">${config.resonance}</span>
            </div>
            <div class="row">
                <label>Attack (s)</label>
                <input type="range" min="0" max="0.1" step="0.001" value="${config.attack}" data-type="${type}" data-key="attack">
                <span id="${type}-attack-val">${config.attack.toFixed(3)}</span>
            </div>
            <div id="${type}-decay-row" class="row">
                <label>Decay (s)</label>
                <input type="range" min="0.01" max="0.5" step="0.01" value="${config.decay}" data-type="${type}" data-key="decay">
                <span id="${type}-decay-val">${config.decay}</span>
            </div>
            ${(type === 'scroll' || type === 'move') ? `
            <div class="row">
                <label>Friction</label>
                <input type="range" min="0" max="1" step="0.01" value="${config.friction || 0}" data-type="${type}" data-key="friction">
                <span id="${type}-friction-val">${config.friction || 0}</span>
            </div>
            ` : ''}
            ${type === 'pressHold' ? `
            <div class="row">
                <label>Delay (ms)</label>
                <input type="range" min="0" max="1000" step="10" value="${config.delay || 0}" data-type="${type}" data-key="delay">
                <span id="${type}-delay-val">${config.delay || 0}</span>
            </div>
            ` : ''}
            <div class="row" style="margin-top: 16px;">
                <label>Sound File</label>
                <button class="btn btn-secondary file-btn" data-type="${type}">Choose...</button>
            </div>
            <div style="font-size: 0.8em; margin-left: 100px; color: #666;" id="${type}-file-name">
                ${config.file ? config.file.split('/').pop() : 'Default (Synthesized)'}
            </div>
        `;
        container.appendChild(section);
    });

    // Handle input changes for sliders and checkboxes
    container.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', (e) => {
            const type = e.target.getAttribute('data-type');
            const key = e.target.getAttribute('data-key');
            let value;
            if (e.target.type === 'checkbox') {
                value = e.target.checked;
            } else {
                value = parseFloat(e.target.value);
                const display = document.getElementById(`${type}-${key}-val`);
                if (display) {
                    if (key === 'volume' || key === 'attack') {
                        display.innerText = value.toFixed(3);
                    } else {
                        display.innerText = value;
                    }
                }
            }
            settings[type][key] = value;
            // Send updates to main process immediately for real-time feedback
            ipcRenderer.send('update-settings', settings);
        });
    });

    // Handle file selection buttons
    container.querySelectorAll('.file-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const type = e.target.getAttribute('data-type');
            const filePath = await ipcRenderer.invoke('select-file');
            if (filePath) {
                settings[type].file = filePath;
                document.getElementById(`${type}-file-name`).innerText = filePath.split('/').pop();
                ipcRenderer.send('update-settings', settings);
            }
        });
    });
}

// Handle footer link to open credits window
document.getElementById('open-credits').addEventListener('click', (e) => {
    e.preventDefault();
    ipcRenderer.send('open-credits');
});

// Initial render
render();
