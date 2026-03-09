import {
  type FrameDefinition,
  type AgentCharacterDefinition,
} from './types';

/**
 * SpriteManager class for loading and rendering agent sprites.
 * Ported from C# SpriteManager.cs.
 */
export class SpriteManager {
  private sprites: Map<string, HTMLCanvasElement> = new Map();
  private transparencyColor: { r: number; g: number; b: number } | null = null;
  private agentRoot: string;
  private definition: AgentCharacterDefinition;

  constructor(agentRoot: string, definition: AgentCharacterDefinition) {
    this.agentRoot = agentRoot;
    this.definition = definition;
  }

  /**
   * Initializes the SpriteManager by loading the transparency color.
   */
  public async init(): Promise<void> {
    await this.loadTransparencyColor();
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
    if (this.sprites.has(filename)) return;

    // Fix path separators and normalization
    const normalizedFilename = filename.replace(/\\/g, '/').split('/').pop() || filename;
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

    if (bitCount !== 8) {
      throw new Error(`Only 8-bit indexed BMPs are supported, got ${bitCount}-bit`);
    }

    const offsetToPixels = view.getUint32(10, true);
    const infoHeaderSize = view.getUint32(14, true);
    const offsetToPalette = 14 + infoHeaderSize;

    const palette: { r: number; g: number; b: number }[] = [];
    const numColors = 256; // For 8-bit
    for (let i = 0; i < numColors; i++) {
      const pIdx = offsetToPalette + i * 4;
      palette.push({
        b: view.getUint8(pIdx),
        g: view.getUint8(pIdx + 1),
        r: view.getUint8(pIdx + 2),
      });
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(width, height);

    // Row size is rounded up to the nearest 4 bytes
    const rowSize = Math.floor((8 * width + 31) / 32) * 4;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // BMP stores rows bottom-to-top by default
        const bmpY = isBottomUp ? height - 1 - y : y;
        const pixelOffset = offsetToPixels + bmpY * rowSize + x;
        const paletteIndex = view.getUint8(pixelOffset);
        const color = palette[paletteIndex];

        const targetIndex = (y * width + x) * 4;
        imageData.data[targetIndex] = color.r;
        imageData.data[targetIndex + 1] = color.g;
        imageData.data[targetIndex + 2] = color.b;

        // Apply transparency
        if (
          this.transparencyColor &&
          color.r === this.transparencyColor.r &&
          color.g === this.transparencyColor.g &&
          color.b === this.transparencyColor.b
        ) {
          imageData.data[targetIndex + 3] = 0;
        } else {
          imageData.data[targetIndex + 3] = 255;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
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
      const sprite = this.sprites.get(imgDef.filename);
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

  public getSpriteWidth(): number {
    return this.definition.character.width;
  }

  public getSpriteHeight(): number {
    return this.definition.character.height;
  }
}
