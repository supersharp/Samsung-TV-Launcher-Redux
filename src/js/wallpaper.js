/* Wallpaper display, rotation and background motion, driven by Prefs.wallpaper. */
(function () {
    'use strict';

    var INTERVALS = [
        { key: 'open', label: 'Each time Home opens', ms: 0 },
        { key: '30s', label: '30 s', ms: 30 * 1000 },
        { key: '5m', label: '5 min', ms: 5 * 60 * 1000 },
        { key: '15m', label: '15 min', ms: 15 * 60 * 1000 },
        { key: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
        { key: '1d', label: 'Daily', ms: 24 * 60 * 60 * 1000 }
    ];

    var token = 0;
    var shown = false;
    var currentKey = null;

    function list() { return window.WALLPAPERS || []; }

    function find(key) {
        return list().find(function (w) { return w.key === key; }) || list()[0] || null;
    }

    function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

    function numberPref(key, fallback, min, max) {
        var v = Prefs.get().wallpaper[key];
        if (typeof v !== 'number' || !isFinite(v)) return fallback;
        return clamp(v, min, max);
    }

    function secondsLabel(n) {
        if (n >= 24 * 60 * 60) return 'Daily';
        if (n >= 60 * 60) return (n / (60 * 60)) + (n === 60 * 60 ? ' hour' : ' hours');
        if (n >= 60) return (n / 60) + (n === 60 ? ' min' : ' min');
        return n + ' s';
    }

    function interval(key) {
        if (typeof key === 'number' && isFinite(key) && key > 0) {
            return { key: 'custom', label: secondsLabel(key), ms: key * 1000 };
        }
        var found = function (k) { return INTERVALS.find(function (i) { return i.key === k; }); };
        return found(key) || found('15m');
    }

    function transitionKind() {
        var v = Prefs.get().wallpaper.transition;
        if (v === 'dark' || v === 'crossfade') return v;
        return 'none';
    }

    function transitionSec() {
        var v = Prefs.get().wallpaper.transitionTime;
        if (typeof v === 'number' && isFinite(v)) return clamp(v, 0.5, 30);
        var found = window.Screensaver && Screensaver.TRANSITION_TIMES.find(function (o) { return o.key === v; });
        return (found ? found.ms : 4000) / 1000;
    }

    function fadeDepth() { return numberPref('fadeDepth', 100, 0, 100); }
    function zoomAmount() { return numberPref('zoomAmount', 0, 0, 40); }
    function zoomSpeed() { return numberPref('zoomSpeed', 16, 1, 120); }

    function bg() { return document.getElementById('bg'); }
    function nextLayer() { return document.getElementById('bg-next'); }
    function shade() { return document.getElementById('bg-fade'); }

    // The background breathes only when Zoom amount is above zero.
    function motion() {
        var stage = document.getElementById('stage');
        if (!stage) return;
        stage.style.setProperty('--bg-zoom', String(zoomAmount() / 100));
        stage.style.setProperty('--bg-zoom-ms', zoomSpeed() + 's');
    }

    function image(file) { return 'url("' + file + '")'; }

    function resetLayers() {
        var next = nextLayer();
        var fade = shade();
        if (next) {
            next.style.transition = 'none';
            next.style.opacity = '0';
            next.style.backgroundImage = '';
        }
        if (fade) {
            fade.style.transition = 'none';
            fade.style.opacity = '0';
        }
    }

    function clear() {
        token++;
        shown = false;
        currentKey = null;
        resetLayers();
        bg().style.backgroundImage = '';
    }

    // Decode first, then swap. Instant is the old behaviour; dark and crossfade use the same
    // two-layer technique as the screen saver, with the Home UI staying above the fade.
    function display(w) {
        if (!w) {
            clear();
            return;
        }
        if (shown && currentKey === w.key) return;

        var t = ++token;
        var img = new Image();
        img.onload = function () {
            if (t !== token) return;
            var next = nextLayer();
            var fade = shade();
            if (!next || !fade) {
                bg().style.backgroundImage = image(w.file);
                shown = true;
                currentKey = w.key;
                return;
            }

            resetLayers();

            if (!shown) {
                bg().style.backgroundImage = image(w.file);
                shown = true;
                currentKey = w.key;
                return;
            }

            var kind = transitionKind();
            if (kind === 'none') {
                bg().style.backgroundImage = image(w.file);
                currentKey = w.key;
                return;
            }

            var total = transitionSec() * 1000;
            if (kind === 'crossfade') {
                next.style.backgroundImage = image(w.file);
                next.style.opacity = '0';
                void next.offsetWidth;
                next.style.transition = 'opacity ' + total + 'ms linear';
                next.style.opacity = '1';
                setTimeout(function () {
                    if (t !== token) return;
                    bg().style.backgroundImage = image(w.file);
                    next.style.transition = 'none';
                    next.style.opacity = '0';
                    next.style.backgroundImage = '';
                    currentKey = w.key;
                }, total);
                return;
            }

            var half = total / 2;
            fade.style.transition = 'opacity ' + half + 'ms linear';
            fade.style.opacity = String(fadeDepth() / 100);
            setTimeout(function () {
                if (t !== token) return;
                bg().style.backgroundImage = image(w.file);
                next.style.backgroundImage = '';
                currentKey = w.key;
                fade.style.transition = 'opacity ' + (total - half) + 'ms linear';
                fade.style.opacity = '0';
            }, half);
        };
        img.onerror = function () { DevLog.log('Wallpaper failed to load: ' + w.file); };
        img.src = w.file;
    }

    function apply() {
        motion();
        var p = Prefs.get().wallpaper;
        display(p.mode === 'off' ? null : find(p.photo));
    }

    function next() {
        var p = Prefs.get().wallpaper;
        var l = list();
        if (!l.length) return null;
        var i = l.findIndex(function (w) { return w.key === p.photo; });
        p.photo = l[(i + 1) % l.length].key;
        p.lastChange = Date.now();
        if (p.mode === 'off') p.mode = 'photo';
        Prefs.save();
        apply();
        return find(p.photo);
    }

    function due() {
        var p = Prefs.get().wallpaper;
        var ms = interval(p.interval).ms;
        return p.mode === 'rotate' && ms > 0 && Date.now() - p.lastChange >= ms;
    }

    // Called when Home appears (launch or return from another app).
    function homeShown() {
        var p = Prefs.get().wallpaper;
        if (p.mode === 'rotate' && (p.interval === 'open' || due())) next();
    }

    function start() {
        motion();
        apply();
        homeShown();
        // The screen saver has its own photo cycle and covers Home completely, so rotating
        // underneath it would only decode images nobody can see — and move the photo Home
        // comes back to.
        setInterval(function () {
            if (window.Screensaver && Screensaver.isOpen()) return;
            if (!document.hidden && due()) next();
        }, 5 * 1000);
    }

    window.Wallpaper = {
        INTERVALS: INTERVALS,
        list: list,
        find: find,
        interval: interval,
        transitionKind: transitionKind,
        transitionSec: transitionSec,
        transitionMs: function () { return transitionSec() * 1000; },
        fadeDepth: fadeDepth,
        zoomAmount: zoomAmount,
        zoomSpeed: zoomSpeed,
        motion: motion,
        apply: apply,
        next: next,
        homeShown: homeShown,
        start: start
    };
})();
