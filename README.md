# ClippitWinforms

A WinForms resurrection of the classic Office Assistant (Clippit). This project allows you to run and interact with nostalgic desktop assistants using modern .NET 8.

## Overview

ClippitWinforms is designed to replicate the behavior of the original Office Assistants. It supports complex animations, branching paths within animations, sound effects, and speech balloons. The project is built with a focus on modularity, separating the agent logic from the WinForms rendering engine.

## Architecture

The solution is divided into two primary projects:

### 1. ClippitWinforms.AgentCore
A .NET 8 library responsible for the "brains" of the agent. It is designed to be platform-agnostic where possible.
- **Models**: Defines the data structures for characters, animations, frames, and states.
- **CharacterParser**: A robust parser that reads `.acd` (Agent Character Definition) files and transforms them into a structured object model.
- **Services**: Contains logic for parsing and managing agent definitions.

### 2. ClippitWinforms (The Host Application)
The Windows Forms implementation that handles the visual and interactive aspects.
- **CharacterView**: The main transparent window that renders the agent. It uses `UpdateLayeredWindow`-like behavior via `TransparencyKey` to allow the agent to "sit" on the desktop.
- **Agent (Orchestrator)**: Located in `Managers/Agent.cs`, this class ties everything together. It coordinates between the `AnimationManager`, `StateManager`, `IAudioManager`, and `BalloonView`.
- **Managers**:
    - `AnimationManager`: Handles frame sequencing, timing, and supports probabilistic branching (e.g., an animation might have multiple paths).
    - `StateManager`: Manages high-level behaviors (Idling, Greeting, Searching) and decides which animations to play based on the current state.
    - `SpriteManager`: Handles loading and retrieving individual frames from disk.
    - `AudioManager`: Uses `NAudio` to play `.wav` files synchronized with specific animation frames.

## How it Works: Data Flow

1. **Initialization**: The `CharacterView` scans the `Documents/Agents` directory for available agent folders.
2. **Parsing**: The `CharacterParser` reads the `.acd` file, which is a text-based definition of the agent's properties, animations, and states.
3. **State Machine**: The `StateManager` starts in an initial state (usually `Greeting` or `Idling`).
4. **Animation Loop**:
    - The `AnimationManager` picks a frame.
    - If the frame has an associated sound, the `IAudioManager` plays it.
    - The `Agent` triggers a `FrameChanged` event.
    - `CharacterView` invalidates its surface, triggering a repaint.
5. **Branching**: Some frames define "branches" with probabilities. The `AnimationManager` uses these to create varied and non-linear animations.

## Setup & Usage

### Agent Files
The application does not come with agent assets. You must provide them in your local `Documents` folder:

1. Navigate to `%USERPROFILE%\Documents`.
2. Create a folder named `Agents`.
3. Create a subfolder for your agent (e.g., `Clippit`).
4. Inside, place your `.acd` file and two folders: `Images` and `Audio`.

**Folder Structure Example:**
```
Documents/
└── Agents/
    └── Clippit/
        ├── Clippit.acd
        ├── Images/ (e.g., frame1.png, frame2.png...)
        └── Audio/ (e.g., sound1.wav, sound2.wav...)
```

### Building the Project
- Requirements: **.NET 8 SDK** and **Windows**.
- Open `ClippitWinforms.sln` in Visual Studio 2022 or use the CLI:
  ```bash
  dotnet build
  ```

## Developer Notes

### Interacting with the Agent
The `Agent` class provides a high-level API for controlling the character:

```csharp
// Play a specific animation once
await agent.PlayAnimation("Writing");

// Change the agent's current state
await agent.SetState("IdlingLevel2");

// Make the agent speak
agent.SayGreetings();
```

### Legacy Core
The `ClippitWinforms.Core` directory contains an earlier iteration of the engine. It is currently unused and kept for reference purposes only.
