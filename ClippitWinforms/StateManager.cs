using System.Text.Json;
using Timer = System.Windows.Forms.Timer;

namespace ClippitWinforms
{
    public class StateManager : IDisposable
    {
        private readonly Dictionary<string, AgentState> states;
        private readonly Random random = new();
        private readonly AnimationManager animationManager;
        private readonly Timer stateTimer;
        private Timer animationTimer;
        private Timer playbackTimer;

        private string currentState = "IdlingLevel1";
        private int currentIdleLevel = 1;
        private int idleTickCount = 0;
        private string continuousAnimation;

        private const string IdlePrefix = "IdlingLevel";
        private const int MaxIdleLevel = 3;
        private const int TicksPerLevel = 12;
        private const int TimerInterval = 10000; // 10 seconds
        private CancellationTokenSource animationCancellation;
        private bool isExiting = false;
        public class AgentState
        {
            public string[] Animation { get; set; }
        }

        public StateManager(string stateJsonPath, AnimationManager animationManager)
        {
            this.animationManager = animationManager;
            states = LoadStates(stateJsonPath);
            stateTimer = InitializeTimer();
            animationTimer = new Timer { Interval = 16 };
            animationTimer.Tick += animationTimer_Tick;
            animationTimer.Start();
        }

        private void animationTimer_Tick(object sender, EventArgs e)
        {
            animationManager.UpdateAnimation();
        }
        private static Dictionary<string, AgentState> LoadStates(string stateJsonPath)
        {
            var jsonString = File.ReadAllText(stateJsonPath);
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            return JsonSerializer.Deserialize<Dictionary<string, AgentState>>(jsonString);
        }

        private Timer InitializeTimer()
        {
            var timer = new Timer { Interval = TimerInterval };
            timer.Tick += StateTimer_Tick;
            timer.Start();
            return timer;
        }

        private async void StateTimer_Tick(object sender, EventArgs e)
        {
            if (currentState == "Playing")
            {
                // Don't do anything if we're in playing state
                return;
            }

            if (IsIdleState(currentState))
            {
                idleTickCount++;

                if (idleTickCount >= TicksPerLevel && currentIdleLevel < MaxIdleLevel)
                {
                    currentIdleLevel++;
                    idleTickCount = 0;
                    await SetIdleState(currentIdleLevel);
                }
                else
                {
                    await UpdateStateAnimation();
                }
            }
            else
            {
                await UpdateStateAnimation();
            }
        }

        private static bool IsIdleState(string state) =>
            state.StartsWith(IdlePrefix, StringComparison.OrdinalIgnoreCase);

        private async Task SetIdleState(int level)
        {
            string newState = $"{IdlePrefix}{level}";
            if (states.ContainsKey(newState))
            {
                currentState = newState;
                await UpdateStateAnimation();
            }
        }

        public async Task SetState(string stateName)
        {
            if (!states.ContainsKey(stateName) && stateName != "Playing")
            {
                throw new ArgumentException($"Invalid state name: {stateName}");
            }

            if (!IsIdleState(stateName))
            {
                ResetIdleProgression();
            }

            currentState = stateName;

            if (stateName != "Playing")
            {
                await UpdateStateAnimation();
            }
        }
        public async Task PlayAnimationOnce(string animationName, int? timeoutMs = null)
        {
            // Cancel any existing animation
            StopContinuousAnimation();

            // Create new cancellation token source
            animationCancellation?.Cancel();
            animationCancellation?.Dispose();
            animationCancellation = new CancellationTokenSource();

            try
            {
                currentState = "Playing";
                continuousAnimation = null; // We don't want continuous playback
                isExiting = false;

                // Create a task to play the animation
                var animationTask = animationManager.PlayAnimation(animationName);

                if (timeoutMs.HasValue)
                {
                    // Create a timeout task
                    var timeoutTask = Task.Delay(timeoutMs.Value, animationCancellation.Token);

                    // Wait for either the animation to complete or timeout
                    var completedTask = await Task.WhenAny(animationTask, timeoutTask);

                    if (completedTask == timeoutTask)
                    {
                        // If timeout occurred, stop the animation
                        isExiting = true;
                    }
                }
                else
                {
                    // Just wait for the animation to complete
                    await animationTask;
                }
            }
            finally
            {
                // Return to idle state
                await ReturnToIdle();
            }
        }

        public async Task StartContinuousAnimation(string animationName, int? timeoutMs = null)
        {
            StopContinuousAnimation();

            continuousAnimation = animationName;
            currentState = "Playing";

            if (timeoutMs.HasValue)
            {
                playbackTimer = new Timer();
                playbackTimer.Interval = timeoutMs.Value;
                playbackTimer.Tick += async (s, e) =>
                {
                    StopContinuousAnimation();
                    await ReturnToIdle();
                };
                playbackTimer.Start();
            }

            // Start the first playback
            await PlayContinuousAnimation();
        }

        private async Task PlayContinuousAnimation()
        {
            if (currentState == "Playing" && !string.IsNullOrEmpty(continuousAnimation))
            {
                await animationManager.InterruptAndPlayAnimation(continuousAnimation);
                // When this animation completes, AnimationManager will trigger the completion event
            }
        }

        public void StopContinuousAnimation()
        {
            isExiting = true;
            playbackTimer?.Stop();
            playbackTimer?.Dispose();
            playbackTimer = null;
            continuousAnimation = null;

            animationCancellation?.Cancel();
            animationCancellation?.Dispose();
            animationCancellation = null;
        }

        public async Task HandleAnimationCompleted()
        {
            //if (currentState == "Playing" && !string.IsNullOrEmpty(continuousAnimation))
            //{
            //    // If we're still in Playing state, start the animation again
            //    await PlayContinuousAnimation();
            //}
            if (isExiting && currentState != "Hiding")
            {
                isExiting = false;
                await ReturnToIdle();
            }
        }

        private async Task ReturnToIdle()
        {
            await SetState("IdlingLevel1");
        }

        public string GetCurrentState() => currentState;

        public IEnumerable<string> GetAvailableStates() => states.Keys;

        private async Task UpdateStateAnimation()
        {
            if (states.TryGetValue(currentState, out var state))
            {
                var animations = state.Animation;
                if (animations?.Length > 0)
                {
                    var randomAnimation = animations[random.Next(animations.Length)];
                    await animationManager.InterruptAndPlayAnimation(randomAnimation);
                }
            }
        }

        public async Task PlayRandomAnimation()
        {
            var animations = animationManager.GetAvailableAnimations().ToList();
            if (animations.Count > 0)
            {
                var randomAnimation = animations[random.Next(animations.Count)];
                await PlayAnimationOnce(randomAnimation, 5000);
            }
        }

        public async Task HandleVisibilityChange(bool showing)
        {
            stateTimer.Stop();
            StopContinuousAnimation();
            if(showing) animationTimer.Start();
            string visibilityState = showing ? "Showing" : "Hiding";
            await SetState(visibilityState);

            if (showing)
            {
                animationTimer.Stop();
                ResetIdleProgression(); 
                animationTimer.Start();
                await SetIdleState(1);
                stateTimer.Start();
            }
            else
            {
                animationTimer.Stop();
            }
        }

        public void ResetIdleProgression()
        {
            currentIdleLevel = 1;
            idleTickCount = 0;
        }

        public void Dispose()
        {
            stateTimer?.Dispose();
            playbackTimer?.Dispose();
            animationCancellation?.Dispose();
            animationTimer?.Dispose();
            GC.SuppressFinalize(this);
        }
    }
}