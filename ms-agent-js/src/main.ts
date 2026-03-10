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
            <label for="scale-range">Scale:</label>
            <input id="scale-range" type="range" min="1" max="5" step="0.1" value="2">
            <span id="scale-value">2.0x</span>
          </div>
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
          <hr />
          <div class="field-row" style="flex-direction: column; align-items: stretch; gap: 4px;">
            <label>Gestures:</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
              <button id="gesture-left-btn" disabled>Left</button>
              <button id="gesture-right-btn" disabled>Right</button>
              <button id="gesture-up-btn" disabled>Up</button>
              <button id="gesture-down-btn" disabled>Down</button>
            </div>
            <button id="gesture-mouse-btn" disabled>Gesture at Mouse (Click)</button>
          </div>
          <hr />
          <div class="field-row">
            <input type="checkbox" id="look-mouse-check" disabled>
            <label for="look-mouse-check">Look at Mouse (Follow)</label>
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

        <fieldset>
          <legend>Speech</legend>
          <div class="field-row">
            <input type="text" id="speak-text" value="Hello! My name is Clippy." style="width: 100%;" />
          </div>
          <div class="field-row">
            <input type="checkbox" id="skip-typing-check" />
            <label for="skip-typing-check">Skip typing</label>
          </div>
          <div class="field-row" style="justify-content: flex-end; gap: 4px; margin-top: 4px;">
            <button id="speak-btn" disabled>Speak</button>
            <button id="ask-btn" disabled>Ask</button>
          </div>
        </fieldset>

        <p style="font-size: 10px; color: #666; margin-top: 10px;">
            Tip: Click the agent for a surprise!
        </p>
      </div>
    </div>
  `;

  const agentSelect = document.getElementById('agent-select') as HTMLSelectElement;
  const scaleRange = document.getElementById('scale-range') as HTMLInputElement;
  const scaleValue = document.getElementById('scale-value') as HTMLSpanElement;
  const animationSelect = document.getElementById('animation-select') as HTMLSelectElement;
  const stateSelect = document.getElementById('state-select') as HTMLSelectElement;
  const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
  const randomBtn = document.getElementById('random-btn') as HTMLButtonElement;
  const visibilityBtn = document.getElementById('visibility-btn') as HTMLButtonElement;
  const speakBtn = document.getElementById('speak-btn') as HTMLButtonElement;
  const askBtn = document.getElementById('ask-btn') as HTMLButtonElement;
  const speakTextInput = document.getElementById('speak-text') as HTMLInputElement;
  const skipTypingCheck = document.getElementById('skip-typing-check') as HTMLInputElement;
  const gestureLeftBtn = document.getElementById('gesture-left-btn') as HTMLButtonElement;
  const gestureRightBtn = document.getElementById('gesture-right-btn') as HTMLButtonElement;
  const gestureUpBtn = document.getElementById('gesture-up-btn') as HTMLButtonElement;
  const gestureDownBtn = document.getElementById('gesture-down-btn') as HTMLButtonElement;
  const gestureMouseBtn = document.getElementById('gesture-mouse-btn') as HTMLButtonElement;
  const lookMouseCheck = document.getElementById('look-mouse-check') as HTMLInputElement;

  const dashState = document.getElementById('dash-state')!;
  const dashAnim = document.getElementById('dash-anim')!;
  const dashFrame = document.getElementById('dash-frame')!;
  const dashLevel = document.getElementById('dash-level')!;
  const dashNextTick = document.getElementById('dash-next-tick')!;

  let currentAgent: Agent | null = null;
  let isVisible = true;

  async function loadAgent(name: string) {
    if (currentAgent) {
      await currentAgent.hide();
      currentAgent.destroy();
    }

    // Reset UI
    animationSelect.innerHTML = '';
    stateSelect.innerHTML = '';
    playBtn.disabled = true;
    randomBtn.disabled = true;
    visibilityBtn.disabled = true;
    speakBtn.disabled = true;
    askBtn.disabled = true;
    gestureLeftBtn.disabled = true;
    gestureRightBtn.disabled = true;
    gestureUpBtn.disabled = true;
    gestureDownBtn.disabled = true;
    gestureMouseBtn.disabled = true;
    lookMouseCheck.disabled = true;

    dashState.textContent = 'Loading...';
    dashAnim.textContent = '-';
    dashFrame.textContent = '-';
    dashLevel.textContent = '-';
    dashNextTick.textContent = '-';

    try {
      const scale = parseFloat(scaleRange.value);
      currentAgent = await Agent.load(name, {
        baseUrl: `/agents/${name}`,
        scale: scale,
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
      speakBtn.disabled = false;
      askBtn.disabled = false;
      gestureLeftBtn.disabled = false;
      gestureRightBtn.disabled = false;
      gestureUpBtn.disabled = false;
      gestureDownBtn.disabled = false;
      gestureMouseBtn.disabled = false;
      lookMouseCheck.disabled = false;

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

  scaleRange.addEventListener('input', () => {
    const scale = parseFloat(scaleRange.value);
    scaleValue.textContent = `${scale.toFixed(1)}x`;
    currentAgent?.setScale(scale);
  });

  playBtn.addEventListener('click', () => {
    currentAgent?.play(animationSelect.value, 5000);
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

  speakBtn.addEventListener('click', () => {
    currentAgent?.speak(speakTextInput.value, {
        skipTyping: skipTypingCheck.checked
    });
  });

  askBtn.addEventListener('click', async () => {
    if (!currentAgent) return;
    const answer = await currentAgent.ask({
        title: "Question",
        placeholder: "Type your answer here..."
    });
    if (answer !== null) {
        currentAgent.speak(`You said: ${answer}`, {
            skipTyping: skipTypingCheck.checked
        });
    } else {
        currentAgent.speak("Cancelled.", {
            skipTyping: skipTypingCheck.checked
        });
    }
  });
  
  gestureLeftBtn.addEventListener('click', () => currentAgent?.setState('GesturingLeft'));
  gestureRightBtn.addEventListener('click', () => currentAgent?.setState('GesturingRight'));
  gestureUpBtn.addEventListener('click', () => currentAgent?.setState('GesturingUp'));
  gestureDownBtn.addEventListener('click', () => currentAgent?.setState('GesturingDown'));

  gestureMouseBtn.addEventListener('click', () => {
    const onMouseDown = (e: MouseEvent) => {
        currentAgent?.gestureAt(e.clientX, e.clientY);
        window.removeEventListener('mousedown', onMouseDown);
        gestureMouseBtn.classList.remove('active'); // hypothetical CSS or just visual cue
    };
    window.addEventListener('mousedown', onMouseDown);
  });

  window.addEventListener('mousemove', (e) => {
    if (lookMouseCheck.checked && currentAgent) {
        currentAgent.lookAt(e.clientX, e.clientY);
    }
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
