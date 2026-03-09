import './style.css';
import { Agent } from './Agent';

async function initDemo() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px;">
      <h1>MSAgentJS - Phase 6: Library API</h1>

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
        <div style="margin-bottom: 8px;">
          <button id="move-btn">Move to Random Position</button>
        </div>
      </div>

      <div id="canvas-container" style="position: relative; height: 300px; border: 1px dashed #ccc;"></div>

      <p style="font-size: 0.8em; color: #666; margin-top: 20px;">
        Note: The agent is currently using the new <strong>Agent</strong> library class.
      </p>
    </div>
  `;

  try {
    const agentRoot = '/agents/Clippit';
    const container = document.getElementById('canvas-container')!;

    const agent = new Agent({
        container,
        scale: 2
    });

    await agent.load(`${agentRoot}/CLIPPIT.acd`);

    const controlsEl = document.getElementById('controls')!;
    const animationSelect = document.getElementById('animation-select') as HTMLSelectElement;
    const playBtn = document.getElementById('play-btn')!;
    const randomBtn = document.getElementById('random-btn')!;
    const visibilityBtn = document.getElementById('visibility-btn')!;
    const moveBtn = document.getElementById('move-btn')!;

    const dashState = document.getElementById('dash-state')!;
    const dashAnim = document.getElementById('dash-anim')!;
    const dashLevel = document.getElementById('dash-level')!;
    const dashTicks = document.getElementById('dash-ticks')!;
    const dashNextTick = document.getElementById('dash-next-tick')!;

    const stateSelect = document.getElementById('state-select') as HTMLSelectElement;

    const definition = agent.characterDefinition!;

    // Populate animation dropdown
    const animNames = Object.keys(definition.animations).sort();
    animNames.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      if (name === 'Greeting') option.selected = true;
      animationSelect.appendChild(option);
    });

    // Populate state dropdown
    const stateNames = Object.keys(definition.states).sort();
    stateNames.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      if (name === 'IdlingLevel1') option.selected = true;
      stateSelect.appendChild(option);
    });

    controlsEl.style.display = 'block';
    agent.show();
    agent.moveTo(100, 100);

    playBtn.addEventListener('click', async () => {
      const selectedAnim = animationSelect.value;
      agent.play(selectedAnim);
    });

    randomBtn.addEventListener('click', () => {
        const allAnimations = Object.keys(definition.animations);
        const selectableAnimations = allAnimations.filter(name => !name.toLowerCase().startsWith('idlinglevel'));

        if (selectableAnimations.length > 0) {
          const randomAnimation = selectableAnimations[Math.floor(Math.random() * selectableAnimations.length)];
          agent.play(randomAnimation);
        }
    });

    stateSelect.addEventListener('change', () => {
        agent.setState(stateSelect.value);
    });

    moveBtn.addEventListener('click', () => {
        const x = Math.random() * (container.clientWidth - 100);
        const y = Math.random() * (container.clientHeight - 100);
        agent.moveTo(x, y);
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

    // Loop to update dashboard (since Agent has its own internal loop)
    function updateDashboard() {
      dashState.textContent = agent.currentStateName;
      dashAnim.textContent = agent.currentAnimationName || '-';
      dashLevel.textContent = agent.idleLevel.toString();
      dashTicks.textContent = agent.ticksToNextLevel.toString();
      dashNextTick.textContent = (agent.timeUntilNextTick / 1000).toFixed(1);

      requestAnimationFrame(updateDashboard);
    }
    updateDashboard();

  } catch (error) {
    console.error(error);
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
      dashboard.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

initDemo();
