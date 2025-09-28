import { beforeEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { createConversionService } from '../src/application/conversion/conversion-service.js';
import type { ConverterFactory } from '../src/infrastructure/conversion/opencc-factory.js';

const mockFactory: ConverterFactory = (from, to) => (text) => `${from}->${to}:${text}`;

describe('conversion service', () => {
  beforeEach(() => {
    const dom = new JSDOM('<!doctype html><html><head><title>原標題</title></head><body></body></html>', {
      url: 'https://example.com',
    });
    (globalThis as any).window = dom.window;
    (globalThis as any).document = dom.window.document;
    (globalThis as any).NodeFilter = dom.window.NodeFilter;
  });

  const createService = () => createConversionService(mockFactory);

  it('converts plain text', () => {
    const service = createService();
    expect(service.convertText('漢字', 'cn', 'hk')).toBe('cn->hk:漢字');
  });

  it('converts text nodes only once per locale pair', () => {
    const service = createService();
    const node = document.createTextNode('測試');
    document.body.appendChild(node);

    expect(service.convertTextNode(node, 'cn', 'hk')).toBe(true);
    expect(node.nodeValue).toBe('cn->hk:測試');
    expect(service.convertTextNode(node, 'cn', 'hk')).toBe(false);
  });

  it('converts documents and avoids double processing', () => {
    const service = createService();
    document.body.innerHTML = '<p>測試一</p><p>測試二</p>';

    const first = service.convertDocument('cn', 'hk');
    const second = service.convertDocument('cn', 'hk');

    expect(first).toBe(2);
    expect(second).toBe(0);
    expect(document.body.textContent).toContain('cn->hk:測試一');
  });

  it('converts selections via cloned fragments', () => {
    const service = createService();
    const paragraph = document.createElement('p');
    paragraph.textContent = '選取文字';
    document.body.appendChild(paragraph);

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const changed = service.convertSelection(selection, 'cn', 'hk');

    expect(changed).toBe(true);
    expect(paragraph.textContent).toBe('cn->hk:選取文字');
  });

  it('updates titles and exposes conversion metadata', () => {
    const service = createService();
    const node = document.createTextNode('標題文字');

    document.body.appendChild(node);
    service.convertTextNode(node, 'cn', 'hk');

    expect(service.hasConverted(node, 'cn', 'hk')).toBe(true);

    service.resetCaches();
    expect(service.hasConverted(node, 'cn', 'hk')).toBe(false);

    service.convertTitle('cn', 'hk');
    expect(document.title).toBe('cn->hk:原標題');
  });
});
