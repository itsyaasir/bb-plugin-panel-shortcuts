import { describe, expect, it } from "vitest";
import { MAX_PAGES, upsertPage, type PanelPage } from "./pages";

describe("discovered page merging", () => {
  const page: PanelPage = { id: "github", label: "GitHub PR", kind: "action", icon: "Github" };

  it("preserves captured icons when a client sends only page identity", () => {
    const pages = new Map([[page.id, page]]);
    upsertPage(pages, { id: page.id, label: "Updated label", kind: "action" });
    expect(pages.get(page.id)).toEqual({ ...page, label: "Updated label" });
  });

  it("updates known pages at capacity and refuses additional pages", () => {
    const pages = new Map(Array.from({ length: MAX_PAGES }, (_, index) => {
      const item = { ...page, id: String(index) };
      return [item.id, item] as const;
    }));
    upsertPage(pages, { ...page, id: "0", icon: "Code" });
    upsertPage(pages, page);
    expect(pages.size).toBe(MAX_PAGES);
    expect(pages.get("0")?.icon).toBe("Code");
    expect(pages.has(page.id)).toBe(false);
  });
});
