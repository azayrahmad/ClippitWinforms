import { AgentCharacterDefinition } from '../models/AgentCharacterDefinition';
import { CharacterParser } from '../services/CharacterParser';
import { AnimationManager } from './AnimationManager';
import { DirectorySpriteManager } from './SpriteManager';
import { AudioManager } from './AudioManager';
import { StateManager } from './StateManager';

export class Agent {
    private animationManager!: AnimationManager;
    private audioManager!: AudioManager;
    private stateManager!: StateManager;
    private characterDefinition!: AgentCharacterDefinition;

    constructor(private canvas: HTMLCanvasElement) {}

    public async initialize(agentPath: string): Promise<void> {
        let response = await fetch(`${agentPath}/agent.acd`);
        if (!response.ok) {
            const agentName = agentPath.split('/').pop();
            response = await fetch(`${agentPath}/${agentName}.acd`);
        }

        if (!response.ok) {
            console.error(`Failed to fetch agent definition from ${agentPath}`);
            return;
        }
        const text = await response.text();

        const parser = new CharacterParser();
        this.characterDefinition = parser.parseFromText(text);

        // Robust path and asset detection
        let imagesPath = `${agentPath}/images`;
        let audioPath = `${agentPath}/audio`;

        const colorTable = this.characterDefinition.character.colorTable;
        // Clean up color table filename (handle Windows backslashes)
        const cleanColorTable = colorTable.split(/[\\/]/).pop() || "";

        const colorTableOptions = [
            `${agentPath}/Images/${cleanColorTable}`,
            `${agentPath}/images/${cleanColorTable}`,
            `${agentPath}/Images/ColorTable.bmp`,
            `${agentPath}/images/ColorTable.bmp`,
            `${agentPath}/Images/0000.bmp`,
            `${agentPath}/images/0000.bmp`
        ];

        let foundColorTable = false;
        for (const option of colorTableOptions) {
            try {
                const res = await fetch(option);
                if (res.ok) {
                    imagesPath = option.substring(0, option.lastIndexOf('/'));
                    const fileName = option.substring(option.lastIndexOf('/') + 1);
                    this.characterDefinition.character.colorTable = fileName;
                    foundColorTable = true;
                    break;
                }
            } catch(e) {}
        }

        const spriteManager = new DirectorySpriteManager(imagesPath, this.characterDefinition.character);

        // Load the color table to get the transparency color
        const colorTableImg = new Image();
        colorTableImg.src = `${imagesPath}/${this.characterDefinition.character.colorTable}`;

        await new Promise<void>((resolve) => {
            colorTableImg.onload = () => {
                try {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = colorTableImg.width;
                    tempCanvas.height = colorTableImg.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    if (tempCtx) {
                        tempCtx.drawImage(colorTableImg, 0, 0);
                        const imageData = tempCtx.getImageData(this.characterDefinition.character.transparency, 0, 1, 1).data;
                        spriteManager.setTransparencyColor(imageData[0], imageData[1], imageData[2]);
                    }
                } catch (e) {
                    console.warn("Failed to process color table, using default pink transparency", e);
                    spriteManager.setTransparencyColor(255, 0, 255);
                }
                resolve();
            };
            colorTableImg.onerror = () => {
                console.warn(`Failed to load color table image from ${colorTableImg.src}, using default pink transparency`);
                spriteManager.setTransparencyColor(255, 0, 255);
                resolve();
            };
        });

        // Detect audio path
        const audioOptions = [`${agentPath}/Audio`, `${agentPath}/audio`];
        for (const option of audioOptions) {
            try {
                const res = await fetch(`${option}/`);
                if (res.ok) {
                    audioPath = option;
                    break;
                }
            } catch(e) {}
        }

        this.audioManager = new AudioManager(audioPath);
        this.animationManager = new AnimationManager(
            spriteManager,
            this.characterDefinition.animations,
            (frame) => {
                if (frame.soundEffect) {
                    this.audioManager.playFrameSound(frame.soundEffect);
                }
            }
        );

        this.stateManager = new StateManager(this.characterDefinition.states, this.animationManager);
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

    public async playAnimation(name: string, timeoutMs?: number, stateName: string = ""): Promise<void> {
        await this.stateManager.playAnimation(name, timeoutMs, stateName);
    }

    public getSelectableAnimations(): string[] {
        return this.animationManager.getSelectableAnimations();
    }

    public getAvailableStates(): string[] {
        return this.stateManager.getAvailableStates();
    }

    public async setState(state: string): Promise<void> {
        await this.stateManager.setState(state);
    }

    public async start(): Promise<void> {
        await this.stateManager.setState("Playing");

        // Try Greeting, then Show, then fallback
        const anims = this.getSelectableAnimations();
        if (anims.includes("Greeting")) {
            await this.playAnimation("Greeting");
        } else if (anims.includes("Show")) {
            await this.playAnimation("Show");
        }

        const states = this.getAvailableStates();
        if (states.includes("IdlingLevel1")) {
            await this.stateManager.setState("IdlingLevel1");
        } else if (states.length > 0) {
            await this.stateManager.setState(states[0]);
        }
    }

    public async stop(): Promise<void> {
        await this.stateManager.playClosingAnimation();
        this.stateManager.dispose();
    }

    public async playRandomAnimation(): Promise<void> {
        await this.stateManager.playRandomAnimation();
    }

    public async handleVisibilityChange(isVisible: boolean): Promise<void> {
        await this.stateManager.handleVisibilityChange(isVisible);
    }

    public get width(): number {
        return this.characterDefinition.character.width * AnimationManager.Scale;
    }

    public get height(): number {
        return this.characterDefinition.character.height * AnimationManager.Scale;
    }
}
