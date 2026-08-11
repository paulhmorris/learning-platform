declare global {
  interface Window {
    __translationSafeDomInstalled?: boolean;
  }
}

/**
 * Chrome's auto-translate rewrites text nodes into its own `<font>` wrappers, re-parenting nodes
 * React still tracks at their original locations. React's next commit then calls
 * `removeChild`/`insertBefore` against the wrong parent, the browser throws `NotFoundError`, and the
 * nearest error boundary takes over. Falling back to the node's real parent lets the commit finish
 * against the translated DOM instead of crashing the page.
 */
export function installTranslationSafeDom() {
  if (typeof window === "undefined" || typeof Node !== "function") return;
  if (window.__translationSafeDomInstalled) return;
  window.__translationSafeDomInstalled = true;

  // Deliberately unbound — both are re-invoked with an explicit `this` via `.call`.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { removeChild, insertBefore } = Node.prototype;

  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      child.parentNode?.removeChild(child);
      return child;
    }
    return removeChild.call(this, child) as T;
  };

  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, child: Node | null): T {
    if (child && child.parentNode !== this) {
      return insertBefore.call(this, node, null) as T;
    }
    return insertBefore.call(this, node, child) as T;
  };
}
