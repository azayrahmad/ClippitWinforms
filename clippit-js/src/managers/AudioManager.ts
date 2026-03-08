export class AudioManager {
    private audioCache: Map<string, HTMLAudioElement> = new Map();

    constructor(private audioPath: string) {}

    public async loadSounds(filenames: string[]): Promise<void> {
        const promises = filenames.map(filename => {
            return new Promise<void>((resolve) => {
                const audio = new Audio(`${this.audioPath}/${filename}`);
                audio.oncanplaythrough = () => {
                    this.audioCache.set(filename, audio);
                    resolve();
                };
                audio.onerror = () => {
                    console.error(`Failed to load sound: ${filename}`);
                    resolve(); // Continue anyway
                };
            });
        });
        await Promise.all(promises);
    }

    public playFrameSound(soundPath: string): void {
        const soundName = soundPath.split(/[\\/]/).pop() || "";
        let audio = this.audioCache.get(soundName) || this.audioCache.get(`${soundName}.wav`);

        if (!audio) {
            // Try to load on demand if not cached
            const filename = soundName.toLowerCase().endsWith('.wav') ? soundName : `${soundName}.wav`;
            audio = new Audio(`${this.audioPath}/${filename}`);
            this.audioCache.set(soundName, audio);
        }

        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.warn("Audio play failed", e));
        }
    }
}
