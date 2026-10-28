# Panel Shortcuts

One-click shortcuts to BB's right-panel pages, directly in the thread header.
Browser, Terminal, and VS Code are pinned by default.

## Install

Requires BB 0.47 or later with Plugin SDK 0.6.79 or later.

```sh
bb plugin install 'git:https://github.com/itsyaasir/bb-plugin-panel-shortcuts.git@^0.1.0'
```

For a private repository, Git must already be authenticated with an account
that has access. Review and confirm BB's installation prompt. Future releases
in the same version range can be installed through BB's plugin updates.

## Configure

Open **Settings → Plugins → Panel Shortcuts**. Check or uncheck any discovered
page under **Pinned panel pages**. Shortcuts use icons with tooltips. You can hide the row.
Changes save automatically and synchronize across open windows. The icons
match BB's native panel controls; hover or focus a shortcut to see its name.

To discover additional pages, open a thread's right panel → **New tab** once.
Fixed views such as Info are discovered when the panel is shown. Pins appear
in the order selected. Browser is available in BB Desktop. Native actions
retain their behavior: Terminal starts a terminal, and VS Code opens its plugin.

## Development

```sh
npm ci
npm run typecheck
npm test
npm run build
bb plugin install .
```

The build command requires the BB CLI on your PATH. Git installs build from
source; release archives also include the prebuilt frontend and server bundles.

## Compatibility

Targets BB >=0.47 and SDK 0.6.79. The public panel API only opens a plugin's own
tabs, so `panel-adapter.ts` activates BB's existing accessible controls through
a lifecycle-managed content script. It uses no private imports. BB UI changes
may require an adapter update. Unavailable actions report an error; opening
may briefly show New tab before the chosen page appears. Shortcuts currently
appear on existing threads, including split panes.
