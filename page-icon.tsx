import { experimental_PluginIcon as PluginIcon } from "@get-bb/plugin-sdk/app";
import { Icon } from "./components/ui/icon";
import { pageIcon, type PanelPage } from "./pages";

export function PageIcon({ page, className }: { page: PanelPage; className?: string }) {
  return page.iconPluginId
    ? <PluginIcon pluginId={page.iconPluginId} icon={page.icon ?? null} className={className} />
    : <Icon name={pageIcon(page)} className={className} />;
}
