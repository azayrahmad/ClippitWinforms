using System.Drawing.Imaging;
using System.Text.Json;

namespace ClippitWinforms
{
    public partial class Clippy : Form
    {
        private Bitmap spriteSheet;
        const int scale = 2;
        const int frameWidth = 124;
        const int frameHeight = 93;
        //const int framesPerRow = 27;
        //const int totalRows = 34;
        //private int currentFrame = 0;
        //private int currentRow = 0;

        private int currentFrameIndex = 0;
        private long lastFrameTime;
        private Dictionary<string, Animation> animations;
        private Animation currentAnimation;

        private bool isClosing = false;
        private TaskCompletionSource<bool> animationComplete;

        private Random random = new Random();
        private bool isExiting = false;

        private AudioManager audioManager = new AudioManager("C:\\Users\\azayr\\OneDrive\\Documents\\GitHub\\ClippitWinforms\\ClippitWinforms\\sounds-mp3.json");

        public Clippy()
        {
            InitializeComponent();

            this.StartPosition = FormStartPosition.Manual; 
            Rectangle workingArea = Screen.GetWorkingArea(this);
            this.Location = new Point(workingArea.Right - this.Width, workingArea.Bottom - this.Height);
            LoadSprites();
            LoadAnimations();
            // Start with the appearance animation
            PlayStartupAnimation();
            // SetAnimation("Alert");  // Set default animation
            lastFrameTime = Environment.TickCount64;
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

        #region Graphics
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

        private void LoadAnimations()
        {
            animations = new Dictionary<string, Animation>();
            string animationsJson = File.ReadAllText("C:\\Users\\azayr\\OneDrive\\Documents\\GitHub\\ClippitWinforms\\ClippitWinforms\\animation.json");

            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            var animationsDict = JsonSerializer.Deserialize<Dictionary<string, Animation>>(animationsJson, options);
            animations = animationsDict;
        }
        private int GetNextFrameIndex(AnimationFrame currentFrame)
        {
            // If we're exiting and there's an exit branch, use it
            if (isExiting && currentFrame.ExitBranch.HasValue)
            {
                return currentFrame.ExitBranch.Value;
            }

            // Handle branching if present
            if (currentFrame.Branching?.Branches != null && currentFrame.Branching.Branches.Any())
            {
                int randomValue = random.Next(100); // 0-99
                int cumulative = 0;

                foreach (var branch in currentFrame.Branching.Branches)
                {
                    cumulative += branch.Weight;
                    if (randomValue < cumulative)
                    {
                        return branch.FrameIndex;
                    }
                }
            }

            // Default to next sequential frame
            return (currentFrameIndex + 1) % currentAnimation.Frames.Count;
        }

        private void SetAnimation(string animationName, bool useExitBranch = false)
        {
            if (animations.TryGetValue(animationName, out var animation))
            {
                isExiting = useExitBranch;
                currentAnimation = animation;
                currentFrameIndex = 0;
                lastFrameTime = Environment.TickCount64;

                // Play initial frame sound if it exists
                if (animation.Frames[0].Sound != null)
                {
                    audioManager.PlayFrameSound(animation.Frames[0].Sound);
                }
            }
        }

        private async Task PlayStartupAnimation()
        {
            animationComplete = new TaskCompletionSource<bool>();
            SetAnimation("Greeting");
            await animationComplete.Task;
            SetAnimation("Idle1_1");
        }

        private async Task PlayClosingAnimation()
        {
            animationComplete = new TaskCompletionSource<bool>();
            SetAnimation("GoodBye", true); // Use exit branch
            await animationComplete.Task;
        }

        private void animationTimer_Tick(object sender, EventArgs e)
        {
            if (currentAnimation == null || currentAnimation.Frames == null ||
                currentAnimation.Frames.Count == 0) return;

            var currentTime = Environment.TickCount64;
            var currentFrame = currentAnimation.Frames[currentFrameIndex];

            if (currentTime - lastFrameTime >= currentFrame.Duration)
            {
                // Get next frame index based on branching logic
                int nextFrameIndex = GetNextFrameIndex(currentFrame);

                // If we're exiting and have completed the exit branch sequence
                if (isExiting && currentFrame.ExitBranch == null && nextFrameIndex == 0)
                {
                    animationComplete?.TrySetResult(true);
                    return;
                }

                currentFrameIndex = nextFrameIndex;
                lastFrameTime = currentTime;

                // Play sound for the new frame if it exists
                var nextFrame = currentAnimation.Frames[currentFrameIndex];
                if (nextFrame.Sound != null)
                {
                    audioManager.PlayFrameSound(nextFrame.Sound);
                }
                // Check if regular animation sequence is complete
                if (!isExiting && currentFrameIndex == 0 && animationComplete != null)
                {
                    animationComplete.TrySetResult(true);
                    animationComplete = null;
                }
                this.Invalidate();
            }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);

            if (spriteSheet != null && currentAnimation?.Frames != null &&
                currentFrameIndex < currentAnimation.Frames.Count)
            {
                var frame = currentAnimation.Frames[currentFrameIndex];
                if (frame.Images != null && frame.Images.Count > 0)
                {
                    var position = frame.Images[0]; // Get first image position
                    int sourceX = position[0];
                    int sourceY = position[1];

                    Rectangle sourceRect = new Rectangle(sourceX, sourceY, frameWidth, frameHeight);

                    e.Graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;
                    e.Graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.Half;

                    e.Graphics.DrawImage(
                        spriteSheet,
                        new Rectangle(0, 0, frameWidth * scale, frameHeight * scale),
                        sourceRect,
                        GraphicsUnit.Pixel
                    );

                    // Debug information
                    string debugText = $"Frame: {currentFrameIndex}, Position: [{sourceX}, {sourceY}]";
                    Font debugFont = new Font("Arial", 12, FontStyle.Bold);
                    e.Graphics.DrawString(
                        debugText,
                        debugFont,
                        Brushes.White,
                        new PointF(10, 10)
                    );
                }
            }
        }
        #endregion

        protected override async void OnFormClosing(FormClosingEventArgs e)
        {
            if (!isClosing)
            {
                e.Cancel = true;
                isClosing = true;

                // Play closing animation
                await PlayClosingAnimation();

                // Clean up and close
                audioManager.Dispose();

                trayIcon.Dispose();
                animationTimer?.Dispose();
                spriteSheet?.Dispose();

                Application.Exit();
            }
        }
    }
}
