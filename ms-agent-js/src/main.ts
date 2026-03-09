import './style.css';
import { CharacterParser } from './CharacterParser';
import { SpriteManager } from './SpriteManager';
import { AnimationManager } from './AnimationManager';
import { AudioManager } from './AudioManager';

async function initDemo() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px;">
      <h1>MSAgentJS - Phase 4 Demo</h1>
      <p id="status">Loading agent...</p>
      <div id="controls" style="margin-bottom: 10px; display: none;">
        <label for="animation-select">Play Animation: </label>
        <select id="animation-select"></select>
        <button id="play-btn">Play</button>
      </div>
      <div id="canvas-container" style="position: relative;"></div>
      <p style="font-size: 0.8em; color: #666; margin-top: 20px;">
        Note: Click "Play" to start animations. Sound may require user interaction to play.
      </p>
    </div>
  `;

  try {
    const agentRoot = '/agents/Clippit';
    const definition = await CharacterParser.load(`${agentRoot}/CLIPPIT.acd`);

    // Normalized path for web environment
    definition.character.colorTable = 'images/ColorTable.bmp';

    const spriteManager = new SpriteManager(agentRoot, definition);
    await spriteManager.init();

    const audioManager = new AudioManager(agentRoot);
    const animationManager = new AnimationManager(spriteManager, audioManager, definition.animations);

    const statusEl = document.getElementById('status')!;
    const controlsEl = document.getElementById('controls')!;
    const animationSelect = document.getElementById('animation-select') as HTMLSelectElement;
    const playBtn = document.getElementById('play-btn')!;

    // Populate animation dropdown
    const animNames = Object.keys(definition.animations).sort();
    animNames.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      if (name === 'Greeting') option.selected = true;
      animationSelect.appendChild(option);
    });

    controlsEl.style.display = 'block';
    statusEl.textContent = `Agent ${definition.character.infos[0].name} loaded. Select an animation to play.`;

    const container = document.getElementById('canvas-container')!;
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = spriteManager.getSpriteWidth() * scale;
    canvas.height = spriteManager.getSpriteHeight() * scale;
    canvas.style.imageRendering = 'pixelated';
    // Transparent checkered background
    canvas.style.background = 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAACBJREFUGFdjZEADJghG4CH8/z8DE6Y8mI6BBZghGEIHAMYICAn3m09WAAAAAElFTkSuQmCC") repeat';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d')!;

    playBtn.addEventListener('click', async () => {
      const selectedAnim = animationSelect.value;
      statusEl.textContent = `Playing ${selectedAnim}...`;

      // Preload sprites and sounds for this animation
      await animationManager.preloadAnimation(selectedAnim);

      // Play it!
      animationManager.playAnimation(selectedAnim).then(() => {
         statusEl.textContent = `Finished ${selectedAnim}. Looping for demo...`;
         // For demo purposes, we will loop manually if it's not handled by playAnimation
         animationManager.setAnimation(selectedAnim);
      });
    });

    // Animation Loop
    function loop() {
      animationManager.update();

      // Clear and draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      animationManager.draw(ctx, 0, 0);

      requestAnimationFrame(loop);
    }

    // Start with default Idle
    if (definition.animations['Idle1_1']) {
        await animationManager.preloadAnimation('Idle1_1');
        animationManager.setAnimation('Idle1_1');
    }

    loop();

  } catch (error) {
    console.error(error);
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

initDemo();
