using System.Drawing.Imaging;
using System.Text.Json;

namespace ClippitWinforms
{
    public class AnimationManager : IDisposable
    {
        private readonly ISpriteManager spriteManager;
        private Dictionary<string, Animation> animations;
        private Animation currentAnimation;
        private int currentFrameIndex = 0;
        private long lastFrameTime;
        private bool isExiting = false;
        private Random random = new Random();
        private TaskCompletionSource<bool> animationComplete;
        // private string queuedAnimation = null;
        public const int Scale = 2;

        public event EventHandler FrameChanged;
        public event EventHandler<string> AnimationCompleted;
        public Animation CurrentAnimation => currentAnimation;
        public int CurrentFrameIndex => currentFrameIndex;
        public bool IsAnimating => currentAnimation != null;

        public AnimationManager(ISpriteManager spriteManager, string animationJsonPath)
        {
            this.spriteManager = spriteManager;
            LoadAnimations(animationJsonPath);
            lastFrameTime = Environment.TickCount64;
        }
        public IEnumerable<string> GetAvailableAnimations()
        {
            return animations.Keys;
        }
        public IEnumerable<string> GetSelectableAnimations()
        {
            return animations.Keys.Where(animation => !animation.StartsWith("Idle", StringComparison.OrdinalIgnoreCase));
        }
        public async Task InterruptAndPlayAnimation(string newAnimationName)
        {
            if (currentAnimation == null || !IsAnimating)
            {
                await PlayAnimation(newAnimationName);
                return;
            }

            // Queue the new animation
            var queuedAnimation = newAnimationName;

            // Trigger exit branch of current animation
            isExiting = true;

            // Wait for current animation to complete its exit branch
            if (animationComplete != null)
            {
                await animationComplete.Task;
            }

            // Play the queued animation
            if (queuedAnimation == newAnimationName) // Check if it's still the same queued animation
            {
                await PlayAnimation(newAnimationName);
                queuedAnimation = null;
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
                string previousAnimation = currentAnimation?.Name ?? string.Empty;
                isExiting = useExitBranch;
                currentAnimation = animation;
                currentAnimation.Name = animationName;
                currentFrameIndex = 0;
                lastFrameTime = Environment.TickCount64;
                FrameChanged?.Invoke(this, EventArgs.Empty);

                if (!string.IsNullOrEmpty(previousAnimation))
                {
                    AnimationCompleted?.Invoke(this, previousAnimation);
                }
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
                    AnimationCompleted?.Invoke(this, currentAnimation.Name);
                    return;
                }

                currentFrameIndex = nextFrameIndex;
                lastFrameTime = currentTime;

                if (!isExiting && currentFrameIndex == 0 && animationComplete != null)
                {
                    animationComplete.TrySetResult(true);
                    animationComplete = null;
                    AnimationCompleted?.Invoke(this, currentAnimation.Name);
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
            if (currentAnimation?.Frames == null ||
                currentFrameIndex >= currentAnimation.Frames.Count) return;

            var frame = currentAnimation.Frames[currentFrameIndex];
            if (frame.Images != null && frame.Images.Count > 0)
            {
                var position = frame.Images[0];
                int sourceX = position[0];
                int sourceY = position[1];

                Rectangle destRect = new Rectangle(
                    0, 0,
                    spriteManager.SpriteWidth * Scale,
                    spriteManager.SpriteHeight * Scale
                );

                spriteManager.DrawSprite(
                    graphics,
                    sourceX,
                    sourceY,
                    spriteManager.SpriteWidth,
                    spriteManager.SpriteHeight,
                    destRect
                );
            }
        }

        public AnimationFrame GetCurrentFrame()
        {
            return currentAnimation?.Frames[currentFrameIndex];
        }

        public void Dispose()
        {
            spriteManager?.Dispose();
        }
    }
}