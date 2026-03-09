import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

async function generateAtlas(agentDir) {
    const agentName = path.basename(agentDir);
    let acdPath = path.join(agentDir, 'agent.acd');
    if (!fs.existsSync(acdPath)) {
        acdPath = path.join(agentDir, `${agentName.toUpperCase()}.acd`);
    }

    if (!fs.existsSync(acdPath)) {
        console.error(`ACD file not found in ${agentDir}`);
        return;
    }

    const acdContent = fs.readFileSync(acdPath, 'utf8');

    // Simple parser for width/height/colorTable
    const widthMatch = acdContent.match(/Width\s*=\s*(\d+)/);
    const heightMatch = acdContent.match(/Height\s*=\s*(\d+)/);
    const transparencyMatch = acdContent.match(/Transparency\s*=\s*(\d+)/);
    const colorTableMatch = acdContent.match(/ColorTable\s*=\s*"([^"]+)"/);

    if (!widthMatch || !heightMatch) {
        console.error(`Could not determine agent dimensions from ${acdPath}`);
        return;
    }

    const width = parseInt(widthMatch[1]);
    const height = parseInt(heightMatch[1]);
    const transparencyIndex = transparencyMatch ? parseInt(transparencyMatch[1]) : 0;
    const colorTableFile = colorTableMatch ? colorTableMatch[1] : "ColorTable.bmp";

    // Find images directory
    let imagesDir = path.join(agentDir, 'images');
    if (!fs.existsSync(imagesDir)) {
        imagesDir = path.join(agentDir, 'Images');
    }
    if (!fs.existsSync(imagesDir)) {
        console.error(`Images directory not found in ${agentDir}`);
        return;
    }

    // Load color table for transparency
    let transRGB = { r: 255, g: 0, b: 255 };
    const colorTablePath = path.join(imagesDir, colorTableFile);
    if (fs.existsSync(colorTablePath)) {
        try {
            const ctImg = await loadImage(colorTablePath);
            const ctCanvas = createCanvas(ctImg.width, ctImg.height);
            const ctCtx = ctCanvas.getContext('2d');
            ctCtx.drawImage(ctImg, 0, 0);
            const data = ctCtx.getImageData(transparencyIndex, 0, 1, 1).data;
            transRGB = { r: data[0], g: data[1], b: data[2] };
            console.log(`Using transparency color: rgb(${transRGB.r}, ${transRGB.g}, ${transRGB.b}) from ${colorTableFile}`);
        } catch (e) {
            console.warn(`Failed to read color table ${colorTablePath}, using default pink`);
        }
    }

    const files = fs.readdirSync(imagesDir).filter(f => f.toLowerCase().endsWith('.bmp') && f.toLowerCase() !== colorTableFile.toLowerCase());
    files.sort();

    console.log(`Processing ${files.length} frames for ${agentName}...`);

    const maxAtlasWidth = 2048;
    const framesPerRow = Math.floor(maxAtlasWidth / width);
    const rows = Math.ceil(files.length / framesPerRow);

    const atlasWidth = Math.min(files.length, framesPerRow) * width;
    const atlasHeight = rows * height;

    const canvas = createCanvas(atlasWidth, atlasHeight);
    const ctx = canvas.getContext('2d');

    const framesMeta = {};

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const img = await loadImage(path.join(imagesDir, file));

        const row = Math.floor(i / framesPerRow);
        const col = i % framesPerRow;
        const x = col * width;
        const y = row * height;

        // Draw with transparency processing
        const tempCanvas = createCanvas(width, height);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);
        const imageData = tempCtx.getImageData(0, 0, width, height);
        const data = imageData.data;

        for (let j = 0; j < data.length; j += 4) {
            if (data[j] === transRGB.r && data[j+1] === transRGB.g && data[j+2] === transRGB.b) {
                data[j+3] = 0;
            }
        }
        tempCtx.putImageData(imageData, 0, 0);

        ctx.drawImage(tempCanvas, x, y);

        const frameId = path.parse(file).name;
        framesMeta[frameId] = { x, y, w: width, h: height };
    }

    const atlasName = 'spritesheet.png';
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(agentDir, atlasName), buffer);

    const meta = {
        agent: agentName,
        width,
        height,
        atlas: atlasName,
        frames: framesMeta
    };

    fs.writeFileSync(path.join(agentDir, 'spritesheet.json'), JSON.stringify(meta, null, 2));
    console.log(`Generated atlas and metadata for ${agentName}`);
}

const agentsRoot = 'public/agents';
const agents = fs.readdirSync(agentsRoot).filter(f => fs.statSync(path.join(agentsRoot, f)).isDirectory());

for (const agent of agents) {
    await generateAtlas(path.join(agentsRoot, agent));
}
