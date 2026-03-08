# Vite/TypeScript Conversion Plan

This document outlines a phased approach to converting the Clippit project from .NET WinForms to a **Vite-powered TypeScript library**. The goal is a reusable component that can be loaded on any HTML page, with a demo page showcasing its capabilities.

## Phase 1: Environment Setup & Asset Pipeline
**Goal:** Establish the project structure for a library and a way to load assets.

### Tasks
- Initialize a Vite project with the `typescript` template.
- Configure Vite for **Library Mode** (building to UMD/ESM).
- Set up a folder structure (e.g., `src/`, `public/agents/`).
- Copy an agent's assets (images and `.acd` file) to the `public` folder.
- **Verification:** Successfully run the Vite dev server and confirm assets are reachable.

## Phase 2: ACD Parser & Data Models
**Goal:** Convert the C# data models to TypeScript interfaces and implement the parser.

### Tasks
- Define TypeScript interfaces for `Character`, `Animation`, `Frame`, `Image`, `State`, etc.
- Implement a `CharacterParser` class in TypeScript that fetches the `.acd` text file and parses it into the defined interfaces.
- **Verification:** A test script successfully parses `Clippit.acd` and logs a valid configuration object.

## Phase 3: Basic Sprite Rendering
**Goal:** Render a single static frame from the agent's image set onto an HTML5 Canvas.

### Tasks
- Create a `SpriteManager` class.
- Implement logic to load `.bmp` files and handle transparency via the color table index.
- Ensure the rendering logic is encapsulated and doesn't rely on global state.
- **Verification:** A single agent frame appears on the screen with the correct transparency and scaling.

## Phase 4: Animation Engine
**Goal:** Implement the core animation engine.

### Tasks
- Create an `AnimationManager` class using `requestAnimationFrame`.
- Handle multi-layer images and frame durations.
- **Verification:** The agent plays a single animation (e.g., "Greeting") in a loop.

## Phase 5: State & Branching Logic
**Goal:** Implement complex animation behavior and the state machine.

### Tasks
- Implement probabilistic branching logic and "Exit Branch" handling.
- Implement the `StateManager` to handle idle progression (Tiers 1, 2, 3) and transitions.
- **Verification:** The agent transitions through idle levels and plays random animations.

## Phase 6: Library API & Packaging
**Goal:** Finalize the public API for the library.

### Tasks
- Implement a top-level `Agent` class that serves as the entry point.
- API should include: `load(acdPath)`, `play(animationName)`, `setState(stateName)`, `moveTo(x, y)`, `hide()`, `show()`.
- Ensure styles are encapsulated (e.g., the canvas element should be managed by the library).
- **Verification:** The library can be imported and initialized in a clean HTML file.

## Phase 7: Demo Page (98.css)
**Goal:** Create a showcase page for the library using a Windows 98 aesthetic.

### Tasks
- Create `index.html` using [98.css](https://jdan.github.io/98.css/).
- Implement UI controls to:
    - Select different agents (if multiple are available).
    - Trigger specific animations from a dropdown.
    - Change agent states.
    - Toggle visibility.
    - Show debug info (current frame, state, etc.) in a classic "Window".
- **Verification:** The demo page allows full interactive testing of the agent library.

---

## Technical Considerations
- **BMP Handling:** Use `bmp-js` or a custom parser to handle indexed bitmaps and extract transparency.
- **Library Mode:** Use Vite's `build.lib` configuration to output a single JS file and a CSS file (if needed).
- **Scaling:** Use `image-rendering: pixelated` to maintain the pixel-art look.
