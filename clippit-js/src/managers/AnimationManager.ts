import { Animation, FrameDefinition } from '../models/AgentCharacterDefinition';
import { ISpriteManager } from './SpriteManager';

export class AnimationManager {
    private currentAnimation: Animation | null = null;
    private currentFrameIndex: number = 0;
    private lastFrameTime: number = 0;
    private isExiting: boolean = false;
    private animationCompleteResolver: ((value: boolean) => void) | null = null;
    public static readonly Scale = 2;

    constructor(
        private spriteManager: ISpriteManager,
        private animations: { [key: string]: Animation },
        private onFrameChanged?: (frame: FrameDefinition) => void
    ) {}

    public get currentAnimationName(): string {
        return this.currentAnimation?.name || "";
    }

    public get frameIndex(): number {
        return this.currentFrameIndex;
    }

    public async playAnimation(animationName: string, useExitBranch: boolean = false): Promise<void> {
        if (this.animationCompleteResolver) {
            this.animationCompleteResolver(false);
        }

        const animation = this.animations[animationName];
        if (!animation) {
            console.error(`Animation ${animationName} not found`);
            return;
        }

        this.currentAnimation = animation;
        this.currentFrameIndex = 0;
        this.isExiting = useExitBranch;
        this.lastFrameTime = Date.now();

        return new Promise((resolve) => {
            this.animationCompleteResolver = (success: boolean) => resolve();
        });
    }

    public update(): void {
        if (!this.currentAnimation) return;

        const currentFrame = this.currentAnimation.frames[this.currentFrameIndex];
        const currentTime = Date.now();

        if (currentTime - this.lastFrameTime >= currentFrame.duration * 10) {
            const nextFrameIndex = this.getNextFrameIndex(currentFrame);

            if (this.isExiting && currentFrame.exitBranch === undefined && nextFrameIndex === 0) {
                this.completeAnimation();
                return;
            }

            this.currentFrameIndex = nextFrameIndex;
            this.lastFrameTime = currentTime;

            if (this.onFrameChanged) {
                this.onFrameChanged(this.currentAnimation.frames[this.currentFrameIndex]);
            }

            if (!this.isExiting && this.currentFrameIndex === 0) {
                this.completeAnimation();
            }
        }
    }

    private getNextFrameIndex(currentFrame: FrameDefinition): number {
        if (this.isExiting && currentFrame.exitBranch !== undefined) {
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

        return (this.currentFrameIndex + 1) % (this.currentAnimation?.frames.length || 1);
    }

    private completeAnimation(): void {
        if (this.animationCompleteResolver) {
            this.animationCompleteResolver(true);
            this.animationCompleteResolver = null;
        }
        // Keep the last frame or reset? C# seems to stop if isExiting, or loop if not.
        // For simplicity, let's clear it or keep it at 0.
    }

    public draw(ctx: CanvasRenderingContext2D): void {
        if (!this.currentAnimation) return;
        const currentFrame = this.currentAnimation.frames[this.currentFrameIndex];
        this.spriteManager.drawFrame(ctx, currentFrame, AnimationManager.Scale);
    }

    public getSelectedAnimations(): string[] {
        return Object.keys(this.animations).filter(name => !name.toLowerCase().startsWith('idle'));
    }
}
