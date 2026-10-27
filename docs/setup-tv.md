# Putting it on a TV

> **Public fork note.** This repository contains the web launcher only. The Home/startup changes
> in Part 2 were made on the tested TV with device-specific root tooling and a boot stub; that
> tooling, its certificates and the per-device baseline are not published here. Part 1 works as an
> ordinary web app without them.

This guide has two halves. The first installs the launcher as an ordinary web app, which is
reversible by uninstalling it. The second records the Home and power-on setup used on the tested
TV; it is not a copyable public procedure. Read Part 2 completely before changing anything.

## Tested device

| | |
| --- | --- |
| Model | `QE65QN95AATXXU` (2021 Neo QLED, platform `21_NIKEM2_QTV`) |
| Software | `T-NKM2DEUC-2310.0` (build `T-NKM2DEUC-REL-202607211844`, 2026-07-21) |
| Platform | Tizen 6.0.0, armv7 / 32-bit |
| Web engine | `chromium-efl 0.3.63120` — Chromium 110.0.5415.0 / 120.0.6099.5; stock `1.1.76` (Chromium 76) preload untouched |
| Launcher | `TvLaunch01.Launcher`, package `TvLaunch01`, version 0.6.25 |
| Home / startup | `TvLaunch01.Launcher`, via the app-context DB and vconf; `ghservice` boot stub |
| Access | Developer Mode on; per-command root relay; SMACK `User` scope |

No compatibility claim for any other model, year or firmware. The upstream Arn0 reference was a
Q70B on Tizen 6.5; this fork's tested device is a different model and Tizen version. Tizen 7/8/9
TVs, The Frame, and other regions' firmware are untested here.

## Part 1 — install the launcher

Prerequisites: Node.js 20+, and the TV in Developer Mode on the same network.

1. Build the package:

   ```sh
   npm run build          # -> dist/arn0-launcher.wgt
   ```

2. Install it. On this TV the signed WGT was pushed to `/tmp` and installed with `pkgcmd` over the
   root relay. On an ordinary TV, use Apps2Samsung's **Custom WGT File** option or Tizen Studio's
   CLI instead.

   The app id is `TvLaunch01.Launcher`; the package id is `TvLaunch01`. Use the same Samsung author
   certificate when updating. If an update reports an author-certificate mismatch, preserve the
   current install and fix signing consistency before uninstalling, since uninstalling clears the
   launcher's saved settings.

3. Open it from the Samsung app list and check it works: apps launch, HDMI tiles switch inputs,
   Settings saves across a restart.

Stop here if you only want the dashboard. You can open it manually from the app list forever and
nothing about the TV's own behaviour has changed. **Part 2 is not required for the launcher to
work** — it only removes the manual step.

## Part 2 — Home button and power-on (tested TV)

**This is not a public, copyable procedure.** The table below records what changed on
`QE65QN95AATXXU`; the scripts, relay, certificates and baseline are not in this repository.

There is no public web-app API for assigning the remote's Home button or first-screen app. On this
TV the Home key and first-screen values live in Samsung's app-context database and vconf, and boot
is triggered by the `com.samsung.tv.ghservice` service slot. The changes were made with the TV's
per-command root relay and then verified by reading the values back.

| Setting | Stock | On this TV |
| --- | --- | --- |
| `key_filter` `XF86Home` in `/opt/dbspace/.app-context.db` | `package:com.samsung.tv.csfs`, args `entry_point:smarthub_key` | `package:TvLaunch01.Launcher` (args unchanged) |
| `db/appfw/home_appid` (vconf) | `org.tizen.tv-viewer` | `TvLaunch01.Launcher` |
| `db/appfw/booting_appid_backup` (vconf) | `org.tizen.tv-viewer` | `TvLaunch01.Launcher` |
| `db/first_screen/type` (vconf) | `com.samsung.tv.csfs` | `TvLaunch01.Launcher` |
| `main` app-control operation | `WykOS4t4F0.cmsWebApp` | `TvLaunch01.Launcher` |
| `com.samsung.tv.ghservice` slot | stock DLL | 5,632 B stub; `app_onboot='true'`; calls `aul_launch_app("TvLaunch01.Launcher")` |

The boot manager still foregrounds `org.tizen.tv-viewer` first; the `ghservice` stub launches the
launcher afterwards. The stock Chromium 76 preload remains untouched; boot mounts the Chromium
110/120 image from `/opt`.

Things worth knowing before touching any of this:

- Install the launcher before mapping the Home key. Updating the app preserves its settings;
  uninstalling clears them.
- The upstream Q70B native helper (`Arn0HomeQuery` / `Arn0HomeControl`, UID 901, firmware
  `T-PTMDEUC`, app id `Arn0Lnchr0.Launcher`) is **not used on this TV** and does not apply. Do not
  substitute it for the method above.
- If you repeat this on another TV, find the equivalent keys read-only, save a baseline off the
  TV, write with a read-back and automatic rollback, and keep a route back to the TV's own menus.
  Do not copy this device's values as your own.
- The root tooling is deliberately outside the public repo. The firmware guard, certificates,
  relay token and baseline are device-specific.

## Recovery

- **Home goes somewhere unexpected.** Use the launcher's **Settings → Samsung Home** entry, which
  opens `com.samsung.tv.csfs` and puts TV settings one press away. Keeping that entry is the route
  back.
- **The launcher misbehaves.** Restore the stock `ghservice` DLL and the five Home/startup values
  from the baseline you saved off the TV. Do not rely on uninstalling an app that is still assigned
  as Home to recover automatically.
- **You cannot reach the TV over the relay or developer connection.** Use Samsung's documented
  consumer support/recovery path for the exact model. Do not enter the service menu or perform a
  factory reset based only on this guide.
- **A firmware update can overwrite any of this.** These are undocumented platform preferences,
  not an API with a compatibility promise. Re-check the values after an update.

## If you are forking this

Part 1 transfers to another Tizen TV with modest effort. Part 2 transfers only as a *method*:
find the keys read-only, save a baseline, write the values with read-back, keep an automatic
rollback, and keep a route back to the TV's own menus. The app id, firmware string, Home mapping
and boot stub are specific to this device and must become yours deliberately.

The public repo intentionally contains no native helper, root tooling, certificates or device
baseline. A coding agent can help with the browser preview and launcher work; it needs access to
the actual TV for Part 2, and it should query before it controls.
