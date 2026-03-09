# Logic Differences: ms-agent-js vs ClippitWinforms

This document lists the logic differences between the TypeScript implementation (`ms-agent-js`) and the original C# code (`ClippitWinforms`), excluding the speech balloon and JSON-based parsing.

## 1. ACD Parsing (`CharacterParser`)

*   **Path Normalization:**
    *   **TS:** Automatically converts backslashes (`\`) to forward slashes (`/`) for web compatibility during parsing.
    *   **CS:** Preserves original backslashes; path handling is left to the Windows filesystem.
*   **GUID Parsing:**
    *   **TS:** Performs a simple string replacement to remove curly braces.
    *   **CS:** Uses the `Guid.Parse` method, which includes format validation.
*   **Language & Culture:**
    *   **TS:** Stores the language code as a hex string (e.g., `"0x0409"`).
    *   **CS:** Converts the hex code into a `CultureInfo` object.
*   **ExtraData (Greetings/Reminders):**
    *   **TS:** Filters out empty strings when splitting by `~~`.
    *   **CS:** Includes empty strings if they appear between delimiters.
*   **Branching Validation:**
    *   **TS:** Validates that both `branchTo` and `probability` are defined (non-undefined).
    *   **CS:** Specifically validates that they are greater than 0.
*   **Color Parsing:**
    *   **CS:** Immediately parses hex strings into `System.Drawing.Color` objects (A, R, G, B order).
    *   **TS:** Stores colors as raw hex strings; they are interpreted later by the rendering or UI layer.

## 2. Animation Engine (`AnimationManager`)

*   **Timing Mechanism:**
    *   **TS:** Uses `requestAnimationFrame` and `performance.now()` for a smooth, high-precision web-native loop.
    *   **CS:** Relies on a `System.Windows.Forms.Timer` with a fixed interval (16ms).
*   **Interruption Optimization:**
    *   **TS:** **Optimization:** If an "Idle" animation is interrupted (e.g., by a user click), it skips the "Exit Branch" logic to provide immediate feedback.
    *   **CS:** Always attempts to play the "Exit Branch" if the exit flag is set, regardless of the animation type.
*   **Interruption Implementation:**
    *   **TS:** `interruptAndPlayAnimation` returns a promise that awaits the completion of the *current* animation's exit branch before starting the next one.
    *   **CS:** Uses `TaskCompletionSource` and a `queuedAnimation` variable to handle hand-offs.
*   **Sound Triggering:**
    *   **TS:** The `AnimationManager` is responsible for checking the frame for `soundEffect` and calling the `AudioManager` during its `update` loop.
    *   **CS:** The `Agent` class listens to the `FrameChanged` event and triggers the sound.

## 3. State Management (`StateManager`)

*   **Tick Management:**
    *   **TS:** Tracks elapsed time manually within its `update(deltaTime)` method, allowing it to be driven by the main requestAnimationFrame loop.
    *   **CS:** Uses a dedicated `System.Windows.Forms.Timer` (`stateTimer`) running at a 10-second interval.
*   **Visibility Logic:**
    *   **TS:** Uses a `isPaused` flag to stop logic updates and triggers the `isExitingFlag` on the animation manager.
    *   **CS:** Stops/Starts timers and immediately forces a state transition to "Showing" or "Hiding".
*   **Asset Preloading:**
    *   **TS:** The `playAnimation` method explicitly calls `preloadAnimation` before starting playback to ensure frames and sounds are cached.
    *   **CS:** Does not implement preloading; assets are loaded from disk on demand or during initialization.
*   **Idle Progression Configuration:**
    *   **TS:** Intervals and tick thresholds are configurable via the constructor.
    *   **CS:** These are hardcoded as constants within the class.

## 4. Sprite Rendering (`SpriteManager`)

*   **Asset Loading Strategy:**
    *   **TS:** Loads BMPs asynchronously on demand (lazy loading) and caches them.
    *   **CS:** Scans the `Images` directory and loads all `.bmp` files into memory during initialization.
*   **Transparency Handling:**
    *   **TS:** Uses a custom BMP parser to manually iterate over pixels and set the alpha channel to 0 for the transparent color index.
    *   **CS:** Uses GDI+ `ImageAttributes.SetColorKey` to define transparency during the drawing operation.
*   **Scaling:**
    *   **TS:** Applies `image-rendering: pixelated` via CSS to the canvas for crisp upscaling.
    *   **CS:** Sets `InterpolationMode.NearestNeighbor` on the GDI+ `Graphics` object.
*   **BMP Format Support:**
    *   **TS:** Implementation is specialized and restricted to 8-bit indexed BMP files.
    *   **CS:** Supports any BMP format handled by the .NET `Bitmap` class.
