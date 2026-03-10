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
    const acdPath = `${baseUrl}/${name.toUpperCase()}.acd`;

    const definition = await CharacterParser.load(acdPath).catch(async (err) => {
        // Fallback to lowercase if uppercase fails
        try {
            return await CharacterParser.load(`${baseUrl}/${name.toLowerCase()}.acd`);
        } catch (innerErr) {
            console.error(`MSAgentJS: Failed to load agent assets for '${name}' at ${baseUrl}. ` +
                          `Please ensure the 'agents/' directory is correctly served and 'baseUrl' is correct.`);
            throw err;
        }
    });

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
    try {
      await agent.init();
    } catch (err) {
      agent.destroy();
      throw err;
    }
    return agent;
  }

  private async init() {
    await this.spriteManager.init();
    this.startLoop();
    await this.stateManager.setState('IdlingLevel1');
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
  public async play(animationName: string): Promise<void> {
    this.emit('animationStart', animationName);
    await this.stateManager.playAnimation(animationName, 'Playing');
    this.emit('animationEnd', animationName);
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
    await this.stateManager.handleVisibilityChange(true);
    this.emit('show');
  }

  /**
   * Hides the agent with the "Hiding" animation.
   */
  public async hide(): Promise<void> {
    await this.stateManager.handleVisibilityChange(false);
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
