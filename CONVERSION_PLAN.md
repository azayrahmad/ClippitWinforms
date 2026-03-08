# Vite/TypeScript Conversion Plan

This document outlines a phased approach to converting the Clippit project from .NET WinForms to a Vite-powered TypeScript application. Each phase is designed to be runnable and testable.

## Phase 1: Environment Setup & Asset Pipeline
**Goal:** Establish the project structure and a way to load assets.

### Tasks
- Initialize a Vite project with the `typescript` template.
- Set up a folder structure (e.g., `src/`, `public/agents/`).
- Copy an agent's assets (images and `.acd` file) to the `public` folder.
- **Verification:** Successfully run the Vite dev server and confirm assets are reachable via URL (e.g., `localhost:5173/agents/Clippit/0001.bmp`).

## Phase 2: ACD Parser & Data Models
**Goal:** Convert the C# data models to TypeScript interfaces and implement the parser.

### Tasks
- Define TypeScript interfaces for `Character`, `Animation`, `Frame`, `Image`, `State`, etc.
- Implement a `CharacterParser` class in TypeScript that fetches the `.acd` text file and parses it into the defined interfaces.
- **Verification:** Write a small script or test to log the parsed object to the console and verify it matches the expected structure of a known agent.

## Phase 3: Basic Sprite Rendering
**Goal:** Render a single static frame from the agent's image set onto an HTML5 Canvas.

### Tasks
- Create a `SpriteManager` class.
- Implement logic to load `.bmp` files. (Note: You may need to convert BMPs to PNGs beforehand or use a library to handle BMPs on canvas).
- Implement transparency handling: read the transparency index from the parsed data and apply it (e.g., by manipulating pixel data on a hidden canvas).
- **Verification:** A single agent frame appears on the screen with the correct transparency and scaling.

## Phase 4: Animation Loop & Frame Timing
**Goal:** Implement the core animation engine.

### Tasks
- Create an `AnimationManager` class.
- Implement a `requestAnimationFrame` loop that updates the current frame based on the duration specified in the `Animation` data.
- Handle multi-layer images (drawing multiple images per frame with offsets).
- **Verification:** The agent plays a single, simple animation (e.g., "Greeting") in a continuous loop.

## Phase 5: Branching & State Management
**Goal:** Implement complex animation behavior and the state machine.

### Tasks
- Implement the probabilistic branching logic (`BranchingDefinition`) in the `AnimationManager`.
- Implement the `StateManager` to handle idle progression (Tiers 1, 2, 3) and transitions between states (Showing, Hiding, Playing).
- Implement the "Exit Branch" logic for interrupting animations gracefully.
- **Verification:** The agent sits on the page, transitions through idle levels over time, and plays random animations as expected.

## Phase 6: Interactive Control & API
**Goal:** Provide a way to interact with the agent programmatically.

### Tasks
- Implement an `Agent` class that exposes a public API (e.g., `agent.playAnimation('Wave')`, `agent.hide()`).
- (Optional) Create a simple UI overlay to trigger different animations and states for testing purposes.
- **Verification:** Manually triggering animations via the console or UI buttons works correctly and doesn't break the state machine.

---

## Technical Considerations
- **BMP Handling:** Browsers may not support all BMP formats natively (especially indexed ones used in `.acd`). Consider a pre-processing step to convert them to PNG or use a library like `bmp-js`.
- **Transparency:** Use a 2D Canvas context. Draw the image, then iterate over pixels to set the alpha channel to 0 for the transparent color index.
- **Scaling:** Use `image-rendering: pixelated` in CSS or `context.imageSmoothingEnabled = false` on the canvas to maintain the retro pixel-art look.
