import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnimationManager } from '../src/AnimationManager';
import { type Animation, type FrameDefinition } from '../src/types';

describe('AnimationManager', () => {
  let spriteManager: any;
  let audioManager: any;
  let animationManager: AnimationManager;

  const mockAnimations: Record<string, Animation> = {
    'test': {
      name: 'test',
      transitionType: 0,
      frames: [
        { duration: 10, images: [] }, // Frame 0
        { duration: 0, images: [], exitBranch: 1 },  // Frame 1 (Null frame)
        { duration: 10, images: [] }  // Frame 2
      ]
    },
    'loop': {
        name: 'loop',
        transitionType: 0,
        frames: [
            { duration: 10, images: [] },
            { duration: 0, images: [], branching: [{ branchTo: 1, probability: 100 }] } // Loops to itself
        ]
    }
  };

  beforeEach(() => {
    spriteManager = {
      drawFrame: vi.fn(),
      loadSprite: vi.fn().mockResolvedValue(undefined)
    };
    audioManager = {
      playFrameSound: vi.fn(),
      loadSounds: vi.fn().mockResolvedValue(undefined)
    };
    animationManager = new AnimationManager(spriteManager, audioManager, mockAnimations);
  });

  it('should fast-forward through null frames (duration 0)', () => {
    const animationWithNullFrames: Animation = {
        name: 'nulls',
        transitionType: 0,
        frames: [
            { duration: 0, images: [] }, // Jump immediately to 1
            { duration: 0, images: [] }, // Jump immediately to 2
            { duration: 10, images: [] } // Stay here
        ]
    };
    (animationManager as any).animations['nulls'] = animationWithNullFrames;

    animationManager.setAnimation('nulls');
    // After setAnimation, it should have already processed the first two null frames
    expect(animationManager.currentFrameIndexValue).toBe(2);
  });

  it('should complete animation when jumping to index 0 from a null frame', async () => {
    const animationEndingInNull: Animation = {
        name: 'end-null',
        transitionType: 0,
        frames: [
            { duration: 10, images: [] },
            { duration: 0, images: [] } // Duration 0, next is 0 (completion)
        ]
    };
    (animationManager as any).animations['end-null'] = animationEndingInNull;

    const promise = animationManager.playAnimation('end-null');

    // Initial state: frame 0
    expect(animationManager.currentFrameIndexValue).toBe(0);

    // Update to trigger next frame
    animationManager.update(performance.now() + 200);

    // Should have skipped frame 1 and completed
    await expect(promise).resolves.toBe(true);
    expect(animationManager.isAnimating).toBe(false);
  });

  it('should handle exit branches correctly when exiting', async () => {
      const anim: Animation = {
          name: 'exit-test',
          transitionType: 0,
          frames: [
              { duration: 10, images: [], exitBranch: 2 }, // If exiting, go to 2
              { duration: 10, images: [] },
              { duration: 10, images: [] }
          ]
      };
      (animationManager as any).animations['exit-test'] = anim;

      const promise = animationManager.playAnimation('exit-test');
      animationManager.isExitingFlag = true;

      // Update to trigger next frame
      animationManager.update(performance.now() + 200);

      // Should have jumped to frame 2 (index 1 is skipped)
      expect(animationManager.currentFrameIndexValue).toBe(1); // Wait, exitBranch is 1-based. exitBranch: 2 means index 1.
  });

  it('should break out of infinite null loops', () => {
    const loopAnim: Animation = {
        name: 'infinite-null',
        transitionType: 0,
        frames: [
            { duration: 0, images: [], branching: [{ branchTo: 1, probability: 100 }] }
        ]
    };
    (animationManager as any).animations['infinite-null'] = loopAnim;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    animationManager.setAnimation('infinite-null');

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Infinite loop detected'));
    warnSpy.mockRestore();
  });

  it('should persist the last rendered frame after animation ends', async () => {
    const singleFrameAnim: Animation = {
        name: 'single',
        transitionType: 0,
        frames: [{ duration: 10, images: [{ filename: 'test.bmp', offsetX: 0, offsetY: 0 }] }]
    };
    (animationManager as any).animations['single'] = singleFrameAnim;

    const promise = animationManager.playAnimation('single');

    // Initial state
    expect(animationManager.currentFrameIndexValue).toBe(0);

    // Advance time
    animationManager.update(performance.now() + 200);

    await promise;

    // Animation is finished
    expect(animationManager.isAnimating).toBe(false);

    // But currentFrame should still return the last rendered one
    expect(animationManager.currentFrame).not.toBeNull();
    expect(animationManager.currentFrame?.images[0].filename).toBe('test.bmp');
  });
});
