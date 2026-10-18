interface QueueOptions {
  document: Document;
  convert(node: Text): void;
  beforeFlush?: () => boolean;
  onError?: (error: unknown) => void;
  schedule?: (callback: () => void) => unknown;
  cancel?: (handle: unknown) => void;
}

/** One live TreeWalker, bounded work per task, and no retained list of page text. */
export function createConversionQueue(options: QueueOptions) {
  const schedule = options.schedule ?? ((callback) => globalThis.setTimeout(callback, 0));
  const cancel = options.cancel ?? ((handle) => globalThis.clearTimeout(handle as number));
  const roots = new Set<Node>();
  let walker: TreeWalker | undefined;
  let activeRoot: Node | undefined;
  let handle: unknown;
  let scheduled = false;
  let generation = 0;

  const clear = () => {
    generation++;
    if (scheduled) cancel(handle);
    scheduled = false;
    roots.clear();
    walker = undefined;
    activeRoot = undefined;
  };

  const request = () => {
    if (scheduled || (!roots.size && !walker)) return;
    scheduled = true;
    const expected = generation;
    handle = schedule(() => {
      if (expected !== generation) return;
      scheduled = false;
      try {
        if (options.beforeFlush && !options.beforeFlush()) {
          clear();
          return;
        }
        const deadline = performance.now() + 8;
        let visited = 0;
        while (visited < 200 && performance.now() < deadline) {
          if (walker && (!activeRoot?.isConnected || !walker.currentNode.isConnected)) {
            if (activeRoot?.isConnected) roots.add(activeRoot);
            walker = undefined;
            activeRoot = undefined;
          }
          if (!walker) {
            const root = roots.values().next().value;
            if (!root) break;
            roots.delete(root);
            if (!root.isConnected) continue;
            let parent = root.parentNode;
            while (parent && !roots.has(parent)) parent = parent.parentNode;
            if (parent) continue;
            if (root.nodeType === 3) {
              options.convert(root as Text);
              visited++;
              continue;
            }
            activeRoot = root;
            // SHOW_ALL also budgets traversal through large trees with little text.
            walker = options.document.createTreeWalker(root, 0xffffffff);
          }
          const node = walker.nextNode();
          if (!node) {
            walker = undefined;
            activeRoot = undefined;
            continue;
          }
          visited++;
          if (node.nodeType === 3) options.convert(node as Text);
        }
        request();
      } catch (error) {
        clear();
        options.onError?.(error);
      }
    });
  };

  const enqueue = (root: Node | null) => {
    if (!root?.isConnected) return;
    // Climb ancestors rather than repeatedly walking the inserted subtrees.
    for (let node: Node | null = root; node; node = node.parentNode) if (roots.has(node)) return;
    roots.add(root);
    request();
  };
  return { enqueue, clear };
}
