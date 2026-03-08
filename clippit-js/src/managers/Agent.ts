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
    private animationFrameId: number | null = null;

    constructor(private canvas: HTMLCanvasElement) {}

    public async initialize(agentPath: string): Promise<void> {
        // Handle trailing slashes in agentPath and ensure we get a valid name
        const normalizedPath = agentPath.replace(/\/$/, "");
        const pathSegments = normalizedPath.split('/');
        const agentName = pathSegments[pathSegments.length - 1] || "agent";
        console.log(`Initializing agent ${agentName} at ${normalizedPath}`);

        const tryPaths = [
            `${normalizedPath}/${agentName.toUpperCase()}.acd`,
            `${normalizedPath}/${agentName}.acd`,
            `${normalizedPath}/agent.acd`
        ];

        let response: Response | null = null;
        for (const path of tryPaths) {
            try {
                const res = await fetch(path);
                if (res.ok) {
                    const contentType = res.headers.get("content-type");
                    if (contentType && contentType.includes("text/html")) {
                        continue;
                    }
                    const textSample = await res.clone().text();
                    if (textSample.trim().startsWith("<!DOCTYPE html>")) {
                         continue;
                    }
                    response = res;
                    console.log(`Found ACD at ${path}`);
                    break;
                }
            } catch (e) {
                console.warn(`Error fetching ${path}`, e);
            }
        }

        if (!response || !response.ok) {
            throw new Error(`Failed to fetch agent definition from ${normalizedPath}`);
        }

        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder('windows-1252');
        const text = decoder.decode(buffer);

        const parser = new CharacterParser();
        this.characterDefinition = parser.parseFromText(text);

        if (!this.characterDefinition || !this.characterDefinition.character) {
             throw new Error("Invalid character definition");
        }

        console.log(`Character dimensions: ${this.characterDefinition.character.width}x${this.characterDefinition.character.height}, Transparency index: ${this.characterDefinition.character.transparency}`);

        // Robust path and asset detection
        let imagesPath = `${normalizedPath}/images`;
        let audioPath = `${normalizedPath}/audio`;

        // Find correct Images directory and ColorTable
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
                    const contentType = res.headers.get("content-type");
                    if (contentType && contentType.includes("text/html")) continue;

                    imagesPath = option.substring(0, option.lastIndexOf('/'));
                    const fileName = option.substring(option.lastIndexOf('/') + 1);
                    this.characterDefinition.character.colorTable = fileName;
                    console.log(`Found images path: ${imagesPath}, colorTable: ${fileName}`);
                    break;
                }
            } catch(e) {}
        }

        const spriteManager = new DirectorySpriteManager(imagesPath, this.characterDefinition.character);

        // Load the color table to get the transparency color by reading BMP palette directly
        // This is more reliable than canvas for 8-bit indexed BMPs
        try {
            const colorTablePath = `${imagesPath}/${this.characterDefinition.character.colorTable}`;
            const res = await fetch(colorTablePath);
            if (res.ok) {
                const buffer = await res.arrayBuffer();
                const view = new DataView(buffer);
                // Check for 'BM' signature
                if (view.getUint16(0, true) === 0x4D42) {
                    const bpp = view.getUint16(28, true);
                    if (bpp === 8) {
                        const index = this.characterDefinition.character.transparency;
                        // BMP Palette starts at 54 (14 file header + 40 info header)
                        // Each entry is 4 bytes (B, G, R, reserved)
                        const offset = 54 + (index * 4);
                        if (offset + 2 < buffer.byteLength) {
                            const b = view.getUint8(offset);
                            const g = view.getUint8(offset + 1);
                            const r = view.getUint8(offset + 2);
                            console.log(`Transparency index ${index} resolved from BMP palette to RGB: ${r},${g},${b}`);
                            spriteManager.setTransparencyColor(r, g, b);
                        } else {
                            throw new Error("Transparency index out of palette bounds");
                        }
                    } else {
                        // For non-8bit color tables (unusual), fallback to middle pixel or magenta
                        spriteManager.setTransparencyColor(255, 0, 255);
                    }
                }
            } else {
                throw new Error("Could not fetch color table");
            }
        } catch (e) {
            console.warn("Failed to read color table BMP, using default pink transparency", e);
            spriteManager.setTransparencyColor(255, 0, 255);
        }

        // Detect audio path
        const audioOptions = [`${normalizedPath}/Audio`, `${normalizedPath}/audio`];
        for (const option of audioOptions) {
            try {
                const resWav = await fetch(`${option}/0001.wav`);
                if (resWav.ok) {
                    const contentType = resWav.headers.get("content-type");
                    if (contentType && contentType.includes("text/html")) continue;

                    audioPath = option;
                    console.log(`Found audio path: ${audioPath}`);
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

        // Preload the first frame so it's visible immediately
        try {
            await spriteManager.loadSprite("0000.bmp");
        } catch (e) {
            console.warn("Could not preload frame 0000.bmp", e);
        }

        this.startLoop();
    }

    private startLoop(): void {
        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;

        const loop = () => {
            this.update();
            this.draw(ctx);
            this.animationFrameId = requestAnimationFrame(loop);
        };
        this.animationFrameId = requestAnimationFrame(loop);
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
        const anims = this.getSelectableAnimations();
        if (anims.includes("Greeting")) {
            await this.playAnimation("Greeting", undefined, "Playing");
        } else if (anims.includes("Show")) {
            await this.playAnimation("Show", undefined, "Playing");
        } else {
            await this.stateManager.setState("IdlingLevel1");
        }
    }

    public async stop(): Promise<void> {
        if (this.stateManager) {
            await this.stateManager.playClosingAnimation();
            this.stateManager.dispose();
        }
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        // Clear canvas on stop
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    public async playRandomAnimation(): Promise<void> {
        await this.stateManager.playRandomAnimation();
    }

    public async handleVisibilityChange(isVisible: boolean): Promise<void> {
        await this.stateManager.handleVisibilityChange(isVisible);
    }

    public get width(): number {
        return (this.characterDefinition?.character?.width || 124) * AnimationManager.Scale;
    }

    public get height(): number {
        return (this.characterDefinition?.character?.height || 93) * AnimationManager.Scale;
    }
}
