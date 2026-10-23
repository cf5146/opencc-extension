export interface TextSnapshot {
  node: Text;
  value: string;
  start: number;
  end: number;
  parent: Node | null;
}
export interface CapturedSelection {
  items: TextSnapshot[];
  matches(): boolean;
}
export function captureSelection(sel: Selection | null): CapturedSelection | null {
  if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0).cloneRange(),
    root = range.commonAncestorContainer;
  const start = range.startContainer,
    end = range.endContainer,
    a = range.startOffset,
    b = range.endOffset;
  const nodes: Text[] = [];
  if (root.nodeType === 3) nodes.push(root as Text);
  const walker = (root.ownerDocument ?? (root as Document)).createTreeWalker(root, 4);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  const items = nodes
    .filter((n) => range.intersectsNode(n))
    .map((node) => ({
      node,
      value: node.data,
      parent: node.parentNode,
      start: node === start ? a : 0,
      end: node === end ? b : node.length,
    }))
    .filter((s) => s.end > s.start);
  return {
    items,
    matches() {
      if (!sel.rangeCount || sel.isCollapsed) return false;
      const current = sel.getRangeAt(0);
      return (
        current.startContainer === start &&
        current.endContainer === end &&
        current.startOffset === a &&
        current.endOffset === b &&
        items.every((s) => s.node.isConnected && s.node.parentNode === s.parent && s.node.data === s.value)
      );
    },
  };
}
