import { MSADPCMDecoder } from './MSADPCMDecoder';
import type { AudioAtlasEntry } from './types';

/**
 * AudioManager class for loading and playing agent sound effects.
 * Support legacy MS ADPCM and standard PCM via Web Audio API.
 * Now also supports audio spritesheets for optimized agents.
 */
export class AudioManager {
    private audioContext: AudioContext | null = null;
    private soundBuffers: Map<string, AudioBuffer> = new Map();
    private loadingPromises: Map<string, Promise<void>> = new Map();
    private audioPath: string;
    private baseUrl: string;
    private enabled: boolean = true;
    private audioAtlas: Record<string, AudioAtlasEntry> | null = null;
    private spritesheetBuffer: AudioBuffer | null = null;
    private spritesheetLoadingPromise: Promise<void> | null = null;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.audioPath = `${this.baseUrl}/Audio`;
    }

    public setEnabled(value: boolean): void {
        this.enabled = value;
    }

    public setAudioAtlas(atlas: Record<string, AudioAtlasEntry>): void {
        this.audioAtlas = atlas;
    }

    private getContext(): AudioContext {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return this.audioContext;
    }

    public async loadSounds(filenames: string[]): Promise<void> {
        if (this.audioAtlas) {
            await this.loadSpritesheet();
            return;
        }

        const promises = filenames.map(async (filename) => {
            // Normalize filename to just the name, removing potential "Audio\" prefix from ACD
            const soundName = filename.split(/[\\/]/).pop() || filename;

            if (this.soundBuffers.has(soundName)) return;

            // Avoid duplicate loading if already in progress
            if (this.loadingPromises.has(soundName)) {
                return this.loadingPromises.get(soundName);
            }

            const loadPromise = this.loadInternal(soundName);
            this.loadingPromises.set(soundName, loadPromise);
            try {
                await loadPromise;
            } finally {
                this.loadingPromises.delete(soundName);
            }
        });
        await Promise.all(promises);
    }

    private async loadInternal(soundName: string): Promise<void> {
        const ctx = this.getContext();
        const normalizedFilename = soundName.toLowerCase().endsWith('.wav') ? soundName : `${soundName}.wav`;
        const url = `${this.audioPath}/${normalizedFilename}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`Failed to load sound ${soundName}: ${response.statusText}`);
                return;
            }
            const arrayBuffer = await response.arrayBuffer();

            let audioBuffer: AudioBuffer;

            // Check if it's a Microsoft ADPCM WAV file
            if (this.isMSADPCM(arrayBuffer)) {
                try {
                    const decoded = MSADPCMDecoder.decode(arrayBuffer);
                    audioBuffer = ctx.createBuffer(decoded.channels, decoded.samples.length, decoded.sampleRate);
                    audioBuffer.getChannelData(0).set(decoded.samples);
                } catch (decodeError) {
                    console.error(`Failed to decode MS ADPCM for ${soundName}:`, decodeError);
                    // Fallback to native decoder as last resort, though it likely fails
                    audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
                }
            } else {
                // Standard decoding for PCM WAV, MP3, etc.
                audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
            }

            this.soundBuffers.set(soundName, audioBuffer);
        } catch (error) {
            console.error(`Error loading sound ${soundName}:`, error);
        }
    }

    private async loadSpritesheet(): Promise<void> {
        if (this.spritesheetBuffer) return;
        if (this.spritesheetLoadingPromise) return this.spritesheetLoadingPromise;

        this.spritesheetLoadingPromise = (async () => {
            const ctx = this.getContext();
            const url = `${this.baseUrl}/agent.webm`;

            try {
                const response = await fetch(url);
                if (!response.ok) {
                    console.warn(`Failed to load audio spritesheet: ${response.statusText}`);
                    return;
                }
                const arrayBuffer = await response.arrayBuffer();
                this.spritesheetBuffer = await ctx.decodeAudioData(arrayBuffer);
                console.log('Audio spritesheet loaded successfully');
            } catch (error) {
                console.error('Error loading audio spritesheet:', error);
            }
        })();

        return this.spritesheetLoadingPromise;
    }

    private isMSADPCM(buffer: ArrayBuffer): boolean {
        const view = new DataView(buffer);
        if (buffer.byteLength < 20) return false;

        // RIFF header
        if (view.getUint32(0, true) !== 0x46464952) return false; // 'RIFF'
        if (view.getUint32(8, true) !== 0x45564157) return false; // 'WAVE'

        // Look for 'fmt ' chunk
        let pos = 12;
        while (pos + 8 < buffer.byteLength) {
            const chunkId = view.getUint32(pos, true);
            const chunkSize = view.getUint32(pos + 4, true);
            if (chunkId === 0x20746d66) { // 'fmt '
                const audioFormat = view.getUint16(pos + 8, true);
                return audioFormat === 2; // WAVE_FORMAT_ADPCM
            }
            pos += 8 + chunkSize;
            if (chunkSize % 2 !== 0) pos++;
        }
        return false;
    }

    public playFrameSound(soundPath: string): void {
        if (!this.enabled) return;

        const soundNameRaw = soundPath.split(/[\\/]/).pop() || "";
        const soundName = soundNameRaw.toLowerCase().endsWith('.wav') ? soundNameRaw.toLowerCase() : `${soundNameRaw.toLowerCase()}.wav`;

        if (this.audioAtlas && this.spritesheetBuffer) {
            const entry = this.audioAtlas[soundName];
            if (entry) {
                this.playFromSpritesheet(entry.start, entry.end);
            } else {
                console.warn(`Sound ${soundName} not found in audio atlas`);
            }
            return;
        }

        const buffer = this.soundBuffers.get(soundNameRaw) || this.soundBuffers.get(`${soundNameRaw}.wav`);

        if (buffer) {
            const ctx = this.getContext();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start(0);
        } else {
            // Load on demand if not cached
            this.loadSounds([soundNameRaw]).then(() => {
                if (this.audioAtlas && this.spritesheetBuffer) {
                    this.playFrameSound(soundNameRaw);
                } else {
                    const reloadedBuffer = this.soundBuffers.get(soundNameRaw) || this.soundBuffers.get(`${soundNameRaw}.wav`);
                    if (reloadedBuffer) {
                        this.playFrameSound(soundNameRaw);
                    }
                }
            });
        }
    }

    private playFromSpritesheet(start: number, end: number): void {
        if (!this.spritesheetBuffer) return;

        const ctx = this.getContext();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const source = ctx.createBufferSource();
        source.buffer = this.spritesheetBuffer;
        source.connect(ctx.destination);
        // source.start(when, offset, duration)
        source.start(0, start, end - start);
    }
}
