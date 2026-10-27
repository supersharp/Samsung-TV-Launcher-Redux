/*
 * Screen saver: photos with a slow breathing zoom, a clock and a caption, after a stretch with
 * no input on Home. Any key closes it, and that press does nothing else.
 *
 * Adapted from a design mockup rather than ported from it. The mockup's backdrop was nine
 * radial-gradients over a linear-gradient — the exact shape the Lab render probe measured at
 * 4.6 fps with 88 of 90 frames dropped (see the header of css/style.css). Here a photo fills
 * that role, the one gradient left is static and painted once, and everything that moves does
 * so through `transform` and `opacity`, which the compositor animates with no JavaScript per
 * frame. The poll below ticks once a second and only decides what is due.
 *
 * Burn-in is the reason anything moves at all: on this kind of panel a clock parked in one
 * corner for an hour is a real risk, so the zoom never settles, the corner text shifts on each
 * photo change, the clock moves to another corner every couple of minutes, and the whole thing
 * fades to black once the configured hour is up.
 */
(function () {
    'use strict';

    var $ = UI.$;

    var DELAYS = [
        { key: '3m', label: '3 min', ms: 3 * 60 * 1000 },
        { key: '5m', label: '5 min', ms: 5 * 60 * 1000 },
        { key: '10m', label: '10 min', ms: 10 * 60 * 1000 },
        { key: '15m', label: '15 min', ms: 15 * 60 * 1000 }
    ];

    /*
     * How long each photo stays up. The 60-90 s options are the design's; the longer ones are
     * for a screen saver left on through an evening.
     */
    var PHOTO_EVERY = [
        { key: '60s', label: '60 s', ms: 60 * 1000 },
        { key: '75s', label: '75 s', ms: 75 * 1000 },
        { key: '90s', label: '90 s', ms: 90 * 1000 },
        { key: '2m', label: '2 min', ms: 2 * 60 * 1000 },
        { key: '5m', label: '5 min', ms: 5 * 60 * 1000 }
    ];

    // How the next photo arrives. 'dark' fades the picture to black, swaps under it, then
    // reveals the new one; 'crossfade' overlaps the two layers directly.
    var TRANSITIONS = [
        { key: 'dark', label: 'Dark fade' },
        { key: 'crossfade', label: 'Crossfade' }
    ];

    // Total time for one change: for Dark fade, half down and half back up.
    var TRANSITION_TIMES = [
        { key: '2s', label: '2 s', ms: 2 * 1000 },
        { key: '4s', label: '4 s', ms: 4 * 1000 },
        { key: '6s', label: '6 s', ms: 6 * 1000 }
    ];

    var DARK_AFTER = [
        { key: '30m', label: '30 min', ms: 30 * 60 * 1000 },
        { key: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
        { key: '2h', label: '2 hours', ms: 2 * 60 * 60 * 1000 },
        { key: 'never', label: 'Never', ms: 0 }
    ];

    /*
     * Motion defaults. The zoom amount and speed are settings now (Settings ▸ Screen saver);
     * these are the fallbacks used by a fresh install or an old saved value.
     *
     * The photo breathes: a gradual zoom in, then a gradual zoom back out, repeating while the
     * screen saver is up. One transition per leg, run by the compositor, no JavaScript per
     * frame. The layer is laid out larger than the screen so the zoom end point and the small
     * sideways drift never reveal an edge.
     */
    var DEFAULT_ZOOM_PCT = 9;
    var DEFAULT_ZOOM_SEC = 16;
    var DEFAULT_FADE_PCT = 100;
    var DRIFT_X = 42;               // a little sideways travel, so the centre moves too
    var DRIFT_Y = 24;
    var CLOCK_MOVE_MS = 150 * 1000; // "every 2-3 minutes"
    var CLOCK_POSITIONS = 4;        // .ss-clock.pos-0 .. pos-3
    var NUDGES = [[0, 0], [7, -5], [-6, 6], [4, 8]];
    var POLL_MS = 1000;

    var open = false;
    var returnTo = 'home';
    var lastInput = Date.now();
    var layers = [];
    var front = 0;              // which of the two photo layers is showing
    var photoToken = 0;
    var photoIndex = 0;
    var openedAt = 0;
    var nextPhotoAt = 0;
    var nextClockMoveAt = 0;
    var nextZoomAt = 0;
    var zoomed = false;
    var zoomSign = 1;           // flipped on each zoom in, so photos drift opposite ways
    var nudge = 0;
    var lastClockText = '';
    var clockPos = 0;
    var dark = false;

    function prefs() { return Prefs.get().screensaver; }

    function option(list, key, fallback) {
        return list.find(function (o) { return o.key === key; }) ||
            list.find(function (o) { return o.key === fallback; });
    }

    // Numeric pref with a range guard. Older saves have strings, so a wrong type falls back.
    function numberPref(key, fallback, min, max) {
        var v = prefs()[key];
        if (typeof v !== 'number' || !isFinite(v)) return fallback;
        return Math.min(max, Math.max(min, v));
    }

    // Preset keys ('5m') and custom numbers (7, meaning minutes) both live in the same field.
    function delay() {
        var v = prefs().delay;
        if (typeof v === 'number' && isFinite(v)) return { key: 'custom', label: v + ' min', ms: v * 60 * 1000 };
        return option(DELAYS, v, '5m');
    }

    function photoEvery() {
        var v = prefs().photoEvery;
        if (typeof v === 'number' && isFinite(v)) return { key: 'custom', label: v + ' s', ms: v * 1000 };
        return option(PHOTO_EVERY, v, '75s');
    }

    function darkAfter() {
        var v = prefs().dark;
        if (typeof v === 'number' && isFinite(v)) {
            return v <= 0
                ? { key: 'custom', label: 'Never', ms: 0 }
                : { key: 'custom', label: v + ' min', ms: v * 60 * 1000 };
        }
        return option(DARK_AFTER, v, '1h');
    }

    function transitionKind() {
        return prefs().transition === 'crossfade' ? 'crossfade' : 'dark';
    }

    function transitionMs() {
        var v = prefs().transitionTime;
        if (typeof v === 'number' && isFinite(v)) return v * 1000;
        return option(TRANSITION_TIMES, v, '4s').ms;
    }

    function source() {
        return prefs().source === 'background' ? 'background' : 'all';
    }

    function zoomAmount() { return numberPref('zoomAmount', DEFAULT_ZOOM_PCT, 0, 40); }
    function zoomMs() { return numberPref('zoomSpeed', DEFAULT_ZOOM_SEC, 1, 120) * 1000; }
    function fadeDepth() { return numberPref('fadeDepth', DEFAULT_FADE_PCT, 0, 100); }

    // ---------- Photos

    function rotating() {
        if (Wallpaper.list().length < 2) return false;
        // The screen saver is a slideshow by default; "Same as Background" makes it hold the
        // Home choice instead. This is what used to make a 60 s interval do nothing when
        // Background was on a single photo.
        if (source() === 'all') return true;
        return Prefs.get().wallpaper.mode === 'rotate';
    }

    /*
     * "All wallpapers" (the default) cycles the list regardless of what Home is showing.
     * "Same as Background" keeps the old behaviour: Off shows no photo, Photo holds the chosen
     * one, Rotate cycles. The index is the screen saver's own — advancing it must not rewrite
     * the wallpaper Home comes back to, so Prefs.wallpaper is read, never written.
     */
    function photoAt(i) {
        var list = Wallpaper.list();
        if (!list.length) return null;
        if (source() === 'all') return list[((i % list.length) + list.length) % list.length];
        var p = Prefs.get().wallpaper;
        if (p.mode === 'off') return null;
        if (p.mode !== 'rotate') return Wallpaper.find(p.photo);
        return list[((i % list.length) + list.length) % list.length];
    }

    // Continue from whatever is already on Home, so opening the screen saver is not a jump cut.
    function startIndex() {
        var key = Prefs.get().wallpaper.photo;
        var i = Wallpaper.list().findIndex(function (w) { return w.key === key; });
        return i < 0 ? 0 : i;
    }

    // The two ends of the breathing cycle: neutral, and slightly zoomed with a small drift.
    function pose(zoomed, sign) {
        if (!zoomed) return 'translate(0px, 0px) scale(1)';
        var to = 1 + zoomAmount() / 100;
        return 'translate(' + (sign * DRIFT_X) + 'px, ' + (sign * DRIFT_Y) + 'px) scale(' + to + ')';
    }

    function zoomTransition() {
        return 'transform ' + zoomMs() + 'ms cubic-bezier(0.37, 0, 0.63, 1), ' +
            'opacity ' + transitionMs() + 'ms linear';
    }

    /*
     * Place a layer at the neutral pose with no animation. The suppression has to be inline
     * rather than a class, because startZoomIn sets `transition` inline and an inline
     * declaration beats a class rule.
     */
    function resetZoom(layer) {
        layer.style.transition = 'none';
        layer.style.transform = pose(false);
        // Reading a layout property flushes that, so the transition startZoomIn restores runs
        // from this pose instead of being collapsed into the move away from it.
        void layer.offsetWidth;
    }

    /*
     * One CSS transition per leg: set once, run by the compositor, no JavaScript per frame.
     * Successive photos are pushed in opposite directions so the picture is not always
     * drifting the same way.
     */
    function startZoomIn() {
        zoomSign = -zoomSign;
        zoomed = true;
        var layer = layers[front];
        layer.style.transition = zoomTransition();
        layer.style.transform = pose(true, zoomSign);
        nextZoomAt = Date.now() + zoomMs();
    }

    function startZoomOut() {
        zoomed = false;
        layers[front].style.transition = zoomTransition();
        layers[front].style.transform = pose(false);
        nextZoomAt = Date.now() + zoomMs();
    }

    /*
     * Dark style: dim the picture to the configured black level over half the transition, swap
     * and start the new zoom under it, then reveal over the other half. The overlay sits below
     * the clock and caption, so those remain readable throughout.
     */
    function darkChange(back, old, token, onShown) {
        var fade = $('ss-fade');
        var total = transitionMs();
        var half = Math.round(total / 2);
        fade.style.transition = 'opacity ' + half + 'ms linear';
        fade.style.opacity = String(fadeDepth() / 100);
        setTimeout(function () {
            if (!open || token !== photoToken) return;
            // The screen is black now: put the incoming photo in place and start its zoom.
            // Commit opacity at 1 before startZoomIn restores a transition, otherwise the
            // incoming photo fades in a second time after the black has already cleared.
            back.style.opacity = '1';
            void back.offsetWidth;
            old.style.transition = 'none';
            old.style.opacity = '0';
            front = 1 - front;
            startZoomIn();
            if (onShown) onShown();
            // Reveal the new photo over the rest of the transition.
            fade.style.transition = 'opacity ' + (total - half) + 'ms linear';
            fade.style.opacity = '0';
        }, half);
    }

    /*
     * The incoming photo is decoded on the hidden layer before anything fades, so a slow decode
     * cannot show as a flash of empty background. A token abandons a decode that finishes after
     * the next change, or after the screen saver has closed.
     *
     * `initial` is the first photo when the screen saver opens: it always fades in from black
     * rather than doing a dark change against an already-empty screen. `onShown` runs when the
     * new photo is actually revealed, which is where the caption and the text nudge belong.
     */
    function showPhoto(w, onShown, initial) {
        var token = ++photoToken;
        if (!w) {
            layers[0].style.opacity = '0';
            layers[1].style.opacity = '0';
            nextZoomAt = 0;
            return;
        }
        var swapped = false;
        var swap = function () {
            if (swapped || token !== photoToken || !open) return;
            swapped = true;
            var back = layers[1 - front];
            var old = layers[front];
            back.style.backgroundImage = 'url("' + w.file + '")';
            // Placed at the neutral pose startZoomIn is about to move away from, animation suppressed.
            resetZoom(back);
            if (!initial && transitionKind() === 'dark') {
                darkChange(back, old, token, onShown);
                return;
            }
            front = 1 - front;
            // Restores the transition before either property is given a new value, so the
            // crossfade and the zoom both animate instead of jumping.
            startZoomIn();
            back.style.opacity = '1';
            old.style.opacity = '0';
            if (onShown) onShown();
        };
        var img = new Image();
        img.onload = swap;
        img.onerror = function () { DevLog.log('Screen saver photo failed: ' + w.file); };
        img.src = w.file;
        if (img.complete && img.naturalWidth) swap();
    }

    // ---------- Text

    // The design asks for "Wed 21 Oct"; Appearance.date is the long form Home uses.
    function shortDate(d) {
        try {
            var text = d.toLocaleDateString(Prefs.get().appearance.locale,
                { weekday: 'short', day: 'numeric', month: 'short' });
            return text.charAt(0).toUpperCase() + text.slice(1);
        } catch (e) {
            return d.toDateString();
        }
    }

    // Called every second, but only writes when the minute turns: repainting the clock text on
    // top of a drifting photo is work the compositor does not need.
    function updateClock() {
        var d = new Date();
        var t = Appearance.time(d);
        var text = t.time + (t.suffix ? ' ' + t.suffix : '');
        if (text === lastClockText) return;
        lastClockText = text;
        $('ss-time').textContent = text;
        $('ss-date').textContent = Prefs.get().appearance.showDate ? shortDate(d) : '';
    }

    function caption(w) {
        $('ss-title').textContent = w ? w.title : '';
        $('ss-caption').classList.toggle('hidden', !w);
    }

    // A few pixels on each photo change, so even the text that stays put does not stay put.
    function nudgeText() {
        nudge = (nudge + 1) % NUDGES.length;
        var shift = 'translate(' + NUDGES[nudge][0] + 'px, ' + NUDGES[nudge][1] + 'px)';
        $('ss-caption').style.transform = shift;
        $('ss-clock').style.transform = shift;
    }

    // Swaps the position class without touching the others, which now include `with-weather`.
    function setClockPos(n) {
        var el = $('ss-clock');
        for (var i = 0; i < CLOCK_POSITIONS; i++) el.classList.remove('pos-' + i);
        el.classList.add('pos-' + n);
    }

    function moveClock() {
        clockPos = (clockPos + 1) % CLOCK_POSITIONS;
        setClockPos(clockPos);
        nextClockMoveAt = Date.now() + CLOCK_MOVE_MS;
    }

    // Hidden outright when there is no usable reading: see the note on staleness in weather.js.
    function renderWeather() {
        var w = window.Weather && Weather.current();
        $('ss-clock').classList.toggle('with-weather', !!w);
        $('ss-weather').classList.toggle('hidden', !w);
        if (!w) return;
        $('ss-wx-icon').innerHTML = w.icon;
        $('ss-wx-temp').textContent = w.temp;
        $('ss-wx-detail').textContent = w.detail;
    }

    // ---------- Open, tick, close

    function openSaver() {
        if (open) return;
        returnTo = UI.current() || 'home';
        open = true;
        dark = false;
        front = 0;
        nudge = 0;
        clockPos = 0;
        photoIndex = startIndex();
        zoomSign = 1;
        zoomed = false;
        lastClockText = '';
        layers[0].style.opacity = '0';
        layers[1].style.opacity = '0';
        resetZoom(layers[0]);
        resetZoom(layers[1]);
        $('ss-dark').style.opacity = '0';
        $('ss-fade').style.transition = 'none';
        $('ss-fade').style.opacity = '0';
        $('ss-caption').style.transform = '';
        setClockPos(0);
        $('ss-clock').style.transform = '';

        var now = Date.now();
        openedAt = now;
        nextPhotoAt = now + photoEvery().ms;
        nextClockMoveAt = now + CLOCK_MOVE_MS;
        nextZoomAt = 0;

        UI.show('screensaver');
        updateClock();
        // Shows the cached reading at once, and asks for a new one only if the hour is up.
        renderWeather();
        if (window.Weather) Weather.refresh();
        var w = photoAt(photoIndex);
        caption(w);
        showPhoto(w, null, true);
        DevLog.log('Screen saver on');
    }

    function goDark() {
        dark = true;
        $('ss-dark').style.opacity = '1';
        DevLog.log('Screen saver dark after ' + darkAfter().label);
    }

    function tick() {
        var now = Date.now();
        updateClock();
        var until = darkAfter().ms;
        if (!dark && until && now - openedAt >= until) goDark();
        // Behind an opaque black layer there is nothing worth moving.
        if (dark) return;
        if (now >= nextClockMoveAt) moveClock();
        if (rotating() && now >= nextPhotoAt) {
            photoIndex++;
            nextPhotoAt = now + photoEvery().ms;
            var w = photoAt(photoIndex);
            // Caption and text nudge wait for the new photo to be revealed, so the title never
            // describes a picture that is still fading in.
            showPhoto(w, function () {
                caption(w);
                nudgeText();
            });
        } else if (nextZoomAt && now >= nextZoomAt) {
            // One leg of the breathing cycle has finished; take the other one.
            if (zoomed) startZoomOut();
            else startZoomIn();
        }
    }

    function close() {
        if (!open) return;
        open = false;
        lastInput = Date.now();
        photoToken++;
        $('ss-fade').style.transition = 'none';
        $('ss-fade').style.opacity = '0';
        // Dropping the images releases two full-screen textures on a 2 GB device.
        layers.forEach(function (l) {
            l.style.opacity = '0';
            l.style.backgroundImage = '';
        });
        UI.show(returnTo, { back: true });
    }

    // Never over a console input or another screen, and never while the app is in the background.
    function eligible() {
        return prefs().enabled && UI.isVisible('home') && !document.hidden &&
            !(window.Home && Home.tvMode());
    }

    /*
     * One poll for everything. The dismissing key is swallowed by the view's onKey below, so it
     * only closes the screen saver; this listener exists to notice input while it is closed.
     */
    document.addEventListener('keydown', function () {
        if (!open) lastInput = Date.now();
    });

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            if (open) close();
            return;
        }
        // Coming back from another app is not idle time: JavaScript was paused, not waiting.
        lastInput = Date.now();
    });

    function init() {
        layers = [$('ss-photo-a'), $('ss-photo-b')];
        // A reading that lands mid-session should appear without waiting for the next photo.
        if (window.Weather) {
            Weather.onUpdate(function () {
                if (open) renderWeather();
            });
        }
        UI.register('screensaver', {
            el: $('screensaver'),
            hints: [],
            rows: function () { return []; },
            onKey: function () { close(); return true; },
            onBack: function () { close(); return true; }
        });
        setInterval(function () {
            if (open) {
                tick();
                return;
            }
            if (eligible() && Date.now() - lastInput >= delay().ms) openSaver();
        }, POLL_MS);
    }

    window.Screensaver = {
        DELAYS: DELAYS,
        PHOTO_EVERY: PHOTO_EVERY,
        DARK_AFTER: DARK_AFTER,
        TRANSITIONS: TRANSITIONS,
        TRANSITION_TIMES: TRANSITION_TIMES,
        delay: delay,
        photoEvery: photoEvery,
        darkAfter: darkAfter,
        transition: transitionKind,
        transitionTime: transitionMs,
        source: source,
        zoomAmount: zoomAmount,
        zoomSpeed: function () { return zoomMs() / 1000; },
        fadeDepth: fadeDepth,
        init: init,
        open: openSaver,
        close: close,
        isOpen: function () { return open; },
        // Settings should not leave a countdown that started before the change.
        poke: function () { lastInput = Date.now(); }
    };
})();
