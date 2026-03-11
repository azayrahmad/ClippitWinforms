export interface Character {
  infos: Info[];
  guid: string;
  width: number;
  height: number;
  transparency: number;
  defaultFrameDuration: number;
  style: number;
  colorTable: string;
}

export const CharacterStyle = {
  None: 0,
  VoiceNone: 0x0001,
  BalloonRoundRect: 0x0002,
  BalloonSizeToText: 0x0004,
  BalloonAutoHide: 0x0008,
  BalloonAutoPace: 0x0010,
} as const;

export interface Balloon {
  numLines: number;
  charsPerLine: number;
  fontName: string;
  fontHeight: number;
  foreColor: string;
  backColor: string;
  borderColor: string;
}

export interface ImageDefinition {
  filename: string;
  offsetX: number;
  offsetY: number;
}

export interface BranchingDefinition {
  branchTo: number;
  probability: number;
}

export interface FrameDefinition {
  duration: number;
  soundEffect?: string;
  exitBranch?: number;
  images: ImageDefinition[];
  branching?: BranchingDefinition[];
}

export interface Animation {
  name: string;
  transitionType: number;
  frames: FrameDefinition[];
}

export interface State {
  name: string;
  animations: string[];
}

export interface Info {
  languageCode: string;
  locale: Intl.Locale;
  name: string;
  description: string;
  greetings: string[];
  reminders: string[];
}

export interface AtlasEntry {
  x: number;
  y: number;
  w: number;
  h: number;
  trimX?: number;
  trimY?: number;
}

export interface AudioAtlasEntry {
  start: number;
  end: number;
}

export interface AgentCharacterDefinition {
  character: Character;
  balloon: Balloon;
  animations: Record<string, Animation>;
  states: Record<string, State>;
  atlas?: Record<string, AtlasEntry>;
  audioAtlas?: Record<string, AudioAtlasEntry>;
}
