import { beforeEach, describe, expect, it } from "vitest";

import { createConversionService } from "../src/application/conversion/conversion-service.js";
import type { ConverterFactory } from "../src/infrastructure/conversion/opencc-factory.js";

const mockFactory: ConverterFactory = (from, to) => (text) => `${from}->${to}:${text}`;

describe("conversion service", () => {
  it("bounds cached characters as well as entry count", () => {
    const service = createConversionService(mockFactory);
    const text = "漢".repeat(3000);
    for (let i = 0; i < 40; i++) service.convertTextNode(document.createTextNode(`${text}${i}`), "cn", "hk");
    expect(service.convertTextNode(document.createTextNode(`cn->hk:${text}0`), "cn", "hk")).toBe(true);
  });
  beforeEach(() => {
    document.documentElement.innerHTML = "<head><title>原標題</title></head><body></body>";
  });

  const createService = () => createConversionService(mockFactory);

  it("converts plain text", () => {
    const service = createService();
    expect(service.convertText("漢字", "cn", "hk")).toBe("cn->hk:漢字");
  });

  it("converts new text written into a previously converted node", () => {
    const service = createService();
    const node = document.createTextNode("原文");
    service.convertTextNode(node, "cn", "hk");
    node.data = "新內容";
    expect(service.hasConverted(node, "cn", "hk")).toBe(false);
    expect(service.convertTextNode(node, "cn", "hk")).toBe(true);
    expect(node.data).toBe("cn->hk:新內容");
  });

  it("does not grow the shared output cache without limit", () => {
    const service = createService();
    for (let i = 0; i < 2000; i++) service.convertTextNode(document.createTextNode(`漢${i}`), "cn", "hk");
    // Old outputs must eventually be evicted, while live-node metadata remains valid.
    const old = document.createTextNode("cn->hk:漢0");
    expect(service.convertTextNode(old, "cn", "hk")).toBe(true);
  });

  it("converts text nodes only once per locale pair", () => {
    const service = createService();
    const node = document.createTextNode("測試");
    document.body.appendChild(node);

    expect(service.convertTextNode(node, "cn", "hk")).toBe(true);
    expect(node.nodeValue).toBe("cn->hk:測試");
    expect(service.convertTextNode(node, "cn", "hk")).toBe(false);
  });

  it("converts documents and avoids double processing", () => {
    const service = createService();
    document.body.innerHTML = "<p>測試一</p><p>測試二</p>";

    const first = service.convertDocument("cn", "hk");
    const second = service.convertDocument("cn", "hk");

    expect(first).toBe(2);
    expect(second).toBe(0);
    expect(document.body.textContent).toContain("cn->hk:測試一");
  });

  it("converts selections via cloned fragments", () => {
    const service = createService();
    const paragraph = document.createElement("p");
    paragraph.textContent = "選取文字";
    document.body.appendChild(paragraph);

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const changed = service.convertSelection(selection, "cn", "hk");

    expect(changed).toBe(true);
    expect(paragraph.textContent).toBe("cn->hk:選取文字");
  });

  it("does not reconvert text inserted by selection conversion", () => {
    const service = createService();
    const paragraph = document.createElement("p");
    paragraph.textContent = "選取文字";
    document.body.appendChild(paragraph);

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(service.convertSelection(selection, "cn", "hk")).toBe(true);
    expect(service.convertDocument("cn", "hk")).toBe(0);
    expect(service.convertSelection(selection, "cn", "hk")).toBe(false);
    expect(paragraph.textContent).toBe("cn->hk:選取文字");
  });

  it("updates titles and exposes conversion metadata", () => {
    const service = createService();
    const node = document.createTextNode("標題文字");

    document.body.appendChild(node);
    service.convertTextNode(node, "cn", "hk");

    expect(service.hasConverted(node, "cn", "hk")).toBe(true);

    service.resetCaches();
    expect(service.hasConverted(node, "cn", "hk")).toBe(false);

    service.convertTitle("cn", "hk");
    expect(document.title).toBe("cn->hk:原標題");
  });
});
