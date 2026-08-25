# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TeleFrame is a digital picture frame: an Electron app that runs fullscreen on a
Raspberry Pi and shows photos/videos people send to a Telegram bot. There is no
build step, no bundler and no test suite — the JS in `js/` is loaded directly by
Electron (main process) and by `index.html` (renderer).

The current branch `rpi4-trixie` is the version-4 modernization (Node 22.12+,
Electron 43, Telegraf 4, Raspberry Pi OS 12/13 with a Wayland/labwc session,
systemd user service instead of pm2). Most non-obvious code in the repo exists
because of that platform move; the comments explaining *why* are load-bearing —
keep them when touching those lines.

## Commands

```bash
npm install                      # also runs tools/install.js (chmod scripts, pre-fetch Electron binary)
npm start                        # -> tools/teleframe.sh, full GUI
npm run botonly                  # -> botonly.js, bot without Electron (Pi Zero / headless)

bash tools/install_service.sh    # install ~/.config/systemd/user/teleframe.service + labwc autostart
systemctl --user restart teleframe
journalctl -t teleframe -f       # NOT --user-unit=teleframe.service (see below)

tools/addon_control.sh status                    # list addons and enabled state
tools/addon_control.sh enable|disable|remove <addonDir>
tools/addon_control.sh config <addonDir> <key> <value>
```

Always start via `npm start` / `tools/teleframe.sh`, never `electron .`:
Chromium resolves its Ozone platform before `main.js` runs, so
`--ozone-platform=wayland` has to be a real argv entry. `app.commandLine.appendSwitch()`
in `main.js` is too late and silently ignored — on a Pi under Wayland the window
then never appears ("Could not create a backing OpenGL context"). Override the
platform with `TELEFRAME_OZONE_PLATFORM=x11|wayland` if needed.

Over SSH the launcher needs the session environment:
`XDG_RUNTIME_DIR=/run/user/$(id -u) WAYLAND_DISPLAY=wayland-0 npm start`.

There are no tests and no linter. Verify changes by running the app and reading
the log.

## Architecture

**Main process** (`main.js`) wires everything up inside `createWindow()` and
passes the collaborators in by hand — there is no DI container or module
registry, so following a feature means following those constructor arguments:

- `js/configuration.js` → exports `{config, screen}`; loaded first, everything
  else takes `config` as an argument.
- `js/imageWatchdog.js` → owns the `images` array and `<imageFolder>/images.json`;
  handles new/starred/deleted images and enforces `imageCount`.
- `js/bot.js` (Telegraf) → downloads assets, calls `imageWatchdog.newImage(...)`.
- `js/inputHandler.js`, `js/voiceRecorder.js` → `globalShortcut` registration.
- `js/schedules.js` → node-schedule jobs that run the `screen.cmdBacklightOn/Off`
  commands from the screen config.
- `js/systemCommands.js` → runs arbitrary shell commands requested by the renderer.
- `js/addonInterface.js` → singleton, loaded before the rest so addons can see
  `teleFrame-ready`.

**Renderer** (`js/renderer.js`, ~860 lines) is the whole UI: slideshow, touch
gestures, sweetalert2 dialogs, and the touch bar (`js/touchBar.js`). It runs with
`nodeIntegration: true` / `contextIsolation: false` and reaches into the main
process through `@electron/remote`: `remote.getGlobal("images" | "config" | "rendererLogger")`.
`global.images` is therefore *the same array object* the imageWatchdog mutates —
the renderer sees mutations without any message passing, and IPC is only used for
notifications. Do not replace that array with a new one on either side.

**IPC contract** — the valid names are the two lists at the top of
`js/addonInterface.js`:

- `validInputEvents` (main → renderer, `emitter.send(...)`): `next`, `previous`,
  `pause`, `play`, `playPause`, `newest`, `delete`, `star`, `mute`, `reboot`,
  `shutdown`, `record`, `askConfirm`, `askCancel`, `messageBox`,
  `imagesUpdated`, `reloadRenderer`.
- `validListenEvents` (renderer → main, and fired directly by main-process code
  via `addonInterface.executeEventCallbacks(name, ...args)`): `renderer-ready`,
  `images-loaded`, `teleFrame-ready`, `starImage`, `deleteImage`, `newImage`,
  `paused`, `muted`, `screenOn`, `changingActiveImage`, …

`AddonInterface` installs an `ipcMain.on()` listener for every listen event, so
adding an event means adding it to that list, otherwise addons can never receive
it. Addons live in `addons/<name>/index.js`, are `require`d by directory name,
run in the main process, and either export a function or a class extending
`AddonBase`. See `addons/README.md` and `addons/examples/`.

## Configuration model

`js/defaultConfig.js` is the single source of truth for defaults and their
documentation. `js/configuration.js` merges `config/config.json` on top of it
(deep merge for plain objects, arrays replaced wholesale) and exports the merged
object. Consequences:

- `config/config.json` is gitignored, holds a real bot token, and should only
  contain *deviations* from the defaults. `config/config.example.json` is the
  tracked sample.
- `config.writeConfig()` rewrites `config.json` with only the values that differ
  from `defaultConfig` — `tools/addon_control.sh` calls it, so hand-formatting or
  commenting that file will not survive an addon config change.
- New options go in `defaultConfig.js` (with a comment), in the README options
  table, and — if user-visible text — in `config/i18n/`.

**Texts** are not in the config: `js/initLanguage.js` populates `config.phrases`
from `config/i18n/<lang>.js` (falling back to `$LANG`, then `en.js`), and
`js/botReply.js` picks `config/i18n/bot/<lang>.js` per Telegram sender using
`ctx.from.language_code`. Both merge onto the English file, so a translation may
be partial.

**Screens**: `config.screenConfig` points at a file in `config/screens/` that
exports shell commands (`cmdBacklightOn/Off`, `cmdInit`) plus an optional
`init(options, logger)`. `screenSwitchOptions` is passed to it. See
`config/screens/README.md`.

## Platform gotchas worth knowing before you edit

- **Image paths are stored relative** (`images/<ms>.jpg`) in `images.json`, but
  `image-downloader` v4 resolves a relative `dest` against its own package
  directory — `js/bot.js` passes `path.resolve(imagePath)` to the downloader and
  keeps the relative path everywhere else. Keep that split.
- **Telegraf 4 filters**: `message('photo','video','document')` requires *all*
  keys and matches nothing; the code uses `anyOf(message('photo'), …)`.
- **`globalShortcut` is a no-op on Wayland.** Failing registrations are logged as
  warnings only — the renderer binds the same keys via DOM `keydown`
  (`ACCELERATOR_KEY_MAP` in `js/renderer.js`). Keyboard changes must be made in
  both places.
- **journald**: Chromium moves its browser process into its own systemd scope, so
  unit-filtered logs lose most lines. The unit sets `SyslogIdentifier=teleframe`;
  use `journalctl -t teleframe`. The unit also needs `KillMode=mixed`, otherwise
  `systemctl --user stop` leaves it "failed".
- **labwc config files replace, not merge.** `tools/install_service.sh` copies
  `/etc/xdg/labwc/autostart` before appending to the user file; the same applies
  to `rc.xml` (README, "Pinning TeleFrame to one display").
- The legacy Pi tooling is gone: no `tvservice`, no WiringPi `gpio` (use
  `pinctrl`, BCM numbering), backlight sysfs moved, LEDs are `ACT`/`PWR` not
  `led0`/`led1`. Every such access is guarded so a missing device cannot stop
  startup — keep new ones guarded too.
- `botonly.js` duplicates a cut-down ImageWatchdog on purpose (no Electron, no
  addon interface). Changes to the image bookkeeping usually need to be made in
  both files.

## Style

Existing code is ES2015-ish, `var`/`self = this`, 2-space indent, semicolons,
`module.exports` under a
`/*** DO NOT EDIT THE LINE BELOW ***/` marker. Match the surrounding file rather
than modernizing it. Comments in this repo explain platform quirks and API
migrations — write new ones in the same spirit and do not delete existing ones as
"noise".
