namespace ClippitWinforms
{
    partial class Clippy
    {
        /// <summary>
        ///  Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        ///  Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        ///  Required method for Designer support - do not modify
        ///  the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            components = new System.ComponentModel.Container();
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(Clippy));
            contextMenu = new ContextMenuStrip(components);
            controlsToolStripMenuItem = new ToolStripMenuItem();
            exitToolStripMenuItem = new ToolStripMenuItem();
            trayIcon = new NotifyIcon(components);
            trayMenu = new ContextMenuStrip(components);
            showToolStripMenuItem = new ToolStripMenuItem();
            hideToolStripMenuItem = new ToolStripMenuItem();
            controlsToolStripMenuItem1 = new ToolStripMenuItem();
            exitToolStripMenuItem1 = new ToolStripMenuItem();
            animationTimer = new System.Windows.Forms.Timer(components);
            contextMenu.SuspendLayout();
            trayMenu.SuspendLayout();
            SuspendLayout();
            // 
            // contextMenu
            // 
            contextMenu.ImageScalingSize = new Size(20, 20);
            contextMenu.Items.AddRange(new ToolStripItem[] { controlsToolStripMenuItem, exitToolStripMenuItem });
            contextMenu.Name = "contextMenuStrip1";
            contextMenu.Size = new Size(134, 52);
            // 
            // controlsToolStripMenuItem
            // 
            controlsToolStripMenuItem.Name = "controlsToolStripMenuItem";
            controlsToolStripMenuItem.Size = new Size(133, 24);
            controlsToolStripMenuItem.Text = "Controls";
            // 
            // exitToolStripMenuItem
            // 
            exitToolStripMenuItem.Name = "exitToolStripMenuItem";
            exitToolStripMenuItem.Size = new Size(133, 24);
            exitToolStripMenuItem.Text = "Exit";
            exitToolStripMenuItem.Click += exitToolStripMenuItem_Click;
            // 
            // trayIcon
            // 
            trayIcon.ContextMenuStrip = trayMenu;
            trayIcon.Icon = (Icon)resources.GetObject("trayIcon.Icon");
            trayIcon.Text = "Clippy";
            trayIcon.Visible = true;
            trayIcon.MouseDoubleClick += trayIcon_MouseDoubleClick;
            // 
            // trayMenu
            // 
            trayMenu.ImageScalingSize = new Size(20, 20);
            trayMenu.Items.AddRange(new ToolStripItem[] { showToolStripMenuItem, hideToolStripMenuItem, controlsToolStripMenuItem1, exitToolStripMenuItem1 });
            trayMenu.Name = "trayMenu";
            trayMenu.Size = new Size(134, 100);
            // 
            // showToolStripMenuItem
            // 
            showToolStripMenuItem.Name = "showToolStripMenuItem";
            showToolStripMenuItem.Size = new Size(133, 24);
            showToolStripMenuItem.Text = "Show";
            // 
            // hideToolStripMenuItem
            // 
            hideToolStripMenuItem.Name = "hideToolStripMenuItem";
            hideToolStripMenuItem.Size = new Size(133, 24);
            hideToolStripMenuItem.Text = "Hide";
            // 
            // controlsToolStripMenuItem1
            // 
            controlsToolStripMenuItem1.Name = "controlsToolStripMenuItem1";
            controlsToolStripMenuItem1.Size = new Size(133, 24);
            controlsToolStripMenuItem1.Text = "Controls";
            // 
            // exitToolStripMenuItem1
            // 
            exitToolStripMenuItem1.Name = "exitToolStripMenuItem1";
            exitToolStripMenuItem1.Size = new Size(133, 24);
            exitToolStripMenuItem1.Text = "Exit";
            exitToolStripMenuItem1.Click += exitToolStripMenuItem_Click;
            // 
            // animationTimer
            // 
            animationTimer.Interval = 16;
            animationTimer.Tick += animationTimer_Tick;
            // 
            // Clippy
            // 
            AutoScaleDimensions = new SizeF(8F, 20F);
            AutoScaleMode = AutoScaleMode.Font;
            BackColor = Color.Black;
            ClientSize = new Size(282, 253);
            ContextMenuStrip = contextMenu;
            DoubleBuffered = true;
            FormBorderStyle = FormBorderStyle.None;
            Name = "Clippy";
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.CenterScreen;
            Text = "Clippy";
            TopMost = true;
            TransparencyKey = Color.Black;
            contextMenu.ResumeLayout(false);
            trayMenu.ResumeLayout(false);
            ResumeLayout(false);
        }

        #endregion

        private ContextMenuStrip contextMenu;
        private ToolStripMenuItem controlsToolStripMenuItem;
        private ToolStripMenuItem exitToolStripMenuItem;
        private NotifyIcon trayIcon;
        private ContextMenuStrip trayMenu;
        private ToolStripMenuItem showToolStripMenuItem;
        private ToolStripMenuItem hideToolStripMenuItem;
        private ToolStripMenuItem controlsToolStripMenuItem1;
        private ToolStripMenuItem exitToolStripMenuItem1;
        private System.Windows.Forms.Timer animationTimer;
    }
}
