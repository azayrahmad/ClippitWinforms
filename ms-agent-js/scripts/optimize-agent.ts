import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import Jimp from 'jimp';
import sharp from 'sharp';
import { CharacterParser } from '../src/CharacterParser';
import type { AgentCharacterDefinition, AudioAtlasEntry, AtlasEntry } from '../src/types';

// Mock some browser globals for CharacterParser
(global as any).fetch = async (url: string) => {
    const content = fs.readFileSync(url, 'utf-8');
    return {
        ok: true,
        text: async () => content
    };
};

interface ProcessedImage {
    filename: string;
    buffer: Buffer;
    width: number;
    height: number;
    trimX: number;
    trimY: number;
}

async function optimizeAgent(agentDir: string) {
    const agentName = path.basename(agentDir);
    const acdPath = path.join(agentDir, `${agentName.toUpperCase()}.acd`);

    console.log(`Optimizing agent: ${agentName}`);

    // 1. Load existing agent.json if it exists to preserve audioAtlas
    let existingDefinition: any = {};
    const jsonPath = path.join(agentDir, 'agent.json');
    if (fs.existsSync(jsonPath)) {
        existingDefinition = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    }

    // 2. Parse ACD
    const definition = await CharacterParser.load(acdPath);

    // 3. Collect all unique images
    const imagesToProcess = new Set<string>();
    Object.values(definition.animations).forEach(anim => {
        anim.frames.forEach(frame => {
            frame.images.forEach(img => {
                const normalized = img.filename.replace(/\\/g, '/').toLowerCase();
                img.filename = normalized; // Normalize in definition too
                imagesToProcess.add(normalized);
            });
        });
    });

    const imageList = Array.from(imagesToProcess).sort();
    console.log(`Found ${imageList.length} unique images.`);

    // 4. Load transparency color
    let colorTablePath = path.join(agentDir, definition.character.colorTable.replace(/\\/g, '/'));
    if (!fs.existsSync(colorTablePath)) {
        colorTablePath = path.join(agentDir, 'images', 'colortable.bmp');
    }
    if (!fs.existsSync(colorTablePath)) {
        colorTablePath = path.join(agentDir, 'Images', 'ColorTable.bmp');
    }
    const colorTableBmp = await Jimp.read(colorTablePath);
    const transIdx = definition.character.transparency;
    const transColor = colorTableBmp.getPixelColor(transIdx, 0);
    const { r, g, b } = Jimp.intToRGBA(transColor);
    console.log(`Transparency color: RGB(${r}, ${g}, ${b}) at index ${transIdx}`);

    // 5. Process and Trim Images
    const processedImages: ProcessedImage[] = [];
    for (const filename of imageList) {
        let imgPath = path.join(agentDir, filename);
        if (!fs.existsSync(imgPath)) {
            imgPath = path.join(agentDir, 'Images', path.basename(filename));
        }
        if (!fs.existsSync(imgPath)) {
             imgPath = path.join(agentDir, 'images', path.basename(filename).toLowerCase());
        }

        try {
            const img = await Jimp.read(imgPath);
            // Apply transparency
            img.scan(0, 0, img.bitmap.width, img.bitmap.height, function(x, y, idx) {
                if (this.bitmap.data[idx] === r &&
                    this.bitmap.data[idx+1] === g &&
                    this.bitmap.data[idx+2] === b) {
                    this.bitmap.data[idx+3] = 0;
                } else {
                    this.bitmap.data[idx+3] = 255;
                }
            });

            const pngBuffer = await img.getBufferAsync(Jimp.MIME_PNG);
            let processed;
            try {
                processed = await sharp(pngBuffer)
                    .trim()
                    .toBuffer({ resolveWithObject: true });
            } catch (trimErr) {
                // If trim fails (e.g. image too small), use original
                processed = await sharp(pngBuffer)
                    .toBuffer({ resolveWithObject: true });
            }

            processedImages.push({
                filename,
                buffer: processed.data,
                width: processed.info.width,
                height: processed.info.height,
                trimX: processed.info.trimOffsetLeft !== undefined ? -processed.info.trimOffsetLeft : 0,
                trimY: processed.info.trimOffsetTop !== undefined ? -processed.info.trimOffsetTop : 0
            });
        } catch (e) {
            console.error(`Failed to process ${filename}: ${e}`);
        }
    }

    // 6. Pack Sprites (Simple Shelf Packing)
    processedImages.sort((a, b) => b.height - a.height); // Sort by height descending

    const atlas: Record<string, AtlasEntry> = {};
    const maxWidth = 2048; // Common max texture size
    const padding = 2; // Padding to prevent bleeding during scaling
    let currentX = 0;
    let currentY = 0;
    let shelfHeight = 0;
    let totalHeight = 0;

    // First pass to determine total height
    for (const img of processedImages) {
        if (currentX + img.width + padding > maxWidth) {
            currentY += shelfHeight + padding;
            currentX = 0;
            shelfHeight = 0;
        }
        currentX += img.width + padding;
        shelfHeight = Math.max(shelfHeight, img.height);
    }
    totalHeight = currentY + shelfHeight;

    // Reset for actual packing
    currentX = 0;
    currentY = 0;
    shelfHeight = 0;
    const composites: any[] = [];

    for (const img of processedImages) {
        if (currentX + img.width + padding > maxWidth) {
            currentY += shelfHeight + padding;
            currentX = 0;
            shelfHeight = 0;
        }

        composites.push({
            input: img.buffer,
            left: currentX,
            top: currentY
        });

        atlas[img.filename] = {
            x: currentX,
            y: currentY,
            w: img.width,
            h: img.height,
            trimX: img.trimX,
            trimY: img.trimY
        };

        currentX += img.width + padding;
        shelfHeight = Math.max(shelfHeight, img.height);
    }

    const sheetPath = path.join(agentDir, 'agent.webp');
    await sharp({
        create: {
            width: maxWidth,
            height: totalHeight,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    })
    .composite(composites)
    .webp({ lossless: true })
    .toFile(sheetPath);

    console.log(`Saved optimized sprite sheet to ${sheetPath}`);

    // 7. Audio Spritesheet (Original logic kept, but preserving existing audioAtlas)
    let audioAtlas = existingDefinition.audioAtlas || {};
    if (Object.keys(audioAtlas).length === 0) {
        const audioToProcess = new Set<string>();
        Object.values(definition.animations).forEach(anim => {
            anim.frames.forEach(frame => {
                if (frame.soundEffect) {
                    const soundName = frame.soundEffect.split(/[\\/]/).pop() || frame.soundEffect;
                    audioToProcess.add(soundName.toLowerCase().endsWith('.wav') ? soundName.toLowerCase() : `${soundName.toLowerCase()}.wav`);
                }
            });
        });

        const audioList = Array.from(audioToProcess).sort();
        if (audioList.length > 0) {
            const tempDir = path.join(agentDir, 'temp_audio');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

            const audioPaths: string[] = [];
            try {
                const silencePath = path.join(tempDir, 'silence.wav');
                execSync(`ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t 0.5 ${silencePath}`, { stdio: 'ignore' });

                let currentTime = 0;
                const silenceDuration = 0.5;

                for (const sound of audioList) {
                    let soundPath = path.join(agentDir, 'Audio', sound);
                    if (!fs.existsSync(soundPath)) {
                        soundPath = path.join(agentDir, 'audio', sound);
                    }
                    if (!fs.existsSync(soundPath)) {
                        const base = sound.replace(/\.wav$/, '');
                        soundPath = path.join(agentDir, 'Audio', base);
                        if (!fs.existsSync(soundPath)) soundPath = path.join(agentDir, 'audio', base);
                    }

                    if (fs.existsSync(soundPath)) {
                        const durationStr = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${soundPath}`).toString().trim();
                        const duration = parseFloat(durationStr);

                        audioAtlas[sound] = {
                            start: currentTime,
                            end: currentTime + duration
                        };

                        audioPaths.push(soundPath);
                        audioPaths.push(silencePath);
                        currentTime += duration + silenceDuration;
                    } else {
                        console.warn(`Could not find audio file: ${sound}`);
                    }
                }

                if (audioPaths.length > 0) {
                    const filterComplex = audioPaths.map((_, i) => `[${i}:a]`).join('') + `concat=n=${audioPaths.length}:v=0:a=1[a]`;
                    const inputs = audioPaths.map(p => `-i "${p}"`).join(' ');
                    const outputWebm = path.join(agentDir, 'agent.webm');
                    execSync(`ffmpeg -y ${inputs} -filter_complex "${filterComplex}" -map "[a]" -c:a libvorbis ${outputWebm}`, { stdio: 'ignore' });
                    console.log(`Saved audio spritesheet to ${outputWebm}`);
                }
            } catch (e) {
                console.warn(`Skipping audio spritesheet generation: ffmpeg not found or failed.`);
            }
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }

    // 8. Save agent.json
    (definition as any).atlas = atlas;
    (definition as any).audioAtlas = audioAtlas;
    fs.writeFileSync(jsonPath, JSON.stringify(definition, null, 2));
    console.log(`Saved agent definition to ${jsonPath}`);
}

const targetDir = process.argv[2];
if (!targetDir) {
    console.error('Usage: npx tsx scripts/optimize-agent.ts <agent_directory>');
    process.exit(1);
}

optimizeAgent(targetDir).catch(console.error);
