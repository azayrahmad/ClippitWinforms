import { Agent } from './managers/Agent';

async function init() {
  const canvas = document.getElementById('agent-canvas') as HTMLCanvasElement;
  const container = document.getElementById('agent-container') as HTMLDivElement;
  const select = document.getElementById('animation-select') as HTMLSelectElement;
  const playButton = document.getElementById('play-button') as HTMLButtonElement;

  const agent = new Agent(canvas);

  // Initialize with a path to the agent folder
  // Note: We need to make sure these assets exist in public/agents/Clippit/
  await agent.initialize('/agents/Clippit');

  // Set canvas size based on agent size
  canvas.width = agent.width;
  canvas.height = agent.height;

  // Position agent at bottom right
  container.style.left = `${window.innerWidth - agent.width - 20}px`;
  container.style.top = `${window.innerHeight - agent.height - 20}px`;

  // Populate animations
  const animations = agent.getSelectableAnimations();
  animations.forEach(anim => {
    const option = document.createElement('option');
    option.value = anim;
    option.textContent = anim;
    select.appendChild(option);
  });

  playButton.onclick = () => {
    agent.playAnimation(select.value);
  };

  // Draggability
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  container.onmousedown = (e) => {
    isDragging = true;
    offsetX = e.clientX - container.offsetLeft;
    offsetY = e.clientY - container.offsetTop;
  };

  window.onmousemove = (e) => {
    if (isDragging) {
      container.style.left = `${e.clientX - offsetX}px`;
      container.style.top = `${e.clientY - offsetY}px`;
    }
  };

  window.onmouseup = () => {
    isDragging = false;
  };
}

init().catch(console.error);
