import { captureSelection, type CapturedSelection, type TextSnapshot as Snapshot } from "./selection-snapshot.js";
import { configName, type ConversionOptions } from "./settings.js";
export type ConvertBatch = (texts: string[], options: ConversionOptions) => Promise<string[]>;

const excluded =
  "script,style,noscript,textarea,input,select,option,pre,code,[contenteditable]:not([contenteditable=false]),[translate=no]";
function eligible(node: Text) {
  return !!node.isConnected && !node.parentElement?.closest(excluded) && /\p{Script=Han}/u.test(node.data);
}
export function createDocumentConverter(convertBatch: ConvertBatch) {
  let generation = 0;
  let appliedConfig: string | undefined;
  const meta = new WeakMap<Text, { key: string; value: string }>();
  const cancel = () => {
    generation++;
  };
  const batches = function* (snapshots: Snapshot[]) {
    for (let i = 0; i < snapshots.length;) {
      const batch: Snapshot[] = [];
      let size = 0;
      while (i < snapshots.length && (batch.length === 0 || (batch.length < 128 && size < 65536))) {
        const s = snapshots[i++]!;
        batch.push(s);
        size += s.end - s.start;
      }
      yield { batch, more: i < snapshots.length };
    }
  };
  const validateOutput = (output: string[], length: number) => {
    if (output.length !== length || output.some((s) => typeof s !== "string"))
      throw new Error("轉換引擎回傳無效結果；原文保留。");
  };
  const convertSnapshots = (batch: Snapshot[], options: ConversionOptions) =>
    convertBatch(
      batch.map((s) => s.value.slice(s.start, s.end)),
      options,
    );
  async function apply(
    snapshots: Snapshot[],
    options: ConversionOptions,
    expected: number,
    stillValid = () => true,
    atomic = false,
  ) {
    let count = 0;
    const key = configName(options),
      pending: Array<{ s: Snapshot; output: string }> = [];
    const unchanged = (s: Snapshot) => eligible(s.node) && s.node.parentNode === s.parent && s.node.data === s.value;
    const commit = (s: Snapshot, output: string) => {
      if (!unchanged(s)) return;
      const next = s.value.slice(0, s.start) + output + s.value.slice(s.end);
      if (next !== s.value) {
        s.node.data = next;
        appliedConfig = key;
        count++;
      }
      if (s.start === 0 && s.end === s.value.length) meta.set(s.node, { key, value: next });
    };
    for (const { batch, more } of batches(snapshots)) {
      if (expected !== generation || !stillValid()) return count;
      const output = await convertSnapshots(batch, options); // NOSONAR S9382: ordered batches bound memory and allow cancellation before writes.
      validateOutput(output, batch.length);
      if (expected !== generation || !stillValid()) return count;
      for (let j = 0; j < batch.length; j++) {
        const s = batch[j]!;
        if (atomic) pending.push({ s, output: output[j]! });
        else commit(s, output[j]!);
      }
      if (more) await new Promise<void>((r) => setTimeout(r, 0)); // NOSONAR S9382: yield between ordered batches so cancellation can run.
    }
    // Selection endpoints move on text writes; validate once, then commit without awaits.
    if (atomic && expected === generation && stillValid() && pending.every((x) => unchanged(x.s)))
      for (const { s, output } of pending) commit(s, output);
    return count;
  }
  const snapshot = (node: Text, start = 0, end = node.length): Snapshot => ({
    node,
    value: node.data,
    start,
    end,
    parent: node.parentNode,
  });
  const nodes = (root: Node) => {
    const found: Text[] = [];
    if (root.nodeType === 3) found.push(root as Text);
    const walker = root.ownerDocument!.createTreeWalker(root, 4);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) found.push(n as Text);
    return found;
  };
  const hasConverted = (node: Text, options: ConversionOptions) => {
    const m = meta.get(node);
    return m?.key === configName(options) && m.value === node.data;
  };
  const convert = async (root: Node, options: ConversionOptions, stillValid = () => true) => {
    const items = nodes(root)
      .filter((n) => eligible(n) && !hasConverted(n, options))
      .map((n) => snapshot(n));
    return apply(items, options, generation, stillValid);
  };
  const selection = async (
    sel: Selection | null,
    options: ConversionOptions,
    stillCurrent = () => true,
    captured: CapturedSelection | null = captureSelection(sel),
  ) => {
    if (!captured?.matches()) return 0;
    return apply(
      captured.items.filter((s) => eligible(s.node)),
      options,
      generation,
      () => stillCurrent() && captured.matches(),
      true,
    );
  };
  return {
    convert,
    selection,
    cancel,
    hasConverted,
    get appliedConfig() {
      return appliedConfig;
    },
  };
}
