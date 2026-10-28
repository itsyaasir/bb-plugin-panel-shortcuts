---
name: panel-shortcuts
description: Configure or troubleshoot the Panel Shortcuts plugin's thread-header buttons.
---

# Panel Shortcuts

In Settings → Plugins → Panel Shortcuts, check or uncheck pages under
Pinned panel pages. Pins save automatically and appear in every thread header.
The declarative setting toggles the shortcut row. Buttons use icons with tooltips.

Browser, Terminal, and VS Code are pinned by default. Open a thread's right
panel → New tab once to discover other installed actions. Fixed panel views
are discovered when their panel is shown. Return to the plugin's settings to
pin them. Browser requires BB Desktop; actions follow their native availability.

Opening a shortcut reveals that thread's panel and activates BB's native
launcher or fixed view. Terminal starts a terminal as the native action does.
This plugin uses a contained DOM adapter because SDK 0.6.79 limits panel
opening to the calling plugin. If an update breaks opening, inspect
panel-adapter.ts against the current app controls and verify split-pane
isolation. Native page ids are persisted with their labels; disabled or removed
pages can be unpinned. No private BB imports or page implementations are used.
