export interface PanelPage {
  id: string;
  label: string;
  kind: "action" | "view";
  icon?: string;
  iconPluginId?: string;
}

export const DEFAULT_PAGES: PanelPage[] = [
  { id: "file-search-result-open-browser", label: "Open browser", kind: "action", icon: "Globe" },
  { id: "file-search-result-start-terminal", label: "Start terminal", kind: "action", icon: "Terminal" },
  { id: "default:vscode", label: "VS Code", kind: "action", icon: "Code" },
];

export function displayLabel(page: PanelPage): string {
  return page.label === "Open browser" ? "Browser" : page.label === "Start terminal" ? "Terminal" : page.label;
}

export function pageIcon(page: PanelPage): string {
  return page.icon ?? DEFAULT_PAGES.find((item) => item.id === page.id)?.icon ?? "PanelRight";
}
