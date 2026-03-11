import { type State } from './types';
import { AnimationManager } from './AnimationManager';

export interface StateManagerConfig {
  idleIntervalMs?: number;
  ticksPerLevel?: number;
  maxIdleLevel?: number;
}

/**
 * StateManager class for handling agent high-level behavior and idle progression.
 * Ported from C# StateManager.cs.
 */
export class StateManager {
  private states: Record<string, State>;
  private animationManager: AnimationManager;

  private currentState: string = 'Hidden';
  private currentIdleLevel: number = 1;
  private idleTickCount: number = 0;
  private elapsedSinceLastTick: number = 0;

  private idleIntervalMs: number = 10000;
  private ticksPerLevel: number = 12;
  private maxIdleLevel: number = 3;
  private idlePrefix: string = 'IdlingLevel';

  private isPaused: boolean = true;

  constructor(
    states: Record<string, State>,
    animationManager: AnimationManager,
    config?: StateManagerConfig
  ) {
    this.states = states;
    this.animationManager = animationManager;

    if (config) {
      if (config.idleIntervalMs !== undefined) this.idleIntervalMs = config.idleIntervalMs;
      if (config.ticksPerLevel !== undefined) this.ticksPerLevel = config.ticksPerLevel;
      if (config.maxIdleLevel !== undefined) this.maxIdleLevel = config.maxIdleLevel;
    }
  }

  public get currentStateName(): string {
    return this.currentState;
  }

  public get idleLevel(): number {
    return this.currentIdleLevel;
  }

  public get ticksToNextLevel(): number {
    return this.ticksPerLevel - this.idleTickCount;
  }

  public get timeUntilNextTick(): number {
    return Math.max(0, this.idleIntervalMs - this.elapsedSinceLastTick);
  }

  /**
   * Updates the state machine logic. Should be called from the main loop.
   */
  public async update(deltaTime: number): Promise<void> {
    if (this.isPaused) return;

    // If animation finished, handle state transitions
    if (!this.animationManager.isAnimating) {
      if (this.currentState === 'Playing') {
        await this.handleAnimationCompleted();
      } else if (this.currentState === 'Showing') {
        // After Showing completes, we start idling
        await this.returnToIdle();
      } else if (this.currentState === 'Hiding') {
        // After Hiding completes, we are truly Hidden and paused
        this.currentState = 'Hidden';
        this.isPaused = true;
        return;
      } else if (this.currentState !== 'Hidden') {
        // For other persistent states (Idling, Gesturing, etc.), loop or pick new anim immediately
        await this.updateStateAnimation();
      }
    }

    // If we are still in Playing/Showing/Hiding states, don't process idle level progression
    if (
      this.currentState === 'Playing' ||
      this.currentState === 'Showing' ||
      this.currentState === 'Hiding'
    ) {
      return;
    }

    this.elapsedSinceLastTick += deltaTime;

    if (this.elapsedSinceLastTick >= this.idleIntervalMs) {
      this.elapsedSinceLastTick = 0;
      await this.onTick();
    }
  }

  private async onTick(): Promise<void> {
    if (this.isIdleState(this.currentState)) {
      this.idleTickCount++;

      if (this.idleTickCount >= this.ticksPerLevel && this.currentIdleLevel < this.maxIdleLevel) {
        this.currentIdleLevel++;
        this.idleTickCount = 0;
        await this.setIdleState(this.currentIdleLevel);
      } else {
        await this.updateStateAnimation();
      }
    } else {
      await this.updateStateAnimation();
    }
  }

  private isIdleState(state: string): boolean {
    return state.toLowerCase().startsWith(this.idlePrefix.toLowerCase());
  }

  private async setIdleState(level: number): Promise<void> {
    const newState = `${this.idlePrefix}${level}`;
    if (this.states[newState]) {
      this.currentState = newState;
      await this.updateStateAnimation();
    }
  }

  public async setState(stateName: string): Promise<void> {
    if (!this.states[stateName] && stateName !== 'Playing') {
      throw new Error(`Invalid state name: ${stateName}`);
    }

    if (!this.isIdleState(stateName)) {
      this.resetIdleProgression();
    }

    this.currentState = stateName;

    if (stateName !== 'Playing') {
      await this.updateStateAnimation();
    }
  }

  public async playAnimation(
    animationName: string,
    stateName: string = '',
    useExitBranch: boolean = false,
    timeoutMs?: number
  ): Promise<boolean> {
    if (stateName) {
      this.currentState = stateName;
    }

    if (this.currentState !== 'Playing' && !this.isIdleState(this.currentState)) {
      this.resetIdleProgression();
    }

    await this.animationManager.preloadAnimation(animationName);

    let timeoutId: any;
    if (timeoutMs) {
      timeoutId = setTimeout(() => {
        this.animationManager.isExitingFlag = true;
      }, timeoutMs);
    }

    try {
      const result = await this.animationManager.interruptAndPlayAnimation(animationName, useExitBranch);
      return result;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (this.currentState === 'Playing' || !this.animationManager.isAnimating) {
        await this.handleAnimationCompleted();
      }
    }
  }

  public async playRandomAnimation(timeoutMs: number = 5000): Promise<void> {
    const allAnimations = Object.keys((this.animationManager as any).animations); // accessing private animations for demo
    const selectableAnimations = allAnimations.filter(name => !this.isIdleState(name));

    if (selectableAnimations.length > 0) {
      const randomAnimation = selectableAnimations[Math.floor(Math.random() * selectableAnimations.length)];
      await this.playAnimation(randomAnimation, 'Playing', false, timeoutMs);
    }
  }

  public async handleAnimationCompleted(): Promise<void> {
    if (this.currentState === 'Playing') {
      await this.returnToIdle();
    }
  }

  private async returnToIdle(): Promise<void> {
    await this.setIdleState(1);
    this.resetIdleProgression();
  }

  public resetIdleProgression(): void {
    this.currentIdleLevel = 1;
    this.idleTickCount = 0;
    this.elapsedSinceLastTick = 0;
  }

  private async updateStateAnimation(): Promise<void> {
    const state = this.states[this.currentState];
    if (state && state.animations.length > 0) {
      const randomAnimation = state.animations[Math.floor(Math.random() * state.animations.length)];
      // Use the common playAnimation wrapper to ensure it respects exit branches
      // when a state animation is updated or replaced.
      await this.playAnimation(randomAnimation);
    }
  }

  public async handleVisibilityChange(showing: boolean): Promise<void> {
    const visibilityState = showing ? 'Showing' : 'Hiding';

    if (this.states[visibilityState]) {
      const state = this.states[visibilityState];
      if (state.animations.length > 0) {
        // Use the first animation for visibility transitions
        const animName = state.animations[0];

        // Ensure we are not paused while playing the visibility transition
        this.isPaused = false;

        // Start the animation and set the state to Showing/Hiding.
        // We AWAIT the full animation completion here to ensure it's shown in full.
        await this.animationManager.preloadAnimation(animName);
        this.currentState = visibilityState;
        await this.animationManager.playAnimation(animName, true);

        // Finalize state after animation finishes
        if (showing) {
            await this.returnToIdle();
        } else {
            this.currentState = 'Hidden';
            this.isPaused = true;
        }
        return;
      }
    }

    // Fallback if no specific animation exists
    if (showing) {
      this.isPaused = false;
      await this.returnToIdle();
    } else {
      this.isPaused = true;
      this.animationManager.setAnimation('', false);
      this.currentState = 'Hidden';
    }
  }
}
