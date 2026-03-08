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
    public parseFromText(text: string): AgentCharacterDefinition {
        const lines = text.split(/\r?\n/);
        console.log(`Parsing ACD file with ${lines.length} lines`);
        const result = this.parseFromLines(lines);
        console.log(`Parsed ${Object.keys(result.animations).length} animations and ${Object.keys(result.states).length} states`);
        return result;
    }

    private parseFromLines(lines: string[]): AgentCharacterDefinition {
        const agent: AgentCharacterDefinition = {
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

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lowerLine = line.toLowerCase();
            if (!line || line.startsWith("//")) continue;

            if (lowerLine.startsWith("definecharacter")) {
                i = this.parseCharacterSection(lines, i, agent);
            } else if (lowerLine.startsWith("defineballoon")) {
                i = this.parseBalloonSection(lines, i, agent);
            } else if (lowerLine.startsWith("defineanimation")) {
                i = this.parseAnimationSection(lines, i, agent);
            } else if (lowerLine.startsWith("definestate")) {
                i = this.parseStateSection(lines, i, agent);
            }
        }

        return agent;
    }

    private parseCharacterSection(lines: string[], i: number, agent: AgentCharacterDefinition): number {
        i++;
        while (i < lines.length && !lines[i].trim().toLowerCase().startsWith("endcharacter")) {
            const line = lines[i].trim();
            const lowerLine = line.toLowerCase();
            if (lowerLine.startsWith("defineinfo")) {
                i = this.parseCharacterInfo(lines, i, agent.character);
            } else if (lowerLine.startsWith("defineanimation")) {
                i = this.parseAnimationSection(lines, i, agent);
            } else if (lowerLine.startsWith("definestate")) {
                i = this.parseStateSection(lines, i, agent);
            } else {
                const parts = line.split('=');
                if (parts.length >= 2) {
                    const key = parts[0].trim().toUpperCase();
                    const value = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
                    switch (key) {
                        case "GUID": agent.character.guid = value.replace(/[{}]/g, ''); break;
                        case "WIDTH": agent.character.width = parseInt(value); break;
                        case "HEIGHT": agent.character.height = parseInt(value); break;
                        case "TRANSPARENCY": agent.character.transparency = parseInt(value); break;
                        case "DEFAULTFRAMEDURATION": agent.character.defaultFrameDuration = parseInt(value); break;
                        case "STYLE": agent.character.style = this.parseStyle(value); break;
                        case "COLORTABLE": agent.character.colorTable = value; break;
                    }
                }
                i++;
            }
        }
        return i;
    }

    private parseCharacterInfo(lines: string[], i: number, character: Character): number {
        const line = lines[i].trim();
        const match = line.match(/0x([0-9A-Fa-f]{4})/);
        if (!match) return i;

        const info: Info = {
            languageCode: parseInt(match[1], 16),
            name: "",
            description: "",
            greetings: [],
            reminders: []
        };

        i++;
        while (i < lines.length && !lines[i].trim().toLowerCase().startsWith("endinfo")) {
            const l = lines[i].trim();
            const parts = l.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim().toUpperCase();
                const value = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
                switch (key) {
                    case "NAME": info.name = value; break;
                    case "DESCRIPTION": info.description = value; break;
                    case "EXTRADATA": this.parseExtraData(value, info); break;
                }
            }
            i++;
        }
        character.infos.push(info);
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
            if (trimmedPart === "AXS_VOICE_NONE") style |= CharacterStyle.VoiceNone;
            else if (trimmedPart === "AXS_BALLOON_ROUNDRECT") style |= CharacterStyle.BalloonRoundRect;
        }
        return style;
    }

    private parseBalloonSection(lines: string[], i: number, agent: AgentCharacterDefinition): number {
        const balloon = {} as Balloon;
        i++;
        while (i < lines.length && !lines[i].trim().toLowerCase().startsWith("endballoon")) {
            const line = lines[i].trim();
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim().toUpperCase();
                const value = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
                switch (key) {
                    case "NUMLINES": balloon.numLines = parseInt(value); break;
                    case "CHARSPERLINE": balloon.charsPerLine = parseInt(value); break;
                    case "FONTNAME": balloon.fontName = value; break;
                    case "FONTHEIGHT": balloon.fontHeight = parseInt(value); break;
                    case "FORECOLOR": balloon.foreColor = this.parseColor(value); break;
                    case "BACKCOLOR": balloon.backColor = this.parseColor(value); break;
                    case "BORDERCOLOR": balloon.borderColor = this.parseColor(value); break;
                }
            }
            i++;
        }
        agent.balloon = balloon;
        return i;
    }

    private parseAnimationSection(lines: string[], i: number, agent: AgentCharacterDefinition): number {
        const line = lines[i].trim();
        const match = line.match(/DefineAnimation\s+"([^"]+)"/i);
        if (!match) return i;

        const animation: Animation = {
            name: match[1],
            transitionType: 0,
            frames: []
        };

        i++;
        while (i < lines.length && !lines[i].trim().toLowerCase().startsWith("endanimation")) {
            const l = lines[i].trim();
            const lowerL = l.toLowerCase();
            if (lowerL.startsWith("transitiontype")) {
                const value = l.split('=')[1].trim();
                animation.transitionType = parseInt(value);
                i++;
            } else if (lowerL.startsWith("defineframe")) {
                i = this.parseFrameSection(lines, i, animation);
            } else {
                i++;
            }
        }

        agent.animations[animation.name] = animation;
        return i;
    }

    private parseFrameSection(lines: string[], i: number, animation: Animation): number {
        const frame: FrameDefinition = {
            duration: 0,
            images: []
        };
        i++;
        while (i < lines.length && !lines[i].trim().toLowerCase().startsWith("endframe")) {
            const line = lines[i].trim();
            const lowerLine = line.toLowerCase();
            if (lowerLine.startsWith("duration")) {
                const value = line.split('=')[1].trim();
                frame.duration = parseInt(value);
                i++;
            } else if (lowerLine.startsWith("exitbranch")) {
                const value = line.split('=')[1].trim();
                frame.exitBranch = parseInt(value);
                i++;
            } else if (lowerLine.startsWith("soundeffect")) {
                const value = line.split('=')[1].trim().replace(/^"|"$/g, '');
                frame.soundEffect = value;
                i++;
            } else if (lowerLine.startsWith("defineimage")) {
                i = this.parseImageSection(lines, i, frame);
            } else if (lowerLine.startsWith("definebranching")) {
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
        while (i < lines.length && !lines[i].trim().toLowerCase().startsWith("endimage")) {
            const line = lines[i].trim();
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim().toUpperCase();
                const value = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
                switch (key) {
                    case "FILENAME": image.filename = value; break;
                    case "OFFSETX": image.offsetX = parseInt(value); break;
                    case "OFFSETY": image.offsetY = parseInt(value); break;
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
        while (i < lines.length && !lines[i].trim().toLowerCase().startsWith("endbranching")) {
            const line = lines[i].trim();
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim().toUpperCase();
                const value = parseInt(parts.slice(1).join('=').trim());
                switch (key) {
                    case "BRANCHTO": branching.branchTo = value; break;
                    case "PROBABILITY": branching.probability = value; break;
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

    private parseStateSection(lines: string[], i: number, agent: AgentCharacterDefinition): number {
        const line = lines[i].trim();
        const match = line.match(/DefineState\s+"([^"]+)"/i);
        if (!match) return i;

        const stateName = match[1];
        const stateAnimations: string[] = [];

        i++;
        while (i < lines.length && !lines[i].trim().toLowerCase().startsWith("endstate")) {
            const l = lines[i].trim();
            const parts = l.split('=');
            if (parts.length >= 2 && parts[0].trim().toUpperCase() === "ANIMATION") {
                stateAnimations.push(parts.slice(1).join('=').trim().replace(/^"|"$/g, ''));
            }
            i++;
        }

        agent.states[stateName] = {
            name: stateName,
            animations: stateAnimations
        };
        return i;
    }

    private parseColor(hexColor: string): string {
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
