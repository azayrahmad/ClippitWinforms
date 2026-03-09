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
  private isExiting: boolean = false;
  private animationPromise: { resolve: (val: boolean) => void; reject: (err: any) => void } | null = null;
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
    if (!this.currentAnimation || this.currentAnimation.frames.length === 0) return null;
    return this.currentAnimation.frames[this.currentFrameIndex];
  }

  public get isAnimating(): boolean {
    return this.currentAnimation !== null;
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

      this.onFrameChanged?.();
      if (previousAnimation) {
        this.onAnimationCompleted?.(previousAnimation);
      }

      // Load first frame's sound if any
      this.checkAndPlaySound(this.currentFrame);
    }
  }

  /**
   * Plays an animation and returns a promise that resolves when it's done.
   */
  public async playAnimation(animationName: string, useExitBranch: boolean = false): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.animationPromise = { resolve, reject };
      this.setAnimation(animationName, useExitBranch);
    });
  }

  /**
   * Updates the animation frame based on elapsed time.
   */
  public update(currentTime: number = performance.now()): void {
    if (!this.currentAnimation || this.currentAnimation.frames.length === 0) return;

    const currentFrame = this.currentAnimation.frames[this.currentFrameIndex];

    // Frame duration is in centiseconds, convert to milliseconds
    if (currentTime - this.lastFrameTime >= currentFrame.duration * 10) {
      const nextFrameIndex = this.getNextFrameIndex(currentFrame);

      if (this.isExiting && currentFrame.exitBranch === undefined && nextFrameIndex === 0) {
        this.completeAnimation();
        return;
      }

      this.currentFrameIndex = nextFrameIndex;
      this.lastFrameTime = currentTime;

      if (!this.isExiting && this.currentFrameIndex === 0 && this.animationPromise) {
        this.completeAnimation();
      } else {
        this.onFrameChanged?.();
        this.checkAndPlaySound(this.currentAnimation.frames[this.currentFrameIndex]);
      }
    }
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
          return branch.branchTo - 1;
        }
      }
    }

    return (this.currentFrameIndex + 1) % this.currentAnimation!.frames.length;
  }

  public async interruptAndPlayAnimation(newAnimationName: string): Promise<boolean> {
    if (!this.isAnimating) {
      return this.playAnimation(newAnimationName);
    }

    // If the animation being interrupted is an Idle animation, we can skip the exit branch
    // to make manual interactions feel more responsive.
    const isIdle = this.currentAnimation?.name.toLowerCase().startsWith('idle');

    if (!isIdle) {
      // Trigger exit branch of current animation
      this.isExiting = true;

      // Wait for current animation to complete its exit branch
      if (this.animationPromise) {
        await new Promise((resolve) => {
          const checkCompletion = () => {
            if (!this.isAnimating || !this.isExiting) {
               resolve(true);
            } else {
               setTimeout(checkCompletion, 16);
            }
          };
          checkCompletion();
        });
      }
    }

    // Play the new animation
    return this.playAnimation(newAnimationName);
  }

  private completeAnimation(): void {
    if (this.animationPromise) {
      this.animationPromise.resolve(true);
      this.animationPromise = null;
    }
    const completedAnimation = this.currentAnimation?.name || '';
    this.onAnimationCompleted?.(completedAnimation);
  }

  private checkAndPlaySound(frame: FrameDefinition | null): void {
    if (frame?.soundEffect) {
      this.audioManager.playFrameSound(frame.soundEffect);
    }
  }

  /**
   * Draws the current frame onto the provided context.
   */
  public draw(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const frame = this.currentFrame;
    if (frame) {
      this.spriteManager.drawFrame(ctx, frame, x, y, this.scale);
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
