using ClippitWinforms.Managers;
using System.Drawing;

namespace ClippitWinforms
{
    public partial class CharacterView : Form
    {
        private Agent agent;
        private bool isClosing = false;
        private Point lastPoint;
        private string defaultAgentFolderDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
        private string defaultAgentFolderName = "Agents";
        private string defaultAgentName = "Clippit";

        public CharacterView()
        {
            InitializeComponent();
            InitializePosition();
            InitializeAgent();
            InitializeSelectionMenu();

            agent.Start();
        }

        private void InitializePosition()
        {
            this.StartPosition = FormStartPosition.Manual;
            Rectangle workingArea = Screen.GetWorkingArea(this);
            this.Location = new Point(workingArea.Right - this.Width, workingArea.Bottom - this.Height);

            // Enable dragging
            this.MouseDown += OnMouseDown;
            this.MouseMove += OnMouseMove;
        }

        private void InitializeAgent()
        {

            var locationPath = Path.Combine(defaultAgentFolderDirectory, defaultAgentFolderName, defaultAgentName);
            var acdFile = new DirectoryInfo(locationPath).GetFiles("*.acd").First();

            agent = new Agent(this, acdFile.FullName);
            agent.FrameChanged += (s, e) => this.Invalidate();
        }

        private void InitializeSelectionMenu()
        {
            // Populate Select Animation
            foreach (var animation in agent.GetSelectableAnimations())
            {
                var menuItem = new ToolStripMenuItem(animation);
                menuItem.Click += async (sender, e) => await agent.PlayAnimationLoop(animation);
                selectAnimationToolStripMenuItem.DropDownItems.Add(menuItem);
            }

            // Populate Select State
            foreach (var state in agent.GetAvailableStates())
            {
                var menuItem = new ToolStripMenuItem(state);
                menuItem.Click += async (sender, e) => await agent.SetState(state);
                selectStateToolStripMenuItem.DropDownItems.Add(menuItem);
            }
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

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            agent.DrawCurrentFrame(e.Graphics);
#if DEBUG
            // Debug information
            Font debugFont = new Font("Arial", 12, FontStyle.Bold);
            e.Graphics.DrawString($"Frame: {agent.GetCurrentFrameIndex()}", debugFont, Brushes.White, new PointF(10, 10));
            e.Graphics.DrawString($"State: {agent.GetCurrentState()}", debugFont, Brushes.White, new PointF(10, 25));
            e.Graphics.DrawString($"Anim: {agent.GetCurrentAnimationName()}", debugFont, Brushes.White, new PointF(10, 40));
#endif
        }

        private void OnMouseDown(object sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                lastPoint = new Point(e.X, e.Y);
            }
        }

        private void OnMouseMove(object sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                Left += e.X - lastPoint.X;
                Top += e.Y - lastPoint.Y;
            }
        }

        protected override async void OnFormClosing(FormClosingEventArgs e)
        {
            if (!isClosing)
            {
                e.Cancel = true;
                isClosing = true;

                await agent.PlayClosingAnimation();
                agent.Dispose();
                trayIcon.Dispose();

                Application.Exit();
            }
        }

        private async void hideToolStripMenuItem1_Click(object sender, EventArgs e)
        {
            var menu = (ToolStripMenuItem)sender;
            if (Visible)
            {
                menu.Text = "Show";
                await agent.HandleVisibilityChange(false);
                Hide();
            }
            else
            {
                menu.Text = "Hide";
                Show();
                await agent.HandleVisibilityChange(true);
            }
        }

        private async void animateToolStripMenuItem_Click(object sender, EventArgs e)
        {
            await agent.PlayRandomAnimation();
        }
    }
}