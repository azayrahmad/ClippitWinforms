import {
  type FrameDefinition,
  type AgentCharacterDefinition,
  type OptimizedAgent,
} from './types';

/**
 * SpriteManager class for loading and rendering agent sprites.
 * Ported from C# SpriteManager.cs.
 */
export class SpriteManager {
  private sprites: Map<string, HTMLCanvasElement | HTMLImageElement> = new Map();
  private transparencyColor: { r: number; g: number; b: number } | null = null;
  private agentRoot: string;
  private definition: AgentCharacterDefinition;
  private optimizedData: OptimizedAgent | null = null;
  private spritesheetImage: HTMLImageElement | null = null;

  constructor(agentRoot: string, definition: AgentCharacterDefinition, optimizedData: OptimizedAgent | null = null) {
    this.agentRoot = agentRoot;
    this.definition = definition;
    this.optimizedData = optimizedData;
  }

  /**
   * Initializes the SpriteManager by loading the transparency color.
   */
  public async init(): Promise<void> {
    if (this.optimizedData) {
      await this.loadSpritesheet();
    } else {
      await this.loadTransparencyColor();
    }
  }

  private async loadSpritesheet(): Promise<void> {
    if (!this.optimizedData) return;
    const url = this.optimizedData.spritesheet.file.startsWith('http')
      ? this.optimizedData.spritesheet.file
      : `${this.agentRoot}/${this.optimizedData.spritesheet.file}`;

    this.spritesheetImage = await this.loadImage(url);
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  private async loadTransparencyColor(): Promise<void> {
    const colorTablePath = this.definition.character.colorTable;
    // The color table is usually in the agent root
    const colorTableUrl = colorTablePath.startsWith('http') ? colorTablePath : `${this.agentRoot}/${colorTablePath}`;
    const response = await fetch(colorTableUrl);
    if (!response.ok) {
      throw new Error(`Failed to load color table: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    this.transparencyColor = this.getPaletteColor(buffer, this.definition.character.transparency);
  }

  private getPaletteColor(buffer: ArrayBuffer, index: number): { r: number; g: number; b: number } {
    const view = new DataView(buffer);
    // BMP Header check: 'BM'
    const magic = view.getUint16(0, true);
    if (magic !== 0x4d42) {
      throw new Error(`Not a BMP file, magic: 0x${magic.toString(16)}`);
    }

    const infoHeaderSize = view.getUint32(14, true);
    const offsetToPalette = 14 + infoHeaderSize;

    // Each palette entry is 4 bytes (B, G, R, reserved)
    const paletteIndex = offsetToPalette + index * 4;

    if (paletteIndex + 3 > buffer.byteLength) {
      throw new Error('Palette index out of range');
    }

    return {
      b: view.getUint8(paletteIndex),
      g: view.getUint8(paletteIndex + 1),
      r: view.getUint8(paletteIndex + 2),
    };
  }

  /**
   * Loads a sprite BMP file and caches it.
   */
  public async loadSprite(filename: string): Promise<void> {
    if (this.optimizedData) {
      // In optimized mode, all sprites are in the spritesheet
      return;
    }
    if (this.sprites.has(filename)) return;

    // Fix path separators and normalization
    const normalizedFilename = filename.replace(/\\/g, '/').toLowerCase().split('/').pop() || filename;
    const url = filename.startsWith('http') ? filename : `${this.agentRoot}/images/${normalizedFilename}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load sprite ${filename}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    const canvas = this.bmpToCanvas(buffer);
    this.sprites.set(filename, canvas);
  }

  private bmpToCanvas(buffer: ArrayBuffer): HTMLCanvasElement {
    const view = new DataView(buffer);
    const magic = view.getUint16(0, true);
    if (magic !== 0x4d42) {
      throw new Error(`Not a BMP file, magic: 0x${magic.toString(16)}`);
    }

    const width = view.getInt32(18, true);
    const height = Math.abs(view.getInt32(22, true));
    const isBottomUp = view.getInt32(22, true) > 0;
    const bitCount = view.getUint16(28, true);

    if (bitCount !== 8 && bitCount !== 24 && bitCount !== 32) {
      throw new Error(`Unsupported BMP bit count: ${bitCount}-bit. Supported: 8, 24, 32.`);
    }

    const offsetToPixels = view.getUint32(10, true);
    const infoHeaderSize = view.getUint32(14, true);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(width, height);

    if (bitCount === 8) {
      const offsetToPalette = 14 + infoHeaderSize;
      const palette: { r: number; g: number; b: number }[] = [];
      const numColors = 256;
      for (let i = 0; i < numColors; i++) {
        const pIdx = offsetToPalette + i * 4;
        palette.push({
          b: view.getUint8(pIdx),
          g: view.getUint8(pIdx + 1),
          r: view.getUint8(pIdx + 2),
        });
      }

      const rowSize = Math.floor((8 * width + 31) / 32) * 4;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const bmpY = isBottomUp ? height - 1 - y : y;
          const pixelOffset = offsetToPixels + bmpY * rowSize + x;
          const paletteIndex = view.getUint8(pixelOffset);
          const color = palette[paletteIndex];
          const targetIndex = (y * width + x) * 4;
          this.setPixel(imageData, targetIndex, color.r, color.g, color.b);
        }
      }
    } else if (bitCount === 24) {
      const rowSize = Math.floor((24 * width + 31) / 32) * 4;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const bmpY = isBottomUp ? height - 1 - y : y;
          const pixelOffset = offsetToPixels + bmpY * rowSize + x * 3;
          const b = view.getUint8(pixelOffset);
          const g = view.getUint8(pixelOffset + 1);
          const r = view.getUint8(pixelOffset + 2);
          const targetIndex = (y * width + x) * 4;
          this.setPixel(imageData, targetIndex, r, g, b);
        }
      }
    } else if (bitCount === 32) {
      // 32-bit BMPs usually don't have row padding as they are already 4-byte aligned
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const bmpY = isBottomUp ? height - 1 - y : y;
          const pixelOffset = offsetToPixels + (bmpY * width + x) * 4;
          const b = view.getUint8(pixelOffset);
          const g = view.getUint8(pixelOffset + 1);
          const r = view.getUint8(pixelOffset + 2);
          // 32-bit usually has Alpha as the 4th byte, but we often ignore it for MS Agents
          // or use it if available. Here we prioritize the transparencyColor logic.
          const targetIndex = (y * width + x) * 4;
          this.setPixel(imageData, targetIndex, r, g, b);
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  private setPixel(imageData: ImageData, index: number, r: number, g: number, b: number): void {
    imageData.data[index] = r;
    imageData.data[index + 1] = g;
    imageData.data[index + 2] = b;

    if (
      this.transparencyColor &&
      r === this.transparencyColor.r &&
      g === this.transparencyColor.g &&
      b === this.transparencyColor.b
    ) {
      imageData.data[index + 3] = 0;
    } else {
      imageData.data[index + 3] = 255;
    }
  }

  /**
   * Draws a frame onto the provided context.
   */
  public drawFrame(
    ctx: CanvasRenderingContext2D,
    frame: FrameDefinition,
    x: number,
    y: number,
    scale: number = 1
  ): void {
    if (!frame.images) return;

    // Draw images in reverse order as per the original implementation
    for (let i = frame.images.length - 1; i >= 0; i--) {
      const imgDef = frame.images[i];

      if (this.optimizedData && this.spritesheetImage) {
        const filename = imgDef.filename.replace(/\\/g, '/').split('/').pop() || imgDef.filename;
        const mapEntry = this.optimizedData.spritesheet.map[filename] ||
                         this.optimizedData.spritesheet.map[filename.toLowerCase()] ||
                         this.optimizedData.spritesheet.map[filename.toUpperCase()];
        if (mapEntry) {
          ctx.drawImage(
            this.spritesheetImage,
            mapEntry.x,
            mapEntry.y,
            mapEntry.w,
            mapEntry.h,
            x + imgDef.offsetX * scale,
            y + imgDef.offsetY * scale,
            mapEntry.w * scale,
            mapEntry.h * scale
          );
        }
      } else {
        const sprite = this.sprites.get(imgDef.filename) as HTMLCanvasElement;
        if (sprite) {
          ctx.drawImage(
            sprite,
            x + imgDef.offsetX * scale,
            y + imgDef.offsetY * scale,
            sprite.width * scale,
            sprite.height * scale
          );
        }
      }
    }
  }

  public getSpriteWidth(): number {
    return this.definition.character.width;
  }

  public getSpriteHeight(): number {
    return this.definition.character.height;
  }
}
