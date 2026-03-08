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
        // Handle trailing slashes in agentPath
        const normalizedPath = agentPath.replace(/\/$/, "");
        const agentName = normalizedPath.split('/').pop() || "agent";
        console.log(`Initializing agent ${agentName} at ${normalizedPath}`);

        const tryPaths = [
            `${normalizedPath}/${agentName.toUpperCase()}.acd`,
            `${normalizedPath}/${agentName}.acd`,
            `${normalizedPath}/agent.acd`
        ];

        let response: Response | null = null;
        for (const path of tryPaths) {
            console.log(`Trying to fetch ACD from ${path}`);
            const res = await fetch(path);
            if (res.ok) {
                // Double check it's not HTML (Vite fallback)
                const text = await res.clone().text();
                if (!text.trim().startsWith("<!DOCTYPE html>")) {
                    response = res;
                    console.log(`Found ACD at ${path}`);
                    break;
                } else {
                    console.log(`Fetch returned HTML instead of ACD at ${path}`);
                }
            }
        }

        if (!response || !response.ok) {
            console.error(`Failed to fetch agent definition from ${normalizedPath}`);
            return;
        }
        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder('windows-1252');
        const text = decoder.decode(buffer);

        const parser = new CharacterParser();
        this.characterDefinition = parser.parseFromText(text);

        // Robust path and asset detection
        let imagesPath = `${normalizedPath}/images`;
        let audioPath = `${normalizedPath}/audio`;

        const colorTable = this.characterDefinition.character.colorTable || "ColorTable.bmp";
        const cleanColorTable = colorTable.split(/[\\/]/).pop() || "ColorTable.bmp";

        const colorTableOptions = [
            `${normalizedPath}/Images/${cleanColorTable}`,
            `${normalizedPath}/images/${cleanColorTable}`,
            `${normalizedPath}/Images/ColorTable.bmp`,
            `${normalizedPath}/images/ColorTable.bmp`,
            `${normalizedPath}/Images/0000.bmp`,
            `${normalizedPath}/images/0000.bmp`
        ];

        for (const option of colorTableOptions) {
            try {
                const res = await fetch(option);
                if (res.ok) {
                    const text = await res.clone().text();
                    if (!text.trim().startsWith("<!DOCTYPE html>")) {
                        imagesPath = option.substring(0, option.lastIndexOf('/'));
                        const fileName = option.substring(option.lastIndexOf('/') + 1);
                        this.characterDefinition.character.colorTable = fileName;
                        break;
                    }
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
        const audioOptions = [`${normalizedPath}/Audio`, `${normalizedPath}/audio`];
        for (const option of audioOptions) {
            try {
                const resWav = await fetch(`${option}/0001.wav`);
                if (resWav.ok) {
                    const text = await resWav.clone().text();
                    if (!text.trim().startsWith("<!DOCTYPE html>")) {
                        audioPath = option;
                        break;
                    }
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
