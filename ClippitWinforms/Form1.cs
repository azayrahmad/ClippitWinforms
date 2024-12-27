using System.Drawing.Imaging;

namespace ClippitWinforms
{
    public partial class Clippy : Form
    {
        private Bitmap spriteSheet;
        const int scale = 2;
        const int frameWidth = 124;
        const int frameHeight = 93;
        const int framesPerRow = 27;
        const int totalRows = 34;
        private int currentFrame = 0;
        private int currentRow = 0;

        private record AnimationState(int StartRow, int StartColumn, int FramesToAnimate);
        private AnimationState currentAnimationState = new AnimationState(0, 0, 20);

        public Clippy()
        {
            InitializeComponent();
            this.StartPosition = FormStartPosition.Manual; // Set to manual
            Rectangle workingArea = Screen.GetWorkingArea(this);
            this.Location = new Point(workingArea.Right - this.Width, workingArea.Bottom - this.Height);
            LoadSprites();
            animationTimer.Start();
        }

        private void exitToolStripMenuItem_Click(object sender, EventArgs e)
        {
            Application.Exit();
        }

        private void trayIcon_MouseDoubleClick(object sender, MouseEventArgs e)
        {
            if (Visible) Hide();
            else Show();
        }

        private void LoadSprites()
        {
            string spritePath = @"D:\Exercises\ClippitWinforms\ClippitWinforms\map.png";
            try
            {
                using (Bitmap originalImage = new(spritePath))
                {
                    spriteSheet = new Bitmap(originalImage.Width, originalImage.Height, PixelFormat.Format32bppArgb);

                    using (Graphics g = Graphics.FromImage(spriteSheet))
                    {
                        ImageAttributes imageAttributes = new();
                        imageAttributes.SetColorKey(Color.FromArgb(255, 0, 255), Color.FromArgb(255, 0, 255));

                        g.DrawImage(originalImage,
                            new Rectangle(0, 0, originalImage.Width, originalImage.Height),
                            0, 0, originalImage.Width, originalImage.Height,
                            GraphicsUnit.Pixel,
                            imageAttributes);
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error loading sprite sheet: {ex.Message}\nTried to load from: {spritePath}",
                    "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void animationTimer_Tick(object sender, EventArgs e)
        {
            // Use values from currentAnimationState instead of reading controls directly
            int startRow = currentAnimationState.StartRow;
            int startColumn = currentAnimationState.StartColumn;
            int framesToAnimate = currentAnimationState.FramesToAnimate;

            // Sprite sheet dimensions
            const int totalColumns = framesPerRow;
            const int totalFrames = totalColumns * totalRows;

            // Calculate the starting position in the sprite sheet
            int startIndex = startRow * totalColumns + startColumn;

            // Calculate which frame in the sequence we're on
            int currentOffset = currentFrame + (currentRow - startRow) * totalColumns - startColumn;
            int nextOffset = (currentOffset + 1) % framesToAnimate;

            // Calculate the actual frame position
            int currentFrameIndex = startIndex + nextOffset;

            // Handle wrapping across rows and total frames
            if (currentFrameIndex >= totalFrames)
            {
                currentFrameIndex = startIndex + (nextOffset % (totalFrames - startIndex));
            }

            // Update row and frame
            currentRow = currentFrameIndex / totalColumns;
            currentFrame = currentFrameIndex % totalColumns;

            this.Invalidate();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);

            if (spriteSheet != null)
            {
                // Calculate the source rectangle based on the current frame and row
                int sourceX = currentFrame * frameWidth; // Frame index in the current row
                int sourceY = currentRow * frameHeight; // Row index in the sprite sheet

                Rectangle sourceRect = new Rectangle(sourceX, sourceY, frameWidth, frameHeight);

                e.Graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;
                e.Graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.Half;

                // Draw the sprite
                e.Graphics.DrawImage(
                    spriteSheet,
                    new Rectangle(0, 0, frameWidth * scale, frameHeight * scale), // Scale up rendering
                    sourceRect,
                    GraphicsUnit.Pixel
                );

                // Display current frame and row index
#if DEBUG

                string debugText = $"Row: {currentRow}, Column: {currentFrame}";
                Font debugFont = new Font("Arial", 12, FontStyle.Bold);
                Brush debugBrush = Brushes.White;

                e.Graphics.DrawString(
                    debugText,
                    debugFont,
                    debugBrush,
                    new PointF(10, 10) // Top-left corner of the form
                );
#endif
            }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            base.OnFormClosing(e);
            trayIcon.Dispose();
            animationTimer?.Dispose();
            spriteSheet?.Dispose();
            // controlsForm?.Dispose();
        }
    }
}
