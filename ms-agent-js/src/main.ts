import { Agent } from './Agent';

let currentAgent: Agent | null = null;

interface AgentInfo {
  id: string;
  name: string;
}

async function initDemo() {
  const agentSelect = document.getElementById('agent-select') as HTMLSelectElement;
  const statusText = document.getElementById('status-text')!;

  try {
    const response = await fetch('/agents/agents.json');
    if (!response.ok) throw new Error('Failed to load agents.json');
    const agents: AgentInfo[] = await response.json();

    agentSelect.innerHTML = '';
    agents.forEach(agent => {
      const option = document.createElement('option');
      option.value = agent.id;
      option.textContent = agent.name;
      agentSelect.appendChild(option);
    });

    // Initial load
    if (agents.length > 0) {
      loadAgent(agents[0].id);
    }

  } catch (error) {
    console.error('Error initializing demo:', error);
    statusText.textContent = 'Error loading agent list.';
  }
}

async function loadAgent(id: string) {
  if (currentAgent) {
    currentAgent.destroy();
  }

  const statusText = document.getElementById('status-text')!;
  statusText.textContent = `Loading ${id}...`;

  try {
    currentAgent = await Agent.load(id, {
      baseUrl: `/agents/${id}`,
      scale: 2,
    });

    statusText.textContent = `Agent ${id} loaded.`;

    populateDropdowns();
  } catch (error) {
    console.error(error);
    statusText.textContent = `Error loading ${id}.`;
  }
}

function populateDropdowns() {
  if (!currentAgent) return;

  const animationSelect = document.getElementById('animation-select') as HTMLSelectElement;
  const stateSelect = document.getElementById('state-select') as HTMLSelectElement;

  // Clear existing
  animationSelect.innerHTML = '';
  stateSelect.innerHTML = '';

  const animations = Object.keys(currentAgent.definition.animations).sort();
  animations.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    animationSelect.appendChild(option);
  });

  const states = Object.keys(currentAgent.definition.states).sort();
  states.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    stateSelect.appendChild(option);
  });
}

function updateDebug() {
  if (!currentAgent) return;

  const info = currentAgent.debugInfo;
  document.getElementById('debug-state')!.textContent = info.state;
  document.getElementById('debug-idle-level')!.textContent = info.idleLevel.toString();
  document.getElementById('debug-ticks')!.textContent = info.ticksToNextLevel.toString();
  document.getElementById('debug-next-tick')!.textContent = (info.timeUntilNextTick / 1000).toFixed(1);
  document.getElementById('debug-anim')!.textContent = info.animation || '-';
  document.getElementById('debug-frame')!.textContent = info.frameIndex.toString();
  document.getElementById('debug-is-animating')!.textContent = info.isAnimating.toString();
  document.getElementById('debug-is-exiting')!.textContent = info.isExiting.toString();

  requestAnimationFrame(updateDebug);
}

const agentSelect = document.getElementById('agent-select') as HTMLSelectElement;
agentSelect.addEventListener('change', () => {
  loadAgent(agentSelect.value);
});

document.getElementById('play-btn')!.addEventListener('click', () => {
  const animationSelect = document.getElementById('animation-select') as HTMLSelectElement;
  if (currentAgent && animationSelect.value) {
    currentAgent.play(animationSelect.value);
  }
});

document.getElementById('random-btn')!.addEventListener('click', () => {
  if (currentAgent) {
    const animations = Object.keys(currentAgent.definition.animations);
    const randomAnim = animations[Math.floor(Math.random() * animations.length)];
    currentAgent.play(randomAnim);
  }
});

document.getElementById('set-state-btn')!.addEventListener('click', () => {
  const stateSelect = document.getElementById('state-select') as HTMLSelectElement;
  if (currentAgent && stateSelect.value) {
    currentAgent.setState(stateSelect.value);
  }
});

document.getElementById('show-btn')!.addEventListener('click', () => {
  currentAgent?.show();
});

document.getElementById('hide-btn')!.addEventListener('click', () => {
  currentAgent?.hide();
});

document.getElementById('move-btn')!.addEventListener('click', () => {
  if (currentAgent) {
    currentAgent.moveTo(window.innerWidth / 2 - 64, window.innerHeight / 2 - 64);
  }
});

// Start
initDemo();
requestAnimationFrame(updateDebug);
