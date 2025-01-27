namespace ClippitWinforms
{
    partial class CharacterView
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
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(CharacterView));
            contextMenu = new ContextMenuStrip(components);
            hideToolStripMenuItem1 = new ToolStripMenuItem();
            animateToolStripMenuItem = new ToolStripMenuItem();
            selectAgentToolStripMenuItem = new ToolStripMenuItem();
            selectAnimationToolStripMenuItem = new ToolStripMenuItem();
            selectStateToolStripMenuItem = new ToolStripMenuItem();
            controlsToolStripMenuItem = new ToolStripMenuItem();
            exitToolStripMenuItem = new ToolStripMenuItem();
            trayIcon = new NotifyIcon(components);
            trayMenu = new ContextMenuStrip(components);
            showToolStripMenuItem = new ToolStripMenuItem();
            hideToolStripMenuItem = new ToolStripMenuItem();
            controlsToolStripMenuItem1 = new ToolStripMenuItem();
            exitToolStripMenuItem1 = new ToolStripMenuItem();
            contextMenu.SuspendLayout();
            trayMenu.SuspendLayout();
            SuspendLayout();
            // 
            // contextMenu
            // 
            contextMenu.ImageScalingSize = new Size(20, 20);
            contextMenu.Items.AddRange(new ToolStripItem[] { hideToolStripMenuItem1, animateToolStripMenuItem, selectAgentToolStripMenuItem, selectAnimationToolStripMenuItem, selectStateToolStripMenuItem, controlsToolStripMenuItem, exitToolStripMenuItem });
            contextMenu.Name = "contextMenuStrip1";
            contextMenu.Size = new Size(192, 172);
            // 
            // hideToolStripMenuItem1
            // 
            hideToolStripMenuItem1.Name = "hideToolStripMenuItem1";
            hideToolStripMenuItem1.Size = new Size(191, 24);
            hideToolStripMenuItem1.Text = "Hide";
            hideToolStripMenuItem1.Click += hideToolStripMenuItem1_Click;
            // 
            // animateToolStripMenuItem
            // 
            animateToolStripMenuItem.Name = "animateToolStripMenuItem";
            animateToolStripMenuItem.Size = new Size(191, 24);
            animateToolStripMenuItem.Text = "Animate!";
            animateToolStripMenuItem.Click += animateToolStripMenuItem_Click;
            // 
            // selectAgentToolStripMenuItem
            // 
            selectAgentToolStripMenuItem.Name = "selectAgentToolStripMenuItem";
            selectAgentToolStripMenuItem.Size = new Size(191, 24);
            selectAgentToolStripMenuItem.Text = "Select Agent";
            selectAgentToolStripMenuItem.Click += selectAgentToolStripMenuItem_Click;
            // 
            // selectAnimationToolStripMenuItem
            // 
            selectAnimationToolStripMenuItem.Name = "selectAnimationToolStripMenuItem";
            selectAnimationToolStripMenuItem.Size = new Size(191, 24);
            selectAnimationToolStripMenuItem.Text = "Select Animation";
            // 
            // selectStateToolStripMenuItem
            // 
            selectStateToolStripMenuItem.Name = "selectStateToolStripMenuItem";
            selectStateToolStripMenuItem.Size = new Size(191, 24);
            selectStateToolStripMenuItem.Text = "Select State";
            // 
            // controlsToolStripMenuItem
            // 
            controlsToolStripMenuItem.Name = "controlsToolStripMenuItem";
            controlsToolStripMenuItem.Size = new Size(191, 24);
            controlsToolStripMenuItem.Text = "Controls";
            // 
            // exitToolStripMenuItem
            // 
            exitToolStripMenuItem.Name = "exitToolStripMenuItem";
            exitToolStripMenuItem.Size = new Size(191, 24);
            exitToolStripMenuItem.Text = "Exit";
            exitToolStripMenuItem.Click += exitToolStripMenuItem_Click;
            // 
            // trayIcon
            // 
            trayIcon.ContextMenuStrip = contextMenu;
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
            // CharacterView
            // 
            AutoScaleDimensions = new SizeF(8F, 20F);
            AutoScaleMode = AutoScaleMode.Font;
            BackColor = Color.Black;
            ClientSize = new Size(282, 253);
            ContextMenuStrip = contextMenu;
            DoubleBuffered = true;
            FormBorderStyle = FormBorderStyle.None;
            Name = "CharacterView";
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.CenterScreen;
            Text = "Clippy";
            TopMost = true;
            Click += CharacterView_Click;
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
        private ToolStripMenuItem selectAnimationToolStripMenuItem;
        private ToolStripMenuItem selectStateToolStripMenuItem;
        private ToolStripMenuItem hideToolStripMenuItem1;
        private ToolStripMenuItem animateToolStripMenuItem;
        private ToolStripMenuItem selectAgentToolStripMenuItem;
    }
}
