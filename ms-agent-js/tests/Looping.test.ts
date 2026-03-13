import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnimationManager } from '../src/AnimationManager';
import { type Animation } from '../src/types';

describe('AnimationManager Looping & Shortcuts', () => {
  let spriteManager: any;
  let audioManager: any;
  let animationManager: AnimationManager;

  beforeEach(() => {
    spriteManager = {
      drawFrame: vi.fn(),
      loadSprite: vi.fn().mockResolvedValue(undefined)
    };
    audioManager = {
      playFrameSound: vi.fn(),
      loadSounds: vi.fn().mockResolvedValue(undefined)
    };
  });

  it('should loop when isLooping is true', async () => {
    const anim: Animation = {
      name: 'seq',
      frames: [
        { duration: 10, images: [] },
        { duration: 10, images: [] } // Final frame index 1
      ]
    };
    animationManager = new AnimationManager(spriteManager, audioManager, { 'seq': anim });

    let completed = false;
    const now = 1000;
    // Set initial time
    animationManager.setAnimation('seq', false, true);
    (animationManager as any).lastFrameTime = now;
    (animationManager as any).animationPromise = { resolve: () => completed = true };

    // Index 0 -> 1
    animationManager.update(now + 150);
    expect(animationManager.currentFrameIndexValue).toBe(1);

    // Index 1 -> 0 (Should LOOP, not complete)
    animationManager.update(now + 300);
    expect(animationManager.currentFrameIndexValue).toBe(0);
    expect(completed).toBe(false);
  });

  it('should suppress shortcut branches when suppressShortcuts is true', async () => {
    const anim: Animation = {
      name: 'shortcut',
      frames: [
        {
          duration: 10,
          images: [],
          branching: [{ branchTo: 10, probability: 100 }] // Extreme shortcut
        },
        ...Array(9).fill({ duration: 10, images: [] })
      ]
    };
    animationManager = new AnimationManager(spriteManager, audioManager, { 'shortcut': anim });

    const now = 1000;
    animationManager.setAnimation('shortcut', false, false, true);
    (animationManager as any).lastFrameTime = now;

    expect(animationManager.currentFrameIndexValue).toBe(0);

    // Update. Should ignore branch to 10 and move to Index 1 (sequential)
    animationManager.update(now + 150);
    expect(animationManager.currentFrameIndexValue).toBe(1);
  });

  it('should stop looping and complete when isExiting is set', async () => {
    const anim: Animation = {
      name: 'loop',
      frames: [{ duration: 10, images: [] }]
    };
    animationManager = new AnimationManager(spriteManager, audioManager, { 'loop': anim });
    animationManager.isLoopingFlag = true;

    let completed = false;
    animationManager.playAnimation('loop').then(() => completed = true);

    animationManager.update(performance.now() + 200);
    expect(completed).toBe(false);

    // Set exiting
    animationManager.isExitingFlag = true;
    expect((animationManager as any).isLooping).toBe(false);

    // Next update should complete
    animationManager.update(performance.now() + 400);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(completed).toBe(true);
  });
});
