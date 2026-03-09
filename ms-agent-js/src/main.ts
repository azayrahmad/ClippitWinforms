import './style.css';
import { CharacterParser } from './CharacterParser';
import { SpriteManager } from './SpriteManager';

async function initDemo() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
    <div>
      <h1>MSAgentJS - Phase 3 Demo</h1>
      <p id="status">Loading agent...</p>
      <div id="canvas-container"></div>
    </div>
  `;

  try {
    const agentRoot = '/agents/Clippit';
    const definition = await CharacterParser.load(`${agentRoot}/CLIPPIT.acd`);

    // The color table path from ACD might need adjustment based on where it's actually located
    // In this case, it's in the images/ subfolder
    definition.character.colorTable = 'images/ColorTable.bmp';

    const spriteManager = new SpriteManager(agentRoot, definition);
    await spriteManager.init();

    // Pick a frame to display (e.g., first frame of GestureLeft)
    const animation = definition.animations['GestureLeft'];
    if (!animation) throw new Error('Animation GestureLeft not found');
    const frame = animation.frames[0];

    // Load necessary sprites for this frame
    for (const img of frame.images) {
      await spriteManager.loadSprite(img.filename);
    }

    const container = document.getElementById('canvas-container')!;
    container.innerHTML = '';

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = spriteManager.getSpriteWidth() * scale;
    canvas.height = spriteManager.getSpriteHeight() * scale;
    canvas.style.imageRendering = 'pixelated';
    canvas.style.border = '1px solid #ccc';
    canvas.style.background = 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAACBJREFUGFdjZEADJghG4CH8/z8DE6Y8mI6BBZghGEIHAMYICAn3m09WAAAAAElFTkSuQmCC") repeat'; // Checkered background to see transparency

    container.appendChild(canvas);

    const ctx = canvas.getContext('2d')!;
    spriteManager.drawFrame(ctx, frame, 0, 0, scale);

    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = `Rendered frame from animation: ${animation.name}`;
    }
  } catch (error) {
    console.error(error);
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

initDemo();
