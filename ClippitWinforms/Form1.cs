using System.Drawing.Imaging;
using System.Text.Json;

namespace ClippitWinforms
{
    public partial class Clippy : Form
    {
        private AnimationManager animationManager;
        private AudioManager audioManager;
        private StateManager stateManager;
        private bool isClosing = false;
        private IEnumerable<string> Animations;

        public Clippy()
        {
            InitializeComponent();
            InitializePosition();
            InitializeManagers();
            InitializeSelectionMenu();

            PlayStartupAnimation();
            animationTimer.Start();
        }

        #region Initializations
        private void InitializePosition()
        {
            this.StartPosition = FormStartPosition.Manual;
            Rectangle workingArea = Screen.GetWorkingArea(this);

            // Agent is positioned on bottom right of the screen
            this.Location = new Point(workingArea.Right - this.Width, workingArea.Bottom - this.Height);
        }

        private void InitializeSelectionMenu()
        {
            // Populate Select Animation
            Animations = animationManager.GetAvailableAnimations().OrderBy(a => a);
            foreach (var animation in Animations)
            {
                // Skip internal animations like Idle sequences
                if (animation.StartsWith("Idle", StringComparison.OrdinalIgnoreCase) ||
                    animation.Equals("Greeting", StringComparison.OrdinalIgnoreCase) ||
                    animation.Equals("GoodBye", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var menuItem = new ToolStripMenuItem(animation);
                menuItem.Click += async (sender, e) => await PlaySelectedAnimation(animation);
                selectAnimationToolStripMenuItem.DropDownItems.Add(menuItem);
            }

            // Populate Select State
            var availableStates = stateManager.GetAvailableStates();
            foreach (var state in availableStates)
            {
                var menuItem = new ToolStripMenuItem(state);
                menuItem.Click += async (sender, e) => await stateManager.SetState(state);
                selectStateToolStripMenuItem.DropDownItems.Add(menuItem);
            }
        }

        private void InitializeManagers()
        {
            string spritePath = @"D:\Exercises\ClippitWinforms\ClippitWinforms\map.png";
            string animationJsonPath = @"C:\Users\azayr\OneDrive\Documents\GitHub\ClippitWinforms\ClippitWinforms\animation.json";
            string soundsJsonPath = @"C:\Users\azayr\OneDrive\Documents\GitHub\ClippitWinforms\ClippitWinforms\sounds-mp3.json";
            string stateJsonPath = @"C:\Users\azayr\OneDrive\Documents\GitHub\ClippitWinforms\ClippitWinforms\states.json";

            // Create sprite manager with transparency key
            var spriteManager = new BitmapSpriteManager(
                spritePath,
                124, // sprite width
                93,  // sprite height
                Color.FromArgb(255, 0, 255) // transparency key
            );

            animationManager = new AnimationManager(spriteManager, animationJsonPath);
            audioManager = new AudioManager(soundsJsonPath);

            animationManager.FrameChanged += AnimationManager_FrameChanged;
            animationManager.AnimationCompleted += AnimationManager_AnimationCompleted;
            stateManager = new StateManager(stateJsonPath, animationManager);
        }
        #endregion

        private void AnimationManager_FrameChanged(object sender, EventArgs e)
        {
            var currentFrame = animationManager.GetCurrentFrame();
            if (currentFrame?.Sound != null)
            {
                audioManager.PlayFrameSound(currentFrame.Sound);
            }
            this.Invalidate();
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

        private async Task PlayStartupAnimation()
        {
            await animationManager.PlayAnimation("Greeting");
            await stateManager.SetState("IdlingLevel1"); // Set initial state instead of direct animation
        }

        private async Task PlayClosingAnimation()
        {
            await animationManager.InterruptAndPlayAnimation("GoodBye");
        }

        private async Task PlaySelectedAnimation(string animationName, int? timeoutMs = null)
        {
            try
            {
                // Start continuous playback of the selected animation
                // await stateManager.StartContinuousAnimation(animationName, timeoutMs);
                // await animationManager.InterruptAndPlayAnimation(animationName);
                await stateManager.PlayAnimationOnce(animationName);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error playing animation: {ex.Message}");
            }
        }

        private async void AnimationManager_AnimationCompleted(object sender, string animationName)
        {
            // Let the state manager handle animation completion
            await stateManager.HandleAnimationCompleted();
        }

        private void animationTimer_Tick(object sender, EventArgs e)
        {
            animationManager.UpdateAnimation();
        }
        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            animationManager.DrawCurrentFrame(e.Graphics);
#if DEBUG
            // Debug information
            string debugText = $"Frame: {animationManager.CurrentFrameIndex}";
            Font debugFont = new Font("Arial", 12, FontStyle.Bold);
            e.Graphics.DrawString(debugText, debugFont, Brushes.White, new PointF(10, 10));
            e.Graphics.DrawString($"State: {stateManager.GetCurrentState()}", debugFont, Brushes.White, new PointF(10, 25));
            e.Graphics.DrawString($"Anim: {animationManager.CurrentAnimation.Name}", debugFont, Brushes.White, new PointF(10, 40));
#endif
        }
        #endregion

        protected override async void OnFormClosing(FormClosingEventArgs e)
        {
            if (!isClosing)
            {
                e.Cancel = true;
                isClosing = true;

                await PlayClosingAnimation();

                audioManager.Dispose();
                animationManager.Dispose();
                stateManager.Dispose();
                trayIcon.Dispose();
                animationTimer?.Dispose();

                Application.Exit();
            }
        }

        private async void hideToolStripMenuItem1_Click(object sender, EventArgs e)
        {
            var menu = (ToolStripMenuItem)sender;
            if (Visible)
            {
                menu.Text = "Show";
                await stateManager.HandleVisibilityChange(false);
                Hide();
                animationTimer.Stop();
            }
            else
            {
                animationTimer.Start();
                menu.Text = "Hide";
                Show();
                await stateManager.HandleVisibilityChange(true);
            }
        }

        private async void animateToolStripMenuItem_Click(object sender, EventArgs e)
        {
            await stateManager.PlayRandomAnimation();
        }
    }
}
