import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { convertAllNewTextNodes, resetConversionCache } from '../src/core/conversion.js';

function setupDom(html: string) {
  const dom = new JSDOM(html, { url: 'https://example.com' });
  (globalThis as any).document = dom.window.document;
  (globalThis as any).NodeFilter = dom.window.NodeFilter;
  return dom;
}

describe('conversion', () => {
  beforeEach(() => {
    resetConversionCache();
  });

  it('converts once without duplicating', () => {
    setupDom('<body>算法</body>');
    convertAllNewTextNodes('cn', 'twp');
    const once = document.body.textContent;
    convertAllNewTextNodes('cn', 'twp');
    const twice = document.body.textContent;
    expect(once).toBe(twice);
    expect(twice).toMatch(/演算法/);
    expect(twice).not.toMatch(/演演算法/);
  });

  it('converts newly appended content without duplicating old text', () => {
    setupDom("<body><div id='c'>這是算法</div></body>");
    convertAllNewTextNodes('cn', 'twp');
    document.getElementById('c')!.appendChild(document.createTextNode(' 和更多算法'));
    convertAllNewTextNodes('cn', 'twp');
    const text = document.body.textContent || '';
    const matches = text.match(/演算法/g) || [];
    expect(matches.length).toBe(2);
    expect(text).not.toMatch(/演演算法/);
  });
});
