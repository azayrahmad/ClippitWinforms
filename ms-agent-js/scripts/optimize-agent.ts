import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { CharacterParser } from '../src/CharacterParser.js';
import { AgentCharacterDefinition } from '../src/types.js';

// We need to shim some browser globals for CharacterParser if it uses them
// CharacterParser uses: fetch (static load only), Intl.Locale, uuid
// In Node 18+, fetch and Intl are available. uuid works in Node.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SpritesheetMapEntry {
    x: number;
    y: number;
    w: number;
    h: number;
}

interface AudioSpriteMapEntry {
    start: number;
    duration: number;
}

interface OptimizedAgent {
    definition: AgentCharacterDefinition;
    spritesheet: {
        file: string;
        map: Record<string, SpritesheetMapEntry>;
    };
    audio: {
        file: string;
        map: Record<string, AudioSpriteMapEntry>;
    };
}

async function getBmpTransparencyColor(bmpPath: string, transparencyIndex: number) {
    const buffer = fs.readFileSync(bmpPath);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    const magic = view.getUint16(0, true);
    if (magic !== 0x4d42) throw new Error(`Not a BMP: ${bmpPath}`);

    const infoHeaderSize = view.getUint32(14, true);
    const offsetToPalette = 14 + infoHeaderSize;
    const paletteIndex = offsetToPalette + transparencyIndex * 4;

    return {
        b: view.getUint8(paletteIndex),
        g: view.getUint8(paletteIndex + 1),
        r: view.getUint8(paletteIndex + 2),
    };
}

async function processBmp(bmpPath: string, transparencyColor: { r: number, g: number, b: number }) {
    const { data, info } = await sharp(bmpPath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const { r: tr, g: tg, b: tb } = transparencyColor;
    const pixels = new Uint8ClampedArray(data);

    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] === tr && pixels[i + 1] === tg && pixels[i + 2] === tb) {
            pixels[i + 3] = 0;
        }
    }

    return {
        data: Buffer.from(pixels),
        width: info.width,
        height: info.height
    };
}

async function optimizeAgent(agentDir: string, audioFormat: 'webm' | 'mp3' = 'webm') {
    const agentName = path.basename(agentDir);
    const optimizedDir = path.join(agentDir, 'optimized');

    if (!fs.existsSync(optimizedDir)) {
        fs.mkdirSync(optimizedDir, { recursive: true });
    }

    // 1. Parse ACD
    const acdFiles = fs.readdirSync(agentDir).filter(f => f.toLowerCase().endsWith('.acd'));
    if (acdFiles.length === 0) throw new Error(`No .acd file found in ${agentDir}`);

    // Try to find the one matching agent name first
    let acdFile = acdFiles.find(f => f.toLowerCase() === `${agentName.toLowerCase()}.acd`) || acdFiles[0];
    const acdContent = fs.readFileSync(path.join(agentDir, acdFile), 'utf-8');
    const parser = new CharacterParser();
    const definition = parser.parse(acdContent);

    // 2. Process Images
    console.log('Processing images...');
    const imageDir = path.join(agentDir, 'images');
    const imageFiles = fs.readdirSync(imageDir).filter(f => f.toLowerCase().endsWith('.bmp'));

    const colorTablePath = path.join(agentDir, definition.character.colorTable.replace(/\\/g, '/'));
    const transparencyColor = await getBmpTransparencyColor(colorTablePath, definition.character.transparency);

    const processedImages = [];
    const spritesheetMap: Record<string, SpritesheetMapEntry> = {};

    // For simplicity, we'll pack them in a vertical strip first
    // In a real packer we'd do something smarter, but this is a good start.
    let currentY = 0;
    let maxWidth = 0;

    for (const imgFile of imageFiles) {
        const { data, width, height } = await processBmp(path.join(imageDir, imgFile), transparencyColor);
        processedImages.push({ data, width, height, name: imgFile });

        spritesheetMap[imgFile] = {
            x: 0,
            y: currentY,
            w: width,
            h: height
        };

        currentY += height;
        maxWidth = Math.max(maxWidth, width);
    }

    // Create spritesheet
    const spritesheetBuffer = await sharp({
        create: {
            width: maxWidth,
            height: currentY,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    })
    .composite(processedImages.map(img => ({
        input: img.data,
        top: spritesheetMap[img.name].y,
        left: spritesheetMap[img.name].x,
        raw: {
            width: img.width,
            height: img.height,
            channels: 4
        }
    })))
    .webp({ lossless: true })
    .toFile(path.join(optimizedDir, 'spritesheet.webp'));

    console.log(`Spritesheet created: ${path.join(optimizedDir, 'spritesheet.webp')}`);

    // 3. Process Audio
    console.log('Processing audio...');
    const audioDir = path.join(agentDir, 'Audio');
    const audioFiles = fs.existsSync(audioDir) ? fs.readdirSync(audioDir).filter(f => f.toLowerCase().endsWith('.wav')) : [];
    const audioSpriteMap: Record<string, AudioSpriteMapEntry> = {};

    if (audioFiles.length > 0) {
        const audioExt = audioFormat === 'webm' ? 'webm' : 'mp3';
        const audioFile = `audio.${audioExt}`;
        const audioOutputPath = path.join(optimizedDir, audioFile);

        // We need to get durations of each file to build the map
        let currentTime = 0;

        // Create a temporary file list for ffmpeg concat
        const concatFilePath = path.join(optimizedDir, 'concat.txt');
        let concatContent = '';

        for (const file of audioFiles) {
            const duration = await new Promise<number>((resolve, reject) => {
                ffmpeg.ffprobe(path.join(audioDir, file), (err, metadata) => {
                    if (err) reject(err);
                    else resolve(metadata.format.duration || 0);
                });
            });

            audioSpriteMap[file] = {
                start: currentTime,
                duration: duration
            };

            concatContent += `file '${path.join(audioDir, file)}'\n`;
            currentTime += duration;
        }

        fs.writeFileSync(concatFilePath, concatContent);

        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(concatFilePath)
                .inputOptions(['-f concat', '-safe 0'])
                .output(audioOutputPath)
                .on('end', () => {
                    fs.unlinkSync(concatFilePath);
                    resolve();
                })
                .on('error', (err) => reject(err))
                .run();
        });

        console.log(`Audio sprite created: ${audioOutputPath}`);
    }

    // 4. Save agent.json
    const optimizedAgent: OptimizedAgent = {
        definition,
        spritesheet: {
            file: 'spritesheet.webp',
            map: spritesheetMap
        },
        audio: {
            file: audioFiles.length > 0 ? `audio.${audioFormat}` : '',
            map: audioSpriteMap
        }
    };

    fs.writeFileSync(path.join(optimizedDir, 'agent.json'), JSON.stringify(optimizedAgent, null, 2));
    console.log(`Optimized agent data saved to: ${path.join(optimizedDir, 'agent.json')}`);
}

const args = process.argv.slice(2);
if (args.length < 1) {
    console.log('Usage: node optimize-agent.js <agent-directory> [audio-format: webm|mp3]');
    process.exit(1);
}

const agentDir = path.resolve(args[0]);
const audioFormat = (args[1] || 'webm') as 'webm' | 'mp3';

optimizeAgent(agentDir, audioFormat).catch(err => {
    console.error('Optimization failed:', err);
    process.exit(1);
});
