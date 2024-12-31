using System.Text.Json;
using Timer = System.Windows.Forms.Timer;

namespace ClippitWinforms
{
    public class StateManager : IDisposable
    {
        private readonly Dictionary<string, AgentState> states;
        private readonly Random random = new Random();
        private readonly AnimationManager animationManager;
        private readonly Timer stateTimer;
        private Timer playbackTimer;

        private string currentState = "IdlingLevel1";
        private int currentIdleLevel = 1;
        private int idleTickCount = 0;
        private string continuousAnimation;

        private const string IdlePrefix = "IdlingLevel";
        private const int MaxIdleLevel = 3;
        private const int TicksPerLevel = 12;
        private const int TimerInterval = 10000; // 10 seconds

        public class AgentState
        {
            public string[] Animation { get; set; }
        }

        public StateManager(string stateJsonPath, AnimationManager animationManager)
        {
            this.animationManager = animationManager;
            states = LoadStates(stateJsonPath);
            stateTimer = InitializeTimer();
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
            playbackTimer?.Stop();
            playbackTimer?.Dispose();
            playbackTimer = null;
            continuousAnimation = null;
        }

        public async Task HandleAnimationCompleted()
        {
            if (currentState == "Playing" && !string.IsNullOrEmpty(continuousAnimation))
            {
                // If we're still in Playing state, start the animation again
                await PlayContinuousAnimation();
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

        public async Task HandleVisibilityChange(bool showing)
        {
            stateTimer.Stop();
            StopContinuousAnimation();

            string visibilityState = showing ? "Showing" : "Hiding";
            await SetState(visibilityState);

            if (showing)
            {
                ResetIdleProgression();
                await SetIdleState(1);
                stateTimer.Start();
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
            GC.SuppressFinalize(this);
        }
    }
}