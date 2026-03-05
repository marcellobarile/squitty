/**
 * @fileoverview Utility functions for the Squitty application.
 * Handles spatial audio calculations and settings persistence.
 */

const { screen, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { DEFAULT_SETTINGS } = require('./constants');

/**
 * Calculates the stereo pan value based on the mouse X coordinate.
 * Normalizes the screen position to a range between -1.0 (left) and 1.0 (right).
 * @param {number} x - The horizontal coordinate of the mouse.
 * @returns {number} The calculated pan value (-1 to 1). Returns 0 on error.
 */
function calculatePan(x) {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const width = primaryDisplay.size.width;
    let p = (x / width) * 2 - 1;
    return Math.max(-1, Math.min(1, p));
  } catch (e) {
    return 0;
  }
}

/**
 * Gets the absolute path to the settings JSON file in the user data directory.
 * @returns {string} The full path to the settings file.
 */
function getSettingsPath() {
    return path.join(app.getPath('userData'), 'squitty-settings.json');
}

/**
 * Loads the application settings from the disk.
 * Handles migration from older versions and merges loaded values with defaults.
 * @returns {Object} The complete settings object.
 */
function loadSettings() {
  const settingsPath = getSettingsPath();
  let settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  console.log('Settings path:', settingsPath);
  if (fs.existsSync(settingsPath)) {
    try {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      const loaded = JSON.parse(data);
      // Migration: click -> mousedown
      if (loaded.click && !loaded.mousedown) {
        loaded.mousedown = loaded.click;
        delete loaded.click;
      }
      // Merge with defaults to handle new fields
      for (const type in settings) {
        if (loaded[type]) {
          settings[type] = { ...settings[type], ...loaded[type] };
        }
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  }
  return settings;
}

/**
 * Saves the current settings to disk synchronously.
 * @param {Object} settings - The settings object to persist.
 */
function saveSettingsSync(settings) {
    try {
      fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
}

module.exports = {
    calculatePan,
    loadSettings,
    saveSettingsSync
};
