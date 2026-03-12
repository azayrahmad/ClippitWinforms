import {
  type FrameDefinition,
  type Animation,
} from './types';
import { SpriteManager } from './SpriteManager';
import { AudioManager } from './AudioManager';

/**
 * AnimationManager class for handling agent animations.
 * Ported from C# AnimationManager.cs.
 */
export class AnimationManager {
  private spriteManager: SpriteManager;
  private audioManager: AudioManager;
  private animations: Record<string, Animation>;
  private currentAnimation: Animation | null = null;
  private currentFrameIndex: number = 0;
  private lastFrameTime: number = 0;
  private lastRenderedFrame: FrameDefinition | null = null;
  private isExiting: boolean = false;
  private animationPromise: { resolve: (val: boolean) => void; reject: (err: any) => void } | null = null;
  private activePromise: Promise<boolean> | null = null;
  private scale: number = 2;

  public get currentAnimationName(): string {
    return this.currentAnimation?.name || '';
  }

  public get isExitingFlag(): boolean {
    return this.isExiting;
  }

  public set isExitingFlag(value: boolean) {
    this.isExiting = value;
  }

  public get currentFrameIndexValue(): number {
    return this.currentFrameIndex;
  }

  public onFrameChanged: (() => void) | null = null;
  public onAnimationCompleted: ((animationName: string) => void) | null = null;

  constructor(
    spriteManager: SpriteManager,
    audioManager: AudioManager,
    animations: Record<string, Animation>
  ) {
    this.spriteManager = spriteManager;
    this.audioManager = audioManager;
    this.animations = animations;
  }

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

  public get isAnimating(): boolean {
    return this.currentAnimation !== null && this.currentAnimation.name !== '' && (!this.isExiting || this.animationPromise !== null);
  }

  /**
   * Sets the current animation without waiting for it to complete.
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
   */
  public update(currentTime: number = performance.now()): void {
    if (!this.currentAnimation || this.currentAnimation.frames.length === 0) return;

    // If we've completed an exit animation, don't update further
    if (this.isExiting && !this.animationPromise) return;

    let safetyCounter = 0;
    const MAX_NULL_FRAMES = 100;

    while (this.currentAnimation && safetyCounter <= MAX_NULL_FRAMES) {
      let currentFrame = this.currentAnimation.frames[this.currentFrameIndex];

      // If it's a null frame, handle it immediately
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

      // If it's a normal frame, check if it's time to move to the next
      if (currentTime - this.lastFrameTime >= (currentFrame.duration * 10)) {
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

  private checkAnimationCompletion(currentFrame: FrameDefinition, nextFrameIndex: number): boolean {
    if (this.isExiting) {
      // If we are exiting and reached the end (either by natural end or exit branch loop back)
      if (currentFrame.exitBranch === undefined && nextFrameIndex === 0) {
        this.completeAnimation();
        return true;
      }
      if (currentFrame.exitBranch !== undefined && nextFrameIndex === 0) {
        this.completeAnimation();
        return true;
      }
    } else {
      // Normal completion
      if (nextFrameIndex === 0 && this.animationPromise) {
        this.completeAnimation();
        return true;
      }
    }
    return false;
  }

  private getNextFrameIndex(currentFrame: FrameDefinition): number {
    if (this.isExiting && currentFrame.exitBranch !== undefined) {
      return currentFrame.exitBranch - 1;
    }

    if (currentFrame.branching && currentFrame.branching.length > 0) {
      const randomValue = Math.floor(Math.random() * 100);
      let cumulative = 0;

      for (const branch of currentFrame.branching) {
        cumulative += branch.probability;
        if (randomValue < cumulative) {
          const nextIndex = branch.branchTo - 1;

          // If exiting, we only follow branches that:
          // 1. Are NOT "variety" (i.e., this is the only branch and it's 100%)
          // 2. AND are forward jumps (avoids getting stuck in uninterruptible loops)
          if (this.isExiting) {
            const isVariety = currentFrame.branching.length > 1 || branch.probability < 100;
            const isForward = nextIndex > this.currentFrameIndex;
            if (isVariety || !isForward) {
              continue; // Skip this branch and try to fall through to next sequential frame
            }
          }

          return nextIndex;
        }
      }
    }

    return (this.currentFrameIndex + 1) % this.currentAnimation!.frames.length;
  }

  public async interruptAndPlayAnimation(
    newAnimationName: string,
    useExitBranch: boolean = false
  ): Promise<boolean> {
    if (!this.isAnimating) {
      return this.playAnimation(newAnimationName, useExitBranch);
    }

    // Trigger exit branch of current animation
    this.isExiting = true;

    // Wait for current animation to complete its exit branch
    if (this.activePromise) {
      await this.activePromise;
    }

    // Play the new animation
    return this.playAnimation(newAnimationName, useExitBranch);
  }

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

  private checkAndPlaySound(frame: FrameDefinition | null): void {
    if (frame && frame.duration > 0) {
      this.lastRenderedFrame = frame;
    }
    if (frame?.soundEffect) {
      this.audioManager.playFrameSound(frame.soundEffect);
    }
  }

  /**
   * Draws the current frame onto the provided context.
   */
  public draw(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number = this.scale): void {
    const frame = this.currentFrame;
    if (frame) {
      this.spriteManager.drawFrame(ctx, frame, x, y, scale);
    }
  }

  /**
   * Preloads all sprites for a given animation.
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
