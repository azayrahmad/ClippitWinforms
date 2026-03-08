import { Agent } from './managers/Agent';

let agent: Agent | null = null;

async function loadAgent(agentName: string) {
  const canvas = document.getElementById('agent-canvas') as HTMLCanvasElement;
  const container = document.getElementById('agent-container') as HTMLDivElement;
  const animSelect = document.getElementById('animation-select') as HTMLSelectElement;
  const stateSelect = document.getElementById('state-select') as HTMLSelectElement;
  const statusText = document.getElementById('status-text') as HTMLElement;

  if (agent) {
    await agent.stop();
  }

  agent = new Agent(canvas);
  statusText.innerText = `Status: Loading ${agentName}...`;

  await agent.initialize(`/agents/${agentName}`);

  // Set canvas size based on agent size
  canvas.width = agent.width;
  canvas.height = agent.height;

  // Position agent at bottom right if not already positioned
  if (!container.style.left) {
    container.style.left = `${window.innerWidth - agent.width - 20}px`;
    container.style.top = `${window.innerHeight - agent.height - 20}px`;
  }

  // Populate animations
  animSelect.innerHTML = '';
  const animations = agent.getSelectableAnimations();
  animations.forEach(anim => {
    const option = document.createElement('option');
    option.value = anim;
    option.textContent = anim;
    animSelect.appendChild(option);
  });

  // Populate states
  stateSelect.innerHTML = '';
  const states = agent.getAvailableStates();
  states.forEach(state => {
    const option = document.createElement('option');
    option.value = state;
    option.textContent = state;
    stateSelect.appendChild(option);
  });

  await agent.start();
  statusText.innerText = `Status: ${agentName} ready.`;
  console.log(`${agentName} loaded and started.`);
}

async function init() {
  const container = document.getElementById('agent-container') as HTMLDivElement;
  const canvas = document.getElementById('agent-canvas') as HTMLCanvasElement;
  const animSelect = document.getElementById('animation-select') as HTMLSelectElement;
  const stateSelect = document.getElementById('state-select') as HTMLSelectElement;
  const agentSelect = document.getElementById('agent-select') as HTMLSelectElement;
  const playButton = document.getElementById('play-button') as HTMLButtonElement;
  const randomButton = document.getElementById('play-random-button') as HTMLButtonElement;

  await loadAgent(agentSelect.value);

  agentSelect.onchange = async () => {
    await loadAgent(agentSelect.value);
  };

  playButton.onclick = async () => {
    if (agent) {
        await agent.playAnimation(animSelect.value, undefined, "Playing");
    }
  };

  randomButton.onclick = async () => {
    if (agent) {
        await agent.playRandomAnimation();
    }
  };

  stateSelect.onchange = async () => {
      if (agent) {
          await agent.setState(stateSelect.value);
      }
  }

  canvas.onclick = async () => {
      if (agent) {
          // Trigger a random animation or say greeting
          await agent.playRandomAnimation();
      }
  }

  // Draggability
  let isDragging = false;
  let dragStartTime = 0;
  let offsetX = 0;
  let offsetY = 0;

  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStartTime = Date.now();
    offsetX = e.clientX - container.offsetLeft;
    offsetY = e.clientY - container.offsetTop;
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      container.style.left = `${e.clientX - offsetX}px`;
      container.style.top = `${e.clientY - offsetY}px`;
    }
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  canvas.addEventListener('click', async (e) => {
    // Only trigger if it's a click, not a drag completion
    if (Date.now() - dragStartTime < 200) {
      if (agent) {
          await agent.playRandomAnimation();
      }
    }
  });
}

init().catch(console.error);
