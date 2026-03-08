import type {
    AgentCharacterDefinition,
    Animation,
    Balloon,
    BranchingDefinition,
    Character,
    FrameDefinition,
    ImageDefinition,
    Info,
    State
} from './types';

export class CharacterParser {
    private currentAgent: Partial<AgentCharacterDefinition> = {
        animations: {},
        states: {}
    };
    private currentCharacter?: Character;
    private currentLanguageInfo?: Info;
    private currentAnimation?: Animation;
    private currentFrame?: FrameDefinition;
    private currentState?: State;

    public parse(text: string): AgentCharacterDefinition {
        const lines = text.split(/\r?\n/);
        return this.parseFromLines(lines);
    }

    private parseFromLines(lines: string[]): AgentCharacterDefinition {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (!line || line.startsWith('//')) continue;

            if (line.startsWith('DefineCharacter')) {
                i = this.parseCharacterSection(lines, i);
            } else if (line.startsWith('DefineBalloon')) {
                i = this.parseBalloonSection(lines, i);
            } else if (line.startsWith('DefineAnimation')) {
                i = this.parseAnimationSection(lines, i);
            } else if (line.startsWith('DefineState')) {
                i = this.parseStateSection(lines, i);
            } else if (line === 'EndCharacter') {
                break;
            }
        }

        return this.currentAgent as AgentCharacterDefinition;
    }

    private parseCharacterSection(lines: string[], i: number): number {
        this.currentCharacter = {
            infos: [],
            guid: '',
            width: 0,
            height: 0,
            transparency: 0,
            defaultFrameDuration: 0,
            style: 0,
            colorTable: ''
        };
        i++;

        while (i < lines.length && !lines[i].trim().includes('EndCharacter')) {
            const line = lines[i].trim();
            if (line.startsWith('DefineInfo')) {
                i = this.parseCharacterInfo(lines, i);
                // parseCharacterInfo handles its own EndInfo
                continue;
            }

            const parts = line.split('=');
            if (parts.length === 2) {
                const key = parts[0].trim();
                const value = parts[1].trim().replace(/^"|"$/g, '');

                switch (key) {
                    case 'GUID': this.currentCharacter.guid = value; break;
                    case 'Width': this.currentCharacter.width = parseInt(value); break;
                    case 'Height': this.currentCharacter.height = parseInt(value); break;
                    case 'Transparency': this.currentCharacter.transparency = parseInt(value); break;
                    case 'DefaultFrameDuration': this.currentCharacter.defaultFrameDuration = parseInt(value); break;
                    case 'Style': this.currentCharacter.style = this.parseStyle(value); break;
                    case 'ColorTable': this.currentCharacter.colorTable = value; break;
                }
            }
            i++;
        }
        this.currentAgent.character = this.currentCharacter;
        return i;
    }

    private parseCharacterInfo(lines: string[], i: number): number {
        const line = lines[i].trim();
        const match = line.match(/0x([0-9A-Fa-f]{4})/);
        if (!match) return i;

        this.currentLanguageInfo = {
            languageCode: match[1],
            name: '',
            description: '',
            greetings: [],
            reminders: []
        };

        i++;
        while (i < lines.length && lines[i].trim() !== 'EndInfo') {
            const currentLine = lines[i].trim();
            const parts = currentLine.split('=');
            if (parts.length === 2) {
                const key = parts[0].trim();
                const value = parts[1].trim().replace(/^"|"$/g, '');

                switch (key) {
                    case 'Name': this.currentLanguageInfo.name = value; break;
                    case 'Description': this.currentLanguageInfo.description = value; break;
                    case 'ExtraData': this.parseExtraData(value, this.currentLanguageInfo); break;
                }
            }
            i++;
        }

        if (this.currentLanguageInfo && this.currentCharacter) {
            this.currentCharacter.infos.push(this.currentLanguageInfo);
        }
        return i;
    }

    private parseExtraData(extraData: string, languageInfo: Info) {
        const parts = extraData.split('^^');
        languageInfo.greetings = parts[0].split('~~').map(s => s.trim());
        if (parts.length > 1) {
            languageInfo.reminders = parts[1].split('~~').map(s => s.trim());
        }
    }

    private parseStyle(value: string): number {
        let style = 0;
        const parts = value.split('|');
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed === 'AXS_VOICE_NONE') style |= 1;
            else if (trimmed === 'AXS_BALLOON_ROUNDRECT') style |= 2;
        }
        return style;
    }

    private parseBalloonSection(lines: string[], i: number): number {
        const balloon: Balloon = {
            numLines: 0,
            charsPerLine: 0,
            fontName: '',
            fontHeight: 0,
            foreColor: '',
            backColor: '',
            borderColor: ''
        };
        i++;

        while (i < lines.length && lines[i].trim() !== 'EndBalloon') {
            const line = lines[i].trim();
            const parts = line.split('=');
            if (parts.length === 2) {
                const key = parts[0].trim();
                const value = parts[1].trim();

                switch (key) {
                    case 'NumLines': balloon.numLines = parseInt(value); break;
                    case 'CharsPerLine': balloon.charsPerLine = parseInt(value); break;
                    case 'FontName': balloon.fontName = value.replace(/^"|"$/g, ''); break;
                    case 'FontHeight': balloon.fontHeight = parseInt(value); break;
                    case 'ForeColor': balloon.foreColor = this.parseColor(value); break;
                    case 'BackColor': balloon.backColor = this.parseColor(value); break;
                    case 'BorderColor': balloon.borderColor = this.parseColor(value); break;
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

        this.currentAnimation = {
            name: match[1],
            transitionType: 0,
            frames: []
        };
        i++;

        while (i < lines.length && lines[i].trim() !== 'EndAnimation') {
            const currentLine = lines[i].trim();
            if (currentLine.startsWith('TransitionType')) {
                this.currentAnimation.transitionType = parseInt(currentLine.split('=')[1].trim());
            } else if (currentLine.startsWith('DefineFrame')) {
                i = this.parseFrameSection(lines, i);
            }
            i++;
        }

        if (this.currentAnimation && this.currentAgent.animations) {
            this.currentAgent.animations[this.currentAnimation.name] = this.currentAnimation;
        }
        return i;
    }

    private parseFrameSection(lines: string[], i: number): number {
        this.currentFrame = {
            duration: 0,
            images: []
        };
        i++;

        while (i < lines.length && lines[i].trim() !== 'EndFrame') {
            const line = lines[i].trim();
            if (line.startsWith('Duration')) {
                this.currentFrame.duration = parseInt(line.split('=')[1].trim());
            } else if (line.startsWith('ExitBranch')) {
                this.currentFrame.exitBranch = parseInt(line.split('=')[1].trim());
            } else if (line.startsWith('SoundEffect')) {
                this.currentFrame.soundEffect = line.split('=')[1].trim().replace(/^"|"$/g, '');
            } else if (line.startsWith('DefineImage')) {
                i = this.parseImageSection(lines, i);
            } else if (line.startsWith('DefineBranching')) {
                i = this.parseBranchingSection(lines, i);
            }
            i++;
        }
        this.currentAnimation?.frames.push(this.currentFrame);
        return i;
    }

    private parseImageSection(lines: string[], i: number): number {
        const image: ImageDefinition = {
            filename: '',
            offsetX: 0,
            offsetY: 0
        };
        i++;

        while (i < lines.length && lines[i].trim() !== 'EndImage') {
            const line = lines[i].trim();
            const parts = line.split('=');
            if (parts.length === 2) {
                const key = parts[0].trim();
                const value = parts[1].trim();

                switch (key) {
                    case 'Filename': image.filename = value.replace(/^"|"$/g, ''); break;
                    case 'OffsetX': image.offsetX = parseInt(value); break;
                    case 'OffsetY': image.offsetY = parseInt(value); break;
                }
            }
            i++;
        }
        this.currentFrame?.images.push(image);
        return i;
    }

    private parseBranchingSection(lines: string[], i: number): number {
        const branchingList: BranchingDefinition[] = [];
        let branching: Partial<BranchingDefinition> = {};
        i++;

        while (i < lines.length && lines[i].trim() !== 'EndBranching') {
            const line = lines[i].trim();
            const parts = line.split('=');
            if (parts.length === 2) {
                const key = parts[0].trim();
                const value = parseInt(parts[1].trim());

                if (key === 'BranchTo') branching.branchTo = value;
                else if (key === 'Probability') branching.probability = value;
            }

            if (branching.branchTo !== undefined && branching.probability !== undefined) {
                branchingList.push(branching as BranchingDefinition);
                branching = {};
            }
            i++;
        }
        this.currentFrame!.branching = branchingList;
        return i;
    }

    private parseStateSection(lines: string[], i: number): number {
        const line = lines[i].trim();
        const match = line.match(/DefineState\s+"([^"]+)"/);
        if (!match) return i;

        this.currentState = {
            name: match[1],
            animations: []
        };
        i++;

        while (i < lines.length && lines[i].trim() !== 'EndState') {
            const currentLine = lines[i].trim();
            const parts = currentLine.split('=');
            if (parts.length === 2 && parts[0].trim() === 'Animation') {
                this.currentState.animations.push(parts[1].trim().replace(/^"|"$/g, ''));
            }
            i++;
        }

        if (this.currentState && this.currentAgent.states) {
            this.currentAgent.states[this.currentState.name] = this.currentState;
        }
        return i;
    }

    private parseColor(hex: string): string {
        // C# parser expected ARGB in hex: "00e1ffff" (A B G R in Substring calls actually)
        // Actually: a = 0-2, b = 2-4, g = 4-6, r = 6-8. Wait.
        // var a = byte.Parse(hexColor.Substring(0, 2), ...);
        // var b = byte.Parse(hexColor.Substring(2, 2), ...);
        // var g = byte.Parse(hexColor.Substring(4, 2), ...);
        // var r = byte.Parse(hexColor.Substring(6, 2), ...);
        // return Color.FromArgb(a, r, g, b);

        // This means hex is ABGR and it returns ARGB.
        // For web, let's just return rgba() or #hex.
        if (hex.length === 8) {
            const a = parseInt(hex.substring(0, 2), 16) / 255;
            const b = parseInt(hex.substring(2, 4), 16);
            const g = parseInt(hex.substring(4, 6), 16);
            const r = parseInt(hex.substring(6, 8), 16);
            return `rgba(${r}, ${g}, ${b}, ${a})`;
        }
        return hex;
    }
}
