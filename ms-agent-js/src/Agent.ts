import { CharacterParser } from './CharacterParser';
import { SpriteManager } from './SpriteManager';
import { AnimationManager } from './AnimationManager';
import { AudioManager } from './AudioManager';
import { StateManager } from './StateManager';
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

type AgentEvent = 'click' | 'animationStart' | 'animationEnd' | 'stateChange' | 'show' | 'hide';
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

  private container: HTMLElement;
  private shadowRoot: ShadowRoot;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private options: Required<AgentOptions>;
  private isDestroyed: boolean = false;
  private lastTime: number = 0;
  private rafId: number = 0;

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

    // Event forwarding
    this.canvas.addEventListener('click', () => this.emit('click'));

    this.setupCanvas();
  }

  private setupCanvas() {
    const width = this.spriteManager.getSpriteWidth();
    const height = this.spriteManager.getSpriteHeight();
    this.canvas.width = width * this.options.scale;
    this.canvas.height = height * this.options.scale;
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
