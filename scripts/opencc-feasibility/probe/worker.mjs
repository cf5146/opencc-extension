import { loadOpenCC } from "./engine/runtime.mjs";
let session;
const sha = async (x) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(x))), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
async function init(_data, start) {
  session?.close();
  session = await loadOpenCC();
  return {
    ms: performance.now() - start,
    memoryBytes: session.memoryBytes,
    manifestSha256: await sha(JSON.stringify(session.manifest)),
  };
}
async function corpus(_data, start) {
  const cases = await (await fetch("./engine/cases.json")).json();
  let matched = 0;
  const mismatches = [];
  for (const c of cases) {
    const actual = session.convert(c.config, c.input);
    if (actual === c.expected) matched++;
    else mismatches.push({ ...c, actual });
  }
  return { tested: cases.length, matched, mismatches, ms: performance.now() - start, memoryBytes: session.memoryBytes };
}
async function long(data) {
  const result = [];
  for (const chars of [100000, 1000000]) {
    for (const pattern of ["汉", "勇敢的士兵在软件开发中心使用鼠标，研究生命起源。 OpenCC 😀\n"]) {
      let input = pattern.repeat(Math.ceil(chars / pattern.length)).slice(0, chars);
      if (!input.isWellFormed()) input = input.slice(0, -1);
      const t = performance.now(),
        output = session.convert(data.config, input),
        ms = performance.now() - t;
      // Finish hashing before the next timed conversion; bound memory and isolate each measurement.
      const sha256 = await sha(output); // NOSONAR S9382: sequential benchmark samples avoid overlapping memory and timings.
      result.push({
        config: data.config,
        chars: input.length,
        pattern: pattern === "汉" ? "repeated-Han" : "mixed",
        inputUtf8Bytes: new TextEncoder().encode(input).length,
        outputUtf8Bytes: new TextEncoder().encode(output).length,
        sha256,
        ms,
        memoryBytes: session.memoryBytes,
      });
    }
  }
  return result;
}
function first(data, start) {
  const output = session.convert(data.config, "勇敢的士兵汉字😀");
  return { config: data.config, output, ms: performance.now() - start, memoryBytes: session.memoryBytes };
}
function warm(data) {
  const text = "勇敢的士兵在软件开发中心使用鼠标。".repeat(600).slice(0, 10000),
    times = [];
  session.convert(data.config, text);
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    session.convert(data.config, text);
    times.push(performance.now() - t);
  }
  return { config: data.config, timesMs: times, memoryBytes: session.memoryBytes };
}
const handlers = new Map(
  Object.entries({
    init,
    corpus,
    long,
    first,
    warm,
    close() {
      session?.close();
      return true;
    },
  }),
);
self.onmessage = async ({ data }) => {
  try {
    const start = performance.now(),
      handler = handlers.get(data.command);
    if (!handler) throw new Error("Unknown command");
    const result = await handler(data, start);
    self.postMessage({ id: data.id, result });
  } catch (e) {
    self.postMessage({ id: data.id, error: e.message });
  }
};
