import { MSADPCMDecoder } from './MSADPCMDecoder';

/**
 * AudioManager class for loading and playing agent sound effects.
 * Support legacy MS ADPCM and standard PCM via Web Audio API.
 */
export class AudioManager {
    private audioContext: AudioContext | null = null;
    private soundBuffers: Map<string, AudioBuffer> = new Map();
    private loadingPromises: Map<string, Promise<void>> = new Map();
    private audioPath: string;
    private enabled: boolean = true;

    constructor(audioPath: string) {
        this.audioPath = audioPath.endsWith('/') ? `${audioPath}Audio` : `${audioPath}/Audio`;
    }

    public setEnabled(value: boolean): void {
        this.enabled = value;
    }

    private getContext(): AudioContext {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return this.audioContext;
    }

    public async loadSounds(filenames: string[]): Promise<void> {
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

    /**
     * Fetches a URL and tries common casing variations if it fails.
     */
    private async fetchWithRetry(url: string): Promise<Response> {
        let response = await fetch(url);
        if (response.ok || url.startsWith('http')) return response;

        const lastSlash = url.lastIndexOf('/');
        const dir = url.substring(0, lastSlash);
        const file = url.substring(lastSlash + 1);

        const variations = [
            url.toLowerCase(),
            dir + '/' + file.toLowerCase(),
            dir + '/' + (file.charAt(0).toUpperCase() + file.slice(1).toLowerCase()),
        ];

        for (const variant of variations) {
            if (variant === url) continue;
            try {
                response = await fetch(variant);
                if (response.ok) return response;
            } catch (e) {
                // Ignore fetch errors during retry
            }
        }

        return response;
    }

    private async loadInternal(soundName: string): Promise<void> {
        const ctx = this.getContext();
        const normalizedFilename = soundName.toLowerCase().endsWith('.wav') ? soundName : `${soundName}.wav`;
        const url = `${this.audioPath}/${normalizedFilename}`;

        try {
            const response = await this.fetchWithRetry(url);
            if (!response.ok) {
                console.warn(`Failed to load sound ${soundName}: ${response.statusText} at ${url}`);
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

        const soundName = soundPath.split(/[\\/]/).pop() || "";
        const buffer = this.soundBuffers.get(soundName) || this.soundBuffers.get(`${soundName}.wav`);

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
            this.loadSounds([soundName]).then(() => {
                const reloadedBuffer = this.soundBuffers.get(soundName) || this.soundBuffers.get(`${soundName}.wav`);
                if (reloadedBuffer) {
                    this.playFrameSound(soundName);
                }
            });
        }
    }
}
