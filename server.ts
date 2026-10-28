import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { DEFAULT_PAGES, MAX_PAGES, upsertPage, type PanelPage } from "./pages";

const pageIdSchema = z.string().min(1).max(256);

const pageSchema = z.object({
  id: pageIdSchema,
  label: z.string().trim().min(1).max(120),
  kind: z.enum(["action", "view"]),
  icon: z.string().min(1).max(256).optional(),
  iconPluginId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(128).optional(),
}).strict();
const configSchema = z.object({
  pages: z.array(pageSchema).max(MAX_PAGES),
  pinned: z.array(pageIdSchema).max(MAX_PAGES),
});
export type ShortcutConfig = z.infer<typeof configSchema>;
export const rpcContract = defineRpcContract({
  get: { input: z.null(), output: configSchema },
  discover: { input: z.object({ pages: z.array(pageSchema).max(MAX_PAGES) }).strict(), output: configSchema },
  pin: { input: z.object({ id: pageIdSchema, pinned: z.boolean() }).strict(), output: configSchema },
});

export default function plugin(bb: BbPluginApi) {
  bb.settings.define({
    enabled: { type: "boolean", label: "Show panel shortcuts", default: true },
  });
  const read = async (): Promise<ShortcutConfig> => {
    const parsed = configSchema.safeParse(await bb.storage.kv.get("shortcuts"));
    return parsed.success ? parsed.data : {
      pages: DEFAULT_PAGES,
      pinned: DEFAULT_PAGES.map((page) => page.id),
    };
  };
  // Serialize read-modify-write operations across windows to avoid lost pins.
  let pending: Promise<unknown> = Promise.resolve();
  const write = (update: (config: ShortcutConfig) => ShortcutConfig) => {
    const next = pending.then(async () => {
      const current = await read();
      const result = configSchema.parse(update(current));
      if (JSON.stringify(current) !== JSON.stringify(result)) {
        await bb.storage.kv.set("shortcuts", result);
        bb.realtime.publish("changed", null);
      }
      return result;
    });
    pending = next.catch(() => {});
    return next;
  };
  bb.rpc.register(rpcContract, {
    get: read,
    discover: ({ pages }) => write((config) => {
      const known = new Map<string, PanelPage>(config.pages.map((page) => [page.id, page]));
      let pinned = config.pinned;
      for (const page of pages) {
        // Replace a default's provisional id once BB exposes its actual action.
        const fallback = config.pages.find((item) => item.label === page.label &&
          (item.id.startsWith("default:") || (item.kind === "view" && page.kind === "view" && item.id !== page.id)));
        if (fallback) {
          known.delete(fallback.id);
          pinned = pinned.map((id) => id === fallback.id ? page.id : id);
        }
        upsertPage(known, page);
      }
      return { pages: [...known.values()], pinned: [...new Set(pinned)] };
    }),
    pin: ({ id, pinned }) => write((config) => {
      if (!config.pages.some((page) => page.id === id)) throw new Error("Unknown panel page");
      return { ...config, pinned: pinned ? [...new Set([...config.pinned, id])] : config.pinned.filter((key) => key !== id) };
    }),
  });
}
