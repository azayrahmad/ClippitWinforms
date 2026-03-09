# Agent Assets Directory

This directory contains the character definition and sprite assets for the Clippit JS engine.

## Optimized Asset Pipeline

The engine has been optimized to use **Sprite Sheets** (Texture Atlases) to reduce hundreds of individual HTTP requests into just two (one for the atlas image and one for the metadata JSON).

### How to Add a New Agent

1. Create a new folder for your agent (e.g., `public/agents/MyAgent/`).
2. Add your `.acd` definition file.
3. Add a subfolder named `images/` containing all your `.bmp` frames and a `ColorTable.bmp` if required for transparency.
4. From the `clippit-js/` root directory, run the conversion script:
   ```bash
   # Make sure you have the 'canvas' library installed temporarily for the script:
   npm install canvas --no-save

   node scripts/generate-atlas.mjs
   ```
5. The script will generate two new files:
   - `spritesheet.png`: The combined atlas containing all frames.
   - `spritesheet.json`: Metadata mapping each frame ID to its coordinates on the atlas.

### What Files Can Be Safely Deleted?

Once the `spritesheet.png` and `spritesheet.json` have been successfully generated, you can safely delete the following to save space:

- The `images/` directory (containing the hundreds of individual `.bmp` files).
- The `ColorTable.bmp` (its transparency info is already baked into the PNG).

**Note**: The engine will still work if you keep the individual files (it will fall back to `DirectorySpriteManager`), but deleting them ensures a clean, high-efficiency installation.

### Supported File Formats

The conversion script currently looks for `.bmp` files in the `images/` directory and generates an optimized `.png` atlas. The engine's `SpriteSheetManager` is designed to work with these generated PNGs and JSON metadata.
