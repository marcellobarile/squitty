/**
 * @fileoverview Centralized constants for the Squitty application.
 * Defines default settings, supported event types, and user-friendly labels.
 */

/**
 * Default configuration for all sound-producing events.
 * Each object contains synthesis parameters and file path (if any).
 * @type {Object<string, Object>}
 * @property {Object} mousedown - Settings for the mouse button press event.
 * @property {Object} mouseup - Settings for the mouse button release event.
 * @property {Object} scroll - Settings for the mouse wheel scroll event.
 * @property {Object} move - Settings for the mouse movement event.
 * @property {Object} pressHold - Settings for the mouse button hold (pulsing) effect.
 */
const DEFAULT_SETTINGS = {
  mousedown: { enabled: true, volume: 0.03, pitchVar: 0.26, cutoff: 1400, resonance: 3.3, attack: 0.006, decay: 0.06, brightness: -15, stereo: 1, file: null },
  mouseup: { enabled: true, volume: 0.03, pitchVar: 0.1, cutoff: 1200, resonance: 1, attack: 0.005, decay: 0.06, brightness: 20, stereo: 1, file: null },
  scroll: { enabled: true, volume: 0.014, pitchVar: 0.24, cutoff: 930, resonance: 10.3, attack: 0.005, decay: 0.02, brightness: -14, stereo: 0.53, friction: 0.03, file: null },
  move: { enabled: true, volume: 0.004, pitchVar: 0.58, cutoff: 420, resonance: 3, attack: 0.008, decay: 0.5, brightness: -20, stereo: 1, friction: 0.16, file: null },
  pressHold: { enabled: true, volume: 0.1, pitchVar: 0, cutoff: 120, resonance: 1.7, attack: 0.1, decay: 0.2, brightness: 20, stereo: 1, delay: 250, file: null }
};

/**
 * Array of supported event type keys used for internal settings mapping.
 * @type {Array<string>}
 */
const EVENT_TYPES = ['mousedown', 'mouseup', 'scroll', 'move', 'pressHold'];

/**
 * Human-readable labels for the event types, used primarily in the UI.
 * @type {Object<string, string>}
 */
const LABELS = {
    mousedown: 'Press',
    mouseup: 'Release',
    scroll: 'Scroll',
    move: 'Movement',
    pressHold: 'Hold'
};

module.exports = {
    DEFAULT_SETTINGS,
    EVENT_TYPES,
    LABELS
};
