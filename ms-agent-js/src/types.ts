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
  VoiceNone: 1,
  BalloonRoundRect: 2,
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
  name: string;
  description: string;
  greetings: string[];
  reminders: string[];
}

export interface AgentCharacterDefinition {
  character: Character;
  balloon: Balloon;
  animations: Record<string, Animation>;
  states: Record<string, State>;
}
