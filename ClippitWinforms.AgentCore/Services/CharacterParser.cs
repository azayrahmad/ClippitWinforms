using ClippitWinforms.AgentCore.Models;
using System.Drawing;
using System.Text.RegularExpressions;

namespace ClippitWinforms.AgentCore.Services
{
    public class CharacterParser
    {
        private AgentCharacterDefinition currentAgent = new AgentCharacterDefinition();
        private Character currentCharacter;
        private Info currentLanguageInfo;
        private Animation currentAnimation;
        private FrameDefinition currentFrame;
        private State currentState;

        public AgentCharacterDefinition ParseFromFile(string filePath)
        {
            var lines = File.ReadAllLines(filePath);
            return ParseFromLines(lines);
        }

        private AgentCharacterDefinition ParseFromLines(string[] lines)
        {

            for (int i = 0; i < lines.Length; i++)
            {
                var line = lines[i].Trim();

                // Skip empty lines and comments
                if (string.IsNullOrEmpty(line) || line.StartsWith("//"))
                    continue;

                if (line.StartsWith("DefineCharacter"))
                {
                    ParseCharacterSection(lines, ref i);
                    continue;
                }
                if (line.StartsWith("DefineBalloon"))
                {
                    ParseBalloonSection(lines, ref i);
                    continue;
                }

                if (line.StartsWith("DefineAnimation"))
                {
                    ParseAnimationSection(lines, ref i);
                    continue;
                }

                if (line.StartsWith("DefineState"))
                {
                    ParseStateSection(lines, ref i);
                    continue;
                }

                if (line == "EndCharacter")
                    break;

            }

            return currentAgent;
        }

        private void ParseCharacterSection(string[] lines, ref int i)
        {
            currentCharacter = new Character();
            Info currentLanguageInfo = null;
            i++;

            while (i < lines.Length && !lines[i].Trim().Equals("EndCharacter"))
            {
                var line = lines[i].Trim();
                if (line.StartsWith("DefineInfo"))
                {
                    ParseCharacterInfo(lines, ref i);
                }

                if (line == "EndInfo")
                {
                    if (currentLanguageInfo != null)
                    {
                        if (currentCharacter.Infos == null)
                            currentCharacter.Infos = new List<Info>();
                        currentCharacter.Infos.Add(currentLanguageInfo);
                        currentLanguageInfo = null;
                    }
                }

                // Parse key-value pairs
                var parts = line.Split(new[] { '=' }, 2);
                if (parts.Length == 2)
                {

                    var key = parts[0].Trim();
                    var value = parts[1].Trim().Trim('"');

                    // Parsing general character properties
                    switch (key)
                    {
                        case "GUID":
                            currentCharacter.Guid = ParseGuid(value);
                            break;
                        case "Width":
                            currentCharacter.Width = int.Parse(value);
                            break;
                        case "Height":
                            currentCharacter.Height = int.Parse(value);
                            break;
                        case "Transparency":
                            currentCharacter.Transparency = int.Parse(value);
                            break;
                        case "DefaultFrameDuration":
                            currentCharacter.DefaultFrameDuration = int.Parse(value);
                            break;
                        case "Style":
                            currentCharacter.Style = ParseStyle(value);
                            break;
                        case "ColorTable":
                            currentCharacter.ColorTable = value;
                            break;
                    }
                }
                i++;
            }
            currentAgent.Character = currentCharacter;
        }

        private void ParseCharacterInfo(string[] lines, ref int i)
        {


            var line = lines[i].Trim();
            var match = Regex.Match(line, @"0x([0-9A-Fa-f]{4})");
            if (!match.Success) return;

            currentLanguageInfo = new Info
            {
                LanguageCode = new System.Globalization.CultureInfo(Convert.ToInt32(match.Groups[1].Value, 16))
            };

            i++;

            while (i < lines.Length && !lines[i].Trim().Equals("EndInfo"))
            {
                line = lines[i].Trim();
                var parts = line.Split(new[] { '=' }, 2);
                if (parts.Length == 2)
                {

                    var key = parts[0].Trim();
                    var value = parts[1].Trim().Trim('"');


                    // Parsing language-specific information
                    switch (key)
                    {
                        case "Name":
                            currentLanguageInfo.Name = value;
                            break;
                        case "Description":
                            currentLanguageInfo.Description = value;
                            break;
                        case "ExtraData":
                            ParseExtraData(value, currentLanguageInfo);
                            break;
                    }

                }

                i++;
            }

            if (currentLanguageInfo != null)
            {
                if (currentCharacter.Infos == null)
                    currentCharacter.Infos = new List<Info>();
                currentCharacter.Infos.Add(currentLanguageInfo);
                currentLanguageInfo = null;
            }
        }

        private void ParseExtraData(string extraData, Info languageInfo)
        {
            var parts = extraData.Split(new[] { "^^" }, StringSplitOptions.None);

            // Parse greetings (before ^^)
            languageInfo.Greetings = parts[0]
                .Split(new[] { "~~" }, StringSplitOptions.None)
                .Select(s => s.Trim())
                .ToList();

            // Parse reminders (after ^^)
            if (parts.Length > 1)
            {
                languageInfo.Reminders = parts[1]
                    .Split(new[] { "~~" }, StringSplitOptions.None)
                    .Select(s => s.Trim())
                    .ToList();
            }
            else
            {
                languageInfo.Reminders = new List<string>();
            }
        }

        private Guid ParseGuid(string value)
        {
            // Remove curly braces and parse GUID
            value = value.Trim('{', '}');
            return Guid.Parse(value);
        }

        private CharacterStyle ParseStyle(string value)
        {
            CharacterStyle style = CharacterStyle.None;
            var styleParts = value.Split(new[] { '|' }, StringSplitOptions.RemoveEmptyEntries);

            foreach (var part in styleParts)
            {
                var trimmedPart = part.Trim();
                if (trimmedPart == "AXS_VOICE_NONE")
                    style |= CharacterStyle.VoiceNone;
                else if (trimmedPart == "AXS_BALLOON_ROUNDRECT")
                    style |= CharacterStyle.BalloonRoundRect;
            }

            return style;
        }

        private void ParseBalloonSection(string[] lines, ref int i)
        {
            var balloon = new Balloon();
            i++;

            while (i < lines.Length && !lines[i].Trim().Equals("EndBalloon"))
            {
                var line = lines[i].Trim();
                var parts = line.Split(new[] { '=' }, 2);
                if (parts.Length == 2)
                {
                    var key = parts[0].Trim();
                    var value = parts[1].Trim();

                    switch (key)
                    {
                        case "NumLines":
                            balloon.NumLines = int.Parse(value);
                            break;
                        case "CharsPerLine":
                            balloon.CharsPerLine = int.Parse(value);
                            break;
                        case "FontName":
                            balloon.FontName = value.Trim('"');
                            break;
                        case "FontHeight":
                            balloon.FontHeight = int.Parse(value);
                            break;
                        case "ForeColor":
                            balloon.ForeColor = ParseColor(value);
                            break;
                        case "BackColor":
                            balloon.BackColor = ParseColor(value);
                            break;
                        case "BorderColor":
                            balloon.BorderColor = ParseColor(value);
                            break;
                    }
                }
                i++;
            }

            currentAgent.Balloon = balloon;
        }

        private void ParseAnimationSection(string[] lines, ref int i)
        {
            var line = lines[i].Trim();
            var match = Regex.Match(line, @"DefineAnimation\s+""([^""]+)""");
            if (!match.Success) return;

            currentAnimation = new Animation
            {
                Name = match.Groups[1].Value
            };

            i++;

            while (i < lines.Length && !lines[i].Trim().Equals("EndAnimation"))
            {
                line = lines[i].Trim();

                if (line.StartsWith("TransitionType"))
                {
                    var value = line.Split('=')[1].Trim();
                    currentAnimation.TransitionType = int.Parse(value);
                }
                else if (line.StartsWith("DefineFrame"))
                {
                    ParseFrameSection(lines, ref i);
                }

                i++;
            }

            currentAgent.Animations[currentAnimation.Name] = currentAnimation;
        }

        private void ParseFrameSection(string[] lines, ref int i)
        {
            currentFrame = new FrameDefinition();
            i++;

            while (i < lines.Length && !lines[i].Trim().Equals("EndFrame"))
            {
                var line = lines[i].Trim();

                if (line.StartsWith("Duration"))
                {
                    var value = line.Split('=')[1].Trim();
                    currentFrame.Duration = int.Parse(value);
                }
                if (line.StartsWith("ExitBranch"))
                {
                    var value = line.Split('=')[1].Trim();
                    currentFrame.ExitBranch = int.Parse(value);
                }
                else if (line.StartsWith("SoundEffect"))
                {
                    var value = line.Split('=')[1].Trim();
                    currentFrame.SoundEffect = value.Trim('"');
                }
                else if (line.StartsWith("DefineImage"))
                {
                    ParseImageSection(lines, ref i);
                }
                else if (line.StartsWith("DefineBranching"))
                {
                    ParseBranchingSection(lines, ref i);
                }

                i++;
            }

            currentAnimation.Frames.Add(currentFrame);
        }

        private void ParseImageSection(string[] lines, ref int i)
        {
            var image = new ImageDefinition();
            i++;

            while (i < lines.Length && !lines[i].Trim().Equals("EndImage"))
            {
                var line = lines[i].Trim();
                var parts = line.Split(new[] { '=' }, 2);
                if (parts.Length == 2)
                {
                    var key = parts[0].Trim();
                    var value = parts[1].Trim();

                    switch (key)
                    {
                        case "Filename":
                            image.Filename = value.Trim('"');
                            break;
                        case "OffsetX":
                            image.OffsetX = int.Parse(value);
                            break;
                        case "OffsetY":
                            image.OffsetY = int.Parse(value);
                            break;
                    }
                }
                i++;
            }

            // Initialize Images list if null
            if (currentFrame.Images == null)
            {
                currentFrame.Images = new List<ImageDefinition>();
            }

            currentFrame.Images.Add(image);
        }

        private void ParseBranchingSection(string[] lines, ref int i)
        {
            var branchingList = new List<BranchingDefinition>();
            var branching = new BranchingDefinition();
            i++;

            while (i < lines.Length && !lines[i].Trim().Equals("EndBranching"))
            {
                var line = lines[i].Trim();
                var parts = line.Split(new[] { '=' }, 2);
                if (parts.Length == 2)
                {
                    var key = parts[0].Trim();
                    var value = int.Parse(parts[1].Trim());

                    switch (key)
                    {
                        case "BranchTo":
                            branching.BranchTo = value;
                            break;
                        case "Probability":
                            branching.Probability = value;
                            break;
                    }
                }
                if (branching.BranchTo > 0 && branching.Probability > 0)
                {
                    branchingList.Add(branching);
                    branching = new BranchingDefinition();
                }
                i++;
            }

            currentFrame.Branching = branchingList;
        }

        private void ParseStateSection(string[] lines, ref int i)
        {
            var line = lines[i].Trim();
            var match = Regex.Match(line, @"DefineState\s+""([^""]+)""");
            if (!match.Success) return;

            currentState = new State
            {
                Name = match.Groups[1].Value
            };

            i++;

            while (i < lines.Length && !lines[i].Trim().Equals("EndState"))
            {
                line = lines[i].Trim();
                var parts = line.Split(new[] { '=' }, 2);
                if (parts.Length == 2 && parts[0].Trim() == "Animation")
                {
                    currentState.Animations.Add(parts[1].Trim().Trim('"'));
                }
                i++;
            }

            currentAgent.States[currentState.Name] = currentState;
        }

        private Color ParseColor(string hexColor)
        {
            // Convert from "00e1ffff" format to Color
            if (hexColor.Length == 8)
            {
                var a = byte.Parse(hexColor.Substring(0, 2), System.Globalization.NumberStyles.HexNumber);
                var b = byte.Parse(hexColor.Substring(2, 2), System.Globalization.NumberStyles.HexNumber);
                var g = byte.Parse(hexColor.Substring(4, 2), System.Globalization.NumberStyles.HexNumber);
                var r = byte.Parse(hexColor.Substring(6, 2), System.Globalization.NumberStyles.HexNumber);
                return Color.FromArgb(a, r, g, b);
            }
            return Color.Black;
        }
    }
}
