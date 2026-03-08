import { FrameDefinition } from '../models/AgentCharacterDefinition';
import { ISpriteManager } from './SpriteManager';

export interface SpriteSheetMetadata {
    agent: string;
    width: number;
    height: number;
    atlas: string;
    frames: {
        [key: string]: {
            x: number;
            y: number;
            w: number;
            h: number;
        }
    }
}

export class SpriteSheetManager implements ISpriteManager {
    private atlasImage: HTMLImageElement | null = null;
    private metadata: SpriteSheetMetadata | null = null;

    constructor(private agentPath: string) {}

    public async load(): Promise<void> {
        const response = await fetch(`${this.agentPath}/spritesheet.json`);
        if (!response.ok) throw new Error("Could not load spritesheet.json");

        this.metadata = await response.json();

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.atlasImage = img;
                resolve();
            };
            img.onerror = reject;
            img.src = `${this.agentPath}/${this.metadata!.atlas}`;
        });
    }

    public get spriteWidth(): number {
        return this.metadata?.width || 0;
    }

    public get spriteHeight(): number {
        return this.metadata?.height || 0;
    }

    public drawFrame(ctx: CanvasRenderingContext2D, frame: FrameDefinition, scale: number): void {
        if (!this.atlasImage || !this.metadata) return;

        if (frame.images && frame.images.length > 0) {
            for (let i = 0; i < frame.images.length; i++) {
                const imageDef = frame.images[i];
                const filename = imageDef.filename.split(/[\\/]/).pop() || "";
                const frameId = filename.split('.')[0];

                const frameMeta = this.metadata.frames[frameId];
                if (frameMeta) {
                    const destX = imageDef.offsetX * scale;
                    const destY = imageDef.offsetY * scale;
                    const destW = this.spriteWidth * scale;
                    const destH = this.spriteHeight * scale;

                    ctx.drawImage(
                        this.atlasImage,
                        frameMeta.x, frameMeta.y, frameMeta.w, frameMeta.h,
                        destX, destY, destW, destH
                    );
                }
            }
        }
    }
}
