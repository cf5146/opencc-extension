import { beforeEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import {
  convertText,
  convertTextNode,
  convertAllTextNodes,
  convertTitle,
  convertSelection,
  hasConverted,
  resetCaches,
} from '../src/utils/conversion';

describe('conversion utilities', () => {
  beforeEach(() => {
    const dom = new JSDOM('<!doctype html><html><head><title>原標題</title></head><body></body></html>', {
      url: 'https://example.com',
    });
    (globalThis as any).window = dom.window;
    (globalThis as any).document = dom.window.document;
    (globalThis as any).NodeFilter = dom.window.NodeFilter;
    resetCaches();
  });

  it('converts plain text', () => {
    const result = convertText('漢字', 'cn', 'hk');
    expect(result).toBeTruthy();
  });

  it('converts text nodes only once per locale pair', () => {
    const node = document.createTextNode('算法');
    document.body.appendChild(node);

    const first = convertTextNode(node, 'cn', 'twp');
    expect(first).toBe(true);
    expect(node.nodeValue).toMatch(/演算法/);

    const second = convertTextNode(node, 'cn', 'twp');
    expect(second).toBe(false);
  });

  it('converts all text nodes in document and avoids double processing', () => {
    document.body.innerHTML = '<p>算法</p><p>語言</p>';

    const first = convertAllTextNodes('cn', 'twp');
    const second = convertAllTextNodes('cn', 'twp');

    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);
  });

  it('converts selections', () => {
    const paragraph = document.createElement('p');
    paragraph.textContent = '算法';
    document.body.appendChild(paragraph);

    const selection = (globalThis as any).window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const changed = convertSelection(selection, 'cn', 'twp');
    expect(changed).toBe(true);
    expect(paragraph.textContent).toMatch(/演算法/);
  });

  it('tracks conversion metadata and resets caches', () => {
    const node = document.createTextNode('算法');
    document.body.appendChild(node);
    convertTextNode(node, 'cn', 'twp');

    expect(hasConverted(node, 'cn', 'twp')).toBe(true);

    resetCaches();
    expect(hasConverted(node, 'cn', 'twp')).toBe(false);
  });

  it('converts document title', () => {
    document.title = '测试标题';
    convertTitle('cn', 'hk');
    expect(document.title).not.toBe('测试标题');
    expect(document.title).toMatch(/測試標題/);
  });
});
