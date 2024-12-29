using System.Text.Json;
using Timer = System.Windows.Forms.Timer;

namespace ClippitWinforms
{
    public class StateManager : IDisposable
    {
        private readonly Dictionary<string, AgentState> states;
        private readonly Random random = new Random();
        private readonly AnimationManager animationManager;
        private string currentState = "IdlingLevel1";
        private Timer stateTimer;

        public class AgentState
        {
            public string[] Animation { get; set; }
        }

        public StateManager(string stateJsonPath, AnimationManager animationManager)
        {
            this.animationManager = animationManager;

            // Load and parse the state configuration
            var jsonString = File.ReadAllText(stateJsonPath);
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };
            states = JsonSerializer.Deserialize<Dictionary<string, AgentState>>(jsonString);

            // Initialize the state timer
            stateTimer = new Timer();
            stateTimer.Interval = 10000; // 10 seconds between state checks
            stateTimer.Tick += StateTimer_Tick;
            stateTimer.Start();
        }

        private async void StateTimer_Tick(object sender, EventArgs e)
        {
            await UpdateStateAnimation();
        }

        public async Task SetState(string stateName)
        {
            if (!states.ContainsKey(stateName))
            {
                throw new ArgumentException($"Invalid state name: {stateName}");
            }

            currentState = stateName;
            await UpdateStateAnimation();
        }

        public string GetCurrentState()
        {
            return currentState;
        }

        public IEnumerable<string> GetAvailableStates()
        {
            return states.Keys;
        }

        private async Task UpdateStateAnimation()
        {
            if (states.TryGetValue(currentState, out var state))
            {
                // Select a random animation from the current state
                var animations = state.Animation;
                if (animations != null && animations.Length > 0)
                {
                    var randomAnimation = animations[random.Next(animations.Length)];
                    await animationManager.InterruptAndPlayAnimation(randomAnimation);
                }
            }
        }

        public void Dispose()
        {
            stateTimer?.Dispose();
        }
    }
}