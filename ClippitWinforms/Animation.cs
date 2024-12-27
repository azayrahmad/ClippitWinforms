using System;
namespace ClippitWinforms
{
    public class AnimationFrame
    {
        public int Duration { get; set; }
        public List<int[]> Images { get; set; }
    }

    public class Animation
    {
        public List<AnimationFrame> Frames { get; set; }
    }
}
