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

        // Load the color table to get the transparency color
        const colorTableImg = new Image();
        colorTableImg.src = `${agentPath}/images/${this.characterDefinition.character.colorTable}`;
        await new Promise<void>((resolve) => {
            colorTableImg.onload = () => {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = colorTableImg.width;
                tempCanvas.height = colorTableImg.height;
                const tempCtx = tempCanvas.getContext('2d');
                if (tempCtx) {
                    tempCtx.drawImage(colorTableImg, 0, 0);
                    // The transparency index is used to look up the color in the color table.
                    // Assuming color table is a 1D or 2D array of colors.
                    // For Microsoft Agent, it's often a small image where each pixel is a palette entry.
                    const imageData = tempCtx.getImageData(this.characterDefinition.character.transparency, 0, 1, 1).data;
                    spriteManager.setTransparencyColor(imageData[0], imageData[1], imageData[2]);
                }
                resolve();
            };
            colorTableImg.onerror = () => {
                console.warn("Failed to load color table, using default pink transparency");
                // Magenta/Pink often used as transparency key
                spriteManager.setTransparencyColor(255, 0, 255);
                resolve();
            };
        });

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

        // Pre-load all frames
        const allFilenames = new Set<string>();
        Object.values(this.characterDefinition.animations).forEach(anim => {
            anim.frames.forEach(frame => {
                frame.images.forEach(img => {
                    allFilenames.add(img.filename);
                });
            });
        });
        await spriteManager.loadSprites(Array.from(allFilenames));

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
