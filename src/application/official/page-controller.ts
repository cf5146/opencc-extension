import { createDocumentConverter, type ConvertBatch } from "./document-converter.js";
import { captureSelection, type CapturedSelection } from "./selection-snapshot.js";
import {
  configName,
  effectiveOptions,
  normalizeOfficialSettings,
  type OfficialSettings,
  type ConversionOptions,
} from "./settings.js";
export function createPageController(
  doc: Document,
  convert: ConvertBatch,
  getUrl = () => doc.location.href,
  onError: (message: string) => void = () => {},
) {
  const service = createDocumentConverter(convert);
  let settings = normalizeOfficialSettings(null),
    used: string | undefined,
    disposed = false;
  let observer: MutationObserver | undefined,
    timer: ReturnType<typeof setTimeout> | undefined,
    busy = false,
    queue: Promise<unknown> = Promise.resolve(),
    revision = 0;
  const roots = new Set<Node>();
  const current = () => effectiveOptions(settings, getUrl()) ?? { preset: settings.preset, mode: settings.mode };
  const auto = () => {
    const lang = doc.documentElement.lang.toLowerCase();
    return !lang || lang === "zh" || lang.startsWith("zh-") ? effectiveOptions(settings, getUrl()) : undefined;
  };
  const stop = () => {
    observer?.disconnect();
    observer = undefined;
    clearTimeout(timer);
    timer = undefined;
    roots.clear();
    service.cancel();
  };
  const mismatch = (options: ConversionOptions) => !!used && used !== configName(options);
  const run = async (root: Node, options: ConversionOptions) => {
    if (mismatch(options)) throw Error("轉換設定已變更，請重新載入頁面後再轉換。");
    used = configName(options);
    const url = getUrl(),
      expected = revision;
    return service.convert(root, options, () => !disposed && expected === revision && url === getUrl());
  };
  const enqueue = (root: Node) => {
    if (root.nodeType !== 1 && root.nodeType !== 3) return;
    for (let p: Node | null = root; p; p = p.parentNode) if (roots.has(p)) return;
    roots.add(root);
    if (!busy && timer === undefined) timer = setTimeout(() => void flush(), 20);
  };
  const flush = async () => {
    timer = undefined;
    if (disposed || busy) return;
    const options = auto();
    if (!options) {
      stop();
      return;
    }
    busy = true;
    const job = queue
      .catch(() => {})
      .then(async () => {
        while (roots.size && !disposed) {
          const active = auto();
          if (!active || configName(active) !== configName(options)) break;
          const root = roots.values().next().value!;
          roots.delete(root);
          await run(root, options);
        }
      });
    queue = job;
    try {
      await job;
    } catch (e) {
      stop();
      onError(e instanceof Error ? e.message : "自動轉換失敗；尚未處理的原文保留。");
    } finally {
      busy = false;
      if (roots.size && !disposed) timer = setTimeout(() => void flush(), 20);
    }
  };
  const update = (next: OfficialSettings) => {
    revision++;
    stop();
    settings = next;
    if (disposed) return;
    const options = auto();
    if (!options) return;
    if (mismatch(options)) {
      onError("轉換設定已變更，請重新載入頁面後再轉換。");
      return;
    }
    observer = new doc.defaultView!.MutationObserver((records) => {
      for (const m of records) {
        if (m.type === "characterData") {
          const t = m.target as Text;
          if (!service.hasConverted(t, options)) enqueue(t);
        }
        for (const node of m.addedNodes) enqueue(node);
      }
    });
    if (doc.body) {
      observer.observe(doc.body, { subtree: true, childList: true, characterData: true });
      enqueue(doc.body);
    }
    const title = doc.querySelector("title");
    if (title) enqueue(title);
  };
  const manual = (
    selection: boolean,
    requestedSelection: CapturedSelection | null = selection ? captureSelection(doc.defaultView!.getSelection()) : null,
  ) => {
    const expected = revision,
      options = current(),
      url = getUrl();
    const job = queue
      .catch(() => {})
      .then(async () => {
        if (disposed || expected !== revision || url !== getUrl()) return { kind: "no-op", count: 0, time: 0 };
        if (selection && (!requestedSelection || !requestedSelection.matches()))
          return { kind: "no-op", count: 0, time: 0 };
        if (mismatch(options)) return { kind: "reload-required" };
        const started = performance.now();
        used = configName(options);
        try {
          let count = 0;
          const valid = () => !disposed && expected === revision && url === getUrl();
          if (selection)
            count = await service.selection(doc.defaultView!.getSelection(), options, valid, requestedSelection);
          else {
            const title = doc.querySelector("title");
            if (title) count += await run(title, options);
            if (doc.body && valid()) count += await run(doc.body, options);
          }
          return { kind: count ? "success" : "no-op", count, time: performance.now() - started };
        } catch (e) {
          stop();
          const message = e instanceof Error ? e.message : "轉換失敗；尚未處理的原文保留。";
          onError(message);
          return { kind: "internal-failure", message };
        }
      });
    queue = job;
    return job;
  };
  return {
    update,
    manual,
    dispose() {
      disposed = true;
      revision++;
      stop();
    },
  };
}
