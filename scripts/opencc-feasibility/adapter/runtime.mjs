import createModule from "./opencc.mjs";
const allowed = new Set(["s2t", "s2tw", "s2twp", "s2hk", "tw2sp"].flatMap((c) => [c, `${c}_jieba`]));
const encoder = new TextEncoder(),
  decoder = new TextDecoder("utf-8", { fatal: true });
export async function loadOpenCC() {
  const base = new URL("./", import.meta.url),
    node = typeof process !== "undefined" && !!process.versions?.node;
  const read = async (relative) => {
    const url = new URL(relative, base);
    if (node) {
      const fs = await import("node:fs/promises");
      return new Uint8Array(await fs.readFile(url));
    }
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Resource ${relative}: ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  };
  const manifest = JSON.parse(decoder.decode(await read("engine-resources.json")));
  const mod = await createModule({ locateFile: (f) => new URL(f, base).href });
  await Promise.all(
    manifest.resources.map(async (resource) => {
      const bytes = await read(resource.path);
      const actual = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      if (actual !== resource.sha256) throw new Error(`Resource hash mismatch: ${resource.path}`);
      mod.FS.mkdirTree(resource.virtualPath.slice(0, resource.virtualPath.lastIndexOf("/")));
      mod.FS.writeFile(resource.virtualPath, bytes);
    }),
  );
  const handles = new Map();
  let closed = false;
  const heapCall = (text, fn) => {
    const bytes = encoder.encode(text),
      p = mod._malloc(bytes.length + 1);
    if (!p) throw new Error("WASM input allocation failed");
    try {
      mod.HEAPU8.set(bytes, p);
      mod.HEAPU8[p + bytes.length] = 0;
      return fn(p, bytes.length);
    } finally {
      mod._free(p);
    }
  };
  const error = () => new Error(mod.UTF8ToString(mod._oc_error()));
  return {
    manifest,
    get memoryBytes() {
      return mod.HEAPU8.buffer.byteLength;
    },
    convert(config, text) {
      if (closed) throw new Error("OpenCC session closed");
      if (!allowed.has(config)) throw new Error(`Unsupported config: ${config}`);
      if (typeof text !== "string") throw new TypeError("Text must be a string");
      if (text.includes("\0"))
        throw new Error("Embedded NUL is unsupported by official OpenCC; input was not converted");
      if (!text.isWellFormed()) throw new Error("Malformed UTF-16 input was not converted");
      if (!handles.has(config)) {
        const h = heapCall(`/data/config/${config}.json`, (p) => mod._oc_create(p));
        if (!h) throw error();
        handles.set(config, h);
      }
      const h = handles.get(config);
      return heapCall(text, (p, n) => {
        const output = mod._oc_convert(h, p, n);
        if (!output) throw error();
        return decoder.decode(mod.HEAPU8.subarray(output, output + mod._oc_output_size(h)));
      });
    },
    close() {
      if (closed) return;
      for (const h of handles.values()) mod._oc_destroy(h);
      handles.clear();
      closed = true;
    },
  };
}
