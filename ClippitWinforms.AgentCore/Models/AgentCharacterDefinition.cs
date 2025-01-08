using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ClippitWinforms.AgentCore.Models
{
    public class AgentCharacterDefinition
    {
        public Character Character { get; set; }
        public Balloon Balloon { get; set; }
        public Dictionary<string, Animation> Animations { get; set; } = new Dictionary<string, Animation>();
        public Dictionary<string, State> States { get; set; } = new Dictionary<string, State>();
    }

    public class Character
    {
        public List<Info> Infos { get; set; } = new List<Info>();
        public Guid Guid { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
        public int Transparency { get; set; }
        public int DefaultFrameDuration { get; set; }
        public CharacterStyle Style { get; set; }
        public string ColorTable { get; set; }
    }

    public class Balloon
    {
        public int NumLines { get; set; }
        public int CharsPerLine { get; set; }
        public string FontName { get; set; }
        public int FontHeight { get; set; }
        public Color ForeColor { get; set; }
        public Color BackColor { get; set; }
        public Color BorderColor { get; set; }
    }

    public class Animation
    {
        public string Name { get; set; }
        public int TransitionType { get; set; }
        public List<FrameDefinition> Frames { get; set; } = new List<FrameDefinition>();
    }

    public class FrameDefinition
    {
        public int Duration { get; set; }
        public string SoundEffect { get; set; }
        public int? ExitBranch { get; set; }
        public List<ImageDefinition> Images { get; set; } = new List<ImageDefinition>();
        public List<BranchingDefinition> Branching { get; set; }
    }

    public class ImageDefinition
    {
        public string Filename { get; set; }
        public int OffsetX { get; set; }
        public int OffsetY { get; set; }
    }

    public class BranchingDefinition
    {
        public int BranchTo { get; set; }
        public int Probability { get; set; }
    }

    public class State
    {
        public string Name { get; set; }
        public List<string> Animations { get; set; } = new List<string>();
    }

    public class Info
    {
        public CultureInfo LanguageCode { get; set; }  // Hexadecimal code like 0x0816 for Portuguese, 0x0C0A for Spanish
        public string Name { get; set; }
        public string Description { get; set; }
        public List<string> Greetings { get; set; } = new List<string>();  // Messages before the ^^ in ExtraData
        public List<string> Reminders { get; set; } = new List<string>();  // Messages after the ^^ in ExtraData
    }
    [Flags]
    public enum CharacterStyle
    {
        None = 0,
        VoiceNone = 1,
        BalloonRoundRect = 2
        // Add other style flags as needed
    }
}
