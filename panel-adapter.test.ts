// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountAdapter, openPage, scanPages } from "./panel-adapter";

let controller: AbortController;
let dispose: () => void;
const launcher = '<button data-panel-new-tab>New tab</button>';
const action = (id = "vscode", label = "VS Code", disabled = false) =>
  `<div data-testid="new-tab-actions"><button data-panel-new-tab-item id="${id}" ${disabled ? "disabled" : ""}><span class="truncate">${label}</span><kbd>⌘T</kbd></button></div>`;

beforeEach(() => {
  controller = new AbortController();
  document.body.innerHTML = '<main data-split-pane-id="one"><div id="shortcut"></div></main>';
  dispose = mountAdapter(controller.signal);
});
afterEach(() => { controller.abort(); dispose(); document.body.innerHTML = ""; vi.useRealTimers(); });
const source = () => document.getElementById("shortcut")!;
const root = () => document.querySelector("main")!;
const page = { id: "vscode", label: "VS Code", kind: "action" as const };

describe("panel adapter", () => {
  it("discovers actions and fixed views, excluding recents, reorder and close controls", () => {
    root().insertAdjacentHTML("beforeend", action() + `
      <button data-panel-new-tab-item id="recent">secret.txt</button>
      <div aria-label="Right panel views">
        <button aria-pressed="true" aria-label="Show thread info panel">Info</button>
        <button aria-pressed="false" aria-label="New tab">New tab</button>
        <button aria-label="Close VS Code">Close</button>
      </div>`);
    expect(scanPages(document)).toEqual([
      page,
      { id: "Show thread info panel", label: "Info", kind: "view" },
    ]);
  });

  it("opens a closed panel and activates an asynchronously rendered action", async () => {
    const activated = vi.fn();
    root().insertAdjacentHTML("beforeend", '<div data-thread-header-pane-actions><button aria-expanded="false" aria-label="Show right panel (⌘ J)">Show</button></div>');
    root().querySelector("button")!.onclick = () => {
      root().insertAdjacentHTML("beforeend", launcher);
      root().querySelector<HTMLButtonElement>("[data-panel-new-tab]")!.onclick = () => {
        queueMicrotask(() => {
          root().insertAdjacentHTML("beforeend", action());
          document.getElementById("vscode")!.onclick = activated;
        });
      };
    };
    await openPage(source(), page);
    expect(activated).toHaveBeenCalledOnce();
  });

  it("captures the native icon instead of guessing from an action's name", () => {
    root().insertAdjacentHTML("beforeend", '<div data-testid="new-tab-actions"><button data-panel-new-tab-item id="plugin-action:handoff:handoff"><span data-icon-root data-icon="ArrowRight02"></span><span class="truncate">Hand off</span></button></div>');
    expect(scanPages(document)).toEqual([{ id: "plugin-action:handoff:handoff", label: "Hand off", kind: "action", icon: "ArrowRight02" }]);
  });

  it("keeps the owning plugin for asset-backed icons", () => {
    root().insertAdjacentHTML("beforeend", '<div data-testid="new-tab-actions"><button data-panel-new-tab-item id="plugin-action:custom:open"><span data-icon-root data-icon="custom/logo" data-plugin-icon-asset="custom"></span><span class="truncate">Custom</span></button></div>');
    expect(scanPages(document)).toEqual([{ id: "plugin-action:custom:open", label: "Custom", kind: "action", icon: "custom/logo", iconPluginId: "custom" }]);
  });

  it("captures fixed-view icons and excludes the keyboard binding from identity", () => {
    root().insertAdjacentHTML("beforeend", '<div aria-label="Right panel views"><button aria-pressed="false" aria-label="Show diff panel (⌘ D)"><span data-icon-root data-icon="FileDiff"></span>Diff</button></div>');
    expect(scanPages(document)).toEqual([{ id: "Show diff panel", label: "Diff", kind: "view", icon: "FileDiff" }]);
  });

  it("opens a fixed view directly without creating a new tab", async () => {
    const activated = vi.fn();
    root().insertAdjacentHTML("beforeend", '<div aria-label="Right panel views"><button aria-pressed="false" aria-label="Show thread info panel">Info</button></div>');
    root().querySelector("button")!.onclick = activated;
    await openPage(source(), { id: "Show thread info panel", label: "Info", kind: "view" });
    expect(activated).toHaveBeenCalledOnce();
  });

  it("finds BB's shared right panel beside the chat pane", async () => {
    const activated = vi.fn();
    document.body.innerHTML = '<div id="layout"><div id="thread-detail-timeline-panel"><main data-split-pane-id="one"><div id="shortcut"></div></main></div><div id="thread-detail-secondary-panel">' + launcher + action() + '</div></div>';
    document.getElementById("vscode")!.onclick = activated;
    await openPage(source(), page);
    expect(activated).toHaveBeenCalledOnce();
  });

  it("resolves the provisional VS Code default by its native label", async () => {
    const activated = vi.fn();
    root().insertAdjacentHTML("beforeend", launcher + action());
    document.getElementById("vscode")!.onclick = activated;
    await openPage(source(), { ...page, id: "default:vscode" });
    expect(activated).toHaveBeenCalledOnce();
  });

  it("does not launch disabled actions", async () => {
    root().insertAdjacentHTML("beforeend", launcher + action("vscode", "VS Code", true));
    const activated = vi.fn();
    document.getElementById("vscode")!.onclick = activated;
    await expect(openPage(source(), page)).rejects.toThrow("unavailable");
    expect(activated).not.toHaveBeenCalled();
  });

  it("never launches an action in a different thread pane", async () => {
    vi.useFakeTimers();
    root().insertAdjacentHTML("beforeend", launcher);
    document.body.insertAdjacentHTML("beforeend", '<main data-split-pane-id="two">' + action() + '</main>');
    const activated = vi.fn();
    document.getElementById("vscode")!.onclick = activated;
    const promise = openPage(source(), page);
    const rejection = expect(promise).rejects.toThrow("unavailable");
    await vi.advanceTimersByTimeAsync(2600);
    await rejection;
    expect(activated).not.toHaveBeenCalled();
  });

  it("cancels pending opening on plugin deactivation", async () => {
    const promise = openPage(source(), page);
    const rejection = expect(promise).rejects.toThrow("cancelled");
    controller.abort();
    await rejection;
  });
});
