import type { AgentCharacterDefinition, FrameDefinition } from './types';
import { AnimationManager } from './AnimationManager';
import { AudioManager } from './AudioManager';

export class Agent {
    private container: HTMLElement;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private animationManager: AnimationManager;
    private audioManager: AudioManager;
    private images: Record<string, HTMLImageElement> = {};
    private basePath: string;
    private scale: number = 2;

    constructor(definition: AgentCharacterDefinition, basePath: string) {
        this.basePath = basePath.endsWith('/') ? basePath : basePath + '/';

        this.container = document.createElement('div');
        this.container.style.position = 'absolute';
        this.container.style.cursor = 'move';
        this.container.style.width = `${definition.character.width * this.scale}px`;
        this.container.style.height = `${definition.character.height * this.scale}px`;
        this.container.style.userSelect = 'none';

        this.canvas = document.createElement('canvas');
        this.canvas.width = definition.character.width * this.scale;
        this.canvas.height = definition.character.height * this.scale;
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d')!;
        this.ctx.imageSmoothingEnabled = false;

        this.animationManager = new AnimationManager(definition.animations);
        this.audioManager = new AudioManager(`${this.basePath}Audio`);

        this.animationManager.onFrameChanged = (frame) => {
            this.drawFrame(frame);
            if (frame.soundEffect) {
                this.audioManager.playFrameSound(frame.soundEffect);
            }
        };

        this.setupDragging();
        this.startLoop();
    }

    private async loadImage(filename: string): Promise<HTMLImageElement> {
        if (this.images[filename]) return this.images[filename];

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.images[filename] = img;
                resolve(img);
            };
            img.onerror = reject;
            img.src = `${this.basePath}Images/${filename}`;
        });
    }

    private async drawFrame(frame: FrameDefinition) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (const imgDef of frame.images) {
            try {
                const img = await this.loadImage(imgDef.filename);
                this.ctx.drawImage(
                    img,
                    0, 0, img.width, img.height,
                    imgDef.offsetX * this.scale, imgDef.offsetY * this.scale,
                    img.width * this.scale, img.height * this.scale
                );
            } catch (e) {
                console.error('Failed to load image', imgDef.filename, e);
            }
        }
    }

    private setupDragging() {
        let isDragging = false;
        let startX = 0;
        let startY = 0;

        this.container.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX - this.container.offsetLeft;
            startY = e.clientY - this.container.offsetTop;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            this.container.style.left = `${e.clientX - startX}px`;
            this.container.style.top = `${e.clientY - startY}px`;
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    private startLoop() {
        const loop = () => {
            this.animationManager.update();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    public mount(parent: HTMLElement) {
        parent.appendChild(this.container);
    }

    public play(animationName: string) {
        return this.animationManager.playAnimation(animationName);
    }

    public getAnimations(): string[] {
        return this.animationManager.getAvailableAnimations();
    }
}
