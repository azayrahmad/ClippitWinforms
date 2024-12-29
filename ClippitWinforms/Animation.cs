using System;
namespace ClippitWinforms
{
    public class Branch
    {
        public int FrameIndex { get; set; }
        public int Weight { get; set; }
    }

    public class Branching
    {
        public List<Branch> Branches { get; set; }
    }
    public class AnimationFrame
    {
        public int Duration { get; set; }
        public List<int[]> Images { get; set; }
        public string Sound { get; set; }
        public Branching Branching { get; set; }
        public int? ExitBranch { get; set; }
    }

    public class Animation
    {
        public string Name { get; set; }
        public List<AnimationFrame> Frames { get; set; }
    }
}
