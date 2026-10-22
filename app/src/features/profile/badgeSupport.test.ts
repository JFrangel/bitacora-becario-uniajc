import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasWebGL, prefersReducedMotion, scheduleIdle, shouldUse3D } from './badgeSupport';

describe('shouldUse3D', () => {
  it.each([
    [true, false, true, true],
    [false, false, true, false],
    [true, true, true, false],
    [true, false, false, false],
    [false, true, true, false],
    [false, false, false, false],
    [true, true, false, false],
    [false, true, false, false],
  ])('webgl %s · reduced motion %s · script loaded %s → %s', (webgl, reducedMotion, scriptLoaded, expected) => {
    expect(shouldUse3D({ webgl, reducedMotion, scriptLoaded })).toBe(expected);
  });
});

describe('browser checks', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('says there is no WebGL when the canvas cannot create a context', () => {
    expect(hasWebGL()).toBe(false);
  });

  it('reads the reduced-motion preference', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(prefersReducedMotion()).toBe(true);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(prefersReducedMotion()).toBe(false);
  });

  it('runs idle work later and can be cancelled', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const cancel = scheduleIdle(fn, 100);
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();
    cancel();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
    scheduleIdle(fn, 10);
    vi.advanceTimersByTime(20);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
