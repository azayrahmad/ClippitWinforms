import { FrameDefinition } from '../models/AgentCharacterDefinition';

export interface ISpriteManager {
    drawFrame(ctx: CanvasRenderingContext2D, frame: FrameDefinition, scale: number): void;
    spriteWidth: number;
    spriteHeight: number;
}

export class DirectorySpriteManager implements ISpriteManager {
    private sprites: Map<number, HTMLImageElement | HTMLCanvasElement> = new Map();
    private width: number;
    private height: number;
    private transparencyKey: string | null = null;

    private transparencyRGB: { r: number, g: number, b: number } | null = null;

    constructor(private directoryPath: string, character: any) {
        this.width = character.width;
        this.height = character.height;
    }

    public setTransparencyColor(r: number, g: number, b: number): void {
        this.transparencyRGB = { r, g, b };
        // If we already loaded sprites, we'd need to re-process them.
        // For simplicity, this should be called before loadSprites.
    }

    public async loadSprites(filenames: string[]): Promise<void> {
        const promises = filenames.map(filename => {
            return new Promise<void>((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const frameNumber = parseInt(filename.split('.')[0]);
                    const processedImg = this.processTransparency(img);
                    this.sprites.set(frameNumber, processedImg);
                    resolve();
                };
                img.onerror = reject;
                img.src = `${this.directoryPath}/${filename}`;
            });
        });
        await Promise.all(promises);
    }

    private processTransparency(img: HTMLImageElement): HTMLCanvasElement | HTMLImageElement {
        if (!this.transparencyRGB) return img;

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return img;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            if (r === this.transparencyRGB.r && g === this.transparencyRGB.g && b === this.transparencyRGB.b) {
                data[i + 3] = 0; // Set alpha to 0
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    public get spriteWidth(): number { return this.width; }
    public get spriteHeight(): number { return this.height; }

    public drawFrame(ctx: CanvasRenderingContext2D, frame: FrameDefinition, scale: number): void {
        if (frame.images && frame.images.length > 0) {
            for (let i = frame.images.length - 1; i >= 0; i--) {
                const imageDef = frame.images[i];
                const frameNumber = parseInt(imageDef.filename.split('.')[0]);
                const sprite = this.sprites.get(frameNumber);

                if (sprite) {
                    // Use a temporary canvas to scale if needed, or draw directly
                    const destX = imageDef.offsetX * scale;
                    const destY = imageDef.offsetY * scale;
                    const destW = this.width * scale;
                    const destH = this.height * scale;

                    // If the sprite is larger than the character dimensions, it's likely a sprite sheet.
                    // But in DirectorySpriteManager, each 'frameNumber' maps to one file.
                    // The issue in the demo was that I used the full map.png as 0001.bmp.

                    ctx.drawImage(
                        sprite,
                        0, 0, this.width, this.height, // Source: assume file contains one frame
                        destX, destY, destW, destH     // Destination
                    );
                }
            }
        }
    }
}
