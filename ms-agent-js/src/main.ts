import './style.css';
import { Agent } from './Agent';

async function initDemo() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
    <div class="window" style="width: 400px; margin: 20px auto;">
      <div class="title-bar">
        <div class="title-bar-text">MSAgentJS Control Panel</div>
        <div class="title-bar-controls">
          <button aria-label="Minimize"></button>
          <button aria-label="Maximize"></button>
          <button aria-label="Close"></button>
        </div>
      </div>
      <div class="window-body">
        <div class="field-row">
          <label for="agent-select">Agent:</label>
          <select id="agent-select">
            <option value="Clippit">Clippit</option>
            <option value="DOT">Dot</option>
            <option value="GENIUS">Genius</option>
            <option value="LOGO">Logo</option>
            <option value="MNATURE">Mother Nature</option>
            <option value="OFFCAT">Office Cat</option>
          </select>
        </div>

        <fieldset>
          <legend>Actions</legend>
          <div class="field-row">
            <label for="animation-select">Animation:</label>
            <select id="animation-select"></select>
          </div>
          <div class="field-row" style="justify-content: flex-end; gap: 4px; margin-top: 4px;">
            <button id="play-btn" disabled>Play</button>
            <button id="random-btn" disabled>Random</button>
          </div>
          <hr />
          <div class="field-row">
            <label for="state-select">State:</label>
            <select id="state-select"></select>
          </div>
          <div class="field-row" style="justify-content: flex-end; gap: 4px; margin-top: 4px;">
            <button id="visibility-btn" disabled>Hide</button>
          </div>
        </fieldset>

        <fieldset>
          <legend>Debug Info</legend>
          <div id="debug-info">
            <div class="field-row">
              <label>State:</label>
              <span id="dash-state">-</span>
            </div>
            <div class="field-row">
              <label>Animation:</label>
              <span id="dash-anim">-</span>
            </div>
            <div class="field-row">
              <label>Frame:</label>
              <span id="dash-frame">-</span>
            </div>
            <div class="field-row">
              <label>Idle Level:</label>
              <span id="dash-level">-</span>
            </div>
            <div class="field-row">
              <label>Next Tick:</label>
              <span id="dash-next-tick">-</span>s
            </div>
          </div>
        </fieldset>

        <p style="font-size: 10px; color: #666; margin-top: 10px;">
            Tip: Click the agent for a surprise!
        </p>
      </div>
    </div>
  `;

  const agentSelect = document.getElementById('agent-select') as HTMLSelectElement;
  const animationSelect = document.getElementById('animation-select') as HTMLSelectElement;
  const stateSelect = document.getElementById('state-select') as HTMLSelectElement;
  const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
  const randomBtn = document.getElementById('random-btn') as HTMLButtonElement;
  const visibilityBtn = document.getElementById('visibility-btn') as HTMLButtonElement;

  const dashState = document.getElementById('dash-state')!;
  const dashAnim = document.getElementById('dash-anim')!;
  const dashFrame = document.getElementById('dash-frame')!;
  const dashLevel = document.getElementById('dash-level')!;
  const dashNextTick = document.getElementById('dash-next-tick')!;

  let currentAgent: Agent | null = null;
  let isVisible = true;

  async function loadAgent(name: string) {
    if (currentAgent) {
      currentAgent.destroy();
      currentAgent = null;
    }

    // Reset UI
    animationSelect.innerHTML = '';
    stateSelect.innerHTML = '';
    playBtn.disabled = true;
    randomBtn.disabled = true;
    visibilityBtn.disabled = true;

    dashState.textContent = 'Loading...';
    dashAnim.textContent = '-';
    dashFrame.textContent = '-';
    dashLevel.textContent = '-';
    dashNextTick.textContent = '-';

    try {
      currentAgent = await Agent.load(name, {
        baseUrl: `/agents/${name}`,
        scale: 2,
        useAudio: true
      });

      // Populate animations
      const animNames = Object.keys(currentAgent.definition.animations).sort();
      animNames.forEach(animName => {
        const option = document.createElement('option');
        option.value = animName;
        option.textContent = animName;
        animationSelect.appendChild(option);
      });

      // Populate states
      const stateNames = Object.keys(currentAgent.definition.states).sort();
      stateNames.forEach(stateName => {
        const option = document.createElement('option');
        option.value = stateName;
        option.textContent = stateName;
        if (stateName === 'IdlingLevel1') option.selected = true;
        stateSelect.appendChild(option);
      });

      isVisible = true;
      visibilityBtn.textContent = 'Hide';

      playBtn.disabled = false;
      randomBtn.disabled = false;
      visibilityBtn.disabled = false;

      // Click to play random animation
      currentAgent.on('click', () => {
          currentAgent?.stateManager.playRandomAnimation();
      });

    } catch (error) {
      console.error('Failed to load agent:', error);
      dashState.textContent = 'Error';
      alert('Failed to load agent. See console for details.');
    }
  }

  agentSelect.addEventListener('change', () => {
    loadAgent(agentSelect.value);
  });

  playBtn.addEventListener('click', () => {
    currentAgent?.play(animationSelect.value);
  });

  randomBtn.addEventListener('click', () => {
    currentAgent?.stateManager.playRandomAnimation();
  });

  stateSelect.addEventListener('change', () => {
    currentAgent?.setState(stateSelect.value);
  });

  visibilityBtn.addEventListener('click', async () => {
    if (!currentAgent) return;

    visibilityBtn.disabled = true;
    isVisible = !isVisible;

    if (isVisible) {
        await currentAgent.show();
        visibilityBtn.textContent = 'Hide';
    } else {
        await currentAgent.hide();
        visibilityBtn.textContent = 'Show';
    }

    visibilityBtn.disabled = false;
  });

  // Update Loop for Debug Info
  function updateDebug() {
    if (currentAgent && currentAgent.stateManager && currentAgent.animationManager) {
      dashState.textContent = currentAgent.stateManager.currentStateName;
      dashAnim.textContent = currentAgent.animationManager.currentAnimationName || '-';
      dashFrame.textContent = currentAgent.animationManager.currentFrameIndexValue.toString();
      dashLevel.textContent = currentAgent.stateManager.idleLevel.toString();
      dashNextTick.textContent = (currentAgent.stateManager.timeUntilNextTick / 1000).toFixed(1);
    }
    requestAnimationFrame(updateDebug);
  }

  // Start
  updateDebug();
  await loadAgent('Clippit');
}

initDemo();
