/**
 * @fileoverview Audio renderer process.
 * Uses the Web Audio API to synthesize mechanical sounds in real-time.
 * Supports looping movement sounds, pulsing hold effects, and discrete events.
 */

const { ipcRenderer } = require('electron');
const fs = require('fs');

/** @type {AudioContext} The main audio context for synthesis */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

/** @type {Object<string, AudioBuffer>} Cache for loaded audio files */
const bufferCache = {};

/** @type {string|null} Currently loaded file for movement sound */
let currentMoveFile = null;

/**
 * State management for the continuous mouse movement sound.
 * @type {Object}
 */
const moveState = {
    source: null,
    gain: null,
    panner: null,
    filter: null,
    shelf: null,
    timeout: null,
    variation: 0
};

/**
 * State management for the continuous button hold sound.
 * @type {Object}
 */
const holdState = {
    source: null,
    gain: null,
    panner: null,
    filter: null,
    shelf: null,
    lfo: null,
    lfoGain: null
};

/**
 * Retrieves an AudioBuffer for a given file path, using cache if available.
 * Falls back to a synthesized white noise buffer on error.
 * @param {string|null} filePath - Path to the audio file.
 * @returns {Promise<AudioBuffer>}
 */
async function getBuffer(filePath) {
    if (!filePath) return clickBuffer;
    if (bufferCache[filePath]) return bufferCache[filePath];
    try {
        const data = fs.readFileSync(filePath);
        const audioBuffer = await audioCtx.decodeAudioData(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
        bufferCache[filePath] = audioBuffer;
        return audioBuffer;
    } catch (e) {
        console.error('Failed to load sound file', filePath, e);
        return clickBuffer;
    }
}

/**
 * Creates a 1-second buffer of white noise for the default synthesized sound.
 * @returns {AudioBuffer}
 */
function createClickBuffer() {
    const sampleRate = audioCtx.sampleRate;
    const duration = 1.0;
    const buffer = audioCtx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return buffer;
}

/** @type {AudioBuffer} Default white noise buffer */
const clickBuffer = createClickBuffer();

/**
 * Plays a discrete sound event (mousedown, mouseup, scroll).
 * Applies real-time filtering, panning, and volume modulation.
 * @param {string} type - The event type.
 * @param {Object} options - Synthesis and modulation parameters.
 * @returns {Promise<void>}
 */
async function playSound(type, options) {
    if (type === 'move') {
        return playMoveSound(options);
    }
    const { volume, pitchVar, file, cutoff, resonance, attack, decay, brightness, pan, stereo, velocity, friction } = options;

    const v = velocity || 1.0;
    const f = friction !== undefined ? friction : 0;
    const mod = 1 + (v - 1) * f;

    const source = audioCtx.createBufferSource();
    source.buffer = await getBuffer(file);
    const gainNode = audioCtx.createGain();

    const panner = audioCtx.createStereoPanner();
    panner.pan.setValueAtTime((pan || 0) * (stereo !== undefined ? stereo : 1), audioCtx.currentTime);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime((cutoff || 1000) * mod, audioCtx.currentTime);
    filter.Q.setValueAtTime(resonance || 1, audioCtx.currentTime);

    const shelf = audioCtx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.setValueAtTime(3000, audioCtx.currentTime);
    shelf.gain.setValueAtTime(brightness || 0, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);

    const attackTime = attack || 0;
    const decayTime = decay || 0.1;
    const targetVolume = volume * mod;

    if (attackTime > 0) {
        gainNode.gain.linearRampToValueAtTime(targetVolume, audioCtx.currentTime + attackTime);
    } else {
        gainNode.gain.setValueAtTime(targetVolume, audioCtx.currentTime);
    }
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + attackTime + decayTime);

    const variation = (Math.random() * 2 - 1) * pitchVar;
    source.playbackRate.setValueAtTime((1 + variation) * Math.max(0.1, mod), audioCtx.currentTime);

    source.connect(shelf);
    shelf.connect(filter);
    filter.connect(panner);
    panner.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    source.start();
    source.stop(audioCtx.currentTime + attackTime + decayTime + 0.1);
}

/**
 * Manages the looping movement sound with smooth parameter transitions.
 * @param {Object} options - Synthesis parameters including velocity.
 * @returns {Promise<void>}
 */
async function playMoveSound(options) {
    const { volume, pan, stereo, file, cutoff, resonance, brightness, attack, decay, pitchVar, velocity, friction } = options;

    const v = velocity || 1.0;
    const f = friction !== undefined ? friction : 0;
    const mod = 1 + (v - 1) * f;

    if (moveState.source && currentMoveFile !== file) {
        stopMoveSound();
    }

    if (!moveState.source) {
        currentMoveFile = file;
        const buffer = await getBuffer(file);
        moveState.source = audioCtx.createBufferSource();
        moveState.source.buffer = buffer;
        moveState.source.loop = true;

        moveState.gain = audioCtx.createGain();
        moveState.gain.gain.setValueAtTime(0, audioCtx.currentTime);

        moveState.panner = audioCtx.createStereoPanner();
        moveState.filter = audioCtx.createBiquadFilter();
        moveState.shelf = audioCtx.createBiquadFilter();

        moveState.source.connect(moveState.shelf);
        moveState.shelf.connect(moveState.filter);
        moveState.filter.connect(moveState.panner);
        moveState.panner.connect(moveState.gain);
        moveState.gain.connect(audioCtx.destination);

        moveState.variation = (Math.random() * 2 - 1) * (pitchVar || 0);
        moveState.source.playbackRate.setValueAtTime((1 + moveState.variation) * Math.max(0.1, mod), audioCtx.currentTime);

        moveState.source.start();
    }

    const now = audioCtx.currentTime;
    const attackConstant = Math.max(0.001, (attack || 0.05) / 3);
    const decayConstant = Math.max(0.001, (decay || 0.15) / 3);

    moveState.gain.gain.setTargetAtTime(volume * mod, now, attackConstant);
    moveState.panner.pan.setTargetAtTime((pan || 0) * (stereo !== undefined ? stereo : 1), now, 0.05);

    moveState.filter.type = 'lowpass';
    moveState.filter.frequency.setTargetAtTime((cutoff || 1000) * mod, now, 0.05);
    moveState.filter.Q.setTargetAtTime(resonance || 1, now, 0.05);

    moveState.shelf.type = 'highshelf';
    moveState.shelf.frequency.setValueAtTime(3000, now);
    moveState.shelf.gain.setTargetAtTime(brightness || 0, now, 0.05);

    moveState.source.playbackRate.setTargetAtTime((1 + moveState.variation) * Math.max(0.1, mod), now, 0.05);

    if (moveState.timeout) clearTimeout(moveState.timeout);
    moveState.timeout = setTimeout(() => {
        moveState.gain.gain.setTargetAtTime(0, audioCtx.currentTime, decayConstant);
    }, 50);
}

/**
 * Starts the continuous "Hold" sound with a pulsing LFO effect.
 * @param {Object} options - Synthesis parameters.
 * @returns {Promise<void>}
 */
async function startHoldSound(options) {
    const { volume, pan, stereo, file, cutoff, resonance, brightness, attack, pitchVar } = options;

    if (holdState.source) stopHoldSound();

    const now = audioCtx.currentTime;
    const attackTime = attack || 0.1;

    if (file) {
        const buffer = await getBuffer(file);
        holdState.source = audioCtx.createBufferSource();
        holdState.source.buffer = buffer;
        holdState.source.loop = true;
        const variation = (Math.random() * 2 - 1) * (pitchVar || 0);
        holdState.source.playbackRate.setValueAtTime(1 + variation, now);
    } else {
        holdState.source = audioCtx.createOscillator();
        holdState.source.type = 'triangle';
        holdState.source.frequency.setValueAtTime(60, now);
    }

    holdState.gain = audioCtx.createGain();
    holdState.gain.gain.setValueAtTime(0, now);
    holdState.gain.gain.linearRampToValueAtTime(volume, now + attackTime);

    holdState.panner = audioCtx.createStereoPanner();
    holdState.panner.pan.setValueAtTime((pan || 0) * (stereo !== undefined ? stereo : 1), now);

    holdState.filter = audioCtx.createBiquadFilter();
    holdState.filter.type = 'lowpass';
    holdState.filter.frequency.setValueAtTime(cutoff || 400, now);
    holdState.filter.Q.setValueAtTime(resonance || 5, now);

    holdState.shelf = audioCtx.createBiquadFilter();
    holdState.shelf.type = 'highshelf';
    holdState.shelf.frequency.setValueAtTime(3000, now);
    holdState.shelf.gain.setValueAtTime(brightness || 0, now);

    holdState.lfo = audioCtx.createOscillator();
    holdState.lfo.type = 'sine';
    holdState.lfo.frequency.setValueAtTime(1.5, now);

    holdState.lfoGain = audioCtx.createGain();
    holdState.lfoGain.gain.setValueAtTime(cutoff * 0.5 || 200, now);

    holdState.lfo.connect(holdState.lfoGain);
    holdState.lfoGain.connect(holdState.filter.frequency);

    holdState.source.connect(holdState.shelf);
    holdState.shelf.connect(holdState.filter);
    holdState.filter.connect(holdState.panner);
    holdState.panner.connect(holdState.gain);
    holdState.gain.connect(audioCtx.destination);

    holdState.source.start();
    holdState.lfo.start();
}

/**
 * Gracefully stops the "Hold" sound with a short fade-out.
 */
function stopHoldSound() {
    if (holdState.gain) {
        const now = audioCtx.currentTime;
        holdState.gain.gain.cancelScheduledValues(now);
        holdState.gain.gain.setTargetAtTime(0, now, 0.05);

        const sourceToStop = holdState.source;
        const lfoToStop = holdState.lfo;
        const gainToDisconnect = holdState.gain;

        setTimeout(() => {
            try { sourceToStop.stop(); } catch(e) {}
            try { lfoToStop.stop(); } catch(e) {}
            gainToDisconnect.disconnect();
        }, 200);
    }
    holdState.source = null;
    holdState.lfo = null;
    holdState.gain = null;
}

/**
 * Immediately stops the movement sound.
 */
function stopMoveSound() {
    if (moveState.source) {
        try { moveState.source.stop(); } catch(e) {}
        moveState.source.disconnect();
        moveState.source = null;
    }
    if (moveState.timeout) {
        clearTimeout(moveState.timeout);
        moveState.timeout = null;
    }
}

// IPC event listeners for controlling audio playback from the main process
ipcRenderer.on('play-sound', async (event, type, options) => {
    await playSound(type, options);
});

ipcRenderer.on('stop-move-sound', () => {
    stopMoveSound();
});

ipcRenderer.on('start-hold-sound', async (event, options) => {
    await startHoldSound(options);
});

ipcRenderer.on('stop-hold-sound', () => {
    stopHoldSound();
});
