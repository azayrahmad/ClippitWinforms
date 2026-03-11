# MS Agent Logic Comparison: `ms-agent-js` vs. `TripleAgent` (C++)

This document provides a deep dive into the logic differences and architectural divergences between the TypeScript implementation in this repository (`ms-agent-js`) and the C++ implementation found in [TripleAgent](https://github.com/calavera42/TripleAgent).

## 1. Architectural Philosophy

### TripleAgent: Sequential Request Queue
`TripleAgent` follows the original Microsoft Agent COM API design. It treats every action as a "Request" (or "Chore") that enters a sequential queue.
*   **Mechanism:** `std::queue<Chore> _requestQueue`.
*   **Execution:** The `Agent::Loop` processes one request at a time. A `Play` request must complete its animation before a `Speak` request starts.
*   **Parity:** This is a high-fidelity recreation of the original engine's synchronous-looking API.

### ms-agent-js: Queue with Priority Interruption
`ms-agent-js` has been updated to use a priority-based request queue while maintaining its reactive state machine for background idles.
*   **Mechanism:** `private requestQueue: AgentRequest[]`.
*   **Priority Logic:** User-initiated requests (e.g., `play`, `speak`) are enqueued with high priority (100). Background idles from the `StateManager` are enqueued with low priority (0).
*   **Execution:** When a high-priority request arrives, it signals the current low-priority request (if any) to "Exit Gracefully" via its `exitBranch`.
*   **Developer Experience:** Continues to use Promises, allowing developers to `await agent.play(...)` while the engine handles the underlying queue management.

---

## 2. Microsoft Agent "Quirks"

### Null Frames (Duration 0)
In the original MS Agent specification, frames with a duration of 0 are used for logic branching and state transitions without being displayed.
*   **TripleAgent Logic:** It explicitly checks `if (fp->FrameDuration != 0)`. If the duration is 0, it processes branching/exits but **skips the rendering call**. This ensures the character stays frozen on the last visible frame while logic runs.
*   **ms-agent-js Logic:** Implements a "Fast-Forward" update loop. When a frame with duration 0 is encountered, the engine processes its branching logic **instantly** within the same execution tick until it finds a frame with a duration > 0. This matches the original behavior by ensuring logic-only jumps are invisible to the user.

### Speaking Frames
Original characters often used a specific frame loop for speaking.
*   **TripleAgent Logic:** Follows the "speaking frame must be last" rule. It uses jumps to null frames to terminate the speaking sequence cleanly.
*   **ms-agent-js Logic:** Does not strictly enforce the "speaking frame" marker from the `.acd`. Instead, it uses the `Balloon` manager to synchronize text typing with the browser's TTS (Text-to-Speech) API. If a "Speaking" state exists in the character definition, the `StateManager` can be told to play it.

---

## 3. Exit Branches and Interruptions

One of the most complex parts of MS Agent is how an animation stops.
*   **TripleAgent (Conditional Exit):** Uses the `ExitFrameIndex` as part of the `Return` logic. This allows a looping animation (like a character tapping its foot) to know exactly how to "loop out" to the neutral position when it's time to stop.
*   **ms-agent-js (Interruption Logic):** Maps `ExitFrameIndex` to `exitBranch`. When a new animation is requested while one is playing, it sets an `isExiting` flag. The `AnimationManager` then looks for the `exitBranch` on the current frame to find the fastest path back to frame 0 (neutral). This allows for "smooth transitions" rather than hard-cutting between animations.

---

## 4. Balloon Rendering & Interaction

### Procedural vs. Declarative
*   **TripleAgent:** Uses GDI+ to procedurally draw the balloon. It calculates the `GraphicsPath`, adds arcs for corners, and manually draws the "tip" triangle pointing at the agent. This is high-precision but hard to modify.
*   **ms-agent-js:** Uses Shadow DOM and standard CSS. The balloon is a `div` with `border-radius`. The "tip" is a base64-encoded PNG sprite that is repositioned. This is much easier to style and theme using standard web technologies.

### Interactive Features
*   **TripleAgent:** Focuses on the core rendering of speech.
*   **ms-agent-js:** Extends the logic with web-centric interaction. The `ask()` method creates a dynamic HTML form inside the balloon, allowing for user input (text areas/buttons) directly within the agent's speech bubble—a feature that bridges the gap between a 90s aesthetic and modern UI needs.

---

## 5. Data Handling

| Feature | TripleAgent | ms-agent-js |
| :--- | :--- | :--- |
| **File Format** | Binary `.ACS` | Text-based `.ACD` or JSON |
| **Decompression** | Custom LZW/Bit-stream decompression | Relies on browser PNG/WebP decoding |
| **Asset Strategy** | Parses embedded binary data | Prefers optimized Sprite Sheets (Atlas) |

**Conclusion:** `TripleAgent` is an excellent reference for the low-level "how it worked" logic of the original Windows binary. `ms-agent-js` is an interpretation that prioritizes "how it should feel" in a modern browser environment, adopting reactive state management over a strict sequential request queue.
