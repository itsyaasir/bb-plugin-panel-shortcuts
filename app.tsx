import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { definePluginApp, useRealtime, useRealtimeConnectionState, useRpc, useSettings } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { rpcContract, ShortcutConfig } from "./server";
import { displayLabel, type PanelPage } from "./pages";
import { getCatalog, mountAdapter, openPage, subscribe } from "./panel-adapter";
import { PageIcon } from "./page-icon";
import { Button } from "./components/ui/button";

function reportError(cause: unknown): void {
  toast.error(cause instanceof Error ? cause.message : String(cause));
}

function useConfig() {
  const rpc = useRpc<typeof rpcContract>();
  const [config, setConfig] = useState<ShortcutConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const discovered = useSyncExternalStore(subscribe, getCatalog);
  const connection = useRealtimeConnectionState();
  const refresh = useCallback(() => {
    rpc.call("get").then((value) => { setConfig(value); setError(null); },
      (cause) => setError(String(cause)));
  }, [rpc]);
  useEffect(refresh, [refresh, connection]);
  useRealtime("changed", refresh);
  useEffect(() => {
    if (!discovered.length) return;
    let active = true;
    rpc.call("discover", { pages: discovered }).then((value) => { if (active) setConfig(value); },
      (cause) => { if (active) setError(String(cause)); });
    return () => { active = false; };
  }, [rpc, discovered]);
  return { rpc, config, setConfig, error, refresh };
}

function Shortcuts() {
  const { config } = useConfig();
  const { values } = useSettings();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const open = async (page: PanelPage) => {
    if (inFlight.current || !root.current) return;
    inFlight.current = true;
    setBusy(true);
    try { await openPage(root.current, page); }
    catch (cause) { reportError(cause); }
    finally { inFlight.current = false; setBusy(false); }
  };
  if (values?.enabled === false || !config) return null;
  const pages = config.pinned.flatMap((id) => config.pages.filter((page) => page.id === id));
  if (!pages.length) return null;
  return <Tooltip.Provider delayDuration={200}>
    <div ref={root} className="flex h-7 min-w-0 max-w-full items-center gap-0.5" aria-label="Panel shortcuts">
      {pages.map((page) => <Tooltip.Root key={page.id}>
        <Tooltip.Trigger asChild>
          <button type="button" aria-label={`Open ${displayLabel(page)} panel`} disabled={busy}
            className="flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-state-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            onClick={() => void open(page)}>
            <PageIcon page={page} className="size-3.5 shrink-0" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content side="bottom" sideOffset={6} collisionPadding={8}
            className="z-50 rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md">
            {displayLabel(page)}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>)}
    </div>
  </Tooltip.Provider>;
}

function ShortcutSettings() {
  const { rpc, config, setConfig, error, refresh } = useConfig();
  const [pending, setPending] = useState(false);
  const pin = async (id: string, pinned: boolean) => {
    setPending(true);
    try { setConfig(await rpc.call("pin", { id, pinned })); }
    catch (cause) { reportError(cause); }
    finally { setPending(false); }
  };
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Choose pages to show in every thread header. Open the right panel’s New tab once to discover additional installed pages.</p>
    {error ? <p role="alert" className="text-sm text-destructive">{error} <button type="button" onClick={refresh}>Retry</button></p> : null}
    {!config ? <p role="status">Loading shortcuts…</p> : <div className="divide-y divide-border rounded-lg border border-border px-3">
      {config.pages.map((page) => <label key={page.id} className="flex cursor-pointer items-center gap-3 py-3 text-sm">
        <input type="checkbox" checked={config.pinned.includes(page.id)} disabled={pending}
          aria-label={`Pin ${displayLabel(page)}`} onChange={(event) => void pin(page.id, event.target.checked)} />
        <PageIcon page={page} className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{displayLabel(page)}</span>
        <span className="text-xs text-muted-foreground">{page.kind === "view" ? "Panel view" : "Panel action"}</span>
      </label>)}
    </div>}
    <Button variant="outline" size="sm" onClick={refresh}>Refresh list</Button>
    <p className="text-xs text-muted-foreground">Changes save automatically. Availability depends on the current thread and installed plugins.</p>
  </div>;
}

export default definePluginApp((app) => {
  app.contentScripts.register({ id: "panel-adapter", mount: ({ signal }) => mountAdapter(signal) });
  app.slots.experimental_threadHeaderAction({ id: "shortcuts", title: "Panel shortcuts", component: Shortcuts });
  app.slots.settingsSection({ id: "pages", title: "Pinned panel pages", component: ShortcutSettings });
});
