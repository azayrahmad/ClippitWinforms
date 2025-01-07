using System.Drawing.Imaging;

namespace ClippitWinforms.Managers
{
    public interface ISpriteManager : IDisposable
    {
        void DrawSprite(Graphics graphics, int sourceX, int sourceY, int width, int height, Rectangle destRect);
        int SpriteWidth { get; }
        int SpriteHeight { get; }
    }

    public abstract class BaseSpriteManager : ISpriteManager
    {
        protected bool isDisposed;

        public abstract int SpriteWidth { get; }
        public abstract int SpriteHeight { get; }

        public abstract void DrawSprite(Graphics graphics, int sourceX, int sourceY, int width, int height, Rectangle destRect);

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

    public class BitmapSpriteManager : BaseSpriteManager
    {
        private readonly Bitmap spriteSheet;
        private readonly ImageAttributes imageAttributes;
        private readonly int width;
        private readonly int height;

        public override int SpriteWidth => width;
        public override int SpriteHeight => height;

        public BitmapSpriteManager(string spritePath, int spriteWidth, int spriteHeight, Color? transparencyKey = null)
        {
            width = spriteWidth;
            height = spriteHeight;
            spriteSheet = LoadSpriteSheet(spritePath, transparencyKey);
            imageAttributes = CreateImageAttributes(transparencyKey);
        }

        private Bitmap LoadSpriteSheet(string spritePath, Color? transparencyKey)
        {
            try
            {
                using (Bitmap originalImage = new(spritePath))
                {
                    var sprite = new Bitmap(originalImage.Width, originalImage.Height, PixelFormat.Format32bppArgb);

                    using (Graphics g = Graphics.FromImage(sprite))
                    {
                        if (transparencyKey.HasValue)
                        {
                            ImageAttributes attrs = CreateImageAttributes(transparencyKey);
                            g.DrawImage(originalImage,
                                new Rectangle(0, 0, originalImage.Width, originalImage.Height),
                                0, 0, originalImage.Width, originalImage.Height,
                                GraphicsUnit.Pixel,
                                attrs);
                        }
                        else
                        {
                            g.DrawImage(originalImage, 0, 0);
                        }
                    }
                    return sprite;
                }
            }
            catch (Exception ex)
            {
                throw new ApplicationException($"Error loading sprite sheet: {ex.Message}", ex);
            }
        }

        private ImageAttributes CreateImageAttributes(Color? transparencyKey)
        {
            var attrs = new ImageAttributes();
            if (transparencyKey.HasValue)
            {
                attrs.SetColorKey(transparencyKey.Value, transparencyKey.Value);
            }
            return attrs;
        }

        public override void DrawSprite(Graphics graphics, int sourceX, int sourceY, int width, int height, Rectangle destRect)
        {
            if (isDisposed) throw new ObjectDisposedException(nameof(BitmapSpriteManager));

            graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;
            graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.Half;

            graphics.DrawImage(
                spriteSheet,
                destRect,
                sourceX, sourceY, width, height,
                GraphicsUnit.Pixel,
                imageAttributes
            );
        }

        protected override void DisposeManagedResources()
        {
            spriteSheet?.Dispose();
            imageAttributes?.Dispose();
        }
    }

    public class DirectorySpriteManager : BaseSpriteManager
    {
        private readonly Dictionary<int, Bitmap> sprites;
        private readonly ImageAttributes imageAttributes;
        private readonly int width;
        private readonly int height;

        public override int SpriteWidth => width;
        public override int SpriteHeight => height;

        public DirectorySpriteManager(string directoryPath, int spriteWidth, int spriteHeight)
        {
            width = spriteWidth;
            height = spriteHeight;
            sprites = new Dictionary<int, Bitmap>();
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
                                ImageAttributes attrs = CreateImageAttributes();
                                g.DrawImage(originalImage,
                                    new Rectangle(0, 0, originalImage.Width, originalImage.Height),
                                    0, 0, originalImage.Width, originalImage.Height,
                                    GraphicsUnit.Pixel,
                                    attrs);
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
            // Use transparency value 253
            Color transparencyColor = Color.FromArgb(253, 253, 253);
            attrs.SetColorKey(transparencyColor, transparencyColor);
            return attrs;
        }

        public override void DrawSprite(Graphics graphics, int sourceX, int sourceY, int width, int height, Rectangle destRect)
        {
            if (isDisposed) throw new ObjectDisposedException(nameof(DirectorySpriteManager));

            // Calculate which sprite number we're looking for based on the sourceX position
            int spriteNumber = (sourceX / width) + 1;

            if (sprites.TryGetValue(sourceX, out Bitmap? sprite))
            {
                graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;
                graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.Half;

                // For individual sprites, we only need to consider the Y offset since each file is a single sprite
                graphics.DrawImage(
                    sprite,
                    destRect,
                    0, sourceY, width, height,
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