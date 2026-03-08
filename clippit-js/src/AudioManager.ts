export class AudioManager {
    private audioCache: Record<string, HTMLAudioElement> = {};
    private basePath: string;

    constructor(basePath: string) {
        this.basePath = basePath.endsWith('/') ? basePath : basePath + '/';
    }

    public playFrameSound(soundName: string) {
        if (!soundName) return;

        const soundPath = `${this.basePath}${soundName}.wav`;
        let audio = this.audioCache[soundPath];

        if (!audio) {
            audio = new Audio(soundPath);
            this.audioCache[soundPath] = audio;
        }

        audio.currentTime = 0;
        audio.play().catch(e => console.warn('Failed to play sound:', e));
    }
}
