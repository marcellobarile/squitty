# 🐭 Squitty

**Give your mouse a soul. And some gears.**

Squitty is a lightweight, background-dwelling Electron application that transforms your mundane mouse movements and clicks into a rich, tactile, and slightly sci-fi auditory experience. Imagine if your mouse wasn't just a plastic shell, but a finely tuned mechanical instrument or a miniature spaceship. That's Squitty.

---

## 🚀 Features

Squitty doesn't just play sounds; it *synthesizes* them in real-time to provide haptic-like feedback for your ears.

*   **Mechanical Clicks**: Distinct sounds for `Press` (mousedown) and `Release` (mouseup) to mimic the feel of high-end mechanical switches.
*   **Fluid Movement**: A smooth "faded trail" sound that follows your cursor, making every movement feel substantial.
*   **Kinetic Scrolling**: Auditory feedback for your scroll wheel that responds to how fast you're spinning.
*   **The "Hold" Effect**: A soothing, pulsing sci-fi "wooom wooom" sound that activates when you hold a button down (with a configurable safety delay).
*   **Stereophonic Magic**: Real-time panning! If your mouse is on the left side of the screen, you'll hear it in your left ear. If it's on the right... well, you get it.
*   **Physical Friction**: Sounds modulate based on velocity. Move faster, and the pitch and volume adapt to simulate surface resistance.
*   **Hyper-Configurable**: A dedicated settings panel with enough sliders to make a sound engineer blush.

## 🛠 Tech Specs (For the Nerds)

Squitty is built for performance and low latency:
*   **Global Hooking**: Powered by `uiohook-napi` to listen to mouse events system-wide, even when Squitty is hiding in your tray.
*   **Web Audio API**: Real-time synthesis using Oscillators, Gain nodes, Biquad Filters, and Stereo Panners.
*   **Zero-Throttling Engine**: The audio renderer runs in a dedicated hidden window with background throttling disabled to ensure your clicks are never late to the party.
*   **Resource Efficient**: Minimal CPU/Memory footprint. It’s a mouse sound app, not a crypto miner.

## 🎛 Configuration

You can tweak almost everything for each event type:
*   **Volume**: High-precision (3 decimals!) gain control.
*   **Cutoff & Resonance**: Shape the "warmth" or "sharpness" of the sound using low-pass filters.
*   **Attack & Decay**: Control how "smooshy" or "snappy" your clicks feel.
*   **Brightness**: A high-shelf filter to make things darker or more brilliant.
*   **Stereo Intensity**: Decide how much the sound should follow your cursor across the stereo field.
*   **Friction**: Adjust how much velocity affects the pitch and volume.
*   **Custom Sounds**: Don't like our synthesis? Load your own WAV/MP3/OGG files and Squitty will apply all the filters and panning to them anyway.

## 📦 Installation

1.  Clone this repository:
    ```bash
    git clone https://github.com/marcellobarile/squitty.git
    cd squitty
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Launch the gears:
    ```bash
    npm start
    ```

## 🏗 Building Executables

You can build Squitty for Windows, macOS, and Linux using `electron-builder`.

### For your current platform:
```bash
npm run dist
```

### For all platforms (macOS, Windows, Linux):
```bash
npm run dist:all
```

*Note: Building for all platforms from a single OS might require specific build tools (e.g., `wine` for Windows on macOS, or `docker` for certain Linux targets).*

*Note on macOS: Accessibility Permissions are required for `uiohook-napi` to capture events in the background. When running the built app, make sure to grant these permissions in System Settings > Privacy & Security > Accessibility.*

## 🤝 Contributing

Got a wild idea for a "Laser Beam" mode or a "Vintage Typewriter" preset? Pull requests are welcome!

## 📜 License

This project is licensed under the MIT License.

---

*Squitty: Because your desk is too quiet and your mouse deserves to be heard.*
