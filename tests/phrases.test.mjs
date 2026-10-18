import { describe, it, beforeEach, expect } from 'vitest';
import { convertAllNewTextNodes, resetConversionCache } from '../src/core/conversion.ts';

function setupDom(html) {
  document.documentElement.innerHTML = html;
}

describe('phrases conversion (legacy test port)', () => {
  beforeEach(() => resetConversionCache());

  it('does not duplicate conversions', () => {
    setupDom('<body>算法</body>');
    convertAllNewTextNodes('cn', 'twp');
    const once = document.body.textContent;
    convertAllNewTextNodes('cn', 'twp');
    const twice = document.body.textContent;
    expect(once).toBe(twice);
    expect(twice).toMatch(/演算法/);
    expect(twice).not.toMatch(/演演算法/);
  });

  it('converts appended nodes without duplicating existing text', () => {
    setupDom("<body><div id='c'>這是算法</div></body>");
    convertAllNewTextNodes('cn', 'twp');
    document.getElementById('c').appendChild(document.createTextNode(' 和更多算法'));
    convertAllNewTextNodes('cn', 'twp');
    const text = document.body.textContent;
    const matches = text.match(/演算法/g) || [];
    expect(matches.length).toBe(2);
    expect(text).not.toMatch(/演演算法/);
  });
});
