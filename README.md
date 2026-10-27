# Arn0 Launcher — TV fork

A fork of the Arn0 launcher (MIT) for a Samsung Tizen TV: a 1920×1080, remote-only web app.
Current package: `TvLaunch01.Launcher` **0.6.22**.

![The launcher home with weather under the clock and a Connected Devices row showing Windows, Linux and USB](docs/preview-home.png)

## Fork changes

- **Connected Devices** — the Home row discovers live HDMI ports from `VIDEOSOURCE` and shows
  unconfigured ones as `HDMI n`; Settings ▸ Connected Devices names, logos, opens, hides or
  reorders them.
- **Brand marks** — Apple, Wii U, Windows, Linux and USB added to the logo picker.
- **Home restyle** — hero/low-rails layout, smaller clock, and a trimmed Home row (TizenTube as
  YouTube, AirPlay, All apps).
- **Screen saver** — breathing zoom with adjustable amount and speed, Dark fade or Crossfade
  (depth and duration), 2/5 min photo intervals, and Custom numeric fields; the settings page
  scrolls with the remote.
- **Weather** — Settings ▸ Weather sets latitude/longitude, °C/°F, automatic refresh every
  15/30/60/180 min (or Custom), Refresh now and Clear. A compact reading appears under the Home
  clock and in the screen-saver corner; optional named presets can be supplied in the gitignored
  `config.local.js`.
- **The 60 s fix** — the screen saver is a slideshow by default (All wallpapers), so a photo
  interval works even when Home holds a single photo.

No new Tizen privileges.

## Preview

**Settings**

![Main Settings with Connected Devices and Weather entries](docs/preview-settings.png)

**Screen saver**

![Screen saver settings, top and scrolled views](docs/preview-screensaver.png)

**Weather**

![Weather page with the latitude number dialog](docs/preview-weather.png)

**Custom values and dark fade**

![Custom number dialog](docs/preview-custom-dialog.png)

![Dark fade between two wallpapers](docs/preview-dark-fade.png)

## Install

The app installs as an ordinary Tizen web app; the native Home/startup helper is not published
in this fork. See [docs/setup-tv.md](docs/setup-tv.md).

```sh
npm run preview   # browser preview at http://localhost:8080
npm run build     # dist/arn0-launcher.wgt (requires sh + zip)
```

Signing and deployment happen outside this repository.

## Docs

- [docs/FORK-CHANGES.md](docs/FORK-CHANGES.md) — complete upstream-vs-fork comparison.
- [docs/setup-tv.md](docs/setup-tv.md) — install and Home-button notes.
- [src/img/marks/SOURCES.md](src/img/marks/SOURCES.md) — brand-mark provenance.

## Licence

MIT. Bundled fonts (OFL), Unsplash photos and brand marks keep their own terms; trademarks
belong to their owners. Based on the Arn0 launcher (MIT).
