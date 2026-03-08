import { describe, it, expect } from 'vitest';
import { CharacterParser } from './CharacterParser';
import * as fs from 'fs';
import * as path from 'path';

describe('CharacterParser', () => {
  it('should parse CLIPPIT.acd correctly', () => {
    const acdPath = path.resolve(__dirname, '../public/agents/Clippit/CLIPPIT.acd');
    const content = fs.readFileSync(acdPath, 'utf-8');

    const parser = new CharacterParser();
    const result = parser.parse(content);

    expect(result).toBeDefined();
    expect(result.character).toBeDefined();
    expect(result.character.guid).toBe('BFC9DE40-EBDE-11D1-BC17-00A076803C83');
    expect(result.character.width).toBe(124);
    expect(result.character.height).toBe(93);

    // Check if at least one language info is present (English 0x0409 might be one of them)
    expect(result.character.infos.length).toBeGreaterThan(0);
    const englishInfo = result.character.infos.find(info => info.languageCode === '0x0409');
    if (englishInfo) {
      expect(englishInfo.name).toBe('Clippit');
    }

    // Check animations
    expect(Object.keys(result.animations).length).toBeGreaterThan(0);
    expect(result.animations['GestureLeft']).toBeDefined();
    expect(result.animations['GestureLeft'].frames.length).toBeGreaterThan(0);

    // Check states
    expect(Object.keys(result.states).length).toBeGreaterThan(0);
  });
});
