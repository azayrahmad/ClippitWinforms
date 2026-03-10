import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../src/Agent';
import { CharacterParser } from '../src/CharacterParser';

// Mock CharacterParser.load to avoid actual network requests
vi.mock('../src/CharacterParser', () => {
    return {
        CharacterParser: {
            load: vi.fn()
        }
    };
});

// Mock SpriteManager to avoid canvas/BMP logic in Node environment
vi.mock('../src/SpriteManager', () => {
    class SpriteManager {
        init = vi.fn().mockResolvedValue(undefined);
        getSpriteWidth = vi.fn().mockReturnValue(100);
        getSpriteHeight = vi.fn().mockReturnValue(100);
    }
    return { SpriteManager };
});

describe('Agent.load', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Mock window.innerWidth and window.innerHeight
        vi.stubGlobal('window', {
            innerWidth: 1024,
            innerHeight: 768,
            AudioContext: vi.fn().mockImplementation(() => ({
                createBuffer: vi.fn(),
                decodeAudioData: vi.fn(),
            })),
            requestAnimationFrame: vi.fn().mockReturnValue(1),
            cancelAnimationFrame: vi.fn(),
            navigator: { userAgent: 'test' },
            speechSynthesis: {
                getVoices: vi.fn().mockReturnValue([]),
                speak: vi.fn(),
                cancel: vi.fn(),
                speaking: false
            }
        });
        vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
        vi.stubGlobal('cancelAnimationFrame', vi.fn());

        // Mock document.createElement for canvas and style
        vi.stubGlobal('document', {
            createElement: vi.fn().mockImplementation((tag) => {
                const el: any = {
                    style: {},
                    appendChild: vi.fn(),
                    className: '',
                    classList: {
                        add: vi.fn(),
                        remove: vi.fn()
                    },
                    addEventListener: vi.fn(),
                    querySelector: vi.fn(),
                    getBoundingClientRect: vi.fn().mockReturnValue({ width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 }),
                    offsetWidth: 0,
                    offsetHeight: 0
                };

                if (tag === 'canvas') {
                    el.getContext = vi.fn().mockReturnValue({});
                    el.width = 0;
                    el.height = 0;
                    el.getBoundingClientRect = vi.fn().mockReturnValue({ width: 100, height: 100, top: 0, left: 0, bottom: 100, right: 100 });
                } else if (tag === 'style') {
                    el.textContent = '';
                } else if (tag === 'div') {
                    el.attachShadow = vi.fn().mockReturnValue({
                        appendChild: vi.fn(),
                        host: el
                    });
                }
                return el;
            }),
            body: {
                appendChild: vi.fn()
            }
        });
    });

    it('should use unpkg CDN as default baseUrl when none is provided', async () => {
        const mockDefinition = {
            character: { width: 100, height: 100, colorTable: 'ColorTable.bmp' },
            animations: {},
            states: { 'IdlingLevel1': { name: 'IdlingLevel1', animations: [] } }
        };
        (CharacterParser.load as any).mockResolvedValue(mockDefinition);

        const agentName = 'Clippit';
        await Agent.load(agentName);

        const expectedBaseUrl = `https://unpkg.com/ms-agent-js@latest/dist/agents/${agentName}`;
        const expectedAcdPath = `${expectedBaseUrl}/${agentName.toUpperCase()}.acd`;

        expect(CharacterParser.load).toHaveBeenCalledWith(expectedAcdPath);
    });

    it('should use provided baseUrl when one is given', async () => {
        const mockDefinition = {
            character: { width: 100, height: 100, colorTable: 'ColorTable.bmp' },
            animations: {},
            states: { 'IdlingLevel1': { name: 'IdlingLevel1', animations: [] } }
        };
        (CharacterParser.load as any).mockResolvedValue(mockDefinition);

        const agentName = 'Clippit';
        const customBaseUrl = '/custom/path/to/agent';
        await Agent.load(agentName, { baseUrl: customBaseUrl });

        const expectedAcdPath = `${customBaseUrl}/${agentName.toUpperCase()}.acd`;

        expect(CharacterParser.load).toHaveBeenCalledWith(expectedAcdPath);
    });
});
