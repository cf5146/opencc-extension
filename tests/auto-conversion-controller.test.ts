import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  createAutoConversionController,
  type AutoConversionOperations,
} from "../src/application/auto/auto-conversion-controller.js";
import { DEFAULT_SETTINGS } from "../src/application/settings/settings.js";
import { createConversionService } from "../src/application/conversion/conversion-service.js";

const disposers: Array<() => void> = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});
function fixture() {
  const dom = new JSDOM('<html lang="zh"><head><title>title</title></head><body><p>汉语</p></body></html>', {
    url: "https://example.com",
  });
  const document = dom.window.document;
  const service = createConversionService(() => (text) => text.replaceAll("汉", "漢").replaceAll("软件", "軟件"));
  let url = "https://example.com";
  let callback: (records: MutationRecord[]) => void = () => {};
  const tasks = new Map<number, () => void>();
  let nextId = 0;
  const observer = { observe: vi.fn(), disconnect: vi.fn() };
  const operations: AutoConversionOperations = {
    convertTextNode: vi.fn((a, b, node) => service.convertTextNode(node, a, b)),
    convertDocument: vi.fn(),
    convertTitle: vi.fn(),
    convertSelection: vi.fn(),
    hasConverted: (node, a, b) => service.hasConverted(node, a, b),
    resetCaches: vi.fn(() => service.resetCaches()),
  };
  const controller = createAutoConversionController({
    document,
    getUrl: () => url,
    operations,
    observerFactory: (cb) => {
      callback = cb;
      return observer;
    },
    timer: {
      schedule: (cb) => {
        tasks.set(++nextId, cb);
        return nextId;
      },
      cancel: (id) => {
        tasks.delete(id as number);
      },
    },
  });
  disposers.push(() => {
    controller.dispose();
    dom.window.close();
  });
  const drain = () => {
    let safety = 0;
    while (tasks.size) {
      if (++safety > 1000) throw new Error("queue failed to settle");
      const [id, fn] = tasks.entries().next().value!;
      tasks.delete(id);
      fn();
    }
  };
  const emit = async (records: Partial<MutationRecord>[]) => {
    callback(
      records.map(
        (record) =>
          ({
            type: "childList",
            target: document.body,
            addedNodes: [],
            removedNodes: [],
            ...record,
          }) as unknown as MutationRecord,
      ),
    );
    await Promise.resolve();
  };
  const settings = { ...DEFAULT_SETTINGS, auto: true };
  return {
    controller,
    document,
    tasks,
    operations,
    observer,
    settings,
    drain,
    emit,
    setUrl: (value: string) => {
      url = value;
    },
  };
}

describe("auto conversion controller", () => {
  it("queues the initial scan, observes mutations without old text copies, and converts incrementally", async () => {
    const f = fixture();
    await f.controller.reconcile(f.settings);
    expect(f.document.body.textContent).toBe("汉语");
    expect(f.observer.observe).toHaveBeenCalledWith(f.document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    f.drain();
    expect(f.document.body.textContent).toBe("漢语");
    expect(f.operations.convertDocument).not.toHaveBeenCalled();
    expect(f.controller.getStatus()).toBe("active");
  });
  it("never schedules a full-document fallback for empty or removal-only mutations", async () => {
    const f = fixture();
    await f.controller.reconcile(f.settings);
    f.drain();
    const calls = vi.mocked(f.operations.convertTextNode).mock.calls.length;
    await f.emit([]);
    await f.emit([{ removedNodes: [f.document.createTextNode("removed")] as unknown as NodeList }]);
    expect(f.tasks.size).toBe(0);
    expect(f.operations.convertTextNode).toHaveBeenCalledTimes(calls);
    expect(f.operations.convertDocument).not.toHaveBeenCalled();
  });
  it("converts expanded subtrees and reused text nodes but ignores its own output", async () => {
    const f = fixture();
    await f.controller.reconcile(f.settings);
    f.drain();
    const section = f.document.createElement("section");
    section.innerHTML = "<p>软件</p>";
    f.document.body.append(section);
    await f.emit([{ addedNodes: [section] as unknown as NodeList }]);
    f.drain();
    expect(section.textContent).toBe("軟件");
    const text = section.firstChild!.firstChild as Text;
    text.data = "汉语软件";
    await f.emit([{ type: "characterData", target: text }]);
    f.drain();
    expect(text.data).toBe("漢语軟件");
    await f.emit([{ type: "characterData", target: text }]);
    expect(f.tasks.size).toBe(0);
  });
  it("deduplicates overlapping expansion records and drops removed subtrees", async () => {
    const f = fixture();
    await f.controller.reconcile(f.settings);
    f.drain();
    const section = f.document.createElement("section");
    section.innerHTML = "<p>软件</p>";
    f.document.body.append(section);
    const paragraph = section.firstChild!;
    await f.emit([{ addedNodes: [paragraph, section] as unknown as NodeList }]);
    vi.mocked(f.operations.convertTextNode).mockClear();
    f.drain();
    expect(f.operations.convertTextNode).toHaveBeenCalledTimes(1);
    const detached = f.document.createElement("p");
    detached.textContent = "汉语";
    f.document.body.append(detached);
    await f.emit([{ addedNodes: [detached] as unknown as NodeList }]);
    detached.remove();
    f.drain();
    expect(detached.textContent).toBe("汉语");
  });
  it.each([
    { auto: false },
    { origin: "hk" as const, target: "hk" as const },
    { whitelist: ["example"] },
    { siteRules: { "example.com": "never" as const } },
  ])("does no work for an ineligible policy %j", async (patch) => {
    const f = fixture();
    await f.controller.reconcile({ ...f.settings, ...patch });
    expect(f.tasks.size).toBe(0);
    expect(f.controller.getStatus()).toBe("inactive");
  });
  it("uses exact-host Always rules while retaining the language safeguard", async () => {
    const f = fixture();
    await f.controller.reconcile({ ...f.settings, auto: false, siteRules: { "example.com": "always" } });
    f.drain();
    expect(f.document.body.textContent).toBe("漢语");
    f.document.documentElement.lang = "en";
    await f.controller.reconcile(f.settings);
    expect(f.controller.getStatus()).toBe("inactive");
  });
  it("cancels pending work on disable and catches content added while disabled on reenable", async () => {
    const f = fixture();
    await f.controller.reconcile(f.settings);
    await f.controller.reconcile({ ...f.settings, auto: false });
    f.drain();
    expect(f.document.body.textContent).toBe("汉语");
    f.document.body.insertAdjacentHTML("beforeend", "<p>软件</p>");
    await f.controller.reconcile(f.settings);
    f.drain();
    expect(f.document.body.textContent).toBe("漢语軟件");
  });
  it("keeps reload-required sticky on locale changes and cancels old queued work", async () => {
    const f = fixture();
    await f.controller.reconcile(f.settings);
    f.drain();
    await f.controller.reconcile({ ...f.settings, origin: "tw" });
    expect(f.controller.getStatus()).toBe("reload-required");
    expect(f.controller.getDocumentState(f.settings)).toBe("reload-required");
    expect(f.tasks.size).toBe(0);
  });
  it("reconciles SPA routes and applies new exclusions before processing mutations", async () => {
    const f = fixture();
    await f.controller.reconcile(f.settings);
    f.drain();
    f.setUrl("https://example.com/next");
    f.document.body.innerHTML = "<p>软件</p>";
    await f.emit([{ addedNodes: [f.document.body.firstChild!] as unknown as NodeList }]);
    f.drain();
    expect(f.document.body.textContent).toBe("軟件");
    expect(f.operations.resetCaches).toHaveBeenCalledTimes(1);
    f.setUrl("https://example.com/skip");
    await f.controller.reconcile({ ...f.settings, whitelist: ["/skip"] });
    expect(f.controller.getStatus()).toBe("inactive");
    expect(f.tasks.size).toBe(0);
  });
  it("rechecks navigation before a pending task and applies exclusions", async () => {
    const f = fixture();
    await f.controller.reconcile({ ...f.settings, whitelist: ["/skip"] });
    f.setUrl("https://example.com/skip");
    f.drain();
    await Promise.resolve();
    expect(f.document.body.textContent).toBe("汉语");
    expect(f.controller.getStatus()).toBe("inactive");
  });
  it("marks queued conversion failures reload-required without endless retries", async () => {
    const f = fixture();
    vi.mocked(f.operations.convertTextNode).mockImplementation(() => {
      throw new Error("conversion failed");
    });
    await f.controller.reconcile(f.settings);
    f.drain();
    expect(f.controller.getStatus()).toBe("reload-required");
    expect(f.tasks.size).toBe(0);
  });
  it.each(["failure", "pair-change"])(
    "pauses subsequent mutations while reload is required after %s",
    async (reason) => {
      const f = fixture();
      await f.controller.reconcile(f.settings);
      f.drain();
      if (reason === "failure") f.controller.markConversionFailed();
      else await f.controller.reconcile({ ...f.settings, origin: "tw" });
      const added = f.document.createTextNode("软件");
      f.document.body.append(added);
      await f.emit([{ addedNodes: [added] as unknown as NodeList }]);
      f.drain();
      expect(added.data).toBe("软件");
      expect(f.tasks.size).toBe(0);
      expect(f.controller.getStatus()).toBe("reload-required");
    },
  );
  it("rolls back observer setup failure and retains reload protection", async () => {
    const f = fixture();
    f.observer.observe.mockImplementation(() => {
      throw new Error("observer failed");
    });
    await expect(f.controller.reconcile(f.settings)).rejects.toThrow("observer failed");
    expect(f.controller.getDocumentState(f.settings)).toBe("reload-required");
    f.drain();
    expect(f.document.body.textContent).toBe("汉语");
  });
  it("tracks partial selection conversion and requires reload for a changed pair", () => {
    const f = fixture();
    f.controller.markSelectionProcessed(f.settings);
    expect(f.controller.getDocumentState(f.settings)).toBe("unprocessed");
    expect(f.controller.getDocumentState({ ...f.settings, origin: "tw" })).toBe("reload-required");
  });
  it("disposes once and prevents later reconciliation or mutation work", async () => {
    const f = fixture();
    await f.controller.reconcile(f.settings);
    f.controller.dispose();
    f.controller.dispose();
    await f.controller.reconcile(f.settings);
    f.drain();
    expect(f.observer.disconnect).toHaveBeenCalledTimes(1);
    expect(f.tasks.size).toBe(0);
    expect(f.document.body.textContent).toBe("汉语");
  });
});
