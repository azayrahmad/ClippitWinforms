import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import Jimp from 'jimp';
import { CharacterParser } from '../src/CharacterParser';
import type { AgentCharacterDefinition, AudioAtlasEntry } from '../src/types';

// Mock some browser globals for CharacterParser
(global as any).fetch = async (url: string) => {
    const content = fs.readFileSync(url, 'utf-8');
    return {
        ok: true,
        text: async () => content
    };
};

async function optimizeAgent(agentDir: string) {
    const agentName = path.basename(agentDir);
    const acdPath = path.join(agentDir, `${agentName.toUpperCase()}.acd`);

    console.log(`Optimizing agent: ${agentName}`);

    // 1. Parse ACD
    const definition = await CharacterParser.load(acdPath);

    // 2. Collect all unique images
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

    // 3. Load transparency color
    let colorTablePath = path.join(agentDir, definition.character.colorTable.replace(/\\/g, '/'));
    if (!fs.existsSync(colorTablePath)) {
        colorTablePath = path.join(agentDir, 'images', 'colortable.bmp');
    }
    if (!fs.existsSync(colorTablePath)) {
        colorTablePath = path.join(agentDir, 'Images', 'ColorTable.bmp');
    }
    const colorTableBmp = await Jimp.read(colorTablePath);
    // Get transparency index color
    const transIdx = definition.character.transparency;
    // Jimp doesn't directly expose palette, but we can get pixel
    // Actually we need to be careful, Jimp's getPixelColor returns RGBA
    // We'll use a trick: load the BMP, and the color at the index is what we need.
    // Wait, the BMP might not be 1x256.
    // Usually ColorTable.bmp is a small image where we pick the color at index.
    // Let's just find the color at (transIdx, 0) or similar if it's a palette row.
    // In MS Agent, it's usually 1 pixel per color.
    const transColor = colorTableBmp.getPixelColor(transIdx, 0);
    const { r, g, b } = Jimp.intToRGBA(transColor);
    console.log(`Transparency color: RGB(${r}, ${g}, ${b}) at index ${transIdx}`);

    // 4. Create Sprite Sheet
    const spriteWidth = definition.character.width;
    const spriteHeight = definition.character.height;
    const cols = Math.ceil(Math.sqrt(imageList.length));
    const rows = Math.ceil(imageList.length / cols);

    const atlas: Record<string, { x: number, y: number, w: number, h: number }> = {};
    const sheet = new Jimp(cols * spriteWidth, rows * spriteHeight, 0x00000000);

    for (let i = 0; i < imageList.length; i++) {
        const filename = imageList[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * spriteWidth;
        const y = row * spriteHeight;

        let imgPath = path.join(agentDir, filename);
        if (!fs.existsSync(imgPath)) {
            // Try Images subfolder
            imgPath = path.join(agentDir, 'Images', path.basename(filename));
        }
        if (!fs.existsSync(imgPath)) {
             // Try lowercase Images subfolder
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
                }
            });

            sheet.composite(img, x, y);
            atlas[filename] = { x, y, w: spriteWidth, h: spriteHeight };
        } catch (e) {
            console.error(`Failed to process ${filename}: ${e}`);
        }
    }

    // 5. Save Sprite Sheet (as PNG for now since we couldn't get WebP easily,
    // but we can try to use PNG and call it 'agent.png')
    const sheetPath = path.join(agentDir, 'agent.png');
    await sheet.writeAsync(sheetPath);
    console.log(`Saved sprite sheet to ${sheetPath}`);

    // 6. Audio Spritesheet
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
    console.log(`Found ${audioList.length} unique audio files.`);

    const audioAtlas: Record<string, AudioAtlasEntry> = {};
    if (audioList.length > 0) {
        const tempDir = path.join(agentDir, 'temp_audio');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const audioPaths: string[] = [];
        const silencePath = path.join(tempDir, 'silence.wav');
        // Create 0.5s silence
        execSync(`ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t 0.5 ${silencePath}`, { stdio: 'ignore' });

        let currentTime = 0;
        const silenceDuration = 0.5;

        for (const sound of audioList) {
            let soundPath = path.join(agentDir, 'Audio', sound);
            if (!fs.existsSync(soundPath)) {
                soundPath = path.join(agentDir, 'audio', sound);
            }
            if (!fs.existsSync(soundPath)) {
                // Try without extension if it was added
                const base = sound.replace(/\.wav$/, '');
                soundPath = path.join(agentDir, 'Audio', base);
                if (!fs.existsSync(soundPath)) soundPath = path.join(agentDir, 'audio', base);
            }

            if (fs.existsSync(soundPath)) {
                // Get duration using ffprobe
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

        // Cleanup temp audio
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // 7. Save agent.json
    (definition as any).atlas = atlas;
    (definition as any).audioAtlas = audioAtlas;
    const jsonPath = path.join(agentDir, 'agent.json');
    fs.writeFileSync(jsonPath, JSON.stringify(definition, null, 2));
    console.log(`Saved agent definition to ${jsonPath}`);
}

const targetDir = process.argv[2];
if (!targetDir) {
    console.error('Usage: npx tsx scripts/optimize-agent.ts <agent_directory>');
    process.exit(1);
}

optimizeAgent(targetDir).catch(console.error);
