# Clippit Agent Logic Documentation

This document provides a high-level overview of the logic and data structures used in the `ClippitWinforms` project, intended to assist in converting the project to a **Vite/TypeScript Library**.

## Overview

The agent is a sprite-based character that can play various animations and transition between states (like idling or playing a specific action). It uses a custom `.acd` (Agent Character Definition) format for its configuration and a set of `.bmp` images for its frames.

## Core Data Structures

The data models are defined in `ClippitWinforms.AgentCore.Models`.

### 1. AgentCharacterDefinition
The root container for all agent data.
- **Character**: General properties like width, height, and transparency.
- **Balloon**: Settings for the speech balloon (ignored for this task).
- **Animations**: A dictionary of `Animation` objects.
- **States**: A dictionary of `State` objects.

### 2. Character
- **Width / Height**: Dimensions of each frame.
- **Transparency**: Index of the color in the color table used for transparency.
- **DefaultFrameDuration**: Default time (in 10ms units) each frame is displayed.
- **ColorTable**: Path to the BMP file containing the palette.

### 3. Animation
- **Name**: Unique identifier.
- **Frames**: A list of `FrameDefinition` objects.

### 4. FrameDefinition
- **Duration**: How long to display this frame (multiplied by 10ms in the manager).
- **Images**: A list of `ImageDefinition` objects (layering is possible).
- **SoundEffect**: Name of the sound file to play.
- **ExitBranch**: (Optional) The frame index to jump to if the animation is interrupted.
- **Branching**: A list of `BranchingDefinition` for probabilistic transitions.

### 5. ImageDefinition
- **Filename**: The `.bmp` file for this layer.
- **OffsetX / OffsetY**: Placement relative to the agent's origin.

### 6. BranchingDefinition
- **BranchTo**: The 1-based index of the target frame.
- **Probability**: Percentage chance (0-100) of taking this branch.

### 7. State
- **Name**: Identifier (e.g., "IdlingLevel1").
- **Animations**: A list of animation names associated with this state.

---

## Key Components

### 1. CharacterParser
Parses the `.acd` file, which is a custom text-based format.
- Sections are delimited by `Define[Section]` and `End[Section]`.
- Properties are typically key-value pairs (`Key = Value`).
- Handles nested structures for Animations, Frames, and Images.

### 2. SpriteManager (`DirectorySpriteManager`)
Handles loading and rendering of the bitmap frames.
- **Transparency**: Uses the `ColorTable` and `Transparency` index from the `.acd` to determine the transparent color.
- **Asset Loading**: Loads `.bmp` files from an `Images` directory.
- **Rendering**: Draws frames to a Graphics object, applying scaling (default is 2x).

### 3. AnimationManager
Controls the playback of animations.
- **Tick-based Update**: `UpdateAnimation()` is called every ~16ms.
- **Frame Timing**: Tracks the time elapsed since the last frame change against the current frame's duration.
- **Branching Logic**:
  - If a frame has `Branching` definitions, it selects the next frame based on probability.
  - If `isExiting` is true, it prioritizes `ExitBranch` if available.
- **Interrupting**: Allows stopping the current animation to start a new one, optionally waiting for an "exit" sequence.

### 4. StateManager
Manages the agent's high-level behavior.
- **Idle Progression**:
  - The agent starts in `IdlingLevel1`.
  - Every 10 seconds (one tick), it checks if it should play a random animation from the current state.
  - After 12 ticks in an idle level, it progresses to the next level (up to `IdlingLevel3`), which may have more "bored" animations.
- **Playing State**: When a specific animation is requested, the state changes to `Playing` until it completes.
- **Visibility Transitions**: Handles "Showing" and "Hiding" animations.

### 5. Agent
The main coordinator that brings all managers together.
- Exposes high-level methods: `PlayAnimation`, `SetState`, `PlayRandomAnimation`.
- Forwards drawing calls to the `AnimationManager`.
- Handles sound playback events triggered by frame changes.

---

## Logic Flow for Conversion (Library Focus)

1.  **Parsing**: Implement a parser for the `.acd` format. As a library, it should ideally fetch the `.acd` file at runtime and parse it, allowing for dynamic loading of different agents.
2.  **Asset Pipeline**:
    - Handle `.bmp` loading in JS (browsers often struggle with indexed bitmaps).
    - Dynamically apply transparency by reading the palette from the color table.
3.  **Encapsulation**:
    - The `Agent` should manage its own `<canvas>` element.
    - Avoid global styles; use specific classes or inline styles for positioning.
4.  **API**: Provide a clean JS/TS API for host pages: `agent.load()`, `agent.play()`, etc.
5.  **Rendering**: Use the HTML5 `<canvas>` API with `image-rendering: pixelated` for that classic look.
6.  **State Machine**: Port the `StateManager` logic, ensuring it can be paused or reset.
