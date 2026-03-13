import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnimationManager } from '../src/AnimationManager';
import { type Animation } from '../src/types';

describe('AnimationManager Discrepancy Repro', () => {
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

  it('should not complete on branch to 0 (current behavior)', async () => {
    const anim: Animation = {
      name: 'branch-to-0',
      transitionType: 0,
      frames: [
        {
          duration: 10,
          images: [],
          branching: [{ branchTo: 1, probability: 100 }]
        }
      ]
    };
    animationManager = new AnimationManager(spriteManager, audioManager, { 'test': anim });

    let completed = false;
    animationManager.playAnimation('test').then(() => completed = true);

    // After one update, it should branch to 0 and NOT complete
    animationManager.update(performance.now() + 200);
    expect(animationManager.currentFrameIndexValue).toBe(0);
    expect(completed).toBe(false);
  });

  it('should complete on branch to 0 if it was the C# behavior', async () => {
      // This test is expected to FAIL with current implementation if we wanted C# behavior
  });
});
