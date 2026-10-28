import { MAX_PAGES, upsertPage, type PanelPage } from "./pages";

// BB 0.47 / SDK 0.6.79: the public panel opener is owner-scoped. Keep the
// app-shell DOM dependency here until BB exposes cross-plugin launchers.
const ACTIONS = '[data-testid="new-tab-actions"] button[data-panel-new-tab-item][id]';
const VIEWS = '[aria-label="Right panel views"] button[aria-pressed]:not([data-tab-pill-select])';
const NEW_TAB = 'button[data-panel-new-tab]';
const WATCHED = '[data-panel-new-tab-page], [aria-label="Right panel views"]';
const listeners = new Set<() => void>();
let catalog: PanelPage[] = [];
let generationSignal: AbortSignal | undefined;

export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const getCatalog = () => catalog;

const actionLabel = (button: HTMLButtonElement) =>
  button.querySelector("span.truncate")?.textContent?.trim() ?? button.textContent?.trim();
const viewId = (button: HTMLButtonElement) => button.getAttribute("aria-label")?.replace(/\s+\([^)]*\)$/, "");

function nativeIcon(button: HTMLButtonElement): Pick<PanelPage, "icon" | "iconPluginId"> {
  const element = button.querySelector("[data-icon-root][data-icon]");
  const icon = element?.getAttribute("data-icon");
  if (!icon || icon.length > 256) return {};
  const pluginId = element?.hasAttribute("data-plugin-icon-asset")
    ? /^plugin-action:([a-z0-9][a-z0-9-]*):/.exec(button.id)?.[1] : undefined;
  return pluginId ? { icon, iconPluginId: pluginId } : { icon };
}

export function scanPages(root: ParentNode): PanelPage[] {
  const pages: PanelPage[] = [];
  for (const button of Array.from(root.querySelectorAll<HTMLButtonElement>(ACTIONS))) {
    const label = actionLabel(button);
    if (label) pages.push({ id: button.id, label, kind: "action", ...nativeIcon(button) });
  }
  for (const button of Array.from(root.querySelectorAll<HTMLButtonElement>(VIEWS))) {
    const name = viewId(button);
    const label = button.textContent?.trim();
    if (name?.startsWith("Show ") && label) pages.push({ id: name, label, kind: "view", ...nativeIcon(button) });
  }
  return pages.filter((page) => page.id.length <= 256 && page.label.length <= 120).slice(0, MAX_PAGES);
}

export function mountAdapter(signal: AbortSignal): () => void {
  generationSignal = signal;
  let scheduled = false;
  const scan = () => {
    scheduled = false;
    if (signal.aborted) return;
    const next = new Map(catalog.map((page) => [page.id, page]));
    for (const page of scanPages(document)) upsertPage(next, page);
    const pages = [...next.values()];
    if (JSON.stringify(pages) !== JSON.stringify(catalog)) {
      catalog = pages;
      for (const listener of listeners) listener();
    }
  };
  const observer = new MutationObserver((records) => {
    const relevant = records.some((record) =>
      record.target instanceof Element && record.target.closest(WATCHED) ||
      Array.from(record.addedNodes).some((node) => node instanceof Element && (node.matches(WATCHED) || node.querySelector(WATCHED))));
    if (relevant && !scheduled) { scheduled = true; queueMicrotask(scan); }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  scan();
  const dispose = () => { observer.disconnect(); };
  signal.addEventListener("abort", dispose, { once: true });
  return () => { dispose(); signal.removeEventListener("abort", dispose); };
}

function waitFor<T>(root: Node, find: () => T | null, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => { observer.disconnect(); clearTimeout(timer); signal.removeEventListener("abort", abort); };
    const check = () => {
      if (signal.aborted || !root.isConnected) { abort(); return; }
      const result = find();
      if (result) { cleanup(); resolve(result); }
    };
    const abort = () => { cleanup(); reject(new Error("Panel shortcut cancelled")); };
    const observer = new MutationObserver(check);
    const timer = setTimeout(() => { cleanup(); reject(new Error("This panel page is unavailable in the current thread.")); }, 2500);
    signal.addEventListener("abort", abort, { once: true });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    check();
  });
}

export async function openPage(source: HTMLElement, page: PanelPage): Promise<void> {
  const signal = generationSignal;
  if (!signal || signal.aborted) throw new Error("Panel shortcuts are reloading. Try again.");
  const root = source.closest<HTMLElement>("[data-split-pane-id]") ?? source.closest<HTMLElement>("main");
  if (!root) throw new Error("No thread panel found.");
  // In BB's shared-panel layout the chat pane and right panel are siblings.
  // Their nearest timeline layout contains only this thread's panel.
  const layout = source.closest<HTMLElement>('[id^="thread-detail-timeline-panel"]')?.parentElement ?? root;
  const toggle = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-thread-header-pane-actions] button[aria-expanded]'))
    .find((button) => /^(Show|Hide) right panel/.test(button.getAttribute("aria-label") ?? ""));
  if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
  // Compact panels are portalled. Never fall through to another thread pane.
  const scope = () => document.querySelector<HTMLElement>('[role="dialog"]:has([aria-label="Right panel views"])') ?? layout;
  if (page.kind === "view") {
    const button = await waitFor(root, () => Array.from(scope().querySelectorAll<HTMLButtonElement>(VIEWS))
      .find((button) => viewId(button) === page.id) ?? null, signal);
    button.click();
    return;
  }
  const launcher = await waitFor(root, () => scope().querySelector<HTMLButtonElement>(NEW_TAB), signal);
  launcher.click();
  const button = await waitFor(root, () => {
    const buttons = Array.from(scope().querySelectorAll<HTMLButtonElement>(ACTIONS));
    return buttons.find((button) => button.id === page.id) ?? (page.id.startsWith("default:")
      ? buttons.find((button) => actionLabel(button) === page.label) ?? null : null);
  }, signal);
  if (button.disabled) throw new Error(`${page.label} is unavailable in the current thread.`);
  button.click();
}
