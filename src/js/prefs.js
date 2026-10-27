/*
 * User settings, stored on the TV (localStorage). js/config.js only provides the defaults.
 * They survive restarts and in-place updates, but not an uninstall.
 */
(function () {
    'use strict';

    var KEY = 'arn0.prefs.v1';
    var LEGACY_WALLPAPER_KEY = 'arn0.wallpaper';

    function defaults() {
        var cfg = window.LAUNCHER_CONFIG || {};
        var theme = cfg.theme || {};
        return {
            sound: {
                enabled: cfg.sound ? cfg.sound.enabled !== false : true,
                preset: cfg.sound && cfg.sound.preset || 'soft'
            },
            wallpaper: {
                mode: theme.wallpaper ? 'photo' : 'off',   // 'off' | 'photo' | 'rotate'
                photo: theme.wallpaper || 'forest',
                interval: '15m',        // see Wallpaper.INTERVALS; a number means seconds
                lastChange: 0,
                // Background motion, mirroring the screen saver's controls. Instant/0 keeps the
                // old Home behaviour until the user opts into a transition or zoom.
                transition: 'none',     // 'none' | 'dark' | 'crossfade'
                transitionTime: '4s',   // see Screensaver.TRANSITION_TIMES; a number means seconds
                fadeDepth: 100,
                zoomAmount: 0,
                zoomSpeed: 16
            },
            screensaver: {
                enabled: true,
                delay: '5m',            // see Screensaver.DELAYS; a number means minutes
                photoEvery: '75s',      // see Screensaver.PHOTO_EVERY; a number means seconds
                source: 'all',          // 'all' | 'background' (see Settings ▸ Screen saver ▸ Photos)
                transition: 'dark',     // 'dark' | 'crossfade'
                transitionTime: '4s',   // see Screensaver.TRANSITION_TIMES; a number means seconds
                fadeDepth: 100,         // percent; dark-fade target opacity
                zoomAmount: 9,          // percent; 9 => scale 1.09
                zoomSpeed: 16,          // seconds for one zoom leg
                dark: '1h'              // see Screensaver.DARK_AFTER; a number means minutes
            },
            weather: {
                latitude: null,         // null = use config.js; Settings ▸ Weather overrides
                longitude: null,
                unit: null,             // null = config.js unit; 'celsius' | 'fahrenheit'
                refreshEvery: 60        // minutes; 5-180, automatic refresh while visible
            },
            appearance: {
                clock: '24h',           // '24h' | '12h'
                showDate: true,
                locale: cfg.locale || 'en-GB',
                font: 'manrope',        // see Appearance.FONTS
                names: 'always'         // app names under tiles: 'always' | 'focused' | 'never'
            },
            layout: {
                appSize: 'medium',      // 'small' | 'medium' | 'large'
                inputSize: 'medium',    // 'small' | 'medium' | 'large'
                top: 'apps',            // 'apps' | 'inputs'
                clockSide: 'left',      // 'left' | 'right' (the gear takes the other side)
                showClock: true,
                showWeather: true
            },
            home: null,                 // [{ id, label, brand }] once edited; null = config.js apps
            inputs: null                // [{ hdmi, label, brand, method, hidden }] once edited; null = config.js
        };
    }

    function merge(target, saved) {
        if (!saved) return;
        Object.keys(target).forEach(function (k) {
            if (saved[k] !== undefined) target[k] = saved[k];
        });
    }

    function load() {
        var prefs = defaults();
        try {
            var saved = JSON.parse(localStorage.getItem(KEY));
            if (saved) {
                merge(prefs.sound, saved.sound);
                merge(prefs.wallpaper, saved.wallpaper);
                merge(prefs.screensaver, saved.screensaver);
                merge(prefs.weather, saved.weather);
                merge(prefs.appearance, saved.appearance);
                if (Array.isArray(saved.home) && saved.home.length) prefs.home = saved.home;
                if (Array.isArray(saved.inputs)) prefs.inputs = saved.inputs;
            } else {
                var legacy = localStorage.getItem(LEGACY_WALLPAPER_KEY);
                if (legacy) prefs.wallpaper.photo = legacy;
            }
        } catch (e) {
            // Unreadable storage: run with defaults.
        }
        // "Midnight" used to be a photo; it is now what Off shows.
        if (prefs.wallpaper.photo === 'midnight') {
            if (prefs.wallpaper.mode === 'photo') prefs.wallpaper.mode = 'off';
            prefs.wallpaper.photo = 'forest';
        }
        return prefs;
    }

    var prefs = load();

    function save() {
        try {
            localStorage.setItem(KEY, JSON.stringify(prefs));
            return true;
        } catch (e) {
            DevLog.log('Could not save settings: ' + DevLog.errorText(e));
            return false;
        }
    }

    function reset() {
        try {
            localStorage.removeItem(KEY);
            localStorage.removeItem(LEGACY_WALLPAPER_KEY);
        } catch (e) {
            // Nothing stored, nothing to clear.
        }
        prefs = defaults();
    }

    window.Prefs = {
        get: function () { return prefs; },
        save: save,
        reset: reset
    };
})();
