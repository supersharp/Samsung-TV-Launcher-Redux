# Fork changes

This repository is a fork of the Arn0 launcher (MIT) described in [the launcher README](../README.md).
It keeps the upstream 1920×1080, remote-only web app, and changes the Home composition, the input
row, and the screen saver. The deployed package is `TvLaunch01.Launcher` **0.6.22** on a Samsung TV
(Tizen 6.0, Chromium 110/120 web engine).

The upstream sections of `README.md` are retained so the original design notes still make sense.
This document is the comparison: what is new, what changed, and what is deliberately not here.

## At a glance

| Area | Upstream Arn0 launcher | This fork |
| --- | --- | --- |
| Home composition | Clock, apps shelf, consoles shelf; section headings | Hero + low rails, static rose/violet veil, smaller clock, **Connected Devices** label |
| Home apps | Upstream defaults | TizenTube shown as "YouTube", AirPlay, All apps |
| HDMI row | Only consoles configured in `config.js` | Configured devices **plus** live HDMI ports discovered from `VIDEOSOURCE` |
| Detected inputs | — | Shown as `HDMI n`; adopt/named from Settings ▸ Connected Devices |
| Input status | Dot on configured tiles | Same dot; discovery refreshes on Home and every 30 s |
| Screen saver motion | Slow `translate()` pan | Breathing zoom, amount and speed configurable |
| Photo transition | 2 s crossfade | Dark fade (default) or crossfade; depth and duration configurable |
| Photo source | Follows Background | All wallpapers (default) or Same as Background |
| Screen-saver settings | Presets only | Presets + a **Custom…** number field for every numeric value |
| Settings layout | Fixed page | Scrollable screen-saver page with remote-following focus |
| Weather | `config.js` only | Settings ▸ Weather with coordinates, units, refresh interval, Home + screen-saver reading, optional local presets |
| Brand marks | Upstream set | Adds Apple, Wii U, Windows, Linux and USB |
| Native Home helper | Guarded helper in upstream `native/` | Not published here; local-only (see **What is not committed**) |
| Package version | 0.2.0 | 0.6.22 |

## Home screen

- **Hero restyle.** The Home view is a full-bleed photo with a static two-stop veil, a smaller
  clock, two low shelves, a **Connected Devices** label above the input row, and a restrained focus
  ring. Everything is scoped to `#home`, so Settings tiles and the All-apps grid keep their upstream
  sizes.
- **Curated Home apps.** `config.js` ships TizenTube (labelled "YouTube") and AirPlay. Xbox,
  TizenBrew and Samsung TV Plus were removed from Home; TV Plus is disabled at TV level. TizenBrew
  remains in All apps.
- **Live HDMI outputs.** Upstream only showed an input if it was written into `config.js`, and
  `config.js` ships `inputs: []`; a console or computer plugged into HDMI therefore did not appear.
  The fork reads `tizen.systeminfo.getPropertyValue('VIDEOSOURCE')`, filters `type === 'HDMI'`, and
  appends any connected port that is not configured as an `HDMI n` tile with a neutral glyph.
  Configured entries win; a hidden configured entry stays hidden.
- **Discovery timing.** The list is read at start-up, when Home becomes visible, and every 30 s
  while Home is on screen. A port that disappears is dropped; a new one appears without a restart.
- **Adopting a detected port.** Settings ▸ Connected Devices lists detected ports as
  **Detected · connected**. Opening one creates a normal device entry and opens the rename dialog,
  so it can be named (for example "Games console"), given a logo, and assigned an open method.
- **Focus stability.** Re-rendering after discovery keeps the focused input tile when possible; a
  periodic status refresh that only changes a dot does not rebuild the row.

## Screen saver

### Motion

Upstream deliberately panned instead of zooming because its reference engine re-rasterised a scaled
layer in visible steps. This fork runs the upgraded engine and uses a **breathing zoom**:

- scale runs from `1.00` to `1 + Zoom amount / 100` and back, repeating;
- each leg takes `Zoom speed` seconds;
- a small sideways drift keeps the centre of the picture from being static;
- the photo layer is laid out slightly larger than the screen so the zoom and drift never show an
  edge; the layer was reduced from the old pan-sized 2240×1260 to 2064×1176 when the drift became
  smaller, which also sharpens the photo and costs less to composite.

The defaults are **9 %** and **16 s per leg**. Both are settings.

### Transitions

- **Dark fade** (default): the picture dims to **Fade to black** (default 100 %) over half the
  transition, the photo is swapped under the dark layer, and the other half reveals it. The clock and
  caption sit above the dark layer, so they stay readable throughout.
- **Crossfade**: the outgoing and incoming photos overlap directly.
- **Transition time** is the total change time (default 4 s; presets 2/4/6 s). For Dark fade, half is
  down and half is up.
- Caption and text nudge happen when the new photo is actually revealed, not when the fade starts,
  so the title never describes a picture that is still fading in.
- The incoming photo's opacity is committed at the swap before the zoom transition is restored;
  otherwise it would fade in a second time after the black cleared.

### Photos and timing

- **Photos** defaults to **All wallpapers**, so the screen saver is a slideshow regardless of what
  Home is showing.
- **Same as Background** restores the upstream behaviour: Off shows only the clock, Photo holds the
  chosen picture, Rotate cycles.
- **Change photo every** is 60/75/90 s or 2/5 min (default 75 s). The screen saver keeps its own
  index and never writes the wallpaper Home comes back to.
- **Start after** and **Go dark after** have their upstream presets and custom minutes.
- **Why a saved 60 s interval did nothing upstream:** the saved `wallpaper.mode` was `photo`, so the
  screen saver followed Home and held one picture. With Photos = All wallpapers, the interval now
  works; the saved 60 s value needed no migration.

### Custom numbers

Every numeric row ends with **Custom…**. It opens the same on-screen-keyboard dialog the console
renamer uses, accepts one decimal place, and validates a range:

| Setting | Range | Default |
| --- | --- | --- |
| Start after | 1–60 min | 5 min |
| Change photo every | 10–3600 s | 75 s |
| Transition time | 0.5–30 s | 4 s |
| Fade to black | 0–100 % | 100 % |
| Zoom amount | 0–40 % | 9 % |
| Zoom speed | 1–120 s per leg | 16 s |
| Go dark after | 0–720 min (0 = never) | 60 min |

Custom values are stored as plain numbers in the same pref as the preset keys, so a custom value
survives restarts and in-place updates. A number outside the range keeps the dialog open with a
toast.

The Screen saver page now scrolls inside its own viewport; focus moves the page so the focused row
stays visible. This was required once the motion and timing rows were added.

## Weather

- **Settings ▸ Weather** stores latitude and longitude in `arn0.prefs.v1`, overriding any defaults
  in `config.js` / `config.local.js`.
- Latitude accepts −90…90 and longitude −180…180, four decimal places, through the same number
  dialog as the screen-saver timings. Units are Celsius or Fahrenheit, with Refresh now and Clear
  coordinates.
- Optional named presets in `config.local.js` appear as rows above Latitude; selecting one sets
  both coordinates. They are local to the TV and are not part of the public repository.
- The reading appears under the Home clock and in the screen-saver corner; both update when a fetch
  succeeds. The Weather page's Refresh now row shows the current reading, or No reading yet.
- **Refresh every** is 15/30/60/180 min or a Custom 5–180 min value. A once-a-minute poll while the
  app is visible checks the interval; returning to the app triggers the same check. Refresh now
  forces a request regardless of the interval.
- The coordinates and unit invalidate the cached reading when changed, so Home and the screen saver
  cannot show the previous location's weather.
- The Open-Meteo request and the three-hour staleness rule are unchanged from upstream; the hourly
  freshness rule is now the settable refresh interval.

## Brand marks

- **Apple** (`src/img/marks/apple.svg`, recoloured white by `scripts/build-marks.mjs`).
- **Wii U** (`src/img/marks/wiiu.svg`, copied as-is because its grey/blue colours are part of the
  mark).
- **Windows** (`src/img/marks/windows.svg`, copied as-is: blue).
- **Linux** (`src/img/marks/linux.svg`, copied as-is: Tux).
- **USB** (`src/img/marks/usb.svg`, recoloured white at build time).

All are selectable per input in Settings ▸ Connected Devices ▸ Logo. Trademarks belong to their
owners; see `src/img/marks/SOURCES.md`.

## Settings, data, and persistence

- Everything is still stored in the TV's `localStorage` under `arn0.prefs.v1`; settings survive
  restarts and in-place updates, not an uninstall.
- New screen-saver and weather keys are additive. Existing installs without `source`, `fadeDepth`,
  `zoomAmount`, `zoomSpeed`, the custom values or `weather` get the defaults, so an update does not
  reset the user's existing choices.
- `config.local.js` remains the per-TV overlay for weather defaults and a development-log address;
  Settings ▸ Weather is the on-TV alternative for coordinates. It is gitignored and is not part of
  the public repository.

## Packaging and permissions

- App identity is still `TvLaunch01.Launcher`, package `TvLaunch01`; the Home-button mapping targets
  that id, so it was not changed.
- No new Tizen privileges were added. HDMI discovery uses the existing `tv.window` and
  `systeminfo` access; the UI uses the existing `application.launch`, `application.info`,
  `tv.inputdevice` and `tv.window` privileges.
- The signed `.wgt` is produced outside the repository with a Samsung developer certificate and is
  installed with `pkgcmd` over the relay. Signing material is never committed.
- The fork uses `scripts/build-marks.mjs` to regenerate `src/img/tiles/` from the source marks. The
  added Apple, Wii U, Windows, Linux and USB marks live in `src/img/marks/`, not directly in the
  generated tiles folder.

## What is not committed (sanitisation)

The public fork intentionally excludes the following:

- the **native Home/startup helper** (`native/`) and its per-device baseline — the launcher works
  installed as an ordinary web app without it;
- `dist/` and every signed or unsigned `.wgt`/`.tpk`;
- `src/js/config.local.js` (per-TV coordinates/devlog address);
- the relay token, certificates, private keys, passwords, TV IP addresses, device serials and
  firmware guards;
- personal photos and audio for the hidden game (`src/img/easter-egg/`, `src/audio/`).

The public README and setup guide describe the web app; the native half of `docs/setup-tv.md` is
retained from upstream for reference and is not a runnable procedure in this fork.

The fork is committed under the **supersharp** GitHub handle with a `users.noreply.github.com`
address, so the contributor is credited without publishing a personal email address.

## What is unchanged

- 1920×1080 stage, remote-only navigation, focus behaviour and the existing key map.
- Tizen app/input APIs, the browser mock (`tizen-mock.js`), the dev log, the weather widget and the
  render/platform probes.
- The upstream MIT licence and the upstream documentation, except where this document explicitly
  describes a change.

## Upstream credit

Upstream: **Arn0 launcher**, MIT. The original README, setup guide, layout notes and performance
measurements are retained in this repository. Brand marks that come from Simple Icons (CC0) and
Custom Brand Icons (MIT) keep their own terms; see `src/img/marks/SOURCES.md`.
