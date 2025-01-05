namespace ClippitWinforms.Data
{
    public class BalloonSettings
    {
        public int NumLines { get; set; } = 2;
        public int CharsPerLine { get; set; } = 28;
        public string FontName { get; set; } = "MS Sans Serif";
        public int FontHeight { get; set; } = 13;
        public string ForeColor { get; set; } = "00000000";
        public string BackColor { get; set; } = "00ffffcc";
        public string BorderColor { get; set; } = "00000000";

        public Color GetForeColor() => ColorTranslator.FromHtml(string.Concat("#", ForeColor.AsSpan(2)));
        public Color GetBackColor() => ColorTranslator.FromHtml(string.Concat("#", BackColor.AsSpan(2)));
        public Color GetBorderColor() => ColorTranslator.FromHtml(string.Concat("#", BorderColor.AsSpan(2)));
    }
}
