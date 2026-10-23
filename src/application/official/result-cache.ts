export function createResultCache() {
  const entries = new Map<string, { value: string; bytes: number }>();
  let bytes = 0;
  return {
    get(key: string) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key: string, value: string) {
      const size = 2 * (key.length + value.length);
      if (size > 524288) return;
      const previous = entries.get(key);
      if (previous) {
        bytes -= previous.bytes;
        entries.delete(key);
      }
      entries.set(key, { value, bytes: size });
      bytes += size;
      while (entries.size > 2048 || bytes > 524288) {
        const oldest = entries.keys().next().value!;
        bytes -= entries.get(oldest)!.bytes;
        entries.delete(oldest);
      }
    },
    clear() {
      entries.clear();
      bytes = 0;
    },
  };
}
