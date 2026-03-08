import { CharacterParser } from './CharacterParser';
import { Agent } from './Agent';

const status = document.getElementById('status')!;
const animationList = document.getElementById('animation-list')!;
const agentContainer = document.getElementById('agent-container')!;

async function init() {
    try {
        status.textContent = 'Loading agent definition...';
        // Note: The user will provide assets later.
        // For now we assume a 'clippit.txt' in the public folder.
        const response = await fetch('/clippit.txt');
        if (!response.ok) throw new Error('Failed to load clippit.txt');

        const text = await response.text();
        const parser = new CharacterParser();
        const definition = parser.parse(text);

        status.textContent = 'Initializing agent...';
        const agent = new Agent(definition, '/'); // Base path for assets
        agent.mount(agentContainer);

        const animations = agent.getAnimations().sort();
        animations.forEach(name => {
            const btn = document.createElement('button');
            btn.textContent = name;
            btn.onclick = () => agent.play(name);
            animationList.appendChild(btn);
        });

        status.textContent = 'Agent ready!';
    } catch (e) {
        console.error(e);
        status.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
}

init();
