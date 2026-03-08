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
  CharacterStyle,
} from './types';

/**
 * CharacterParser class for parsing .acd files into AgentCharacterDefinition.
 * Ported from C# CharacterParser.cs.
 */
export class CharacterParser {
  private currentAgent: Partial<AgentCharacterDefinition> = {
    animations: {},
    states: {},
  };
  private currentCharacter: Character | null = null;
  private currentLanguageInfo: Info | null = null;
  private currentAnimation: Animation | null = null;
  private currentFrame: FrameDefinition | null = null;
  private currentState: State | null = null;

  /**
   * Fetches an .acd file from a URL and parses it.
   */
  public static async load(url: string): Promise<AgentCharacterDefinition> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load .acd file: ${response.statusText}`);
    }
    const content = await response.text();
    const parser = new CharacterParser();
    return parser.parse(content);
  }

  /**
   * Parses the content of an .acd file.
   */
  public parse(content: string): AgentCharacterDefinition {
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and comments
      if (!line || line.startsWith('//')) {
        continue;
      }

      if (line.startsWith('DefineCharacter')) {
        i = this.parseCharacterSection(lines, i);
        continue;
      }
      if (line.startsWith('DefineBalloon')) {
        i = this.parseBalloonSection(lines, i);
        continue;
      }
      if (line.startsWith('DefineAnimation')) {
        i = this.parseAnimationSection(lines, i);
        continue;
      }
      if (line.startsWith('DefineState')) {
        i = this.parseStateSection(lines, i);
        continue;
      }

      if (line === 'EndCharacter') {
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
      style: CharacterStyle.None,
      colorTable: '',
    };
    i++;

    while (i < lines.length && lines[i].trim() !== 'EndCharacter') {
      const line = lines[i].trim();
      if (line.startsWith('DefineInfo')) {
        i = this.parseCharacterInfo(lines, i);
      }

      if (line === 'EndInfo') {
        if (this.currentLanguageInfo) {
          this.currentCharacter.infos.push(this.currentLanguageInfo);
          this.currentLanguageInfo = null;
        }
      }

      // Parse key-value pairs
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/"/g, '');

        switch (key) {
          case 'GUID':
            this.currentCharacter.guid = value.replace(/{|}/g, '');
            break;
          case 'Width':
            this.currentCharacter.width = parseInt(value, 10);
            break;
          case 'Height':
            this.currentCharacter.height = parseInt(value, 10);
            break;
          case 'Transparency':
            this.currentCharacter.transparency = parseInt(value, 10);
            break;
          case 'DefaultFrameDuration':
            this.currentCharacter.defaultFrameDuration = parseInt(value, 10);
            break;
          case 'Style':
            this.currentCharacter.style = this.parseStyle(value);
            break;
          case 'ColorTable':
            this.currentCharacter.colorTable = value;
            break;
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
      languageCode: `0x${match[1]}`,
      name: '',
      description: '',
      greetings: [],
      reminders: [],
    };

    i++;
    while (i < lines.length && lines[i].trim() !== 'EndInfo') {
      const currentLine = lines[i].trim();
      const parts = currentLine.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/"/g, '');

        switch (key) {
          case 'Name':
            this.currentLanguageInfo.name = value;
            break;
          case 'Description':
            this.currentLanguageInfo.description = value;
            break;
          case 'ExtraData':
            this.parseExtraData(value, this.currentLanguageInfo);
            break;
        }
      }
      i++;
    }

    if (this.currentLanguageInfo && this.currentCharacter) {
      this.currentCharacter.infos.push(this.currentLanguageInfo);
      this.currentLanguageInfo = null;
    }
    return i;
  }

  private parseExtraData(extraData: string, languageInfo: Info): void {
    const parts = extraData.split('^^');
    // Parse greetings (before ^^)
    languageInfo.greetings = parts[0]
      .split('~~')
      .map((s) => s.trim())
      .filter((s) => s !== '');

    // Parse reminders (after ^^)
    if (parts.length > 1) {
      languageInfo.reminders = parts[1]
        .split('~~')
        .map((s) => s.trim())
        .filter((s) => s !== '');
    } else {
      languageInfo.reminders = [];
    }
  }

  private parseStyle(value: string): CharacterStyle {
    let style = CharacterStyle.None;
    const styleParts = value.split('|');

    for (const part of styleParts) {
      const trimmedPart = part.trim();
      if (trimmedPart === 'AXS_VOICE_NONE') style |= CharacterStyle.VoiceNone;
      else if (trimmedPart === 'AXS_BALLOON_ROUNDRECT')
        style |= CharacterStyle.BalloonRoundRect;
    }

    return style;
  }

  private parseBalloonSection(lines: string[], i: number): number {
    const balloon: Balloon = {
      numLines: 0,
      charsPerLine: 0,
      fontName: '',
      fontHeight: 0,
      foreColor: '00000000',
      backColor: '00000000',
      borderColor: '00000000',
    };
    i++;

    while (i < lines.length && lines[i].trim() !== 'EndBalloon') {
      const line = lines[i].trim();
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();

        switch (key) {
          case 'NumLines':
            balloon.numLines = parseInt(value, 10);
            break;
          case 'CharsPerLine':
            balloon.charsPerLine = parseInt(value, 10);
            break;
          case 'FontName':
            balloon.fontName = value.replace(/"/g, '');
            break;
          case 'FontHeight':
            balloon.fontHeight = parseInt(value, 10);
            break;
          case 'ForeColor':
            balloon.foreColor = value;
            break;
          case 'BackColor':
            balloon.backColor = value;
            break;
          case 'BorderColor':
            balloon.borderColor = value;
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

    this.currentAnimation = {
      name: match[1],
      transitionType: 0,
      frames: [],
    };

    i++;
    while (i < lines.length && lines[i].trim() !== 'EndAnimation') {
      const currentLine = lines[i].trim();

      if (currentLine.startsWith('TransitionType')) {
        const value = currentLine.split('=')[1].trim();
        this.currentAnimation.transitionType = parseInt(value, 10);
      } else if (currentLine.startsWith('DefineFrame')) {
        i = this.parseFrameSection(lines, i);
      }

      i++;
    }

    if (this.currentAnimation && this.currentAgent.animations) {
      this.currentAgent.animations[this.currentAnimation.name] =
        this.currentAnimation;
    }
    return i;
  }

  private parseFrameSection(lines: string[], i: number): number {
    this.currentFrame = {
      duration: 0,
      images: [],
    };
    i++;

    while (i < lines.length && lines[i].trim() !== 'EndFrame') {
      const line = lines[i].trim();

      if (line.startsWith('Duration')) {
        const value = line.split('=')[1].trim();
        this.currentFrame.duration = parseInt(value, 10);
      } else if (line.startsWith('ExitBranch')) {
        const value = line.split('=')[1].trim();
        this.currentFrame.exitBranch = parseInt(value, 10);
      } else if (line.startsWith('SoundEffect')) {
        const value = line.split('=')[1].trim().replace(/"/g, '');
        this.currentFrame.soundEffect = value;
      } else if (line.startsWith('DefineImage')) {
        i = this.parseImageSection(lines, i);
      } else if (line.startsWith('DefineBranching')) {
        i = this.parseBranchingSection(lines, i);
      }

      i++;
    }

    if (this.currentFrame && this.currentAnimation) {
      this.currentAnimation.frames.push(this.currentFrame);
    }
    return i;
  }

  private parseImageSection(lines: string[], i: number): number {
    const image: ImageDefinition = {
      filename: '',
      offsetX: 0,
      offsetY: 0,
    };
    i++;

    while (i < lines.length && lines[i].trim() !== 'EndImage') {
      const line = lines[i].trim();
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/"/g, '');

        switch (key) {
          case 'Filename':
            image.filename = value;
            break;
          case 'OffsetX':
            image.offsetX = parseInt(value, 10);
            break;
          case 'OffsetY':
            image.offsetY = parseInt(value, 10);
            break;
        }
      }
      i++;
    }

    if (this.currentFrame) {
      this.currentFrame.images.push(image);
    }
    return i;
  }

  private parseBranchingSection(lines: string[], i: number): number {
    const branchingList: BranchingDefinition[] = [];
    let branching: Partial<BranchingDefinition> = {};
    i++;

    while (i < lines.length && lines[i].trim() !== 'EndBranching') {
      const line = lines[i].trim();
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parseInt(parts.slice(1).join('=').trim(), 10);

        switch (key) {
          case 'BranchTo':
            branching.branchTo = value;
            break;
          case 'Probability':
            branching.probability = value;
            break;
        }
      }
      if (branching.branchTo !== undefined && branching.probability !== undefined) {
        branchingList.push(branching as BranchingDefinition);
        branching = {};
      }
      i++;
    }

    if (this.currentFrame) {
      this.currentFrame.branching = branchingList;
    }
    return i;
  }

  private parseStateSection(lines: string[], i: number): number {
    const line = lines[i].trim();
    const match = line.match(/DefineState\s+"([^"]+)"/);
    if (!match) return i;

    this.currentState = {
      name: match[1],
      animations: [],
    };

    i++;
    while (i < lines.length && lines[i].trim() !== 'EndState') {
      const currentLine = lines[i].trim();
      const parts = currentLine.split('=');
      if (parts.length >= 2 && parts[0].trim() === 'Animation') {
        this.currentState.animations.push(parts.slice(1).join('=').trim().replace(/"/g, ''));
      }
      i++;
    }

    if (this.currentState && this.currentAgent.states) {
      this.currentAgent.states[this.currentState.name] = this.currentState;
    }
    return i;
  }
}
