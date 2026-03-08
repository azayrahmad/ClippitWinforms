import {
    AgentCharacterDefinition,
    Character,
    Balloon,
    Animation,
    FrameDefinition,
    ImageDefinition,
    BranchingDefinition,
    State,
    Info,
    CharacterStyle
} from '../models/AgentCharacterDefinition';

export class CharacterParser {
    private currentAgent!: AgentCharacterDefinition;
    private currentCharacter!: Character;
    private currentLanguageInfo: Info | null = null;

    public parseFromText(text: string): AgentCharacterDefinition {
        // Character definitions can be large, and sometimes contain binary or non-UTF8 data.
        // We split by lines but handle each line carefully.
        const lines = text.split(/\r?\n/);
        console.log(`Parsing ACD file with ${lines.length} lines`);
        const result = this.parseFromLines(lines);
        console.log(`Parsed ${Object.keys(result.animations).length} animations and ${Object.keys(result.states).length} states`);
        return result;
    }

    private parseFromLines(lines: string[]): AgentCharacterDefinition {
        this.currentAgent = {
            character: {
                infos: [],
                guid: "",
                width: 0,
                height: 0,
                transparency: 0,
                defaultFrameDuration: 0,
                style: CharacterStyle.None,
                colorTable: ""
            } as Character,
            balloon: {} as Balloon,
            animations: {},
            states: {}
        };

        console.log(`Starting parse of ${lines.length} lines`);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (i < 10) console.log(`Line ${i}: [${line}]`);

            if (!line || line.startsWith("//"))
                continue;

            if (line.startsWith("DefineCharacter")) {
                i = this.parseCharacterSection(lines, i);
                continue;
            }
            if (line.startsWith("DefineBalloon")) {
                i = this.parseBalloonSection(lines, i);
                continue;
            }
            if (line.startsWith("DefineAnimation")) {
                i = this.parseAnimationSection(lines, i);
                continue;
            }
            if (line.startsWith("DefineState")) {
                i = this.parseStateSection(lines, i);
                continue;
            }
            if (line.startsWith("DefineAnimation")) {
                i = this.parseAnimationSection(lines, i);
                continue;
            }
            if (line.startsWith("DefineState")) {
                i = this.parseStateSection(lines, i);
                continue;
            }

            if (line === "EndCharacter")
                break;
        }

        return this.currentAgent;
    }

    private parseCharacterSection(lines: string[], i: number): number {
        this.currentCharacter = this.currentAgent.character;
        i++;

        while (i < lines.length && lines[i].trim() !== "EndCharacter") {
            const line = lines[i].trim();
            if (line.startsWith("DefineInfo")) {
                i = this.parseCharacterInfo(lines, i);
                continue;
            }
            if (line.startsWith("DefineAnimation")) {
                i = this.parseAnimationSection(lines, i);
                continue;
            }
            if (line.startsWith("DefineState")) {
                i = this.parseStateSection(lines, i);
                continue;
            }

            if (line === "EndInfo") {
                if (this.currentLanguageInfo) {
                    this.currentCharacter.infos.push(this.currentLanguageInfo);
                    this.currentLanguageInfo = null;
                }
            }

            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');

                switch (key) {
                    case "GUID":
                        this.currentCharacter.guid = value.replace(/[{}]/g, '');
                        break;
                    case "Width":
                        this.currentCharacter.width = parseInt(value);
                        break;
                    case "Height":
                        this.currentCharacter.height = parseInt(value);
                        break;
                    case "Transparency":
                        this.currentCharacter.transparency = parseInt(value);
                        break;
                    case "DefaultFrameDuration":
                        this.currentCharacter.defaultFrameDuration = parseInt(value);
                        break;
                    case "Style":
                        this.currentCharacter.style = this.parseStyle(value);
                        break;
                    case "ColorTable":
                        this.currentCharacter.colorTable = value;
                        break;
                }
            }
            i++;
        }
        return i;
    }

    private parseCharacterInfo(lines: string[], i: number): number {
        const line = lines[i].trim();
        const match = line.match(/0x([0-9A-Fa-f]{4})/);
        if (!match) return i;

        this.currentLanguageInfo = {
            languageCode: parseInt(match[1], 16),
            name: "",
            description: "",
            greetings: [],
            reminders: []
        };

        i++;

        while (i < lines.length && lines[i].trim() !== "EndInfo") {
            const line = lines[i].trim();
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');

                switch (key) {
                    case "Name":
                        this.currentLanguageInfo.name = value;
                        break;
                    case "Description":
                        this.currentLanguageInfo.description = value;
                        break;
                    case "ExtraData":
                        this.parseExtraData(value, this.currentLanguageInfo);
                        break;
                }
            }
            i++;
        }

        if (this.currentLanguageInfo) {
            this.currentCharacter.infos.push(this.currentLanguageInfo);
            this.currentLanguageInfo = null;
        }
        return i;
    }

    private parseExtraData(extraData: string, languageInfo: Info): void {
        const parts = extraData.split("^^");
        languageInfo.greetings = parts[0].split("~~").map(s => s.trim());
        if (parts.length > 1) {
            languageInfo.reminders = parts[1].split("~~").map(s => s.trim());
        }
    }

    private parseStyle(value: string): CharacterStyle {
        let style = CharacterStyle.None;
        const styleParts = value.split('|');

        for (const part of styleParts) {
            const trimmedPart = part.trim();
            if (trimmedPart === "AXS_VOICE_NONE")
                style |= CharacterStyle.VoiceNone;
            else if (trimmedPart === "AXS_BALLOON_ROUNDRECT")
                style |= CharacterStyle.BalloonRoundRect;
        }
        return style;
    }

    private parseBalloonSection(lines: string[], i: number): number {
        const balloon = {} as Balloon;
        i++;

        while (i < lines.length && lines[i].trim() !== "EndBalloon") {
            const line = lines[i].trim();
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');

                switch (key) {
                    case "NumLines":
                        balloon.numLines = parseInt(value);
                        break;
                    case "CharsPerLine":
                        balloon.charsPerLine = parseInt(value);
                        break;
                    case "FontName":
                        balloon.fontName = value;
                        break;
                    case "FontHeight":
                        balloon.fontHeight = parseInt(value);
                        break;
                    case "ForeColor":
                        balloon.foreColor = this.parseColor(value);
                        break;
                    case "BackColor":
                        balloon.backColor = this.parseColor(value);
                        break;
                    case "BorderColor":
                        balloon.borderColor = this.parseColor(value);
                        break;
                }
            }
            i++;
        }
        this.currentAgent.balloon = balloon;
        return i;
    }

    private parseAnimationSection(lines: string[], i: number): number {
        const line = lines[i].trim();
        const match = line.match(/DefineAnimation\s+"([^"]+)"/);
        if (!match) return i;

        const animation: Animation = {
            name: match[1],
            transitionType: 0,
            frames: []
        };

        i++;

        while (i < lines.length && lines[i].trim() !== "EndAnimation") {
            const line = lines[i].trim();

            if (line.startsWith("TransitionType")) {
                const value = line.split('=')[1].trim();
                animation.transitionType = parseInt(value);
                i++;
            } else if (line.startsWith("DefineFrame")) {
                i = this.parseFrameSection(lines, i, animation);
            } else {
                i++;
            }
        }

        this.currentAgent.animations[animation.name] = animation;
        return i;
    }

    private parseFrameSection(lines: string[], i: number, animation: Animation): number {
        const frame: FrameDefinition = {
            duration: 0,
            images: []
        };
        i++;

        while (i < lines.length && lines[i].trim() !== "EndFrame") {
            const line = lines[i].trim();

            if (line.startsWith("Duration")) {
                const value = line.split('=')[1].trim();
                frame.duration = parseInt(value);
                i++;
            } else if (line.startsWith("ExitBranch")) {
                const value = line.split('=')[1].trim();
                frame.exitBranch = parseInt(value);
                i++;
            } else if (line.startsWith("SoundEffect")) {
                const value = line.split('=')[1].trim().replace(/^"|"$/g, '');
                frame.soundEffect = value;
                i++;
            } else if (line.startsWith("DefineImage")) {
                i = this.parseImageSection(lines, i, frame);
            } else if (line.startsWith("DefineBranching")) {
                i = this.parseBranchingSection(lines, i, frame);
            } else {
                i++;
            }
        }

        animation.frames.push(frame);
        return i;
    }

    private parseImageSection(lines: string[], i: number, frame: FrameDefinition): number {
        const image = {} as ImageDefinition;
        i++;

        while (i < lines.length && lines[i].trim() !== "EndImage") {
            const line = lines[i].trim();
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');

                switch (key) {
                    case "Filename":
                        image.filename = value;
                        break;
                    case "OffsetX":
                        image.offsetX = parseInt(value);
                        break;
                    case "OffsetY":
                        image.offsetY = parseInt(value);
                        break;
                }
            }
            i++;
        }
        frame.images.push(image);
        return i;
    }

    private parseBranchingSection(lines: string[], i: number, frame: FrameDefinition): number {
        const branchingList: BranchingDefinition[] = [];
        let branching = {} as BranchingDefinition;
        i++;

        while (i < lines.length && lines[i].trim() !== "EndBranching") {
            const line = lines[i].trim();
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parseInt(parts.slice(1).join('=').trim());

                switch (key) {
                    case "BranchTo":
                        branching.branchTo = value;
                        break;
                    case "Probability":
                        branching.probability = value;
                        break;
                }
            }
            if (branching.branchTo !== undefined && branching.probability !== undefined) {
                branchingList.push(branching);
                branching = {} as BranchingDefinition;
            }
            i++;
        }
        frame.branching = branchingList;
        return i;
    }

    private parseStateSection(lines: string[], i: number): number {
        const line = lines[i].trim();
        const match = line.match(/DefineState\s+"([^"]+)"/);
        if (!match) return i;

        const stateName = match[1];
        const stateAnimations: string[] = [];

        i++;

        while (i < lines.length && lines[i].trim() !== "EndState") {
            const line = lines[i].trim();
            const parts = line.split('=');
            if (parts.length >= 2 && parts[0].trim() === "Animation") {
                stateAnimations.push(parts.slice(1).join('=').trim().replace(/^"|"$/g, ''));
            }
            i++;
        }

        this.currentAgent.states[stateName] = {
            name: stateName,
            animations: stateAnimations
        };
        return i;
    }

    private parseColor(hexColor: string): string {
        // Convert from "00e1ffff" format to CSS rgba
        if (hexColor.length === 8) {
            const a = parseInt(hexColor.substring(0, 2), 16);
            const b = parseInt(hexColor.substring(2, 4), 16);
            const g = parseInt(hexColor.substring(4, 6), 16);
            const r = parseInt(hexColor.substring(6, 8), 16);
            return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
        }
        return "black";
    }
}
