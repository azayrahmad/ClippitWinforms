# Alignment Plan: ms-agent-js to ClippitWinforms Parity

This document outlines the proposed technical changes to bring the `ms-agent-js` library into closer functional and architectural alignment with the original `ClippitWinforms` C# implementation.

## 1. Robust GUID Parsing
**Goal:** Replace simple string manipulation with a validated parsing approach.

- **Proposed Change:** Integrate the `uuid` library.
- **Implementation:**
    - Use `uuid.validate()` to ensure the GUID in the `.acd` file is well-formed after stripping curly braces.
    - If valid, store the normalized GUID string. If invalid, log a warning or throw a descriptive error during parsing in `CharacterParser.ts`.
- **Benefit:** Catches malformed data early, mirroring the behavior of .NET's `Guid.Parse`.

## 2. Cultural & Language Parity
**Goal:** Transition from raw LCID strings to localized objects using modern Web APIs.

- **Proposed Change:** Use a mapping between Windows LCID (e.g., `0x0409`) and BCP 47 locale identifiers (e.g., `en-US`), combined with the `Intl.Locale` API.
- **Implementation:**
    - Update `CharacterParser.ts` to map the hex LCID to a locale string.
    - Store an `Intl.Locale` object in the `Info` interface instead of a raw string.
    - Update `Agent` logic to use `navigator.language` and `Intl.Locale.prototype.maximize()` for smarter matching of the agent's language to the user's environment.
- **Benefit:** Provides parity with .NET's `CultureInfo` and improves internationalization support.

## 3. Standardized BMP Handling
**Goal:** Replace the custom 8-bit parser with a maintained library capable of handling various BMP formats.

- **Proposed Change:** Integrate `bmp-js` for decoding.
- **Implementation:**
    - Refactor `SpriteManager.ts` to use `bmp-js` for initial decoding of the BMP buffer into a raw RGBA byte array.
    - Retain the custom transparency logic that matches the RGBA values against the `transparencyColor` derived from the `ColorTable` index.
- **Benefit:** Support for more BMP variants (24-bit, 32-bit, compressed) while maintaining the pixel-perfect transparency required for MS Agents.

## 4. Visibility State Transitions
**Goal:** Implement the "Showing" and "Hiding" animation flow for natural agent entrance/exit.

- **Proposed Change:** Update `StateManager.ts` to play specific animations when visibility changes.
- **Implementation:**
    - In `handleVisibilityChange(showing: boolean)`:
        - If `showing`:
            - Set state to `"Showing"`.
            - Play the `"Showing"` animation.
            - Once complete, transition to `IdlingLevel1` and resume the idle loop.
        - If `!showing`:
            - Set state to `"Hiding"`.
            - Play the `"Hiding"` animation.
            - Once complete, set `isPaused = true` and hide the canvas.
- **Benefit:** Achieves visual parity with the C# implementation, where the agent smoothly appears and disappears rather than simply popping in/out of existence.
