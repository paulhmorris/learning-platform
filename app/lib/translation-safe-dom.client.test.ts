import { beforeAll, describe, expect, it } from "vitest";

import { installTranslationSafeDom } from "./translation-safe-dom.client";

describe("installTranslationSafeDom", () => {
  beforeAll(() => {
    installTranslationSafeDom();
  });

  it("removes the node from its real parent when it was re-parented", () => {
    const container = document.createElement("div");
    const elsewhere = document.createElement("div");
    const child = document.createElement("span");
    elsewhere.appendChild(child);

    expect(() => container.removeChild(child)).not.toThrow();
    expect(child.parentNode).toBeNull();
  });

  it("appends when the reference node was re-parented", () => {
    const container = document.createElement("div");
    const elsewhere = document.createElement("div");
    const reference = document.createElement("span");
    elsewhere.appendChild(reference);

    const node = document.createElement("b");
    expect(() => container.insertBefore(node, reference)).not.toThrow();
    expect(node.parentNode).toBe(container);
  });

  it("leaves valid removals unchanged", () => {
    const container = document.createElement("div");
    const child = document.createElement("span");
    container.appendChild(child);

    expect(container.removeChild(child)).toBe(child);
    expect(container.childNodes).toHaveLength(0);
  });

  it("leaves valid insertions unchanged", () => {
    const container = document.createElement("div");
    const a = document.createElement("a");
    const b = document.createElement("b");
    container.appendChild(b);
    container.insertBefore(a, b);

    expect(container.firstChild).toBe(a);
  });
});
