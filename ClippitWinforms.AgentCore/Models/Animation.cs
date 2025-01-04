using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ClippitWinforms.AgentCore.Models
{
    public class Animation
    {
        public string Name { get; set; }
        public List<AnimationFrame> Frames { get; set; }
    }
    public class Branch
    {
        public int BranchTo { get; set; }
        public int Probability { get; set; }
    }

    public class Branching
    {
        public List<Branch> Branches { get; set; }
    }
    public class AnimationFrame
    {
        public int Duration { get; set; }
        public List<AnimationImage> Image { get; set; }
        public string SoundEffect { get; set; }
        public Branching Branching { get; set; }
        public int? ExitBranch { get; set; }
    }

    public class AnimationImage
    {
        public string Filename { get; set; }
    }
}
