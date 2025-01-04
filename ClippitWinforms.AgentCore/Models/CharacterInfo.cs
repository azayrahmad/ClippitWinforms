using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ClippitWinforms.AgentCore.Models
{
    public class CharacterInfo
    {
        public Dictionary<string, InfoDetail> Info { get; set; }
        public string GUID { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
        public int Transparency { get; set; }
        public int DefaultFrameDuration { get; set; }
        public string Style { get; set; }
        public string ColorTable { get; set; }
    }

    public class InfoDetail
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public string ExtraData { get; set; }
    }
}
