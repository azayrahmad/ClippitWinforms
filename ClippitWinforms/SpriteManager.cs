using System.Drawing.Imaging;

namespace ClippitWinforms
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

    
}