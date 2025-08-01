﻿using ClippitWinforms.AgentCore.Models;
using System.Drawing.Imaging;

namespace ClippitWinforms.Managers
{
    public interface ISpriteManager : IDisposable
    {
        void DrawFrame(Graphics graphics, FrameDefinition frame, int scale = 1);
        int SpriteWidth { get; }
        int SpriteHeight { get; }
    }

    public abstract class BaseSpriteManager : ISpriteManager
    {
        protected bool isDisposed;

        public abstract int SpriteWidth { get; }
        public abstract int SpriteHeight { get; }
        public abstract Color TransparencyKey { get; }

        public abstract void DrawFrame(Graphics graphics, FrameDefinition frame, int scale = 1);
        public abstract void DrawSprite(Graphics graphics, int spritenum, int offsetX, int offsetY, int width, int height, Rectangle destRect);
        protected virtual void Dispose(bool disposing)
        {
            if (!isDisposed)
            {
                if (disposing)
                {
                    DisposeManagedResources();
                }
                DisposedUnmanagedResources();
                isDisposed = true;
            }
        }

        protected virtual void DisposeManagedResources() { }
        protected virtual void DisposedUnmanagedResources() { }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        ~BaseSpriteManager()
        {
            Dispose(false);
        }
    }
    public class DirectorySpriteManager : BaseSpriteManager
    {
        private readonly Dictionary<int, Bitmap> sprites;
        private readonly ImageAttributes imageAttributes;
        private readonly int width;
        private readonly int height;
        private readonly Color transparencyKey;

        public override int SpriteWidth => width;
        public override int SpriteHeight => height;
        public override Color TransparencyKey => transparencyKey;

        public DirectorySpriteManager(string directoryPath, Character character)
        {
            width = character.Width;
            height = character.Height;
            sprites = new Dictionary<int, Bitmap>();
            transparencyKey = GetTransparencyColor(Path.Combine(directoryPath, Path.GetFileName(character.ColorTable)), character.Transparency);
            imageAttributes = CreateImageAttributes();
            LoadSprites(directoryPath);
        }

        private void LoadSprites(string directoryPath)
        {
            try
            {
                var files = Directory.GetFiles(directoryPath, "*.bmp")
                                   .OrderBy(f => f);

                foreach (var file in files)
                {
                    // Extract frame number from filename (e.g., "0001.bmp" -> 1)
                    if (int.TryParse(Path.GetFileNameWithoutExtension(file), out int frameNumber))
                    {
                        using (Bitmap originalImage = new(file))
                        {
                            var sprite = new Bitmap(originalImage.Width, originalImage.Height, PixelFormat.Format32bppArgb);

                            using (Graphics g = Graphics.FromImage(sprite))
                            {
                                g.DrawImage(originalImage,
                                    new Rectangle(0, 0, originalImage.Width, originalImage.Height),
                                    0, 0, originalImage.Width, originalImage.Height,
                                    GraphicsUnit.Pixel,
                                    imageAttributes);
                            }
                            sprites[frameNumber] = sprite;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                throw new ApplicationException($"Error loading sprites from directory: {ex.Message}", ex);
            }
        }

        private ImageAttributes CreateImageAttributes()
        {
            var attrs = new ImageAttributes();
            attrs.SetColorKey(transparencyKey, transparencyKey);
            return attrs;
        }

        /// <summary>
        /// Gets the transparency color from a color table image based on a specified index.
        /// </summary>
        /// <param name="colorTablePath">The file path to the color table image.</param>
        /// <param name="index">The index of the color in the color table.</param>
        /// <returns>The Color at the specified index, or Color.Empty if invalid.</returns>
        public static Color GetTransparencyColor(string colorTablePath, int index)
        {
            using (Bitmap colorTableBitmap = new Bitmap(colorTablePath))
            {
                // Ensure the image is in indexed color mode
                if (colorTableBitmap.PixelFormat != PixelFormat.Format8bppIndexed &&
                    colorTableBitmap.PixelFormat != PixelFormat.Format4bppIndexed &&
                    colorTableBitmap.PixelFormat != PixelFormat.Format1bppIndexed)
                {
                    throw new InvalidOperationException("The provided image is not in an indexed color format.");
                }

                // Get the palette from the image
                ColorPalette palette = colorTableBitmap.Palette;

                // Validate the index
                if (index < 0 || index >= palette.Entries.Length)
                {
                    throw new ArgumentOutOfRangeException(nameof(index), "Index is out of range for the color table.");
                }

                // Return the color at the specified index
                return palette.Entries[index];
            }
        }

        public override void DrawFrame(Graphics graphics, FrameDefinition frame, int scale)
        {
            if (frame.Images != null && frame.Images.Count > 0)
            {
                for (int i = frame.Images.Count - 1; i >= 0; i--)
                {
                    var image = frame.Images[i];
                    if (int.TryParse(Path.GetFileNameWithoutExtension(image.Filename), out int frameNumber))
                    {
                        var position = image;
                        int sourceX = position.OffsetX;
                        int sourceY = position.OffsetY;

                        Rectangle destRect = new Rectangle(
                            sourceX * scale, sourceY * scale,
                            SpriteWidth * scale,
                            SpriteHeight * scale
                        );

                        DrawSprite(
                            graphics,
                            frameNumber,
                            0,
                            0,
                            SpriteWidth,
                            SpriteHeight,
                            destRect
                        );
                    }
                }
            }
        }

        public override void DrawSprite(Graphics graphics, int spritenum, int offsetX, int offsetY, int width, int height, Rectangle destRect)
        {
            if (isDisposed) throw new ObjectDisposedException(nameof(DirectorySpriteManager));

            if (sprites.TryGetValue(spritenum, out Bitmap? sprite))
            {
                graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;
                graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.Half;

                graphics.DrawImage(
                    sprite,
                    destRect,
                    offsetX, offsetY, width, height,
                    GraphicsUnit.Pixel,
                    imageAttributes
                );
            }
        }

        protected override void DisposeManagedResources()
        {
            foreach (var sprite in sprites.Values)
            {
                sprite?.Dispose();
            }
            sprites.Clear();
            imageAttributes?.Dispose();
        }
    }
}