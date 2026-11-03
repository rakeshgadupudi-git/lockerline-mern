'use strict';
const { newCode, hashCode, codeMatches } = require('../src/parcels/codes');

const KEY = 'a test key';

test('a new code is six digits', () => {
  expect(newCode()).toMatch(/^[0-9]{6}$/);
});

test('the stored hash is not the code, and the right code matches it', () => {
  const hash = hashCode('482913', KEY);

  expect(hash).not.toContain('482913');
  expect(codeMatches('482913', hash, KEY)).toBe(true);
});

test('a wrong code does not match', () => {
  expect(codeMatches('000000', hashCode('482913', KEY), KEY)).toBe(false);
});