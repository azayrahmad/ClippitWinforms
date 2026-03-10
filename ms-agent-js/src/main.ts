import './style.css';
import { Agent } from './Agent';

async function initDemo() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px;">
      <h1>MSAgentJS - Optimized Agent Demo</h1>

      <div id="dashboard" style="background: #f0f0f0; border: 1px solid #ccc; padding: 10px; margin-bottom: 20px; font-family: monospace;">
        <strong>Agent Dashboard</strong><br/>
        State: <span id="dash-state">Loading...</span><br/>
        Animation: <span id="dash-anim">-</span><br/>
        Idle Level: <span id="dash-level">-</span><br/>
        Ticks to Next Level: <span id="dash-ticks">-</span><br/>
        Next Tick In: <span id="dash-next-tick">-</span>s
      </div>

      <div id="controls" style="margin-bottom: 10px; display: none;">
        <div style="margin-bottom: 8px;">
          <label for="animation-select">Manual Animation: </label>
          <select id="animation-select"></select>
          <button id="play-btn">Play</button>
          <button id="random-btn">Play Random (Set "Playing" State)</button>
        </div>
        <div style="margin-bottom: 8px;">
          <label for="state-select">Change State: </label>
          <select id="state-select"></select>
          <button id="visibility-btn">Hide</button>
        </div>
      </div>

      <div id="canvas-container" style="position: relative;"></div>

      <p style="font-size: 0.8em; color: #666; margin-top: 20px;">
        Note: The agent is currently in automatic mode. It will play idle animations every 10 seconds.
        Manual animations use the "Exit Branch" for smooth transitions.
      </p>
    </div>
  `;

  try {
    const agent = await Agent.load('Clippit', {
        baseUrl: '/agents/Clippit',
        optimized: true,
        fixed: false,
        container: document.getElementById('canvas-container')!,
        scale: 2
    });

    const stateManager = (agent as any).stateManager;
    const animationManager = (agent as any).animationManager;

    const controlsEl = document.getElementById('controls')!;
    const animationSelect = document.getElementById('animation-select') as HTMLSelectElement;
    const playBtn = document.getElementById('play-btn')!;
    const randomBtn = document.getElementById('random-btn')!;
    const visibilityBtn = document.getElementById('visibility-btn')!;

    const dashState = document.getElementById('dash-state')!;
    const dashAnim = document.getElementById('dash-anim')!;
    const dashLevel = document.getElementById('dash-level')!;
    const dashTicks = document.getElementById('dash-ticks')!;
    const dashNextTick = document.getElementById('dash-next-tick')!;

    const stateSelect = document.getElementById('state-select') as HTMLSelectElement;

    // Populate animation dropdown
    const animNames = Object.keys(agent.definition.animations).sort();
    animNames.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      if (name === 'Greeting') option.selected = true;
      animationSelect.appendChild(option);
    });

    // Populate state dropdown
    const stateNames = Object.keys(agent.definition.states).sort();
    stateNames.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      if (name === 'IdlingLevel1') option.selected = true;
      stateSelect.appendChild(option);
    });

    controlsEl.style.display = 'block';

    playBtn.addEventListener('click', async () => {
      const selectedAnim = animationSelect.value;
      agent.play(selectedAnim);
    });

    randomBtn.addEventListener('click', () => {
        stateManager.playRandomAnimation();
    });

    stateSelect.addEventListener('change', () => {
        agent.setState(stateSelect.value);
    });

    let isVisible = true;
    visibilityBtn.addEventListener('click', async () => {
        isVisible = !isVisible;
        visibilityBtn.textContent = isVisible ? 'Hide' : 'Show';
        visibilityBtn.setAttribute('disabled', 'true');

        if (isVisible) {
            await agent.show();
        } else {
            await agent.hide();
        }

        visibilityBtn.removeAttribute('disabled');
    });

    // Update Dashboard loop
    function updateDashboard() {
      dashState.textContent = stateManager.currentStateName;
      dashAnim.textContent = animationManager.currentAnimationName || '-';
      dashLevel.textContent = stateManager.idleLevel.toString();
      dashTicks.textContent = stateManager.ticksToNextLevel.toString();
      dashNextTick.textContent = (stateManager.timeUntilNextTick / 1000).toFixed(1);

      requestAnimationFrame(updateDashboard);
    }
    requestAnimationFrame(updateDashboard);

  } catch (error) {
    console.error(error);
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
      dashboard.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

initDemo();
