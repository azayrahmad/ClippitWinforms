# MSAgentJS

A modern, TypeScript-based implementation of Microsoft Agent, bringing the charm of 90s digital assistants like Clippy to the web.

## Features

- **Shadow DOM Encapsulation:** Zero CSS leakage to your page. The agent and its balloon are isolated.
- **Modern API:** Simple, promise-based API for animations, state transitions, and speech.
- **Internal Loop:** Manages its own `requestAnimationFrame` loop.
- **Asset Normalization:** Robustly handles case-sensitivity and path inconsistencies commonly found in legacy `.acd` files.
- **Procedural Balloons:** Speech balloons are rendered using SVGs for pixel-perfect fidelity with the original Windows look.
- **Optimized Assets:** Supports texture atlases (WebP/PNG) and audio spritesheets (WebM) for fast loading.
- **Draggable:** Built-in support for repositioning agents via mouse or touch.

## Installation

```bash
npm install ms-agent-js
```

## Usage

### Simple Example

```javascript
import { Agent } from 'ms-agent-js';

async function init() {
  // Load the agent 'Clippit' (searches in current directory /agents/Clippit by default)
  const agent = await Agent.load('Clippit');

  // Show the agent (plays the entry 'Showing' animation)
  await agent.show();

  // Make the agent speak
  await agent.speak('Hello! I am your web assistant.');

  // Play a specific animation by name
  await agent.play('Greeting');

  // Move the agent to a specific position
  agent.moveTo(100, 100);
}

init();
```

### Advanced Interactions

```javascript
// Ask the user a question with an input field
const answer = await agent.ask({
  title: 'Search',
  placeholder: 'What are you looking for?'
});

if (answer) {
  await agent.speak(`Searching for "${answer}"...`);
}

// Make the agent look or gesture at a specific point on the screen
window.addEventListener('mousemove', (e) => {
  agent.lookAt(e.clientX, e.clientY);
});

// Configure Text-to-Speech (TTS)
agent.setTTSOptions({
  rate: 1.2,
  pitch: 0.9,
  volume: 0.8
});
```

## Including Agent Assets

MSAgentJS requires agent definition files (.acd or agent.json), images, and sounds.

### Default Asset Structure
By default, the library expects assets at `/agents/<AgentName>/`.

```text
public/
  agents/
    Clippit/
      agent.json      (Optimized definition)
      agent.webp      (Texture atlas)
      agent.webm      (Audio spritesheet)
```

### Custom Base URL
You can specify exactly where to load assets from:

```javascript
const agent = await Agent.load('Clippit', {
  baseUrl: 'https://cdn.example.com/assets/agents/clippy'
});
```

## Configuration Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `container` | `HTMLElement` | `document.body` | The element where the agent's container div will be appended. |
| `baseUrl` | `string` | `/agents/{name}` | The base path to the agent's folder. |
| `scale` | `number` | `1` | Scaling factor for the agent (e.g., 2 for double size). |
| `speed` | `number` | `1` | Multiplier for animation playback speed. |
| `idleIntervalMs` | `number` | `5000` | Delay between checks for idle animations. |
| `useAudio` | `boolean` | `true` | Whether to enable sound effects playback. |
| `fixed` | `boolean` | `true` | Use `fixed` instead of `absolute` positioning. |
| `x`, `y` | `number` | bottom-right | Initial coordinates of the agent. |

## API Reference

### `Agent.load(name, options)`
Static factory method to create and initialize an agent. Asynchronously loads character data and pre-warms caches.

### `agent.show()` / `agent.hide()`
Shows or hides the agent using the character's 'Showing' and 'Hiding' animation sequences. Returns a promise that resolves when the transition finishes.

### `agent.play(animationName, timeoutMs?)`
Plays a specific animation and returns a promise that resolves upon completion.

### `agent.speak(text, options?)`
Displays a message in the speech balloon. Supports `useTTS: true` (default) for system speech.

### `agent.ask(options?)`
Opens a balloon with a title and textarea. Returns a promise that resolves to the user's string input.

### `agent.lookAt(x, y)` / `agent.gestureAt(x, y)`
Automatically picks the correct 4-way or 8-way directional animation to point towards the specified screen coordinates.

### `agent.moveTo(x, y)`
Instantly repositions the agent container.

### `agent.destroy()`
Cancels all loops, stops speech, and removes the agent from the DOM.

## Events

Subscribe to events using `agent.on(eventName, callback)`:

- `click`: Fired when the agent canvas is clicked (but not dragged).
- `animationStart` / `animationEnd`: Fired when a play request starts/finishes.
- `stateChange`: Fired when the high-level behavior state changes.
- `dragstart` / `drag` / `dragend`: Fired during movement interactions.

## License

MIT
