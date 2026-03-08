/**
 * Represents the full definition of an agent character.
 * Maps to AgentCharacterDefinition in C#.
 */
export interface AgentCharacterDefinition {
  character: Character;
  balloon: Balloon;
  animations: Record<string, Animation>;
  states: Record<string, State>;
}

/**
 * Basic character properties and metadata.
 * Maps to Character in C#.
 */
export interface Character {
  infos: Info[];
  guid: string;
  width: number;
  height: number;
  transparency: number;
  defaultFrameDuration: number;
  style: CharacterStyle;
  colorTable: string;
}

/**
 * Character style flags.
 * Maps to CharacterStyle in C#.
 */
export enum CharacterStyle {
  None = 0,
  VoiceNone = 1,
  BalloonRoundRect = 2,
}

/**
 * Configuration for the speech balloon.
 * Maps to Balloon in C#.
 */
export interface Balloon {
  numLines: number;
  charsPerLine: number;
  fontName: string;
  fontHeight: number;
  foreColor: string; // Represented as hex string in TS
  backColor: string;
  borderColor: string;
}

/**
 * A named sequence of frames.
 * Maps to Animation in C#.
 */
export interface Animation {
  name: string;
  transitionType: number;
  frames: FrameDefinition[];
}

/**
 * A single frame within an animation.
 * Maps to FrameDefinition in C#.
 */
export interface FrameDefinition {
  duration: number;
  soundEffect?: string;
  exitBranch?: number;
  images: ImageDefinition[];
  branching?: BranchingDefinition[];
}

/**
 * An image layer within a frame.
 * Maps to ImageDefinition in C#.
 */
export interface ImageDefinition {
  filename: string;
  offsetX: number;
  offsetY: number;
}

/**
 * Probabilistic branching for animations.
 * Maps to BranchingDefinition in C#.
 */
export interface BranchingDefinition {
  branchTo: number;
  probability: number;
}

/**
 * A logical state that groups multiple animations (e.g., Idle).
 * Maps to State in C#.
 */
export interface State {
  name: string;
  animations: string[];
}

/**
 * Localized information for the character.
 * Maps to Info in C#.
 */
export interface Info {
  languageCode: string; // Hexadecimal string like 0x0409
  name: string;
  description: string;
  greetings: string[];
  reminders: string[];
}
