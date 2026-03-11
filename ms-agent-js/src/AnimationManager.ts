import {
  type FrameDefinition,
  type Animation,
} from './types';
import { SpriteManager } from './SpriteManager';
import { AudioManager } from './AudioManager';

/**
 * AnimationManager class for handling low-level frame timing, branching, and sound synchronization.
 * It manages the progression through an animation's frame sequence and handles probabilistic branching.
 */
export class AnimationManager {
  private spriteManager: SpriteManager;
  private audioManager: AudioManager;
  /** Dictionary of all available animations for this character. */
  private animations: Record<string, Animation>;
  /** The currently playing animation. */
  private currentAnimation: Animation | null = null;
  /** The 0-based index of the current frame in the current animation. */
  private currentFrameIndex: number = 0;
  /** Timestamp (from performance.now()) when the current frame was first displayed. */
  private lastFrameTime: number = 0;
  /** A reference to the last valid (non-null) frame rendered, used as a buffer during logic frames. */
  private lastRenderedFrame: FrameDefinition | null = null;
  /** Whether the current animation is in the process of exiting via an exit branch. */
  private isExiting: boolean = false;
  /** Internal promise controls for the currently playing animation. */
  private animationPromise: { resolve: (val: boolean) => void; reject: (err: any) => void } | null = null;
  /** The promise for the active animation playback. */
  private activePromise: Promise<boolean> | null = null;
  /** Default scaling factor (usually overwritten by the Agent's options). */
  private scale: number = 2;

  /**
   * The name of the animation currently being played.
   */
  public get currentAnimationName(): string {
    return this.currentAnimation?.name || '';
  }

  /**
   * Whether the manager is currently in the process of exiting an animation.
   */
  public get isExitingFlag(): boolean {
    return this.isExiting;
  }

  public set isExitingFlag(value: boolean) {
    this.isExiting = value;
  }

  /**
   * The index of the frame currently being processed.
   */
  public get currentFrameIndexValue(): number {
    return this.currentFrameIndex;
  }

  /** Callback fired whenever the frame changes. */
  public onFrameChanged: (() => void) | null = null;
  /** Callback fired when an animation sequence finishes. */
  public onAnimationCompleted: ((animationName: string) => void) | null = null;

  /**
   * @param spriteManager - Manager for character image rendering.
   * @param audioManager - Manager for character sound playback.
   * @param animations - Record of animation definitions.
   */
  constructor(
    spriteManager: SpriteManager,
    audioManager: AudioManager,
    animations: Record<string, Animation>
  ) {
    this.spriteManager = spriteManager;
    this.audioManager = audioManager;
    this.animations = animations;
  }

  /**
   * Returns the frame definition that should currently be rendered.
   * Handles "null frames" (duration 0) by returning the last valid rendered frame instead.
   */
  public get currentFrame(): FrameDefinition | null {
    if (!this.currentAnimation || this.currentAnimation.frames.length === 0) {
      return this.lastRenderedFrame;
    }
    const frame = this.currentAnimation.frames[this.currentFrameIndex];
    // Don't display frames with duration 0 (logic frames); stick to the last valid one.
    if (frame.duration === 0) {
      return this.lastRenderedFrame;
    }
    return frame;
  }

  /**
   * Whether an animation is currently active and updating.
   */
  public get isAnimating(): boolean {
    return this.currentAnimation !== null && this.currentAnimation.name !== '' && (!this.isExiting || this.animationPromise !== null);
  }

  /**
   * Sets the current animation and starts its playback immediately.
   * Does not wait for completion or return a promise.
   *
   * @param animationName - The name of the animation to set.
   * @param useExitBranch - Whether to initialize the animation in an "exiting" state.
   */
  public setAnimation(animationName: string, useExitBranch: boolean = false): void {
    const animation = this.animations[animationName];
    if (animation) {
      const previousAnimation = this.currentAnimation?.name || '';
      this.isExiting = useExitBranch;
      this.currentAnimation = animation;
      this.currentFrameIndex = 0;
      this.lastFrameTime = performance.now();

      if (previousAnimation) {
        this.onAnimationCompleted?.(previousAnimation);
      }

      // Use update(now) to handle potential null frames at the start
      this.update(this.lastFrameTime);
    }
  }

  /**
   * Plays an animation and returns a promise that resolves when it's done.
   *
   * @param animationName - The name of the animation to play.
   * @param useExitBranch - Whether to start in an "exiting" state.
   * @returns A promise that resolves to true when the animation finishes.
   */
  public async playAnimation(animationName: string, useExitBranch: boolean = false): Promise<boolean> {
    this.activePromise = new Promise((resolve, reject) => {
      this.animationPromise = { resolve, reject };
      this.setAnimation(animationName, useExitBranch);
    });
    return this.activePromise;
  }

  /**
   * Updates the animation frame based on elapsed time.
   * This is called on every animation frame (e.g., from the Agent's main loop).
   * It handles frame timing, sound triggers, and instant "null frame" (logic frame) fast-forwarding.
   *
   * @param currentTime - The current performance timestamp.
   */
  public update(currentTime: number = performance.now()): void {
    if (!this.currentAnimation || this.currentAnimation.frames.length === 0) return;

    // If we've completed an exit animation, don't update further
    if (this.isExiting && !this.animationPromise) return;

    let safetyCounter = 0;
    const MAX_NULL_FRAMES = 100;

    // We use a while loop to handle sequential null-duration (logic) frames instantly
    while (this.currentAnimation && safetyCounter <= MAX_NULL_FRAMES) {
      let currentFrame = this.currentAnimation.frames[this.currentFrameIndex];

      // If it's a null frame (duration 0), handle it immediately and move to next
      if (currentFrame.duration === 0) {
        const nextIndex = this.getNextFrameIndex(currentFrame);
        this.checkAndPlaySound(currentFrame);
        if (this.checkAnimationCompletion(currentFrame, nextIndex)) return;

        this.currentFrameIndex = nextIndex;
        this.lastFrameTime = currentTime;
        this.onFrameChanged?.();
        this.checkAndPlaySound(this.currentAnimation.frames[this.currentFrameIndex]);

        safetyCounter++;
        if (safetyCounter > MAX_NULL_FRAMES) {
            console.warn(`MSAgentJS: Infinite loop detected in animation '${this.currentAnimation?.name}'. Safety break at frame ${this.currentFrameIndex}.`);
            break;
        }
        continue;
      }

      // If it's a normal frame, check if its display duration (in units of 10ms) has elapsed
      if (currentTime - this.lastFrameTime >= currentFrame.duration * 10) {
        const nextFrameIndex = this.getNextFrameIndex(currentFrame);
        this.checkAndPlaySound(currentFrame);

        if (this.checkAnimationCompletion(currentFrame, nextFrameIndex)) {
          return;
        }

        this.currentFrameIndex = nextFrameIndex;
        this.lastFrameTime = currentTime;

        this.onFrameChanged?.();
        this.checkAndPlaySound(this.currentAnimation.frames[this.currentFrameIndex]);

        // Continue the loop to potentially handle a null frame that we just moved into
        safetyCounter++;
        continue;
      }

      // If we reach here, it's a normal frame but not yet time to advance
      break;
    }
  }

  /**
   * Checks if the current animation should be marked as complete.
   * Completions occur either at the end of the frame sequence or when an exit branch loops back.
   */
  private checkAnimationCompletion(currentFrame: FrameDefinition, nextFrameIndex: number): boolean {
    if (this.isExiting) {
      // If we are exiting and reached the end (either by natural end or exit branch loop back to frame 0)
      if (currentFrame.exitBranch === undefined && nextFrameIndex === 0) {
        this.completeAnimation();
        return true;
      }
      if (currentFrame.exitBranch !== undefined && nextFrameIndex === 0) {
        this.completeAnimation();
        return true;
      }
    } else {
      // Normal completion when we loop back to the first frame
      if (nextFrameIndex === 0 && this.animationPromise) {
        this.completeAnimation();
        return true;
      }
    }
    return false;
  }

  /**
   * Determines the next frame index to jump to, considering exit branches and probabilities.
   */
  private getNextFrameIndex(currentFrame: FrameDefinition): number {
    // If exiting, prioritize the exit branch if it exists
    if (this.isExiting && currentFrame.exitBranch !== undefined) {
      return currentFrame.exitBranch - 1; // Frames in ACD are 1-based
    }

    // Normal playback handles probabilistic branching
    if (!this.isExiting && currentFrame.branching && currentFrame.branching.length > 0) {
      const randomValue = Math.floor(Math.random() * 100);
      let cumulative = 0;

      for (const branch of currentFrame.branching) {
        cumulative += branch.probability;
        if (randomValue < cumulative) {
          return branch.branchTo - 1;
        }
      }
    }

    // Default to sequential playback (wrapping around to 0)
    return (this.currentFrameIndex + 1) % this.currentAnimation!.frames.length;
  }

  /**
   * Interrupts the current animation and plays a new one.
   * If the current animation has an exit sequence, it will wait for that sequence to complete first.
   *
   * @param newAnimationName - The name of the animation to start.
   * @param useExitBranch - Whether the new animation should start in an exiting state.
   * @returns A promise that resolves when the *new* animation finishes.
   */
  public async interruptAndPlayAnimation(
    newAnimationName: string,
    useExitBranch: boolean = false
  ): Promise<boolean> {
    if (!this.isAnimating) {
      return this.playAnimation(newAnimationName, useExitBranch);
    }

    // Signal the current animation to interrupt and navigate towards its neutral frame via exit branches
    this.isExiting = true;

    // Wait for current animation to complete its exit sequence
    if (this.activePromise) {
      await this.activePromise;
    }

    // Play the new animation
    return this.playAnimation(newAnimationName, useExitBranch);
  }

  /**
   * Marks the current animation as finished and resolves any pending promises.
   */
  private completeAnimation(): void {
    if (this.animationPromise) {
      this.animationPromise.resolve(true);
      this.animationPromise = null;
      this.activePromise = null;
    }
    const completedAnimation = this.currentAnimation?.name || '';
    this.currentAnimation = null;
    this.onAnimationCompleted?.(completedAnimation);
  }

  /**
   * Checks if a frame has an associated sound effect and plays it if it does.
   */
  private checkAndPlaySound(frame: FrameDefinition | null): void {
    if (frame && frame.duration > 0) {
      this.lastRenderedFrame = frame;
    }
    if (frame?.soundEffect) {
      this.audioManager.playFrameSound(frame.soundEffect);
    }
  }

  /**
   * Draws the current animation frame onto the provided 2D canvas context.
   *
   * @param ctx - The destination canvas context.
   * @param x - Horizontal position.
   * @param y - Vertical position.
   * @param scale - Scaling factor.
   */
  public draw(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number = this.scale): void {
    const frame = this.currentFrame;
    if (frame) {
      this.spriteManager.drawFrame(ctx, frame, x, y, scale);
    }
  }

  /**
   * Preloads all image and audio assets for a specific animation.
   *
   * @param animationName - The animation to preload.
   */
  public async preloadAnimation(animationName: string): Promise<void> {
    const animation = this.animations[animationName];
    if (!animation) return;

    const soundsToLoad: string[] = [];
    for (const frame of animation.frames) {
      for (const img of frame.images) {
        await this.spriteManager.loadSprite(img.filename);
      }
      if (frame.soundEffect) {
        soundsToLoad.push(frame.soundEffect);
      }
    }
    if (soundsToLoad.length > 0) {
      await this.audioManager.loadSounds(soundsToLoad);
    }
  }
}
