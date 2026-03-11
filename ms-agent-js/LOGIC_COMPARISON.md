# ms-agent-js vs TripleAgent: Logic Comparison

This document provides a detailed architectural and logical comparison between `ms-agent-js` (TypeScript) and [TripleAgent](https://github.com/calavera42/TripleAgent) (C++), with a specific focus on the animation branching and frame processing systems.

## 1. High-Level Architecture

| Feature | ms-agent-js | TripleAgent |
|---------|-------------|-------------|
| **Core Pattern** | Promise-based with Interruption Flags | Sequential Request Queue (Chores) + FSM |
| **Request Storage** | No formal queue; uses `async/await` and interruption logic. | `std::queue<Chore>` for pending; `std::stack<Request>` for active. |
| **State Tracking** | `isExiting` flag on `AnimationManager`. | `RequestStage` enum: `Running`, `Stopping`, `Waiting`. |
| **Interruption** | High-priority calls (e.g., `play`) signal the current animation to interrupt by setting `isExiting = true`. | Uses `Agent::ServeRequest` and a stack-based approach to handle nested or interrupted logic. |

## 2. Animation Branching Logic

Both systems implement the Microsoft Agent specification for probabilistic branching, but they differ in index handling and mathematical thresholds:

### Randomization & Thresholds
- **ms-agent-js**: Uses `Math.random() * 100` (returns 0 to <100). Branching check: `randomValue < cumulative`.
- **TripleAgent**: Uses `(rand() % 100) + 1` (returns 1 to 100). Branching check: `selection <= count`.

### Frame Index Management
- **ms-agent-js**: Assumes 1-based indices in the Character Definition (ACD) and converts to 0-based for internal processing (`branchTo - 1`).
- **TripleAgent**: Directly uses the index provided by the `DataProvider` (ACS), which is mapped to the internal `AnimationInfo.Frames` vector.

### Default Progression
- **ms-agent-js**: Loops back to the first frame (`(current + 1) % length`) if no branches are taken.
- **TripleAgent**: Increments the index (`_currentFrame++`). If it reaches the end of the frame array, the request terminates (`REQUEST_DONE`).

## 3. Exit Branching (Interruption Logic)

How the systems navigate towards a "Neutral" state when stopped or interrupted:

### ms-agent-js
- When `isExiting` is active, `getNextFrameIndex` prioritizes the `exitBranch` property.
- If no `exitBranch` is defined for a frame, it falls back to sequential progression.
- **Completion Condition**: The animation terminates when the calculated next frame index is `0`.

### TripleAgent
- Implements a dedicated `Return()` method for animations in the `Stopping` stage.
- Uses `ExitFrameIndex` with special markers:
  - `-1`: Move to the next sequential frame.
  - `-2`: Immediate completion (jumps to the end).
  - `Index >= 0`: Jump to a specific exit target.
- **Completion Condition**: Returns `REQUEST_DONE` to the agent loop.

## 4. Null Frame (Duration 0) Processing

"Null frames" are logic frames used for triggers or branching without rendering.

### ms-agent-js
- **Fast-Forward**: Processes sequential null frames in a single tick using a `while` loop in `AnimationManager.update`.
- **Safety**: Implements `MAX_NULL_FRAMES = 100` to prevent infinite loops from circular branching.
- **Rendering**: Uses a `lastRenderedFrame` buffer. The `currentFrame` getter skips null frames and returns this buffer instead.

### TripleAgent
- **Fast-Forward**: Returns `fp->FrameDuration` (which is `0`) from `Update()`. The `Agent::Loop` immediately proceeds to the next iteration, effectively fast-forwarding in the next "tick" of the hardware clock.
- **Rendering**: Checks `FrameDuration != 0` before emitting an `AgentFrameChange` event.
- **Persistence**: Maintains `_lastValidFrame` to ensure the agent remains visible during logic frames.

## 5. Implementation Quirks

### The "Speaking Frame" Problem
Microsoft Agent animations often place the mouth-open frame last. To keep the mouth open while waiting for the next word or ending the animation, characters jump from a mouth-open frame to a null frame.

- **TripleAgent**: Explicitly tracks `_lastValidFrame`. When an animation terminates at a null frame, it reverts the rendered state to `_lastValidFrame` to prevent the agent from disappearing.
- **ms-agent-js**: Addresses this by persisting `lastRenderedFrame` in the `AnimationManager`. It also decouples mouth movement from the core animation loop by synchronizing with the `SpeechSynthesis` API's word/sentence boundaries.

### Movement & Position
- **TripleAgent**: Works under the theory that movement animations play their sequence, then use a null frame jump to trigger the actual coordinate change on the window.
- **ms-agent-js**: Coordinates movement via `Agent.moveTo`, which handles the interpolation and animation state (`Moving`) at the higher `Agent` level rather than inside the frame-level FSM.

## 6. Platform & Rendering

| Feature | ms-agent-js | TripleAgent |
|---------|-------------|-------------|
| **Language** | TypeScript / JavaScript | C++ / C |
| **Rendering** | HTML5 Canvas | GDI+ / Platform-specific windows |
| **Asset Format** | BMP/PNG Sprite Sheets + JSON/ACD | .ACS (Binary Agent Character Specification) |
| **Audio** | Web Audio API / .wav / .mp3 | .wav (Windows API) |
| **Speech** | SpeechSynthesis API (TTS) | Planned TTS integration |

## 7. Summary of Alignment Goals

To align `ms-agent-js` closer to the intended design and quality of TripleAgent, the following logic updates are planned:
1. **Instant Null-Frame Processing**: (Completed) `AnimationManager.update` now loops through frames with duration 0 instantly within a single tick.
2. **Priority-based Queuing**: While staying Promise-based, ensure that "interruption" strictly follows the "exit branch to neutral" pattern before starting new high-priority chores.
