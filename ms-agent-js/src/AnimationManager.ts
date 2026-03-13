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
  /** Whether the current animation should loop back to the beginning instead of completing. */
  private isLooping: boolean = false;
  /** Whether shortcut branches (leading to the end) should be ignored during playback. */
  private suppressShortcuts: boolean = false;
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
   * Whether the animation is current in a looping state.
   */
  public get isLoopingFlag(): boolean {
    return this.isLooping;
  }

  /**
   * Whether the manager is currently in the process of exiting an animation.
   */
  public get isExitingFlag(): boolean {
    return this.isExiting;
  }

  public set isExitingFlag(value: boolean) {
    const wasExiting = this.isExiting;
    this.isExiting = value;

    // When exiting, we no longer want to loop or suppress shortcuts
    if (value) {
      this.isLooping = false;
      this.suppressShortcuts = false;
    }

    // If we just started exiting, and we are currently animating,
    // check if we can jump to an exit branch or break a loop immediately.
    if (value && !wasExiting && this.currentAnimation) {
      const currentFrame = this.currentAnimation.frames[this.currentFrameIndex];
      if (currentFrame) {
        const { index: nextIndex, isBranch } =
          this.getNextFrameDetails(currentFrame);

        if (nextIndex !== null) {
          const oldFrame = currentFrame;
          this.currentFrameIndex = nextIndex;
          this.lastFrameTime = performance.now();
          this.onFrameChanged?.();
          this.checkAndPlaySound(
            this.currentAnimation.frames[this.currentFrameIndex],
          );

          if (this.checkAnimationCompletion(oldFrame, nextIndex, isBranch))
            return;

          // Also call update to handle potential null (logic) frames at the new position
          this.update(this.lastFrameTime);
        }
      }
    }
  }

  /**
   * The index of the frame currently being processed.
   */
  public get currentFrameIndexValue(): number {
    return this.currentFrameIndex;
  }

  /**
   * Enables or disables continuous looping for the current animation.
   */
  public set isLoopingFlag(value: boolean) {
    this.isLooping = value;
  }

  /**
   * Enables or disables suppression of "shortcut" branches that lead to the end of the animation.
   */
  public set suppressShortcutsFlag(value: boolean) {
    this.suppressShortcuts = value;
  }

  public get suppressShortcutsFlag(): boolean {
    return this.suppressShortcuts;
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
    return this.currentAnimation !== null;
  }

  /**
   * Sets the current animation and starts its playback immediately.
   * Does not wait for completion or return a promise.
   *
   * @param animationName - The name of the animation to set.
   * @param useExitBranch - Whether to initialize the animation in an "exiting" state.
   */
  public setAnimation(
    animationName: string,
    useExitBranch: boolean = false,
    isLooping: boolean = false,
    suppressShortcuts: boolean = false,
  ): void {
    const animation = this.animations[animationName];
    if (animation) {
      const previousAnimation = this.currentAnimation?.name || '';

      this.currentAnimation = animation;
      this.currentFrameIndex = 0;
      this.lastFrameTime = performance.now();
      // Reset flags but call the setter to trigger immediate exit jumps if needed
      this.isExiting = false;
      this.isLooping = isLooping;
      this.suppressShortcuts = suppressShortcuts;

      if (previousAnimation && previousAnimation !== animationName) {
        this.onAnimationCompleted?.(previousAnimation);
      }

      this.isExitingFlag = useExitBranch;

      // Use update(now) to handle potential null frames at the start
      this.update(this.lastFrameTime);
    } else if (animationName === '') {
      this.currentAnimation = null;
      this.isExiting = false;
      this.isLooping = false;
      this.suppressShortcuts = false;
    }
  }

  /**
   * Plays an animation and returns a promise that resolves when it's done.
   *
   * @param animationName - The name of the animation to play.
   * @param useExitBranch - Whether to start in an "exiting" state.
   * @param isLooping - Whether the animation should loop continuously.
   * @param suppressShortcuts - Whether to ignore shortcut branches during playback.
   * @returns A promise that resolves to true when the animation finishes.
   */
  public async playAnimation(
    animationName: string,
    useExitBranch: boolean = false,
    isLooping: boolean = false,
    suppressShortcuts: boolean = false,
  ): Promise<boolean> {
    // If we are already playing an animation and it hasn't finished, resolve it now
    // to prevent deadlocks when starting a new one.
    if (this.animationPromise) {
      const p = this.animationPromise;
      this.animationPromise = null;
      p.resolve(true);
    }

    this.activePromise = new Promise((resolve, reject) => {
      this.animationPromise = { resolve, reject };
      this.setAnimation(animationName, useExitBranch, isLooping, suppressShortcuts);
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
    if (!this.currentAnimation || this.currentAnimation.frames.length === 0)
      return;

    // If we've completed an exit animation, don't update further
    if (this.isExiting && !this.animationPromise) return;

    let safetyCounter = 0;
    const MAX_NULL_FRAMES = 100;

    // We use a while loop to handle sequential null-duration (logic) frames instantly
    while (this.currentAnimation && safetyCounter <= MAX_NULL_FRAMES) {
      const currentFrame = this.currentAnimation.frames[this.currentFrameIndex];

      // If it's a null frame (duration 0), handle it immediately and move to next
      if (currentFrame.duration === 0) {
        const { index: nextIndex, isBranch } =
          this.getNextFrameDetails(currentFrame);
        this.checkAndPlaySound(currentFrame);
        if (this.checkAnimationCompletion(currentFrame, nextIndex, isBranch))
          return;

        this.currentFrameIndex = nextIndex;
        this.lastFrameTime = currentTime;
        this.onFrameChanged?.();
        this.checkAndPlaySound(
          this.currentAnimation.frames[this.currentFrameIndex],
        );

        safetyCounter++;
        if (safetyCounter > MAX_NULL_FRAMES) {
          console.warn(
            `MSAgentJS: Infinite loop detected in animation '${this.currentAnimation?.name}'. Safety break at frame ${this.currentFrameIndex}.`,
          );
          break;
        }
        continue;
      }

      // If it's a normal frame, check if its display duration (in units of 10ms) has elapsed
      if (currentTime - this.lastFrameTime >= currentFrame.duration * 10) {
        const { index: nextIndex, isBranch } =
          this.getNextFrameDetails(currentFrame);
        this.checkAndPlaySound(currentFrame);

        if (this.checkAnimationCompletion(currentFrame, nextIndex, isBranch)) {
          return;
        }

        this.currentFrameIndex = nextIndex;
        this.lastFrameTime = currentTime;

        this.onFrameChanged?.();
        this.checkAndPlaySound(
          this.currentAnimation.frames[this.currentFrameIndex],
        );

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
  private checkAnimationCompletion(
    currentFrame: FrameDefinition,
    nextFrameIndex: number,
    isBranch: boolean,
  ): boolean {
    const isAtLastFrame =
      this.currentFrameIndex === this.currentAnimation!.frames.length - 1;
    const nextIsNeutral = nextFrameIndex === 0;

    if (this.isExiting) {
      // If we are exiting and reached the end (either by natural end or exit branch loop back to frame 0)
      if (nextIsNeutral) {
        this.completeAnimation();
        return true;
      }
    } else if (this.animationPromise) {
      // Normal completion when we loop back to the first frame sequentially
      // Or if we take a branch that explicitly points back to Frame 0
      if (nextIsNeutral) {
        // If looping, we never complete naturally
        if (this.isLooping) {
          return false;
        }

        // If it's a natural wrap-around from the last frame, it's definitely completion.
        if (isAtLastFrame) {
          this.completeAnimation();
          return true;
        }

        // If it's a branch to 0 from an earlier frame, it's an internal loop.
        // TripleAgent/clippy.js often treat branching to 0 as continuation.
        // However, if the user sees 'one frame and ends', it might be because the branch
        // probability is very high and it's looping back to 0 (neutral pose) instantly.
        // We will keep it as continuation for now to preserve sequence integrity.
      }
    }
    return false;
  }

  /**
   * Determines the next frame index to jump to, considering exit branches and probabilities.
   */
  private getNextFrameDetails(currentFrame: FrameDefinition): {
    index: number;
    isBranch: boolean;
  } {
    // If exiting, prioritize the exit branch if it exists
    if (this.isExiting && currentFrame.exitBranch !== undefined) {
      return { index: currentFrame.exitBranch - 1, isBranch: true };
    }

    // If exiting, we still want to follow "forward" branches that take us closer to the end
    // (frame 0). If no forward branches exist, we ignore branching to break loops.
    const branching = currentFrame.branching || [];
    const useBranchingWhileExiting =
      this.isExiting &&
      branching.some(
        (b) => b.branchTo - 1 > this.currentFrameIndex || b.branchTo - 1 === 0,
      );

    if (
      branching.length > 0 &&
      (!this.isExiting || useBranchingWhileExiting)
    ) {
      const randomValue = Math.floor(Math.random() * 100);
      let cumulative = 0;

      const filteredBranches = branching.filter(branch => {
        if (this.suppressShortcuts && !this.isExiting) {
          const isForwardJump = branch.branchTo - 1 > this.currentFrameIndex;
          const isLoopBack = branch.branchTo === 1;
          return !(isLoopBack || (isForwardJump && branch.branchTo - 1 > this.currentFrameIndex + 2));
        }
        return true;
      });

      // If variety is suppressed, fall back to sequential if no valid branches left
      if (filteredBranches.length > 0) {
        for (const branch of filteredBranches) {
          // If exiting, only consider forward-leading branches
          if (this.isExiting) {
            const isForward =
              branch.branchTo - 1 > this.currentFrameIndex ||
              (branch.branchTo - 1 === 0 && this.currentFrameIndex > 0);
            if (!isForward) continue;
          }

          cumulative += branch.probability;
          if (randomValue < cumulative) {
            return { index: branch.branchTo - 1, isBranch: true };
          }
        }
      }
    }

    // Default to sequential playback (wrapping around to 0)
    const next =
      (this.currentFrameIndex + 1) % this.currentAnimation!.frames.length;
    return { index: next, isBranch: false };
  }

  /**
   * Interrupts the current animation and plays a new one.
   * If the current animation has an exit sequence, it will wait for that sequence to complete first.
   *
   * @param newAnimationName - The name of the animation to start.
   * @param useExitBranch - Whether the new animation should start in an exiting state.
   * @param isLooping - Whether the new animation should loop.
   * @param suppressShortcuts - Whether to ignore variety shortcuts in the new animation.
   * @returns A promise that resolves when the *new* animation finishes.
   */
  public async interruptAndPlayAnimation(
    newAnimationName: string,
    useExitBranch: boolean = false,
    isLooping: boolean = false,
    suppressShortcuts: boolean = false,
  ): Promise<boolean> {
    if (!this.isAnimating) {
      return this.playAnimation(newAnimationName, useExitBranch, isLooping, suppressShortcuts);
    }

    // Signal the current animation to interrupt and navigate towards its neutral frame via exit branches
    this.isExitingFlag = true;

    // Wait for current animation to complete its exit sequence
    if (this.activePromise) {
      await this.activePromise;
    }

    // Play the new animation
    return this.playAnimation(newAnimationName, useExitBranch, isLooping, suppressShortcuts);
  }

  /**
   * Marks the current animation as finished and resolves any pending promises.
   */
  private completeAnimation(): void {
    const completedAnimation = this.currentAnimation?.name || '';
    if (this.animationPromise) {
      this.animationPromise.resolve(true);
      this.animationPromise = null;
      this.activePromise = null;
    }
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
