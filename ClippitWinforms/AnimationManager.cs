using System.Drawing.Imaging;
using System.Text.Json;

namespace ClippitWinforms
{
    public class AnimationManager : IDisposable
    {
        private readonly Bitmap spriteSheet;
        private Dictionary<string, Animation> animations;
        private Animation currentAnimation;
        private int currentFrameIndex = 0;
        private long lastFrameTime;
        private bool isExiting = false;
        private Random random = new Random();
        private TaskCompletionSource<bool> animationComplete;

        public const int FrameWidth = 124;
        public const int FrameHeight = 93;
        public const int Scale = 2;

        public event EventHandler FrameChanged;
        public Animation CurrentAnimation => currentAnimation;
        public int CurrentFrameIndex => currentFrameIndex;

        public AnimationManager(string spritePath, string animationJsonPath)
        {
            spriteSheet = LoadSpriteSheet(spritePath);
            LoadAnimations(animationJsonPath);
            lastFrameTime = Environment.TickCount64;
        }

        private Bitmap LoadSpriteSheet(string spritePath)
        {
            try
            {
                using (Bitmap originalImage = new(spritePath))
                {
                    var sprite = new Bitmap(originalImage.Width, originalImage.Height, PixelFormat.Format32bppArgb);

                    using (Graphics g = Graphics.FromImage(sprite))
                    {
                        ImageAttributes imageAttributes = new();
                        imageAttributes.SetColorKey(Color.FromArgb(255, 0, 255), Color.FromArgb(255, 0, 255));

                        g.DrawImage(originalImage,
                            new Rectangle(0, 0, originalImage.Width, originalImage.Height),
                            0, 0, originalImage.Width, originalImage.Height,
                            GraphicsUnit.Pixel,
                            imageAttributes);
                    }
                    return sprite;
                }
            }
            catch (Exception ex)
            {
                throw new ApplicationException($"Error loading sprite sheet: {ex.Message}", ex);
            }
        }

        private void LoadAnimations(string animationJsonPath)
        {
            string animationsJson = File.ReadAllText(animationJsonPath);
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };
            animations = JsonSerializer.Deserialize<Dictionary<string, Animation>>(animationsJson, options);
        }

        public void SetAnimation(string animationName, bool useExitBranch = false)
        {
            if (animations.TryGetValue(animationName, out var animation))
            {
                isExiting = useExitBranch;
                currentAnimation = animation;
                currentFrameIndex = 0;
                lastFrameTime = Environment.TickCount64;
                FrameChanged?.Invoke(this, EventArgs.Empty);
            }
        }

        public async Task PlayAnimation(string animationName, bool useExitBranch = false)
        {
            animationComplete = new TaskCompletionSource<bool>();
            SetAnimation(animationName, useExitBranch);
            await animationComplete.Task;
        }

        public void UpdateAnimation()
        {
            if (currentAnimation?.Frames == null || currentAnimation.Frames.Count == 0) return;

            var currentTime = Environment.TickCount64;
            var currentFrame = currentAnimation.Frames[currentFrameIndex];

            if (currentTime - lastFrameTime >= currentFrame.Duration)
            {
                int nextFrameIndex = GetNextFrameIndex(currentFrame);

                if (isExiting && currentFrame.ExitBranch == null && nextFrameIndex == 0)
                {
                    animationComplete?.TrySetResult(true);
                    return;
                }

                currentFrameIndex = nextFrameIndex;
                lastFrameTime = currentTime;

                if (!isExiting && currentFrameIndex == 0 && animationComplete != null)
                {
                    animationComplete.TrySetResult(true);
                    animationComplete = null;
                }

                FrameChanged?.Invoke(this, EventArgs.Empty);
            }
        }

        private int GetNextFrameIndex(AnimationFrame currentFrame)
        {
            if (isExiting && currentFrame.ExitBranch.HasValue)
            {
                return currentFrame.ExitBranch.Value;
            }

            if (currentFrame.Branching?.Branches != null && currentFrame.Branching.Branches.Any())
            {
                int randomValue = random.Next(100);
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

            return (currentFrameIndex + 1) % currentAnimation.Frames.Count;
        }

        public void DrawCurrentFrame(Graphics graphics)
        {
            if (spriteSheet == null || currentAnimation?.Frames == null ||
                currentFrameIndex >= currentAnimation.Frames.Count) return;

            var frame = currentAnimation.Frames[currentFrameIndex];
            if (frame.Images != null && frame.Images.Count > 0)
            {
                var position = frame.Images[0];
                int sourceX = position[0];
                int sourceY = position[1];

                Rectangle sourceRect = new Rectangle(sourceX, sourceY, FrameWidth, FrameHeight);

                graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;
                graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.Half;

                graphics.DrawImage(
                    spriteSheet,
                    new Rectangle(0, 0, FrameWidth * Scale, FrameHeight * Scale),
                    sourceRect,
                    GraphicsUnit.Pixel
                );
            }
        }

        public AnimationFrame GetCurrentFrame()
        {
            return currentAnimation?.Frames[currentFrameIndex];
        }

        public void Dispose()
        {
            spriteSheet?.Dispose();
        }
    }
}