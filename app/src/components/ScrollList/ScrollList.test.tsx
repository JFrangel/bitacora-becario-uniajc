import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScrollList } from './ScrollList';
import { fadeMask, fadeSizes, stateFor } from './useScrollList';

const ROW = 100;
const N = 30;
type Log = string[];

let frames: FrameRequestCallback[] = [];
const flush = () =>
  act(() => {
    const run = frames;
    frames = [];
    run.forEach((cb) => cb(0));
  });

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
});
afterEach(() => vi.unstubAllGlobals());

/** Lienzo de 300 px de alto con 30 filas de 100 px; registra cada lectura (r) y escritura (w) de diseño. */
function mount(extra: { snap?: boolean; maxHeight?: string } = {}) {
  const items = Array.from({ length: N }, (_, i) => ({ id: i }));
  const result = render(
    <ScrollList
      items={items}
      getKey={(item) => item.id}
      renderItem={(item) => (
        <article className="card" tabIndex={0}>
          fila {item.id}
        </article>
      )}
      {...extra}
    />,
  );
  const list = result.container.querySelector<HTMLElement>('.sl')!;
  const log: Log = [];
  const state = { top: 0, writes: 0, mask: '' };
  const def = (target: object, name: string, get: () => unknown, set?: (v: unknown) => void) => Object.defineProperty(target, name, { configurable: true, get, set });
  def(list, 'clientHeight', () => (log.push('r'), 300));
  def(list, 'scrollHeight', () => (log.push('r'), ROW * N));
  def(
    list,
    'scrollTop',
    () => (log.push('r'), state.top),
    (v) => {
      state.top = Number(v);
    },
  );
  const style = list.style as unknown as Record<string, unknown>;
  def(
    style,
    'maskImage',
    () => state.mask,
    (v) => {
      log.push('w');
      state.writes += 1;
      state.mask = String(v);
    },
  );
  def(style, 'webkitMaskImage', () => state.mask, () => {});
  const cards = [...list.querySelectorAll<HTMLElement>('[data-sl]')];
  cards.forEach((card, i) => {
    def(card, 'offsetTop', () => (log.push('r'), i * ROW));
    def(card, 'offsetHeight', () => (log.push('r'), ROW));
    const set = card.setAttribute.bind(card);
    const remove = card.removeAttribute.bind(card);
    card.setAttribute = (name: string, value: string) => {
      if (name === 'data-state') log.push('w');
      set(name, value);
    };
    card.removeAttribute = (name: string) => {
      if (name === 'data-state') log.push('w');
      remove(name);
    };
  });
  const scrollTo = (top: number) => {
    state.top = top;
    list.dispatchEvent(new Event('scroll'));
    flush();
  };
  return { ...result, list, cards, log, state, scrollTo };
}

describe('pure helpers', () => {
  it('sizes the fade: none at the top of the list, full at the bottom, and the other way round at the end', () => {
    expect(fadeSizes(0, 2700)).toEqual({ top: 0, bottom: 56 });
    expect(fadeSizes(30, 2700)).toEqual({ top: 30, bottom: 56 });
    expect(fadeSizes(2700, 2700)).toEqual({ top: 56, bottom: 0 });
    expect(fadeSizes(0, 0)).toEqual({ top: 0, bottom: 0 });
  });

  it('builds a pixel mask with 8 stops at each end', () => {
    const mask = fadeMask(56, 0);
    expect(mask.startsWith('linear-gradient(to bottom, ')).toBe(true);
    expect(mask.match(/rgba\(0,0,0,/g)).toHaveLength(16);
    expect(mask).toContain('rgba(0,0,0,1) 56.0px');
    expect(mask).not.toContain('var(');
  });

  it('puts a card in when at least a third is visible, otherwise above or below', () => {
    expect(stateFor(0, 100, 300)).toBe('in');
    expect(stateFor(-66, 100, 300)).toBe('in');
    expect(stateFor(-67, 100, 300)).toBe('above');
    expect(stateFor(-60, 200, 300)).toBe('in');
    expect(stateFor(280, 100, 300)).toBe('below');
    expect(stateFor(250, 100, 300)).toBe('in');
  });
});

describe('ScrollList', () => {
  it('renders every item and marks each one for the engine', () => {
    const { list, cards } = mount();
    expect(cards).toHaveLength(N);
    expect(list.querySelectorAll('.card')).toHaveLength(N);
    expect(cards[0].textContent).toBe('fila 0');
  });

  it('at rest the mask fades only at the bottom, and at the end only at the top', () => {
    const { scrollTo, state } = mount();
    scrollTo(0);
    expect(state.mask).toContain('calc(100% - 56.0px)');
    expect(state.mask).not.toContain('rgba(0,0,0,1) 56.0px');
    scrollTo(ROW * N - 300);
    expect(state.mask).toContain('rgba(0,0,0,1) 56.0px');
    expect(state.mask).not.toContain('calc(100% - 56.0px)');
  });

  it('does not rewrite the mask when the scroll stays inside the same 4 px step', () => {
    const { scrollTo, state } = mount();
    scrollTo(200);
    const before = state.writes;
    scrollTo(201);
    scrollTo(203);
    expect(state.writes).toBe(before);
    scrollTo(30);
    scrollTo(34);
    expect(state.writes).toBeGreaterThan(before);
  });

  it('reads first and writes after in every frame, and reads each child once', () => {
    const { scrollTo, log } = mount();
    log.length = 0;
    scrollTo(1000);
    const frame = log.join('');
    expect(frame).toMatch(/^r+w+$/);
    expect(frame.match(/r/g)!.length).toBe(3 + 2 * N);
    log.length = 0;
    scrollTo(1500);
    expect(log.join('')).not.toMatch(/w.*r/);
  });

  it('puts the cards outside the view in the above and below states, and the visible ones in', () => {
    const { scrollTo, cards } = mount();
    scrollTo(1000);
    expect(cards[0].dataset.state).toBe('above');
    expect(cards[9].dataset.state).toBe('above');
    expect(cards[10].dataset.state).toBe('in');
    expect(cards[12].dataset.state).toBe('in');
    expect(cards[13].dataset.state).toBe('below');
    expect(cards[29].dataset.state).toBe('below');
    scrollTo(0);
    expect(cards[0].dataset.state).toBe('in');
    expect(cards[3].dataset.state).toBe('below');
  });

  it('leaves everything visible when the user prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const { scrollTo, cards } = mount();
    scrollTo(1000);
    expect(cards.every((card) => !card.hasAttribute('data-state'))).toBe(true);
  });

  it('moves the focus with the arrow keys', async () => {
    const user = userEvent.setup();
    const { cards } = mount();
    cards[2].focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(cards[3]);
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(document.activeElement).toBe(cards[1]);
    cards[0].focus();
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(cards[0]);
  });

  it('snaps to cards only when asked, and takes a max height', () => {
    const plain = mount();
    expect(plain.list.classList.contains('snap')).toBe(false);
    plain.unmount();
    const snapped = mount({ snap: true, maxHeight: '420px' });
    expect(snapped.list.classList.contains('snap')).toBe(true);
    expect(snapped.list.style.maxHeight).toBe('420px');
  });
});

describe('ScrollList styles', () => {
  const css = readFileSync(join(__dirname, '../../styles/components.css'), 'utf8');

  it('hides the native scroll bar and draws no position indicator', () => {
    expect(css).toMatch(/\.sl \{[^}]*scrollbar-width: none/);
    expect(css).toMatch(/\.sl::-webkit-scrollbar \{ display: none; \}/);
    expect(css).not.toMatch(/\.sl[\w-]*\s*(indicator|thumb|bar|track)/i);
  });

  it('writes the fade inline: no CSS variables for the mask', () => {
    expect(css).not.toMatch(/--fade-(top|bottom|mask)/);
  });
});
