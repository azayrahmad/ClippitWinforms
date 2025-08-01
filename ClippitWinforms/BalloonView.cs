﻿using ClippitWinforms.Data;
using System.Drawing.Drawing2D;
using System.Text.Json;
using Timer = System.Windows.Forms.Timer;

namespace ClippitWinforms;


public class BalloonView : Form
{
    private Label titleLabel;
    private readonly Label contentLabel;
    private readonly int tailHeight = 40;
    private readonly int cornerRadius = 10;
    private readonly int padding = 10;
    private BalloonSettings settings = new BalloonSettings();
    private Form parentForm;
    private enum TailDirection
    {
        Bottom,
        Left,
        Right
    }

    private TailDirection tailDirection = TailDirection.Bottom;

    private Timer hideTimer;
    public BalloonView(Form parent)
    {
        InitializeComponent();
        parentForm = parent;
        BackColor = parentForm.BackColor;
        TransparencyKey = parentForm.TransparencyKey;

        // Configure content label
        contentLabel = new Label
        {
            AutoSize = false,
            TextAlign = ContentAlignment.TopLeft,
            UseMnemonic = false
        };

        // Add controls to the form
        Controls.AddRange([contentLabel]);

        // Enable custom drawing
        SetStyle(ControlStyles.UserPaint |
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.OptimizedDoubleBuffer, true);

        // Handle parent form movement
        parentForm.LocationChanged += (s, e) =>
        {
            UpdateSize();
            UpdatePosition();
        };
        parentForm.SizeChanged += (s, e) =>
        {
            UpdateSize();
            UpdatePosition();
        };
        // Initialize timer for hide timeout
        hideTimer = new Timer();
        hideTimer.Tick += OnHideTimerTick;
        ApplySettings();
    }

    public void ShowBalloon(string title, string content, int displayDurationMs = 0)
    {
        hideTimer.Stop();
        if (!string.IsNullOrEmpty(title))
        {
            titleLabel = new Label
            {
                Location = new Point(padding, padding),
                AutoSize = false,
                Font = new Font(settings.FontName, settings.FontHeight, FontStyle.Bold),
                TextAlign = ContentAlignment.MiddleLeft,
                UseMnemonic = false, // Prevents & from being interpreted as an underline marker
                BackColor = settings.GetBackColor(),
                ForeColor = settings.GetForeColor(),
                Text = title
            };

            Controls.Add(titleLabel);
        }
        contentLabel.Text = content;

        // Recalculate size based on content
        UpdateSize();
        UpdatePosition();

        if (displayDurationMs > 0)
        {
            // Start the hide timer with the specified duration
            hideTimer.Interval = displayDurationMs;
            hideTimer.Start();
        }
        Show();
    }
    public void HideBalloon()
    {
        hideTimer.Stop();
        // Close();
    }

    private Size MeasureText(string text, Font font, int maxWidth)
    {
        if (string.IsNullOrEmpty(text)) return new Size(0, 0);
        using (Graphics g = CreateGraphics())
        {
            // Create a temporary rectangle for text measurement
            RectangleF rect = new RectangleF(0, 0, maxWidth, float.MaxValue);

            // Measure the text with wrapping
            CharacterRange[] ranges = { new CharacterRange(0, text.Length) };
            StringFormat sf = new StringFormat();
            sf.SetMeasurableCharacterRanges(ranges);

            // Get the actual region the text occupies
            Region[] regions = g.MeasureCharacterRanges(text, font, rect, sf);
            RectangleF bounds = regions[0].GetBounds(g);

            // Add a small buffer to ensure text isn't cut off
            return new Size((int)Math.Ceiling(bounds.Width), (int)Math.Ceiling(bounds.Height + 5));
        }
    }

    private void UpdateSize()
    {
        int maxWidth = parentForm.Width;
        int minWidth = 100;
        int innerWidth = maxWidth - (padding * 2);

        // Measure title
        // Size titleSize = MeasureText(titleLabel.Text, titleLabel.Font, innerWidth);
        Size titleSize = new Size(0, 0);
        if (titleLabel != null)
        {
            titleSize = MeasureText(titleLabel.Text, titleLabel.Font, innerWidth);
        }

        // Measure content
        Size contentSize = MeasureText(contentLabel.Text, contentLabel.Font, innerWidth);

        // Calculate required width
        int requiredInnerWidth = Math.Max(titleSize.Width, contentSize.Width);
        int totalWidth = Math.Min(maxWidth, Math.Max(minWidth, requiredInnerWidth + (padding * 2)));

        // Adjust width for left or right tail
        if (tailDirection == TailDirection.Left || tailDirection == TailDirection.Right)
        {
            totalWidth += tailHeight;
        }

        // Update form width
        Width = totalWidth;

        // Update labels
        int usableWidth = Width - (padding * 2);

        // Configure title
        if (titleLabel != null)
        {
            titleLabel.Width = usableWidth;
            titleLabel.Height = titleSize.Height;
            titleLabel.Location = new Point(padding, padding);
        }

        // Configure content with AutoSize true for proper wrapping
        contentLabel.MaximumSize = new Size(usableWidth, 0);
        contentLabel.AutoSize = true;
        //contentLabel.Location = new Point(padding, titleLabel.Bottom);
        contentLabel.Location = new Point(padding, titleLabel == null ? padding : titleLabel.Bottom);

        // Update form height after content is properly wrapped
        //Height = padding + titleLabel.Height + 10 + contentLabel.Height + padding + tailHeight;
        Height = padding + contentLabel.Height + padding + tailHeight;
        if (titleLabel != null) Height += titleLabel.Height;
    }


    private void UpdatePosition()
    {
        if (parentForm == null) return;

        // Get the working area of the screen containing the parent form
        Screen currentScreen = Screen.FromControl(parentForm);
        Rectangle workArea = currentScreen.WorkingArea;

        // Calculate parent form's center point
        Point parentCenter = new Point(
            parentForm.Left + (parentForm.Width / 2),
            parentForm.Top + (parentForm.Height / 2)
        );

        // Initial position (centered above parent)
        Point initialPos = new Point(
            parentCenter.X - (Width / 2),
            parentForm.Location.Y - Height + tailHeight
        );

        // Check horizontal bounds
        if (initialPos.X < workArea.Left)
            initialPos.X = workArea.Left + 10;
        else if (initialPos.X + Width > workArea.Right)
            initialPos.X = workArea.Right - Width - 10;

        // Check if balloon would be above screen top
        if (initialPos.Y < workArea.Top)
        {
            // Try positioning to the right of the parent form first
            if (parentForm.Right + Width + 10 <= workArea.Right)
            {
                initialPos = new Point(
                    parentForm.Right,
                    parentCenter.Y - (Height / 2)
                );
                tailDirection = TailDirection.Left;
            }
            // If not enough space on right, try left side
            else if (parentForm.Left - Width - 10 >= workArea.Left)
            {
                initialPos = new Point(
                    parentForm.Left - Width - 10,
                    parentCenter.Y - (Height / 2)
                );
                tailDirection = TailDirection.Right;
            }
            // If no space on sides, place at top of screen
            else
            {
                initialPos = new Point(
                    Math.Min(Math.Max(parentCenter.X - (Width / 2), workArea.Left), workArea.Right - Width),
                    workArea.Top + 10
                );
                tailDirection = TailDirection.Bottom;
            }
        }
        else
        {
            tailDirection = TailDirection.Bottom;
        }

        Location = initialPos;
        Invalidate();
        BringToFront();
    }

    public void LoadSettings(string jsonSettings)
    {
        try
        {
            settings = JsonSerializer.Deserialize<BalloonSettings>(jsonSettings);
            ApplySettings();
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Error loading settings: {ex.Message}");
        }
    }

    private void ApplySettings()
    {
        if (settings == null) return;

        //titleLabel.ForeColor = settings.GetForeColor();
        contentLabel.ForeColor = settings.GetForeColor();
        // titleLabel.BackColor = settings.GetBackColor();
        contentLabel.BackColor = settings.GetBackColor();
        contentLabel.Font = new Font(settings.FontName, settings.FontHeight);

        //UpdateSize();
        //UpdatePosition();
        Invalidate();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        using (GraphicsPath path = CreateBalloonPath())
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;

            // Fill the balloon
            using (SolidBrush brush = new SolidBrush(settings?.GetBackColor() ?? Color.White))
            {
                e.Graphics.FillPath(brush, path);
            }

            // Draw the border
            using (Pen pen = new Pen(settings?.GetBorderColor() ?? Color.Gray, 1))
            {
                e.Graphics.DrawPath(pen, path);
            }
        }
    }

    private GraphicsPath CreateBalloonPath()
    {
        GraphicsPath path = new GraphicsPath();
        Rectangle bounds;

        switch (tailDirection)
        {
            case TailDirection.Bottom:
                bounds = new Rectangle(0, 0, Width - 1, Height - tailHeight - 1);
                CreateBottomTailPath(path, bounds);
                break;

            case TailDirection.Left:
                bounds = new Rectangle(0, 0, Width - 1, Height - tailHeight - 1);
                CreateLeftTailPath(path, bounds);
                break;

            case TailDirection.Right:
                bounds = new Rectangle(0, 0, Width - 1, Height - tailHeight - 1);
                CreateRightTailPath(path, bounds);
                break;
        }

        return path;
    }

    private void CreateBottomTailPath(GraphicsPath path, Rectangle bounds)
    {
        // Draw the top and side arcs of the rounded rectangle
        path.AddArc(bounds.X, bounds.Y, cornerRadius * 2, cornerRadius * 2, 180, 90); // Top-left corner
        path.AddArc(bounds.Right - cornerRadius * 2, bounds.Y, cornerRadius * 2, cornerRadius * 2, 270, 90); // Top-right corner
        path.AddArc(bounds.Right - cornerRadius * 2, bounds.Bottom - cornerRadius * 2, cornerRadius * 2, cornerRadius * 2, 0, 45); // Bottom-right corner (partial)

        // Transition to the tail
        int tailWidth = 12;
        int centerX = Width / 2;
        int parentCenterX = parentForm.Left + (parentForm.Width / 2);
        int parentCenterXRelative = parentCenterX - this.Left; // Adjust for the balloon's position

        // Create the tail
        path.AddLine(bounds.Right - cornerRadius, bounds.Bottom, centerX + tailWidth, bounds.Bottom); // Line to tail's right base
        path.AddLine(centerX + tailWidth, bounds.Bottom, parentCenterXRelative, Height - 1); // Tail's tip // Tail's tip
        path.AddLine(parentCenterXRelative, Height - 1, centerX - tailWidth, bounds.Bottom); // Tail's left base

        //// Continue drawing the bottom-left corner
        path.AddLine(centerX - tailWidth, bounds.Bottom, bounds.X + cornerRadius, bounds.Bottom); // Line to bottom-left arc
        path.AddArc(bounds.X, bounds.Bottom - cornerRadius * 2, cornerRadius * 2, cornerRadius * 2, 135, 45); // Bottom-left corner

        path.CloseFigure();
    }


    private void CreateLeftTailPath(GraphicsPath path, Rectangle bounds)
    {
        // Draw the rounded rectangle
        path.AddArc(bounds.X, bounds.Y, cornerRadius * 2, cornerRadius * 2, 180, 90);
        path.AddArc(bounds.Right - cornerRadius * 2, bounds.Y, cornerRadius * 2, cornerRadius * 2, 270, 90);
        path.AddArc(bounds.Right - cornerRadius * 2, bounds.Bottom - cornerRadius * 2, cornerRadius * 2, cornerRadius * 2, 0, 90);
        path.AddArc(bounds.X, bounds.Bottom - cornerRadius * 2, cornerRadius * 2, cornerRadius * 2, 90, 90);

        //// Add left-pointing tail
        int tailWidth = 12;
        int centerY = Height / 2;
        //path.AddLine(bounds.X, bounds.Bottom - cornerRadius, bounds.X, centerY + tailWidth); // left side from bottom
        //path.AddLine(bounds.X, centerY - tailWidth, bounds.X, bounds.Y + cornerRadius); // left side from top
        ////path.AddLine(bounds.X, centerY + tailWidth, bounds.X - tailHeight, centerY);
        ////path.AddLine(bounds.X, centerY + tailWidth, 0, centerY);
        ////path.AddLine(0, centerY, bounds.X, centerY + tailWidth);

        //path.CloseFigure();
    }

    private void CreateRightTailPath(GraphicsPath path, Rectangle bounds)
    {
        // Draw the rounded rectangle
        path.AddArc(bounds.X, bounds.Y, cornerRadius * 2, cornerRadius * 2, 180, 90);
        path.AddArc(bounds.Right - cornerRadius * 2, bounds.Y, cornerRadius * 2, cornerRadius * 2, 270, 90);
        path.AddArc(bounds.Right - cornerRadius * 2, bounds.Bottom - cornerRadius * 2, cornerRadius * 2, cornerRadius * 2, 0, 90);
        path.AddArc(bounds.X, bounds.Bottom - cornerRadius * 2, cornerRadius * 2, cornerRadius * 2, 90, 90);

        // Add right-pointing tail
        int tailWidth = 12;
        int centerY = Height / 2;
        //path.AddLine(bounds.Right, centerY - tailWidth, Width - 1, centerY);
        //path.AddLine(Width - 1, centerY, bounds.Right, centerY + tailWidth);

        // path.CloseFigure();
    }

    private void InitializeComponent()
    {
        SuspendLayout();
        // 
        // BalloonView
        // 
        BackColor = Color.Pink;
        ClientSize = new Size(282, 253);
        FormBorderStyle = FormBorderStyle.None;
        Name = "BalloonView";
        ShowInTaskbar = false;
        TopMost = true;
        TransparencyKey = Color.Pink;
        ResumeLayout(false);
    }

    private void OnHideTimerTick(object sender, EventArgs e)
    {
        // Stop the hide timer and close the balloon
        HideBalloon();
    }
}