using System.Drawing.Drawing2D;
using System.Text.Json;

namespace ClippitWinforms;

public class BalloonSettings
{
    public int NumLines { get; set; } = 2;
    public int CharsPerLine { get; set; } = 28;
    public string FontName { get; set; } = "MS Sans Serif";
    public int FontHeight { get; set; } = 13;
    public string ForeColor { get; set; } = "00000000";
    public string BackColor { get; set; } = "00e1ffff";
    public string BorderColor { get; set; } = "00000000";

    public Color GetForeColor() => ColorTranslator.FromHtml("#" + ForeColor.Substring(2));
    public Color GetBackColor() => ColorTranslator.FromHtml("#" + BackColor.Substring(2));
    public Color GetBorderColor() => ColorTranslator.FromHtml("#" + BorderColor.Substring(2));
}

public class Balloon : Form
{
    private readonly Label titleLabel;
    private readonly Label contentLabel;
    private readonly int tailHeight = 40; // Increased tail height
    private readonly int cornerRadius = 10;
    private readonly int padding = 10;
    private BalloonSettings settings;
    private Form parentForm;
    
    public Balloon(Form parent)
    {
        parentForm = parent;
        
        // Set up the form properties
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        TopMost = true;
        BackColor = Color.Pink;
        TransparencyKey = Color.Pink;

        // Configure title label
        titleLabel = new Label
        {
            Location = new Point(padding, padding),
            AutoSize = false,
            Font = new Font("MS Sans Serif", 10, FontStyle.Bold),
            TextAlign = ContentAlignment.MiddleLeft,
            UseMnemonic = false // Prevents & from being interpreted as an underline marker
        };
        
        // Configure content label
        contentLabel = new Label
        {
            AutoSize = false,
            TextAlign = ContentAlignment.TopLeft,
            UseMnemonic = false
        };

        // Add controls to the form
        Controls.AddRange(new Control[] { titleLabel, contentLabel });
        
        // Enable custom drawing
        SetStyle(ControlStyles.UserPaint | 
                ControlStyles.AllPaintingInWmPaint | 
                ControlStyles.OptimizedDoubleBuffer, true);

        // Handle parent form movement
        parentForm.LocationChanged += (s, e) => UpdatePosition();
        parentForm.SizeChanged += (s, e) => UpdatePosition();
    }

    public void ShowBalloon(string title, string content)
    {
        titleLabel.Text = title;
        contentLabel.Text = content;
        
        // Recalculate size based on content
        UpdateSize();
        UpdatePosition();
        Show();
    }
    private Size MeasureText(string text, Font font, int maxWidth)
    {
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
        Size titleSize = MeasureText(titleLabel.Text, titleLabel.Font, innerWidth);
        
        // Measure content
        Size contentSize = MeasureText(contentLabel.Text, contentLabel.Font, innerWidth);
        
        // Calculate required width
        int requiredInnerWidth = Math.Max(titleSize.Width, contentSize.Width);
        int totalWidth = Math.Min(maxWidth, Math.Max(minWidth, requiredInnerWidth + (padding * 2)));
        
        // Update form width
        Width = totalWidth;
        
        // Update labels
        int usableWidth = Width - (padding * 2);
        
        // Configure title
        titleLabel.Width = usableWidth;
        titleLabel.Height = titleSize.Height;
        titleLabel.Location = new Point(padding, padding);
        
        // Configure content with AutoSize true for proper wrapping
        contentLabel.MaximumSize = new Size(usableWidth, 0);
        contentLabel.AutoSize = true;
        contentLabel.Location = new Point(padding, titleLabel.Bottom + 10);
        
        // Update form height after content is properly wrapped
        Height = padding + titleLabel.Height + 10 + contentLabel.Height + padding + tailHeight;
    }

    private void UpdatePosition()
    {
        if (parentForm == null) return;

        Location = new Point(
            parentForm.Location.X + (parentForm.Width / 2) - (Width / 2),
            parentForm.Location.Y - Height + tailHeight - 20
        );
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

        titleLabel.Font = new Font(settings.FontName, settings.FontHeight + 2, FontStyle.Bold);
        contentLabel.Font = new Font(settings.FontName, settings.FontHeight);
        
        titleLabel.ForeColor = settings.GetForeColor();
        contentLabel.ForeColor = settings.GetForeColor();
        titleLabel.BackColor = settings.GetBackColor();
        contentLabel.BackColor = settings.GetBackColor();

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
        Rectangle bounds = new Rectangle(0, 0, Width - 1, Height - tailHeight - 1);

        // Draw the rounded rectangle
        path.AddArc(bounds.X, bounds.Y, cornerRadius * 2, cornerRadius * 2, 180, 90);
        path.AddArc(bounds.Right - cornerRadius * 2, bounds.Y, cornerRadius * 2, cornerRadius * 2, 270, 90);
        path.AddArc(bounds.Right - cornerRadius * 2, bounds.Bottom - cornerRadius * 2, cornerRadius * 2, cornerRadius * 2, 0, 90);
        
        // Add tail
        int tailWidth = 12;
        int centerX = Width / 2;
        path.AddLine(centerX - tailWidth, bounds.Bottom, centerX, Height - 1);
        path.AddLine(centerX, Height - 1, centerX + tailWidth, bounds.Bottom);
        
        path.AddArc(bounds.X, bounds.Bottom - cornerRadius * 2, cornerRadius * 2, cornerRadius * 2, 90, 90);
        path.CloseFigure();

        return path;
    }
}