import { describe, expect, it } from 'vitest';
import { allRules } from './cssFiles';
import type { Rule } from './cssFiles';

const all = allRules();
const parts = (rule: Rule) => rule.selector.split(',').map((part) => part.trim());
const rulesFor = (selector: string) => all.filter((rule) => parts(rule).includes(selector));
const declared = (rules: Rule[], property: string) => rules.flatMap((rule) => [...rule.body.matchAll(new RegExp(`(?:^|[;\\s{])${property}\\s*:\\s*([^;]+)`, 'g'))].map((m) => m[1].trim()));

describe('the Bitácora badge column (layout)', () => {
  it('hangs from the top bar: sticky, above the bar, and never takes the clicks itself', () => {
    const column = rulesFor('#view-journal.active > .journal-badge');
    expect(declared(column, 'position')).toContain('sticky');
    expect(declared(column, 'pointer-events')).toContain('none');
    expect(declared(column, 'margin-top').join(' ')).toMatch(/--nav-h/);
    expect(Number(declared(column, 'z-index').pop())).toBeGreaterThan(0);
  });

  it('keeps sticky working: no ancestor of the column is a scroll container', () => {
    // `overflow: hidden | auto | scroll` en un ancestro rompe `position: sticky`; `clip` no.
    const ancestors = ['html', 'body', '#root', '.app', '.stage', '.view', '#view-journal', '.app .stage', '.app[data-theme]', '.app[data-theme] .stage'];
    const offenders = ancestors.flatMap((selector) => declared(rulesFor(selector), 'overflow(?:-[xy])?').map((value) => `${selector} → ${value}`)).filter((line) => !/(→ (visible|clip))$/.test(line));
    expect(offenders).toEqual([]);
  });

  it('lets the 3D canvas cover from the left edge of the app, so the card is not cut when dragged sideways', () => {
    const stage = rulesFor('.journal-badge .badge-stage');
    expect(declared(stage, 'position')).toContain('absolute');
    expect(declared(stage, 'left').join(' ')).toMatch(/--stage-left/);
    expect(declared(stage, 'width').join(' ')).toMatch(/--stage-w/);
  });

  it('makes the canvas as tall as the window, so the card can go all the way down and meets no invisible wall', () => {
    expect(declared(rulesFor('.journal-badge .badge-stage'), 'height')).toContain('100vh');
    expect(declared(rulesFor('.badge-hit'), 'height').join(' ')).toMatch(/100vh/);
  });

  it('receives the pointer only in the two zones: below the bar and on the strap itself', () => {
    const hit = rulesFor('.badge-hit');
    expect(declared(hit, 'pointer-events')).toContain('auto');
    expect(declared(hit, 'touch-action')).toContain('none');
    expect(declared(hit, 'left').join(' ')).toMatch(/--hit-left/);
    const strap = rulesFor('.badge-hit.strap');
    expect(declared(strap, 'left').join(' ')).toMatch(/--strap-left/);
    expect(declared(strap, 'top')).toContain('0');
    expect(declared(strap, 'height').join(' ')).toMatch(/--nav-h/);
  });

  it('without 3D, shows the flat card at the size and place of the 3D one, never filling the whole screen', () => {
    const flat = rulesFor('.journal-badge .badge-flat');
    expect(declared(flat, 'position')).toContain('absolute');
    expect(declared(flat, 'height').join(' ')).toMatch(/min\(700px/);
    expect(declared(flat, 'left').join(' ')).toMatch(/--strap-left/);
    expect(declared(flat, 'pointer-events')).toContain('none');
  });

  it('wraps the badge without adding a box of its own', () => {
    expect(declared(rulesFor('.badge-col'), 'display')).toContain('contents');
  });

  it('is not shown on screens up to 1100 px, where there is no column', () => {
    const narrow = all.filter((rule) => rule.selector === '.journal-badge' && /display\s*:\s*none/.test(rule.body));
    expect(narrow.length).toBeGreaterThan(0);
  });

  it('makes room in the bar only while the badge hangs there', () => {
    expect(declared(rulesFor('.app.journal-wide .appearance'), 'margin-left')).toContain('34px');
  });
});
