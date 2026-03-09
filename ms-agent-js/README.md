# MSAgentJS

A modern, TypeScript-based implementation of Microsoft Agent, bringing the charm of 90s digital assistants to the web.

## Features

- **Shadow DOM Encapsulation:** Zero CSS leakage to your page.
- **Modern API:** Simple, promise-based API for animations and state.
- **Internal Loop:** Manages its own `requestAnimationFrame` loop.
- **Asset Normalization:** Handles case-sensitivity and path inconsistencies in `.acd` files.
- **Lightweight:** Built with TypeScript and Vite, no heavy dependencies.

## Installation

```bash
npm install ms-agent-js
```

## Usage

### Simple Example

```javascript
import { Agent } from 'ms-agent-js';

async function init() {
  const agent = await Agent.load('Clippit');

  // Show the agent (plays the 'Showing' animation)
  await agent.show();

  // Play a specific animation
  await agent.play('Greeting');

  // Move the agent
  agent.moveTo(100, 100);
}

init();
```

## Including Agent Assets

MSAgentJS includes agent assets (like Clippit) within the package. To use them, you must ensure these assets are served by your web server.

### Vite

If you use Vite, you can use the `vite-plugin-static-copy` to copy the assets to your public directory:

```javascript
// vite.config.js
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default {
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/ms-agent-js/dist/agents/*',
          dest: 'agents'
        }
      ]
    })
  ]
}
```

Then you can load the agent without a custom `baseUrl`:

```javascript
const agent = await Agent.load('Clippit');
```

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `container` | `HTMLElement` | `document.body` | The element where the agent will be placed. |
| `baseUrl` | `string` | `/agents/{name}` | The base path to the agent assets. |
| `scale` | `number` | `1` | Scaling factor for the agent. |
| `speed` | `number` | `1` | Animation speed multiplier. |
| `useAudio` | `boolean` | `true` | Whether to enable sound effects. |
| `fixed` | `boolean` | `true` | Use `fixed` instead of `absolute` positioning. |
| `x`, `y` | `number` | bottom-right | Initial coordinates of the agent. |

## API Reference

### `Agent.load(name, options)`
Static factory method to create and initialize an agent.

### `agent.play(animationName)`
Plays an animation and returns a promise that resolves when it finishes.

### `agent.show()` / `agent.hide()`
Shows or hides the agent using the built-in 'Showing' and 'Hiding' animations.

### `agent.moveTo(x, y)`
Instantly moves the agent to the specified coordinates.

### `agent.setState(stateName)`
Manually sets the agent's state (e.g., 'IdlingLevel1', 'Searching').

### `agent.on(event, callback)`
Listen for events: `'click'`, `'animationStart'`, `'animationEnd'`, `'stateChange'`, `'show'`, `'hide'`.

### `agent.destroy()`
Cleans up the agent and removes it from the DOM.

## License

MIT
