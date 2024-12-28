using System.Drawing.Imaging;
using System.Text.Json;

namespace ClippitWinforms
{
    public partial class Clippy : Form
    {
        private AnimationManager animationManager;
        private AudioManager audioManager;
        private bool isClosing = false;

        public Clippy()
        {
            InitializeComponent();

            this.StartPosition = FormStartPosition.Manual;
            Rectangle workingArea = Screen.GetWorkingArea(this);
            this.Location = new Point(workingArea.Right - this.Width, workingArea.Bottom - this.Height);

            string spritePath = @"D:\Exercises\ClippitWinforms\ClippitWinforms\map.png";
            string animationJsonPath = @"C:\Users\azayr\OneDrive\Documents\GitHub\ClippitWinforms\ClippitWinforms\animation.json";
            string soundsJsonPath = @"C:\Users\azayr\OneDrive\Documents\GitHub\ClippitWinforms\ClippitWinforms\sounds-mp3.json";

            animationManager = new AnimationManager(spritePath, animationJsonPath);
            audioManager = new AudioManager(soundsJsonPath);

            animationManager.FrameChanged += AnimationManager_FrameChanged;

            // Start with the appearance animation
            PlayStartupAnimation();
            animationTimer.Start();
        }

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
            await animationManager.PlayAnimation("Idle1_1");
        }

        private async Task PlayClosingAnimation()
        {
            await animationManager.PlayAnimation("GoodBye", true);
        }

        private void animationTimer_Tick(object sender, EventArgs e)
        {
            animationManager.UpdateAnimation();
        }
        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            animationManager.DrawCurrentFrame(e.Graphics);

            // Debug information
            string debugText = $"Frame: {animationManager.CurrentFrameIndex}";
            Font debugFont = new Font("Arial", 12, FontStyle.Bold);
            e.Graphics.DrawString(debugText, debugFont, Brushes.White, new PointF(10, 10));
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
                trayIcon.Dispose();
                animationTimer?.Dispose();

                Application.Exit();
            }
        }
    }
}
