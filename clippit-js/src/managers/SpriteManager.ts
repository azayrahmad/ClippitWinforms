import { FrameDefinition } from '../models/AgentCharacterDefinition';

export interface ISpriteManager {
    drawFrame(ctx: CanvasRenderingContext2D, frame: FrameDefinition, scale: number): void;
    spriteWidth: number;
    spriteHeight: number;
}

export class DirectorySpriteManager implements ISpriteManager {
    private sprites: Map<number, HTMLImageElement> = new Map();
    private width: number;
    private height: number;
    private transparencyKey: string | null = null;

    constructor(private directoryPath: string, character: any) {
        this.width = character.width;
        this.height = character.height;
        // In web version, we might handle transparency differently (e.g., pre-processed images)
        // or using canvas to filter. For now, assuming standard images.
    }

    public async loadSprites(filenames: string[]): Promise<void> {
        const promises = filenames.map(filename => {
            return new Promise<void>((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const frameNumber = parseInt(filename.split('.')[0]);
                    this.sprites.set(frameNumber, img);
                    resolve();
                };
                img.onerror = reject;
                img.src = `${this.directoryPath}/${filename}`;
            });
        });
        await Promise.all(promises);
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
