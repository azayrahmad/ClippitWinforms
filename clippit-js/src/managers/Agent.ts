import { AgentCharacterDefinition } from '../models/AgentCharacterDefinition';
import { CharacterParser } from '../services/CharacterParser';
import { AnimationManager } from './AnimationManager';
import { DirectorySpriteManager } from './SpriteManager';
import { AudioManager } from './AudioManager';

export class Agent {
    private animationManager!: AnimationManager;
    private audioManager!: AudioManager;
    private characterDefinition!: AgentCharacterDefinition;

    constructor(private canvas: HTMLCanvasElement) {}

    public async initialize(agentPath: string): Promise<void> {
        const response = await fetch(`${agentPath}/agent.acd`);
        if (!response.ok) {
            console.error(`Failed to fetch agent definition: ${response.statusText}`);
            return;
        }
        const text = await response.text();

        const parser = new CharacterParser();
        this.characterDefinition = parser.parseFromText(text);

        const spriteManager = new DirectorySpriteManager(`${agentPath}/images`, this.characterDefinition.character);
        // In a real scenario, we'd list files. For demo, we might need a manifest or known files.
        // For now, let's assume we know what to load or load on demand.
        // To keep it simple, let's just load some if we had a list.

        this.audioManager = new AudioManager(`${agentPath}/audio`);
        this.animationManager = new AnimationManager(
            spriteManager,
            this.characterDefinition.animations,
            (frame) => {
                if (frame.soundEffect) {
                    this.audioManager.playFrameSound(frame.soundEffect);
                }
            }
        );

        // Pre-load frames for demo
        await spriteManager.loadSprites(['0001.bmp', '0002.bmp']);

        this.startLoop();
    }

    private startLoop(): void {
        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;

        const loop = () => {
            this.update();
            this.draw(ctx);
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    private update(): void {
        if (this.animationManager) {
            this.animationManager.update();
        }
    }

    private draw(ctx: CanvasRenderingContext2D): void {
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.animationManager) {
            this.animationManager.draw(ctx);
        }
    }

    public async playAnimation(name: string): Promise<void> {
        await this.animationManager.playAnimation(name);
    }

    public getSelectableAnimations(): string[] {
        return this.animationManager.getSelectedAnimations();
    }

    public get width(): number {
        return this.characterDefinition.character.width * AnimationManager.Scale;
    }

    public get height(): number {
        return this.characterDefinition.character.height * AnimationManager.Scale;
    }
}
