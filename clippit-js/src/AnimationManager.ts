import type { Animation, FrameDefinition } from './types';

export class AnimationManager {
    private animations: Record<string, Animation>;
    public currentAnimation?: Animation;
    public currentFrameIndex: number = 0;
    private lastFrameTime: number = 0;
    public isExiting: boolean = false;
    private animationCompleteResolver?: (value: boolean) => void;

    public onFrameChanged?: (frame: FrameDefinition) => void;
    public onAnimationCompleted?: (name: string) => void;

    constructor(animations: Record<string, Animation>) {
        this.animations = animations;
    }

    public getAvailableAnimations(): string[] {
        return Object.keys(this.animations);
    }

    public async playAnimation(name: string, useExitBranch: boolean = false): Promise<boolean> {
        const animation = this.animations[name];
        if (!animation) return false;

        if (this.animationCompleteResolver) {
            this.animationCompleteResolver(false);
        }

        this.currentAnimation = animation;
        this.currentFrameIndex = 0;
        this.lastFrameTime = performance.now();
        this.isExiting = useExitBranch;

        if (this.onFrameChanged) {
            this.onFrameChanged(this.currentAnimation.frames[this.currentFrameIndex]);
        }

        return new Promise((resolve) => {
            this.animationCompleteResolver = resolve;
        });
    }

    public update() {
        if (!this.currentAnimation || this.currentAnimation.frames.length === 0) return;

        const currentTime = performance.now();
        const currentFrame = this.currentAnimation.frames[this.currentFrameIndex];

        // Duration in ACD files seems to be in 10ms units based on C# code (* 10)
        if (currentTime - this.lastFrameTime >= currentFrame.duration * 10) {
            const nextFrameIndex = this.getNextFrameIndex(currentFrame);

            if (this.isExiting && currentFrame.exitBranch === undefined && nextFrameIndex === 0) {
                this.completeAnimation();
                return;
            }

            this.currentFrameIndex = nextFrameIndex;
            this.lastFrameTime = currentTime;

            if (!this.isExiting && this.currentFrameIndex === 0) {
                this.completeAnimation();
            }

            if (this.onFrameChanged) {
                this.onFrameChanged(this.currentAnimation.frames[this.currentFrameIndex]);
            }
        }
    }

    private completeAnimation() {
        const name = this.currentAnimation!.name;
        // In C# it doesn't null currentAnimation immediately, but let's keep it playing the last frame or 0th frame
        if (this.animationCompleteResolver) {
            this.animationCompleteResolver(true);
            this.animationCompleteResolver = undefined;
        }
        if (this.onAnimationCompleted) {
            this.onAnimationCompleted(name);
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

        return (this.currentFrameIndex + 1) % this.currentAnimation!.frames.length;
    }
}
