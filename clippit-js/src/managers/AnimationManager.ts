import { Animation, FrameDefinition } from '../models/AgentCharacterDefinition';
import { ISpriteManager, DirectorySpriteManager } from './SpriteManager';

export class AnimationManager {
    private _currentAnimation: Animation | null = null;
    private _currentFrameIndex: number = 0;
    private _lastFrameTime: number = 0;
    private _isExiting: boolean = false;
    private _animationCompleteResolver: ((value: boolean) => void) | null = null;
    public static readonly Scale = 2;

    constructor(
        private spriteManager: ISpriteManager,
        private animations: { [key: string]: Animation },
        private onFrameChanged?: (frame: FrameDefinition) => void
    ) {}

    public get currentAnimationName(): string {
        return this._currentAnimation?.name || "";
    }

    public get frameIndex(): number {
        return this._currentFrameIndex;
    }

    public get isAnimating(): boolean {
        return this._currentAnimation !== null;
    }

    public setExiting(exiting: boolean): void {
        this._isExiting = exiting;
    }

    public getIsExiting(): boolean {
        return this._isExiting;
    }

    public async playAnimation(animationName: string, useExitBranch: boolean = false): Promise<void> {
        if (this._animationCompleteResolver) {
            this._animationCompleteResolver(false);
        }

        const animation = this.animations[animationName];
        if (!animation) {
            console.error(`Animation ${animationName} not found`);
            return;
        }

        // Load sprites for this animation if they are not already loaded
        if (this.spriteManager instanceof DirectorySpriteManager) {
            const spriteFilenames = new Set<string>();
            animation.frames.forEach(frame => {
                frame.images.forEach(image => {
                    spriteFilenames.add(image.filename);
                });
            });
            try {
                await (this.spriteManager as DirectorySpriteManager).loadSprites(Array.from(spriteFilenames));
            } catch (e) {
                console.warn(`Failed to load some sprites for animation ${animationName}`, e);
            }
        }

        this._currentAnimation = animation;
        this._currentFrameIndex = 0;
        this._isExiting = useExitBranch;
        this._lastFrameTime = Date.now();

        return new Promise((resolve) => {
            this._animationCompleteResolver = (success: boolean) => resolve();
        });
    }

    public update(): void {
        if (!this._currentAnimation) return;

        const currentFrame = this._currentAnimation.frames[this._currentFrameIndex];
        const currentTime = Date.now();

        if (currentTime - this._lastFrameTime >= currentFrame.duration * 10) {
            const nextFrameIndex = this.getNextFrameIndex(currentFrame);

            if (this._isExiting && currentFrame.exitBranch === undefined && nextFrameIndex === 0) {
                this.completeAnimation();
                return;
            }

            this._currentFrameIndex = nextFrameIndex;
            this._lastFrameTime = currentTime;

            if (this.onFrameChanged) {
                this.onFrameChanged(this._currentAnimation.frames[this._currentFrameIndex]);
            }

            if (!this._isExiting && this._currentFrameIndex === 0) {
                this.completeAnimation();
            }
        }
    }

    private getNextFrameIndex(currentFrame: FrameDefinition): number {
        if (this._isExiting && currentFrame.exitBranch !== undefined) {
            return currentFrame.exitBranch - 1;
        }

        if (currentFrame.branching && currentFrame.branching.length > 0) {
            const randomValue = Math.random() * 100;
            let cumulative = 0;

            for (const branch of currentFrame.branching) {
                cumulative += branch.probability;
                if (randomValue < cumulative) {
                    return branch.branchTo - 1;
                }
            }
        }

        return (this._currentFrameIndex + 1) % (this._currentAnimation?.frames.length || 1);
    }

    private completeAnimation(): void {
        if (this._animationCompleteResolver) {
            this._animationCompleteResolver(true);
            this._animationCompleteResolver = null;
        }
        // Keep the last frame or reset? C# seems to stop if isExiting, or loop if not.
        // For simplicity, let's clear it or keep it at 0.
    }

    public draw(ctx: CanvasRenderingContext2D): void {
        if (!this._currentAnimation) return;
        const currentFrame = this._currentAnimation.frames[this._currentFrameIndex];
        this.spriteManager.drawFrame(ctx, currentFrame, AnimationManager.Scale);
    }

    public getSelectableAnimations(): string[] {
        return Object.keys(this.animations).filter(name => !name.toLowerCase().startsWith('idle'));
    }

    public async interruptAndPlayAnimation(animationName: string): Promise<void> {
        await this.playAnimation(animationName, false);
    }
}
