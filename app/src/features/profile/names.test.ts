import { describe, expect, it } from 'vitest';
import { initialsOf, nameLines } from './names';

describe('nameLines', () => {
  it.each([
    ['Jose Frangel Padilla Camacho', ['Jose Frangel', 'Padilla Camacho']],
    ['Ana María Gómez', ['Ana María', 'Gómez']],
    ['Laura Gómez', ['Laura', 'Gómez']],
    ['Madonna', ['Madonna', '']],
    ['  Ana   Gómez  ', ['Ana', 'Gómez']],
    ['', ['', '']],
  ])('splits «%s»', (name, expected) => {
    expect(nameLines(name)).toEqual(expected);
  });
});

describe('initialsOf', () => {
  it.each([
    ['Jose Frangel Padilla Camacho', 'JP'],
    ['Ana María Gómez', 'AG'],
    ['Laura Gómez', 'LG'],
    ['madonna', 'MA'],
    ['', '?'],
  ])('«%s» ⇒ %s', (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});
