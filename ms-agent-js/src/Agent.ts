import { CharacterParser } from './CharacterParser';
import { SpriteManager } from './SpriteManager';
import { AnimationManager } from './AnimationManager';
import { AudioManager } from './AudioManager';
import { StateManager } from './StateManager';
import type { AgentCharacterDefinition } from './types';

export interface AgentOptions {
  container?: HTMLElement;
  scale?: number;
  idleIntervalMs?: number;
  ticksPerLevel?: number;
}

export type AgentEvent =
  | 'animationStart'
  | 'animationEnd'
  | 'stateChange'
  | 'moveStart'
  | 'moveEnd'
  | 'show'
  | 'hide';

/**
 * Agent class serves as the high-level entry point for the MS Agent JS library.
 */
export class Agent extends EventTarget {
  private definition: AgentCharacterDefinition | null = null;
  private spriteManager: SpriteManager | null = null;
  private animationManager: AnimationManager | null = null;
  private audioManager: AudioManager | null = null;
  private stateManager: StateManager | null = null;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private scale: number;
  private isVisible: boolean = true;
  private isMoving: boolean = false;

  private lastTime: number = 0;
  private animationFrameId: number | null = null;

  private posX: number = 0;
  private posY: number = 0;

  constructor(options: AgentOptions = {}) {
    super();
    this.container = options.container || document.body;
    this.scale = options.scale || 2;

    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.imageRendering = 'pixelated';
    this.canvas.style.pointerEvents = 'auto';
    this.canvas.style.zIndex = '9999';
    this.canvas.style.display = 'none'; // Initially hidden until loaded

    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Could not create 2D context');
    this.ctx = context;

    this.container.appendChild(this.canvas);
  }

  /**
   * Loads the agent definition and assets.
   * @param acdPath Path to the .acd file.
   */
  public async load(acdPath: string): Promise<void> {
    const agentRoot = acdPath.substring(0, acdPath.lastIndexOf('/'));
    this.definition = await CharacterParser.load(acdPath);

    this.spriteManager = new SpriteManager(agentRoot, this.definition);
    await this.spriteManager.init();

    this.audioManager = new AudioManager(agentRoot);
    this.animationManager = new AnimationManager(this.spriteManager, this.audioManager, this.definition.animations);

    // Inject event hooks into animation manager
    const originalOnAnimationCompleted = this.animationManager.onAnimationCompleted;
    this.animationManager.onAnimationCompleted = (name) => {
      originalOnAnimationCompleted?.(name);
      this.dispatchEvent(new CustomEvent('animationEnd', { detail: { name } }));
    };

    this.stateManager = new StateManager(this.definition.states, this.animationManager, {
      idleIntervalMs: 5000,
      ticksPerLevel: 3
    });

    this.canvas.width = this.spriteManager.getSpriteWidth() * this.scale;
    this.canvas.height = this.spriteManager.getSpriteHeight() * this.scale;

    this.lastTime = performance.now();
    this.startLoop();
  }

  private startLoop(): void {
    const loop = (currentTime: number) => {
      const deltaTime = currentTime - this.lastTime;
      this.lastTime = currentTime;

      if (this.animationManager && this.stateManager) {
        this.animationManager.update(currentTime);
        this.stateManager.update(deltaTime);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.animationManager.draw(this.ctx, 0, 0);
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  public async play(animationName: string): Promise<boolean> {
    if (!this.stateManager) return false;
    this.dispatchEvent(new CustomEvent('animationStart', { detail: { name: animationName } }));
    return this.stateManager.playAnimation(animationName, 'Playing');
  }

  public async setState(stateName: string): Promise<void> {
    if (!this.stateManager) return;
    const oldState = this.stateManager.currentStateName;
    await this.stateManager.setState(stateName);
    this.dispatchEvent(new CustomEvent('stateChange', { detail: { from: oldState, to: stateName } }));
  }

  public async show(): Promise<void> {
    if (this.isVisible) return;
    this.isVisible = true;
    this.canvas.style.display = 'block';
    this.dispatchEvent(new CustomEvent('show'));
    if (this.stateManager) {
      await this.stateManager.handleVisibilityChange(true);
    }
  }

  public async hide(): Promise<void> {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.dispatchEvent(new CustomEvent('hide'));
    if (this.stateManager) {
      await this.stateManager.handleVisibilityChange(false);
    }
    this.canvas.style.display = 'none';
  }

  public async moveTo(x: number, y: number): Promise<void> {
    if (this.isMoving) return;
    this.isMoving = true;
    this.dispatchEvent(new CustomEvent('moveStart', { detail: { x, y } }));

    const startX = this.posX;
    const startY = this.posY;
    const distance = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));

    if (distance < 1) {
      this.isMoving = false;
      this.dispatchEvent(new CustomEvent('moveEnd'));
      return;
    }

    // Attempt to play "Move" animation if it exists
    const hasMoveAnim = this.definition?.animations['Move'] !== undefined;
    if (hasMoveAnim && this.stateManager) {
      this.stateManager.playAnimation('Move', 'Playing');
    }

    const duration = distance * 2; // 2ms per pixel
    const startTime = performance.now();

    const animateMove = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      this.posX = startX + (x - startX) * progress;
      this.posY = startY + (y - startY) * progress;
      this.canvas.style.left = `${this.posX}px`;
      this.canvas.style.top = `${this.posY}px`;

      if (progress < 1) {
        requestAnimationFrame(animateMove);
      } else {
        this.isMoving = false;
        if (hasMoveAnim && this.stateManager) {
           this.stateManager.handleAnimationCompleted();
        }
        this.dispatchEvent(new CustomEvent('moveEnd'));
      }
    };

    requestAnimationFrame(animateMove);
  }

  public get currentStateName(): string {
    return this.stateManager?.currentStateName || '';
  }

  public get currentAnimationName(): string {
    return this.animationManager?.currentAnimationName || '';
  }

  public get idleLevel(): number {
    return this.stateManager?.idleLevel || 0;
  }

  public get ticksToNextLevel(): number {
    return this.stateManager?.ticksToNextLevel || 0;
  }

  public get timeUntilNextTick(): number {
    return this.stateManager?.timeUntilNextTick || 0;
  }

  public get characterDefinition(): AgentCharacterDefinition | null {
    return this.definition;
  }

  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}
