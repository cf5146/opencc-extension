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
function snapshotRange(range: Range): TextSnapshot[] {
  const root = range.commonAncestorContainer;
  const nodes: Text[] = [];
  if (root.nodeType === 3) nodes.push(root as Text);
  const walker = (root.ownerDocument ?? (root as Document)).createTreeWalker(root, 4);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  return nodes
    .filter((node) => range.intersectsNode(node))
    .map((node) => ({
      node,
      value: node.data,
      parent: node.parentNode,
      start: node === range.startContainer ? range.startOffset : 0,
      end: node === range.endContainer ? range.endOffset : node.length,
    }))
    .filter((snapshot) => snapshot.end > snapshot.start);
}
export function captureSelection(sel: Selection | null): CapturedSelection | null {
  if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0).cloneRange();
  const start = range.startContainer,
    end = range.endContainer,
    a = range.startOffset,
    b = range.endOffset;
  const items = snapshotRange(range);
  return {
    items,
    matches() {
      if (!sel.rangeCount || sel.isCollapsed) return false;
      const current = sel.getRangeAt(0);
      if (
        current.startContainer !== start ||
        current.endContainer !== end ||
        current.startOffset !== a ||
        current.endOffset !== b
      )
        return false;
      const live = snapshotRange(current);
      return (
        live.length === items.length &&
        items.every((snapshot, index) => {
          const actual = live[index]!;
          return (
            actual.node === snapshot.node &&
            actual.node.isConnected &&
            actual.parent === snapshot.parent &&
            actual.value === snapshot.value &&
            actual.start === snapshot.start &&
            actual.end === snapshot.end
          );
        })
      );
    },
  };
}
