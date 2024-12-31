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

        private string currentState = "IdlingLevel1";
        private int currentIdleLevel = 1;
        private int idleTickCount = 0;

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
            if (!states.ContainsKey(stateName))
            {
                throw new ArgumentException($"Invalid state name: {stateName}");
            }

            if (!IsIdleState(stateName))
            {
                ResetIdleProgression();
            }

            currentState = stateName;
            await UpdateStateAnimation();
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

            string visibilityState = showing ? "Showing" : "Hiding";
            await SetState(visibilityState);

            if (showing)
            {
                ResetIdleProgression();
                currentState = "IdlingLevel1";
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
            GC.SuppressFinalize(this);
        }
    }
}
