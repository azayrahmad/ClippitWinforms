import { State } from '../models/AgentCharacterDefinition';
import { AnimationManager } from './AnimationManager';

export class StateManager {
    private states: Map<string, string[]>;
    private currentState: string = "IdlingLevel1";
    private currentIdleLevel: number = 1;
    private idleTickCount: number = 0;
    private stateTimer: number | null = null;

    private readonly IdlePrefix = "IdlingLevel";
    private readonly MaxIdleLevel = 3;
    private readonly TicksPerLevel = 12;
    private readonly TimerInterval = 10000; // 10 seconds

    constructor(
        statesDict: { [key: string]: State },
        private animationManager: AnimationManager
    ) {
        this.states = new Map();
        for (const key in statesDict) {
            const state = statesDict[key];
            this.states.set(state.name, state.animations);
        }
        this.startTimer();
    }

    private startTimer() {
        if (this.stateTimer) clearInterval(this.stateTimer);
        this.stateTimer = window.setInterval(() => this.onTimerTick(), this.TimerInterval);
    }

    public stopTimer() {
        if (this.stateTimer) {
            clearInterval(this.stateTimer);
            this.stateTimer = null;
        }
    }

    private async onTimerTick() {
        if (this.currentState === "Playing") {
            return;
        }

        if (this.isIdleState(this.currentState)) {
            this.idleTickCount++;

            if (this.idleTickCount >= this.TicksPerLevel && this.currentIdleLevel < this.MaxIdleLevel) {
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
        return state.toLowerCase().startsWith(this.IdlePrefix.toLowerCase());
    }

    private async setIdleState(level: number) {
        const newState = `${this.IdlePrefix}${level}`;
        if (this.states.has(newState)) {
            this.currentState = newState;
            await this.updateStateAnimation();
        }
    }

    public async setState(stateName: string) {
        if (!this.states.has(stateName) && stateName !== "Playing") {
            console.warn(`Invalid state name: ${stateName}. Available: ${Array.from(this.states.keys()).join(", ")}`);
            return;
        }

        if (!this.isIdleState(stateName)) {
            this.resetIdleProgression();
        }

        this.currentState = stateName;

        if (stateName !== "Playing") {
            await this.updateStateAnimation();
        }
    }

    public async playAnimation(animationName: string, timeoutMs?: number, stateName: string = "") {
        if (stateName) {
            this.currentState = stateName;
        }

        try {
            if (timeoutMs) {
                const animationPromise = this.animationManager.playAnimation(animationName);
                const timeoutPromise = new Promise((resolve) => setTimeout(() => {
                    this.animationManager.setExiting(true);
                    resolve(null);
                }, timeoutMs));

                await Promise.race([animationPromise, timeoutPromise]);
            } else {
                await this.animationManager.playAnimation(animationName);
            }
        } finally {
            if (this.currentState === "Playing") {
                this.animationManager.setExiting(true);
            }
            await this.handleAnimationCompleted();
        }
    }

    public async handleAnimationCompleted() {
        if (this.animationManager.getIsExiting() && this.currentState === "Playing") {
            this.animationManager.setExiting(false);
            await this.returnToIdle();
        }
    }

    private async returnToIdle() {
        if (this.states.has("IdlingLevel1")) {
            await this.setState("IdlingLevel1");
        } else {
            const keys = Array.from(this.states.keys());
            if (keys.length > 0) {
                await this.setState(keys[0]);
            }
        }
    }

    public getCurrentState(): string {
        return this.currentState;
    }

    public getAvailableStates(): string[] {
        return Array.from(this.states.keys());
    }

    private async updateStateAnimation() {
        const animations = this.states.get(this.currentState);
        if (animations && animations.length > 0) {
            const randomAnimation = animations[Math.floor(Math.random() * animations.length)];
            await this.playAnimation(randomAnimation);
        }
    }

    public async playRandomAnimation() {
        const animations = this.animationManager.getSelectableAnimations();
        if (animations.length > 0) {
            const randomAnimation = animations[Math.floor(Math.random() * animations.length)];
            await this.playAnimation(randomAnimation, 5000, "Playing");
        }
    }

    public async handleVisibilityChange(showing: boolean) {
        this.stopTimer();
        this.animationManager.setExiting(true);

        const visibilityState = showing ? "Showing" : "Hiding";
        await this.setState(visibilityState);

        if (showing) {
            this.resetIdleProgression();
            await this.setIdleState(1);
            this.startTimer();
        }
    }

    public resetIdleProgression() {
        this.currentIdleLevel = 1;
        this.idleTickCount = 0;
    }

    public async playClosingAnimation() {
        this.stopTimer();
        await this.playAnimation("Goodbye");
    }

    public dispose() {
        this.stopTimer();
    }
}
