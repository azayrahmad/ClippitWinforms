import { CharacterParser } from './CharacterParser';
import { SpriteManager } from './SpriteManager';
import { AnimationManager } from './AnimationManager';
import { AudioManager } from './AudioManager';
import { StateManager } from './StateManager';
import { Balloon } from './Balloon';
import type { TTSOptions } from './Balloon';
import type { AgentCharacterDefinition } from './types';

export interface AgentOptions {
  container?: HTMLElement;
  baseUrl?: string;
  scale?: number;
  speed?: number;
  idleIntervalMs?: number;
  useAudio?: boolean;
  fixed?: boolean;
  x?: number;
  y?: number;
}

type AgentEvent = 'click' | 'animationStart' | 'animationEnd' | 'stateChange' | 'show' | 'hide' | 'dragstart' | 'drag' | 'dragend';
type AgentEventListener = (...args: any[]) => void;

/**
 * The main Agent class that serves as the entry point for the library.
 */
export class Agent {
  public readonly definition: AgentCharacterDefinition;
  public readonly spriteManager: SpriteManager;
  public readonly audioManager: AudioManager;
  public readonly animationManager: AnimationManager;
  public readonly stateManager: StateManager;
  public readonly balloon: Balloon;

  private container: HTMLElement;
  private shadowRoot: ShadowRoot;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private options: Required<AgentOptions>;
  private isDestroyed: boolean = false;
  private lastTime: number = 0;
  private rafId: number = 0;

  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private initialAgentX: number = 0;
  private initialAgentY: number = 0;

  private listeners: Map<AgentEvent, Set<AgentEventListener>> = new Map();

  private constructor(definition: AgentCharacterDefinition, options: Required<AgentOptions>) {
    this.definition = definition;
    this.options = options;

    // Create container if not provided
    this.container = options.container || document.createElement('div');
    if (!options.container) {
      document.body.appendChild(this.container);
    }

    // Shadow DOM
    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    // Styles
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        position: ${options.fixed ? 'fixed' : 'absolute'};
        left: ${options.x}px;
        top: ${options.y}px;
        z-index: 9999;
        pointer-events: none;
      }
      canvas {
        display: block;
        image-rendering: pixelated;
        pointer-events: auto;
        cursor: pointer;
      }
      .clippy-balloon {
        position: absolute;
        z-index: 1000;
        background: #ffc;
        color: black;
        padding: 8px;
        border: 1px solid black;
        border-radius: 5px;
        pointer-events: auto;
      }
      .clippy-content {
        max-width: 200px;
        min-width: 120px;
        font-family: "Microsoft Sans", sans-serif;
        font-size: 10pt;
      }
      .clippy-tip {
        width: 10px;
        height: 16px;
        background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAgCAMAAAAlvKiEAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAAlQTFRF///MAAAA////52QwgAAAAAN0Uk5T//8A18oNQQAAAGxJREFUeNqs0kEOwCAIRFHn3//QTUU6xMyyxii+jQosrTPkyPEM6IN3FtzIRk1U4dFeKWQiH6pRRowMVKEmvronEynkwj0uZJgR22+YLopPSo9P34wJSamLSU7lSIWLJU7NkNomNlhqxUeAAQC+TQLZyEuJBwAAAABJRU5ErkJggg==) no-repeat;
        position: absolute;
      }
      .clippy-top-left .clippy-tip {
        top: 100%;
        margin-top: 0px;
        left: 100%;
        margin-left: -50px;
      }
      .clippy-top-right .clippy-tip {
        top: 100%;
        margin-top: 0px;
        left: 0;
        margin-left: 50px;
        background-position: -10px 0;
      }
      .clippy-bottom-right .clippy-tip {
        top: 0;
        margin-top: -16px;
        left: 0;
        margin-left: 50px;
        background-position: -10px -16px;
      }
      .clippy-bottom-left .clippy-tip {
        top: 0;
        margin-top: -16px;
        left: 100%;
        margin-left: -50px;
        background-position: 0px -16px;
      }
      .clippy-input {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 5px;
      }
      .clippy-input b {
        align-self: flex-start;
        margin-bottom: 5px;
      }
      .clippy-input textarea {
        width: 100%;
        margin-bottom: 10px;
        background-color: white;
        border: 1px solid grey;
        box-shadow: none;
        resize: none;
        font-family: inherit;
        font-size: inherit;
        box-sizing: border-box;
      }
      .clippy-input-buttons {
        display: flex;
        justify-content: space-between;
        width: 100%;
      }
      .clippy-input-buttons button {
        background-color: transparent;
        border: 1px solid grey;
        border-radius: 4px;
        width: 70px;
        padding: 2px;
        cursor: pointer;
      }
      .clippy-input-buttons button:hover {
        background-color: #eee;
      }
      .clippy-input-buttons .ask-button {
        margin-right: 5px;
      }
    `;
    this.shadowRoot.appendChild(style);

    // Canvas
    this.canvas = document.createElement('canvas');
    this.shadowRoot.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    // Managers
    this.spriteManager = new SpriteManager(options.baseUrl, definition);
    this.audioManager = new AudioManager(options.baseUrl);
    this.audioManager.setEnabled(options.useAudio);
    if (definition.audioAtlas) {
      this.audioManager.setAudioAtlas(definition.audioAtlas);
    }
    this.animationManager = new AnimationManager(this.spriteManager, this.audioManager, definition.animations);
    this.stateManager = new StateManager(definition.states, this.animationManager, {
      idleIntervalMs: options.idleIntervalMs,
      ticksPerLevel: 3,
    });

    // Balloon
    this.balloon = new Balloon(this.canvas, this.shadowRoot);

    // Event forwarding
    this.canvas.addEventListener('click', (e) => {
        // Only emit click if we didn't just finish a drag
        if (!this.wasDragging) {
            this.emit('click');
        }
    });

    this.setupDragging();
    this.setupCanvas();
  }

  private wasDragging = false;

  private setupDragging() {
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // Only left click
      this.isDragging = true;
      this.wasDragging = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.initialAgentX = this.options.x;
      this.initialAgentY = this.options.y;

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);

      this.emit('dragstart');
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!this.isDragging) return;

      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          this.wasDragging = true;
      }

      let nx = this.initialAgentX + dx;
      let ny = this.initialAgentY + dy;

      // Constrain to viewport
      const minX = 0;
      const minY = 0;
      const maxX = window.innerWidth - this.canvas.width;
      const maxY = window.innerHeight - this.canvas.height;

      nx = Math.max(minX, Math.min(nx, maxX));
      ny = Math.max(minY, Math.min(ny, maxY));

      this.moveTo(nx, ny);
      this.emit('drag', { x: nx, y: ny });
    };

    const onPointerUp = () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      this.emit('dragend');
    };

    this.canvas.addEventListener('pointerdown', onPointerDown);
  }

  private setupCanvas() {
    const width = this.spriteManager.getSpriteWidth();
    const height = this.spriteManager.getSpriteHeight();
    this.canvas.width = width * this.options.scale;
    this.canvas.height = height * this.options.scale;
  }

  /**
   * Sets the scale of the agent, keeping it centered.
   */
  public setScale(scale: number) {
    const oldScale = this.options.scale;
    if (oldScale === scale) return;

    const width = this.spriteManager.getSpriteWidth();
    const height = this.spriteManager.getSpriteHeight();

    const oldWidth = width * oldScale;
    const oldHeight = height * oldScale;

    const newWidth = width * scale;
    const newHeight = height * scale;

    // Calculate center
    const cx = this.options.x + oldWidth / 2;
    const cy = this.options.y + oldHeight / 2;

    // New top-left to keep center
    let nx = cx - newWidth / 2;
    let ny = cy - newHeight / 2;

    // Constrain to viewport
    nx = Math.max(0, Math.min(nx, window.innerWidth - newWidth));
    ny = Math.max(0, Math.min(ny, window.innerHeight - newHeight));

    this.options.scale = scale;
    this.canvas.width = newWidth;
    this.canvas.height = newHeight;
    this.moveTo(nx, ny);
  }

  /**
   * Static factory method to load an agent.
   */
  public static async load(name: string, options: AgentOptions = {}): Promise<Agent> {
    const defaultBaseUrl = `https://unpkg.com/ms-agent-js@latest/dist/agents/${name}`;
    const baseUrl = (options.baseUrl || defaultBaseUrl).replace(/\/$/, '');

    // Try to find the .acd file. We try the uppercase name first, but we are robust.
    const jsonPath = `${baseUrl}/agent.json`;
    let definition: AgentCharacterDefinition;

    try {
        const response = await fetch(jsonPath);
        if (!response.ok) throw new Error('No agent.json');
        definition = await response.json();
    } catch (e) {
        // Fallback to .acd
        const acdPath = `${baseUrl}/${name.toUpperCase()}.acd`;

        definition = await CharacterParser.load(acdPath).catch(async (err) => {
            // Fallback to lowercase if uppercase fails
            try {
                return await CharacterParser.load(`${baseUrl}/${name.toLowerCase()}.acd`);
            } catch (innerErr) {
                console.error(`MSAgentJS: Failed to load agent assets for '${name}' at ${baseUrl}. ` +
                              `Please ensure the 'agents/' directory is correctly served and 'baseUrl' is correct.`);
                throw err;
            }
        });
    }

    // Normalize paths in definition to be relative to baseUrl
    if (definition.character.colorTable && !definition.character.colorTable.startsWith('http')) {
      // Some .acd files have ColorTable.bmp in the Images subfolder
      definition.character.colorTable = definition.character.colorTable.replace(/\\/g, '/');
      // We don't lowercase it here yet, SpriteManager handles it with fallback
    }

    // Lowercase all image filenames in animations for robustness
    Object.values(definition.animations).forEach(animation => {
      animation.frames.forEach(frame => {
        frame.images.forEach(image => {
          image.filename = image.filename.replace(/\\/g, '/').toLowerCase();
        });
        if (frame.soundEffect) {
          frame.soundEffect = frame.soundEffect.toLowerCase();
        }
      });
    });

    // Default options
    const fullOptions: Required<AgentOptions> = {
      container: options.container || null as any,
      baseUrl: baseUrl,
      scale: options.scale ?? 1,
      speed: options.speed ?? 1,
      idleIntervalMs: options.idleIntervalMs ?? 5000,
      useAudio: options.useAudio ?? true,
      fixed: options.fixed ?? true,
      x: options.x ?? (window.innerWidth - definition.character.width * (options.scale ?? 1) - 50),
      y: options.y ?? (window.innerHeight - definition.character.height * (options.scale ?? 1) - 50),
    };

    const agent = new Agent(definition, fullOptions);
    await agent.init();
    return agent;
  }

  private async init() {
    const initPromises: Promise<any>[] = [this.spriteManager.init()];

    if (this.options.useAudio && this.definition.audioAtlas) {
      // Eager load audio spritesheet if available
      initPromises.push(this.audioManager.loadSounds([]));
    }

    await Promise.all(initPromises);
    this.startLoop();
    await this.show();
  }

  private startLoop() {
    this.lastTime = performance.now();
    const loop = (currentTime: number) => {
      if (this.isDestroyed) return;

      const deltaTime = (currentTime - this.lastTime) * this.options.speed;
      this.lastTime = currentTime;

      this.animationManager.update(currentTime);
      this.stateManager.update(deltaTime);

      this.draw();

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.animationManager.draw(this.ctx, 0, 0, this.options.scale);
  }

  /**
   * Plays a specific animation.
   */
  public async play(animationName: string, timeoutMs?: number): Promise<void> {
    this.emit('animationStart', animationName);
    await this.stateManager.playAnimation(animationName, 'Playing', false, timeoutMs);
    this.emit('animationEnd', animationName);
  }

  /**
   * Gestures at a specific position.
   * Calculates the 4-way direction and sets the agent's state to the corresponding "Gesturing" state.
   */
  public async gestureAt(x: number, y: number): Promise<void> {
    const direction = this.getDirection(x, y, 4);
    const stateName = `Gesturing${direction}`;
    if (this.definition.states[stateName]) {
      await this.setState(stateName);
    } else {
      // Fallback to animation if state is missing
      const animName = `Gesture${direction}`;
      if (this.definition.animations[animName]) {
        await this.stateManager.playAnimation(animName, 'Gesturing');
      }
    }
  }

  /**
   * Looks at a specific position.
   * Calculates the 8-way direction and plays the corresponding "Look" animation.
   */
  public async lookAt(x: number, y: number): Promise<void> {
    const direction = this.getDirection(x, y, 8);
    const animName = `Look${direction}`;

    if (this.animationManager.currentAnimationName === animName && this.animationManager.isAnimating) {
      return;
    }

    if (this.definition.animations[animName]) {
      this.emit('animationStart', animName);
      await this.stateManager.playAnimation(animName, 'Looking');
      this.emit('animationEnd', animName);
    }
  }

  /**
   * Sets the agent's state.
   */
  public async setState(stateName: string): Promise<void> {
    const oldState = this.stateManager.currentStateName;
    await this.stateManager.setState(stateName);
    this.emit('stateChange', stateName, oldState);
  }

  /**
   * Moves the agent to a new position.
   */
  public moveTo(x: number, y: number) {
    this.options.x = x;
    this.options.y = y;
    // this.container is the host of the shadow root.
    this.container.style.left = `${x}px`;
    this.container.style.top = `${y}px`;
    this.balloon.reposition();
  }

  /**
   * Speaks the given text.
   */
  public speak(text: string, options: { hold?: boolean; useTTS?: boolean; skipTyping?: boolean } = {}): Promise<void> {
    const { hold = false, useTTS = true, skipTyping = false } = options;
    return new Promise((resolve) => {
      this.balloon.speak(resolve, text, hold, useTTS, skipTyping);
    });
  }

  /**
   * Shows HTML in the balloon.
   */
  public showHtml(html: string, hold: boolean = false) {
    this.balloon.showHtml(html, hold);
  }

  /**
   * Asks a question with an input field.
   */
  public ask(options: {
    title?: string;
    placeholder?: string;
    askButtonText?: string;
    cancelButtonText?: string;
    timeout?: number;
  } = {}): Promise<string | null> {
    const title = options.title || "What would you like to do?";
    const placeholder = options.placeholder || "Ask me anything...";
    const askButtonText = options.askButtonText || "Ask";
    const cancelButtonText = options.cancelButtonText || "Cancel";
    const timeout = options.timeout || 60000;

    return new Promise((resolve) => {
      let inputBalloonTimeout: number | null = null;

      const balloonContent = `
        <div class="clippy-input">
          <b>${title}</b>
          <textarea rows="2" placeholder="${placeholder}"></textarea>
          <div class="clippy-input-buttons">
            <button class="ask-button default">${askButtonText}</button>
            <button class="cancel-button">${cancelButtonText}</button>
          </div>
        </div>
      `;

      this.showHtml(balloonContent, true);

      const balloonEl = this.balloon.balloonEl;
      const input = balloonEl.querySelector('textarea') as HTMLTextAreaElement;
      const askButton = balloonEl.querySelector('.ask-button') as HTMLButtonElement;
      const cancelButton = balloonEl.querySelector('.cancel-button') as HTMLButtonElement;

      const handleKeypress = (e: KeyboardEvent) => {
        resetBalloonTimeout();
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAsk();
        }
      };

      const handleAsk = () => {
        cleanup();
        const value = input.value;
        this.balloon.close();
        resolve(value);
      };

      const handleCancel = () => {
        cleanup();
        this.balloon.close();
        resolve(null);
      };

      const resetBalloonTimeout = () => {
        clearBalloonTimeout();
        inputBalloonTimeout = window.setTimeout(() => {
          handleCancel();
        }, timeout);
      };

      const clearBalloonTimeout = () => {
        if (inputBalloonTimeout) {
          clearTimeout(inputBalloonTimeout);
          inputBalloonTimeout = null;
        }
      };

      const cleanup = () => {
        clearBalloonTimeout();
        input?.removeEventListener('keypress', handleKeypress);
        askButton.removeEventListener('click', handleAsk);
        cancelButton.removeEventListener('click', handleCancel);
      };

      if (input) {
        input.focus();
        input.addEventListener('keypress', handleKeypress);
      }

      askButton.addEventListener('click', handleAsk);
      cancelButton.addEventListener('click', handleCancel);

      resetBalloonTimeout();

      // Force reposition after a short delay for rendering
      setTimeout(() => this.balloon.reposition(), 0);
    });
  }

  /**
   * Sets TTS options.
   */
  public setTTSOptions(options: TTSOptions) {
    this.balloon.setTTSOptions(options);
  }

  /**
   * Gets available TTS voices.
   */
  public getTTSVoices(): SpeechSynthesisVoice[] {
    return this.balloon.getTTSVoices();
  }

  /**
   * Stops any ongoing TTS speech.
   */
  public stopTTS() {
    this.balloon.stopTTS();
  }

  /**
   * Shows the agent with the "Showing" animation.
   */
  public async show(): Promise<void> {
    this.container.style.display = 'block';
    await this.stateManager.handleVisibilityChange(true);
    this.emit('show');
  }

  /**
   * Hides the agent with the "Hiding" animation.
   */
  public async hide(): Promise<void> {
    await this.stateManager.handleVisibilityChange(false);
    this.container.style.display = 'none';
    this.emit('hide');
  }

  /**
   * Event emitter methods.
   */
  public on(event: AgentEvent, listener: AgentEventListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  public off(event: AgentEvent, listener: AgentEventListener) {
    this.listeners.get(event)?.delete(listener);
  }

  private emit(event: AgentEvent, ...args: any[]) {
    this.listeners.get(event)?.forEach(listener => listener(...args));
  }

  private getDirection(targetX: number, targetY: number, numDirections: 4 | 8): string {
    const centerX = this.options.x + (this.definition.character.width * this.options.scale) / 2;
    const centerY = this.options.y + (this.definition.character.height * this.options.scale) / 2;

    const dx = targetX - centerX;
    const dy = targetY - centerY;

    // Angle in radians
    const angle = Math.atan2(dy, dx);
    // Convert to degrees [0, 360)
    let degrees = angle * (180 / Math.PI);
    if (degrees < 0) degrees += 360;

    if (numDirections === 4) {
      // 4 directions: Right (315-45), Down (45-135), Left (135-225), Up (225-315)
      if (degrees >= 315 || degrees < 45) return 'Right';
      if (degrees >= 45 && degrees < 135) return 'Down';
      if (degrees >= 135 && degrees < 225) return 'Left';
      return 'Up';
    } else {
      // 8 directions
      if (degrees >= 337.5 || degrees < 22.5) return 'Right';
      if (degrees >= 22.5 && degrees < 67.5) return 'DownRight';
      if (degrees >= 67.5 && degrees < 112.5) return 'Down';
      if (degrees >= 112.5 && degrees < 157.5) return 'DownLeft';
      if (degrees >= 157.5 && degrees < 202.5) return 'Left';
      if (degrees >= 202.5 && degrees < 247.5) return 'UpLeft';
      if (degrees >= 247.5 && degrees < 292.5) return 'Up';
      return 'UpRight';
    }
  }

  /**
   * Cleans up the agent and removes it from the DOM.
   */
  public destroy() {
    this.isDestroyed = true;
    cancelAnimationFrame(this.rafId);
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.listeners.clear();
  }
}
