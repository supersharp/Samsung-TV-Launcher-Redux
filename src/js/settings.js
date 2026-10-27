/* Settings: overview, Background, Apps on Home, Consoles, Appearance, Samsung, Advanced. */
(function () {
    'use strict';

    var $ = UI.$;
    var el = UI.el;
    var KEY = UI.KEY;
    var THUMB_COLS = 6;

    // Samsung's on-screen keyboard (IME) sends these for its Done / Cancel buttons.
    var IME_DONE = 65376;
    var IME_CANCEL = 65385;

    // Samsung's own home screen (Smart Hub); TV settings are one press away from there.
    // Opening com.samsung.tv.coba.setting directly does not work on the Q70B: a plain launch
    // fails (UnknownError) and app controls are accepted but show nothing.
    var SAMSUNG_HOME = 'com.samsung.tv.csfs';

    var LOGOS = [
        { key: 'playstation', label: 'PlayStation' },
        { key: 'xbox', label: 'Xbox' },
        { key: 'switch', label: 'Nintendo Switch' },
        { key: 'wiiu', label: 'Wii U' },
        { key: 'windows', label: 'Windows' },
        { key: 'linux', label: 'Linux' },
        { key: 'usb', label: 'USB' },
        { key: 'apple', label: 'Apple' },
        { key: '', label: 'None' }
    ];

    var METHODS = [
        { key: 'switch+viewer', label: 'TV input', hint: 'Game Mode works' },
        { key: 'inapp', label: 'Inside the launcher', hint: 'Back returns here' }
    ];

    // ---------- Generic list pages

    // entries: [{ label, value, mini, run }]
    function renderList(list, entries) {
        list.innerHTML = '';
        entries.forEach(function (e) {
            var li = el('li', 'setting-row');
            if (e.mini) li.appendChild(e.mini);
            li.appendChild(el('span', 'setting-label', e.label));
            li.appendChild(el('span', 'setting-value', e.value || ''));
            li._item = e;
            list.appendChild(li);
        });
    }

    /*
     * A two-column list fills the first column before the second, so visual row r holds items
     * r and r + rowCount. The focus grid has to be built that way round or Down would jump
     * across columns.
     */
    function columnRows(items) {
        var rowCount = Math.ceil(items.length / 2);
        var rows = [];
        for (var r = 0; r < rowCount; r++) {
            var row = [items[r]];
            if (items[r + rowCount]) row.push(items[r + rowCount]);
            rows.push(row);
        }
        return rows;
    }

    function registerList(name, entries, hints, twoColumn) {
        var view = $(name);
        var list = view.querySelector('ul');
        var render = function () {
            renderList(list, entries());
            // Set in JS so the split follows the number of entries rather than a hard-coded four.
            if (twoColumn) {
                list.style.gridTemplateRows =
                    'repeat(' + Math.ceil(list.children.length / 2) + ', auto)';
            }
        };
        UI.register(name, {
            el: view,
            rows: function () {
                var items = UI.children(list);
                return twoColumn ? columnRows(items) : items.map(function (li) { return [li]; });
            },
            onShow: render,
            activate: function (item) { item.run(); },
            hints: hints
        });
        return render;
    }

    var opening = false;
    function openSamsungHome() {
        if (opening) return;
        opening = true;
        DevLog.log('Open Samsung Home');
        Apps.launch(SAMSUNG_HOME).catch(function (err) {
            DevLog.log('Samsung Home failed: ' + DevLog.errorText(err));
            UI.toast('Could not open Samsung Home: ' + DevLog.errorText(err));
        }).then(function () { opening = false; });
    }

    // ---------- Overview

    function wallpaperSummary() {
        var p = Prefs.get().wallpaper;
        if (p.mode === 'off') return 'Off';
        if (p.mode === 'rotate') return 'Rotate · ' + Wallpaper.interval(p.interval).label.toLowerCase();
        var w = Wallpaper.find(p.photo);
        return w ? w.title : 'Photo';
    }

    function overviewEntries() {
        var a = Prefs.get().appearance;
        var shown = Home.inputs().filter(function (i) { return !i.hidden; }).length;
        return [
            { label: 'Background', value: wallpaperSummary(), run: function () { UI.show('bg'); } },
            { label: 'Apps on Home', value: Home.homeItems().length + ' apps', run: function () { UI.show('homeapps'); } },
            { label: 'Connected Devices', value: shown + ' on Home', run: function () { UI.show('consoles'); } },
            { label: 'Appearance', value: Appearance.font(a.font).label + ' · ' + (a.clock === '12h' ? '12-hour' : '24-hour'), run: function () { UI.show('appearance'); } },
            { label: 'Navigation sound', value: soundSummary(), run: function () { UI.show('sound-settings'); } },
            { label: 'Weather', value: weatherSummary(), run: function () { UI.show('weather'); } },
            { label: 'Screen saver', value: screensaverSummary(), run: function () { UI.show('screensaver-settings'); } },
            { label: 'Samsung Home', value: 'Smart Hub and TV settings', run: openSamsungHome },
            { label: 'Advanced', value: 'Refresh, reset, Lab', run: function () { UI.show('advanced'); } }
        ];
    }

    // ---------- Chips (Background, Appearance)

    function chip(label, on, item) {
        var c = el('div', 'chip' + (on ? ' on' : ''), label);
        c._item = item;
        return c;
    }

    function chipRows(container) {
        var rows = [];
        UI.children(container).forEach(function (block) {
            if (block.classList.contains('hidden')) return;
            var chips = block.querySelector('.chips, .thumbs');
            if (!chips) return;
            if (chips.classList.contains('thumbs')) rows = rows.concat(UI.chunk(UI.children(chips), THUMB_COLS));
            else rows.push(UI.children(chips));
        });
        return rows;
    }

    // ---------- Background

    function backgroundMotionBlocks() {
        var p = Prefs.get().wallpaper;
        return [
            {
                id: 'bg-transition',
                title: 'Transition',
                key: 'transition',
                options: [['none', 'Instant'], ['dark', 'Dark fade'], ['crossfade', 'Crossfade']]
            },
            {
                id: 'bg-transition-time',
                title: 'Transition time',
                key: 'transitionTime',
                options: Screensaver.TRANSITION_TIMES.map(function (o) { return [o.key, o.label]; }),
                custom: {
                    title: 'Transition time (seconds)', min: 0.5, max: 30, unit: 's', decimals: 1,
                    get: function () { return Wallpaper.transitionSec(); },
                    set: function (n) { p.transitionTime = n; },
                    format: function (n) { return n + ' s'; }
                }
            },
            {
                id: 'bg-fade-depth',
                title: 'Fade to black',
                key: 'fadeDepth',
                options: [[100, '100 %'], [85, '85 %'], [70, '70 %']],
                custom: {
                    title: 'Fade to black (percent)', min: 0, max: 100, unit: '%', decimals: 0,
                    get: function () { return Wallpaper.fadeDepth(); },
                    set: function (n) { p.fadeDepth = n; },
                    format: function (n) { return n + ' %'; }
                }
            },
            {
                id: 'bg-zoom-amount',
                title: 'Zoom amount',
                key: 'zoomAmount',
                options: [[0, 'Off'], [5, '5 %'], [9, '9 %'], [15, '15 %']],
                custom: {
                    title: 'Zoom amount (percent)', min: 0, max: 40, unit: '%', decimals: 0,
                    get: function () { return Wallpaper.zoomAmount(); },
                    set: function (n) { p.zoomAmount = n; },
                    format: function (n) { return n + ' %'; }
                }
            },
            {
                id: 'bg-zoom-speed',
                title: 'Zoom speed',
                key: 'zoomSpeed',
                options: [[10, '10 s'], [16, '16 s'], [25, '25 s']],
                custom: {
                    title: 'Zoom speed (seconds per leg)', min: 1, max: 120, unit: 's', decimals: 0,
                    get: function () { return Wallpaper.zoomSpeed(); },
                    set: function (n) { p.zoomSpeed = n; },
                    format: function (n) { return n + ' s'; }
                }
            }
        ];
    }

    function renderBackgroundMotion(block, p) {
        var box = $(block.id);
        if (!box) return;
        box.innerHTML = '';
        block.options.forEach(function (o) {
            box.appendChild(chip(o[1], p[block.key] === o[0], { kind: 'motion', key: block.key, value: o[0] }));
        });
        if (block.custom) {
            var active = typeof p[block.key] === 'number' && !block.options.some(function (o) {
                return o[0] === p[block.key];
            });
            box.appendChild(chip(
                active ? 'Custom · ' + block.custom.format(p[block.key]) : 'Custom…',
                active,
                { kind: 'custom', custom: block.custom }
            ));
        }
    }

    function renderBackground(opts) {
        var p = Prefs.get().wallpaper;
        var body = $('bg-body');
        var viewport = $('bg-viewport');
        var keep = (!opts || opts.back) ? (body._scroll || 0) : 0;

        var modes = $('bg-mode');
        modes.innerHTML = '';
        [['off', 'Off'], ['photo', 'Photo'], ['rotate', 'Rotate']].forEach(function (m) {
            modes.appendChild(chip(m[1], p.mode === m[0], { kind: 'mode', key: m[0] }));
        });

        var intervals = $('bg-interval');
        intervals.innerHTML = '';
        Wallpaper.INTERVALS.forEach(function (i) {
            intervals.appendChild(chip(i.label, p.interval === i.key, { kind: 'interval', key: i.key }));
        });
        var customInterval = {
            title: 'Change every (seconds)', min: 10, max: 86400, unit: 's', decimals: 0,
            get: function () { return Math.round(Wallpaper.interval(p.interval).ms / 1000); },
            set: function (n) { p.interval = n; p.lastChange = Date.now(); },
            format: function (n) { return Wallpaper.interval(n).label; }
        };
        var intervalCustom = typeof p.interval === 'number';
        intervals.appendChild(chip(
            intervalCustom ? 'Custom · ' + Wallpaper.interval(p.interval).label : 'Custom…',
            intervalCustom,
            { kind: 'custom', custom: customInterval }
        ));
        $('bg-interval-block').classList.toggle('hidden', p.mode !== 'rotate');

        var photos = $('bg-photos');
        photos.innerHTML = '';
        Wallpaper.list().forEach(function (w) {
            var t = el('div', 'thumb' + (p.photo === w.key ? ' on' : ''));
            var img = new Image();
            img.src = w.thumb;
            t.appendChild(img);
            t.appendChild(el('div', 'thumb-title', w.title));
            t._item = { kind: 'photo', key: w.key };
            photos.appendChild(t);
        });
        $('bg-photos-block').classList.toggle('hidden', p.mode !== 'photo');

        backgroundMotionBlocks().forEach(function (block) { renderBackgroundMotion(block, p); });

        var max = Math.max(0, body.scrollHeight - (viewport ? viewport.clientHeight : 0));
        var y = Math.min(Math.max(0, keep), max);
        body._scroll = y;
        body.style.transform = y ? 'translateY(' + (-y) + 'px)' : '';
    }

    function scrollToBackgroundBlock(target) {
        var block = target.closest ? target.closest('.setting-block') : null;
        var body = $('bg-body');
        var viewport = $('bg-viewport');
        if (!block || !body || !viewport) return;
        var top = block.offsetTop;
        var bottom = top + block.offsetHeight;
        var height = viewport.clientHeight;
        var scroll = body._scroll || 0;
        if (top < scroll) scroll = top;
        else if (bottom > scroll + height) scroll = bottom - height;
        scroll = Math.min(Math.max(0, scroll), Math.max(0, body.scrollHeight - height));
        body._scroll = scroll;
        body.style.transform = scroll ? 'translateY(' + (-scroll) + 'px)' : '';
    }

    function activateBackground(item) {
        var p = Prefs.get().wallpaper;
        if (item.kind === 'mode') {
            p.mode = item.key;
            if (item.key === 'rotate') p.lastChange = Date.now();
            Prefs.save();
            Wallpaper.apply();
        } else if (item.kind === 'interval') {
            p.interval = item.key;
            p.lastChange = Date.now();
            Prefs.save();
        } else if (item.kind === 'photo') {
            p.photo = item.key;
            Prefs.save();
            Wallpaper.apply();
        } else if (item.kind === 'motion') {
            p[item.key] = item.value;
            Prefs.save();
            Wallpaper.motion();
        } else if (item.kind === 'custom') {
            var c = item.custom;
            askNumber(c.title, c.get(), c.min, c.max, c.unit, function (n) {
                c.set(n);
                Prefs.save();
                Wallpaper.apply();
            }, c.decimals || 0);
            return;
        }
        renderBackground({ back: true });
        UI.refresh();
    }

    // ---------- Appearance

    function appearanceBlocks() {
        return [
            { title: 'Clock', key: 'clock', options: [['24h', '24-hour'], ['12h', '12-hour']] },
            { title: 'Date', key: 'showDate', options: [[true, 'Show'], [false, 'Hide']] },
            { title: 'Date language', key: 'locale', options: Appearance.LOCALES.map(function (l) { return [l.key, l.label]; }) },
            { title: 'Font', key: 'font', options: Appearance.FONTS.map(function (f) { return [f.key, f.label, f.family]; }) },
            { title: 'App names', key: 'names', options: [['always', 'Always'], ['focused', 'When selected'], ['never', 'Never']] }
        ];
    }

    function renderAppearance() {
        var p = Prefs.get().appearance;
        var body = $('appearance-body');
        body.innerHTML = '';
        appearanceBlocks().forEach(function (b) {
            var block = el('div', 'setting-block');
            block.appendChild(el('h2', '', b.title));
            var chips = el('div', 'chips');
            b.options.forEach(function (o) {
                var c = chip(o[1], p[b.key] === o[0], { key: b.key, value: o[0] });
                if (o[2]) c.style.fontFamily = o[2];
                chips.appendChild(c);
            });
            block.appendChild(chips);
            body.appendChild(block);
        });
    }

    function activateAppearance(item) {
        Prefs.get().appearance[item.key] = item.value;
        Prefs.save();
        Appearance.apply();
        Home.updateClock();
        renderAppearance();
        UI.refresh();
    }

    // ---------- Navigation sound

    function soundSummary() {
        var p = Prefs.get().sound;
        return p.enabled ? 'On · ' + Sound.presetLabel() : 'Off';
    }

    function renderSound() {
        var p = Prefs.get().sound;
        var body = $('sound-body');
        body.innerHTML = '';

        var enabledBlock = el('div', 'setting-block');
        enabledBlock.appendChild(el('h2', '', 'Sound'));
        var enabledChips = el('div', 'chips');
        enabledChips.appendChild(chip('On', p.enabled, { kind: 'enabled', value: true }));
        enabledChips.appendChild(chip('Off', !p.enabled, { kind: 'enabled', value: false }));
        enabledBlock.appendChild(enabledChips);
        body.appendChild(enabledBlock);

        var presetBlock = el('div', 'setting-block');
        presetBlock.appendChild(el('h2', '', 'Style'));
        var presetChips = el('div', 'chips');
        Sound.presetOptions().forEach(function (preset) {
            presetChips.appendChild(chip(preset.label, p.preset === preset.key,
                { kind: 'preset', value: preset.key }));
        });
        presetBlock.appendChild(presetChips);
        body.appendChild(presetBlock);

        var previewBlock = el('div', 'setting-block');
        previewBlock.appendChild(el('h2', '', 'Try it'));
        var previewChips = el('div', 'chips');
        previewChips.appendChild(chip('Preview selected sound', false, { kind: 'preview' }));
        previewBlock.appendChild(previewChips);
        body.appendChild(previewBlock);
    }

    function activateSound(item) {
        var p = Prefs.get().sound;
        if (item.kind === 'enabled') {
            p.enabled = item.value;
            Prefs.save();
            renderSound();
            UI.refresh();
            if (p.enabled) Sound.preview();
            return;
        }
        if (item.kind === 'preset') {
            p.preset = item.value;
            Prefs.save();
            renderSound();
            UI.refresh();
            Sound.preview();
            return;
        }
        if (item.kind === 'preview') Sound.preview();
    }

    // ---------- Screen saver

    function screensaverSummary() {
        var p = Prefs.get().screensaver;
        return p.enabled ? 'After ' + Screensaver.delay().label : 'Off';
    }

    /*
     * Every numeric setting keeps its preset chips, plus a "Custom…" chip that opens a number
     * dialog. Custom values are stored as plain numbers in the same pref (minutes, seconds or
     * percent); Screensaver's readers accept both that and the preset keys.
     */
    function screensaverBlocks() {
        var p = Prefs.get().screensaver;
        var followsBackground = Screensaver.source() === 'background';
        var rotate = Prefs.get().wallpaper.mode === 'rotate';
        return [
            { title: 'Screen saver', key: 'enabled', options: [[true, 'On'], [false, 'Off']] },
            {
                title: 'Start after',
                key: 'delay',
                options: optionPairs(Screensaver.DELAYS),
                custom: {
                    title: 'Start after (minutes)', min: 1, max: 60, unit: 'min',
                    get: function () { return Screensaver.delay().ms / 60000; },
                    set: function (n) { p.delay = n; },
                    format: function (n) { return n + ' min'; }
                }
            },
            {
                title: 'Photos',
                key: 'source',
                options: [['all', 'All wallpapers'], ['background', 'Same as Background']]
            },
            {
                title: 'Change photo every',
                key: 'photoEvery',
                options: optionPairs(Screensaver.PHOTO_EVERY),
                hint: (followsBackground && !rotate)
                    ? 'Photos follows Background, which is not rotating. Choose All wallpapers to change photos.'
                    : '',
                custom: {
                    title: 'Change photo every (seconds)', min: 10, max: 3600, unit: 's',
                    get: function () { return Screensaver.photoEvery().ms / 1000; },
                    set: function (n) { p.photoEvery = n; },
                    format: function (n) { return n + ' s'; }
                }
            },
            { title: 'Transition', key: 'transition', options: optionPairs(Screensaver.TRANSITIONS) },
            {
                title: 'Transition time',
                key: 'transitionTime',
                options: optionPairs(Screensaver.TRANSITION_TIMES),
                custom: {
                    title: 'Transition time (seconds)', min: 0.5, max: 30, unit: 's',
                    get: function () { return Screensaver.transitionTime() / 1000; },
                    set: function (n) { p.transitionTime = n; },
                    format: function (n) { return n + ' s'; }
                }
            },
            {
                title: 'Fade to black',
                key: 'fadeDepth',
                options: [[100, '100 %'], [85, '85 %'], [70, '70 %']],
                hint: p.transition === 'crossfade' ? 'Used by Dark fade only' : '',
                custom: {
                    title: 'Fade to black (percent)', min: 0, max: 100, unit: '%',
                    get: function () { return Screensaver.fadeDepth(); },
                    set: function (n) { p.fadeDepth = n; },
                    format: function (n) { return n + ' %'; }
                }
            },
            {
                title: 'Zoom amount',
                key: 'zoomAmount',
                options: [[5, '5 %'], [9, '9 %'], [15, '15 %']],
                custom: {
                    title: 'Zoom amount (percent)', min: 0, max: 40, unit: '%',
                    get: function () { return Screensaver.zoomAmount(); },
                    set: function (n) { p.zoomAmount = n; },
                    format: function (n) { return n + ' %'; }
                }
            },
            {
                title: 'Zoom speed',
                key: 'zoomSpeed',
                options: [[10, '10 s'], [16, '16 s'], [25, '25 s']],
                hint: 'Seconds for one zoom leg',
                custom: {
                    title: 'Zoom speed (seconds per leg)', min: 1, max: 120, unit: 's',
                    get: function () { return Screensaver.zoomSpeed(); },
                    set: function (n) { p.zoomSpeed = n; },
                    format: function (n) { return n + ' s'; }
                }
            },
            {
                title: 'Go dark after',
                key: 'dark',
                options: optionPairs(Screensaver.DARK_AFTER),
                custom: {
                    title: 'Go dark after (minutes, 0 = never)', min: 0, max: 720, unit: 'min',
                    get: function () { return Screensaver.darkAfter().ms / 60000; },
                    set: function (n) { p.dark = n; },
                    format: function (n) { return n <= 0 ? 'Never' : n + ' min'; }
                }
            }
        ];
    }

    function optionPairs(list) {
        return list.map(function (o) { return [o.key, o.label]; });
    }

    function customSelected(block, value) {
        if (!block.custom || typeof value !== 'number') return false;
        return !block.options.some(function (o) { return o[0] === value; });
    }

    function renderScreensaver(opts) {
        var p = Prefs.get().screensaver;
        var body = $('screensaver-body');
        var viewport = $('screensaver-viewport');
        // Keep the place when coming back from the number dialog, or when a value changes.
        var keep = (!opts || opts.back) ? (body._scroll || 0) : 0;
        body.innerHTML = '';

        screensaverBlocks().forEach(function (b) {
            var block = el('div', 'setting-block');
            block.appendChild(el('h2', '', b.title));
            var chips = el('div', 'chips');
            b.options.forEach(function (o) {
                chips.appendChild(chip(o[1], p[b.key] === o[0], { key: b.key, value: o[0] }));
            });
            if (b.custom) {
                var active = customSelected(b, p[b.key]);
                chips.appendChild(chip(
                    active ? 'Custom · ' + b.custom.format(p[b.key]) : 'Custom…',
                    active,
                    { kind: 'custom', custom: b.custom }
                ));
            }
            block.appendChild(chips);
            if (b.hint) block.appendChild(el('div', 'setting-hint', b.hint));
            body.appendChild(block);
        });

        var tryBlock = el('div', 'setting-block');
        tryBlock.appendChild(el('h2', '', 'Try it'));
        var tryChips = el('div', 'chips');
        tryChips.appendChild(chip('Show it now', false, { kind: 'preview' }));
        tryBlock.appendChild(tryChips);
        body.appendChild(tryBlock);

        var max = Math.max(0, body.scrollHeight - (viewport ? viewport.clientHeight : 0));
        var y = Math.min(Math.max(0, keep), max);
        body._scroll = y;
        body.style.transform = y ? 'translateY(' + (-y) + 'px)' : '';
    }

    // Called by the focus system for the screen saver view; keeps the focused block visible.
    function scrollToBlock(target) {
        var block = target.closest ? target.closest('.setting-block') : null;
        var body = $('screensaver-body');
        var viewport = $('screensaver-viewport');
        if (!block || !body || !viewport) return;
        var top = block.offsetTop;
        var bottom = top + block.offsetHeight;
        var height = viewport.clientHeight;
        var scroll = body._scroll || 0;
        if (top < scroll) scroll = top;
        else if (bottom > scroll + height) scroll = bottom - height;
        scroll = Math.min(Math.max(0, scroll), Math.max(0, body.scrollHeight - height));
        if (scroll === body._scroll) return;
        body._scroll = scroll;
        body.style.transform = 'translateY(' + (-scroll) + 'px)';
    }

    function activateScreensaver(item) {
        if (item.kind === 'preview') {
            Screensaver.open();
            return;
        }
        if (item.kind === 'custom') {
            var c = item.custom;
            askNumber(c.title, c.get(), c.min, c.max, c.unit, function (n) {
                c.set(n);
                Prefs.save();
                Screensaver.poke();
            });
            return;
        }
        Prefs.get().screensaver[item.key] = item.value;
        Prefs.save();
        // Otherwise a countdown that began before the change could fire straight away.
        Screensaver.poke();
        renderScreensaver();
        UI.refresh();
    }

    // ---------- Weather coordinates

    var renderWeatherPage = null;

    function coordText(n) {
        return (typeof n === 'number' && isFinite(n)) ? n.toFixed(4) : 'Not set';
    }

    function weatherSummary() {
        var c = Weather.coordinates();
        if (typeof c.latitude !== 'number' || typeof c.longitude !== 'number') return 'Set location';
        return c.latitude.toFixed(4) + ', ' + c.longitude.toFixed(4);
    }

    function editWeatherCoord(which) {
        var c = Weather.coordinates();
        var isLat = which === 'latitude';
        var current = isLat ? c.latitude : c.longitude;
        var other = isLat ? c.longitude : c.latitude;
        askNumber(
            isLat ? 'Latitude' : 'Longitude',
            typeof current === 'number' ? current : 0,
            isLat ? -90 : -180,
            isLat ? 90 : 180,
            '°',
            function (n) {
                if (isLat) Weather.setCoordinates(n, other);
                else Weather.setCoordinates(other, n);
                UI.toast((isLat ? 'Latitude' : 'Longitude') + ' saved');
            },
            4
        );
    }

    function weatherUnitMenu() {
        var c = Weather.coordinates();
        UI.menu('Units', [
            {
                label: 'Celsius (°C)',
                checked: c.unit !== 'fahrenheit',
                run: function () {
                    Weather.setUnit('celsius');
                    UI.show('weather', { back: true });
                    UI.toast('Weather units: Celsius');
                }
            },
            {
                label: 'Fahrenheit (°F)',
                checked: c.unit === 'fahrenheit',
                run: function () {
                    Weather.setUnit('fahrenheit');
                    UI.show('weather', { back: true });
                    UI.toast('Weather units: Fahrenheit');
                }
            }
        ]);
    }

    function weatherRefresh() {
        if (!Weather.configured()) {
            UI.toast('Set latitude and longitude first');
            return;
        }
        Weather.refresh(true);
        UI.toast('Fetching weather…');
    }

    function weatherReading() {
        var w = Weather.current();
        if (w) return w.temp + ' · ' + w.detail;
        return Weather.configured() ? 'No reading yet' : 'Set coordinates first';
    }

    function weatherRefreshMenu() {
        var current = Weather.refreshMinutes();
        var options = [15, 30, 60, 180].map(function (n) {
            var label = n === 60 ? 'Every hour' : (n === 180 ? 'Every 3 hours' : 'Every ' + n + ' min');
            return {
                label: label,
                checked: current === n,
                run: function () {
                    Weather.setRefresh(n);
                    UI.show('weather', { back: true });
                    UI.toast('Weather refresh: ' + Weather.refreshLabel().toLowerCase());
                }
            };
        });
        options.push({
            label: 'Custom…',
            run: function () {
                askNumber('Refresh every (minutes)', current, 5, 180, 'min', function (n) {
                    Weather.setRefresh(n);
                    UI.toast('Weather refresh: ' + Weather.refreshLabel().toLowerCase());
                }, 0);
            }
        });
        UI.menu('Refresh weather every', options);
    }

    function weatherClear() {
        UI.menu('Clear weather coordinates?', [
            {
                label: 'Clear',
                run: function () {
                    Weather.clear();
                    UI.show('weather', { back: true });
                    UI.toast('Weather coordinates cleared');
                }
            },
            { label: 'Cancel' }
        ]);
    }

    function applyWeatherPreset(p) {
        Weather.setCoordinates(p.latitude, p.longitude);
        UI.show('weather', { back: true });
        UI.toast('Weather set to ' + p.label);
    }

    function weatherEntries() {
        var c = Weather.coordinates();
        var rows = Weather.presets().map(function (p) {
            return {
                label: p.label,
                value: 'Preset · ' + p.latitude.toFixed(4) + ', ' + p.longitude.toFixed(4),
                run: function () { applyWeatherPreset(p); }
            };
        });
        rows.push(
            { label: 'Latitude', value: coordText(c.latitude), run: function () { editWeatherCoord('latitude'); } },
            { label: 'Longitude', value: coordText(c.longitude), run: function () { editWeatherCoord('longitude'); } },
            { label: 'Units', value: Weather.unitLabel(), run: weatherUnitMenu },
            { label: 'Refresh every', value: Weather.refreshLabel(), run: weatherRefreshMenu },
            {
                label: 'Refresh now',
                value: weatherReading(),
                run: weatherRefresh
            },
            { label: 'Clear coordinates', value: '', run: weatherClear }
        );
        return rows;
    }

    // ---------- Apps on Home editor (two columns, custom navigation)

    var ed = { col: 0, idx: [0, 0], moving: -1, snapshot: null, items: [], others: [] };

    function edLoad() {
        ed.items = Home.homeItems().slice();
        var onHome = {};
        ed.items.forEach(function (i) { onHome[i.id] = true; });
        ed.others = Apps.allSorted(Home.apps(), false).filter(function (a) { return !onHome[a.id]; });
    }

    function edRow(item, moving) {
        var row = el('div', 'ed-item' + (moving ? ' moving' : ''));
        row.appendChild(Home.miniTile(item));
        row.appendChild(el('span', 'ed-label', item.label));
        if (moving) row.appendChild(el('span', 'ed-move', '↕'));
        return row;
    }

    function edRender() {
        var home = $('ed-home');
        home.innerHTML = '';
        ed.items.forEach(function (item, i) { home.appendChild(edRow(item, i === ed.moving)); });
        var other = $('ed-other');
        other.innerHTML = '';
        ed.others.forEach(function (item) { other.appendChild(edRow(item, false)); });
        $('ed-home-title').textContent = 'On Home · ' + ed.items.length;
        $('ed-other-title').textContent = 'Add apps · ' + ed.others.length;
        if (!ed.others.length) ed.col = 0;
    }

    function edFocusEl() {
        var list = [$('ed-home'), $('ed-other')][ed.col];
        if (!list.children.length) return null;
        ed.idx[ed.col] = UI.clamp(ed.idx[ed.col], 0, list.children.length - 1);
        return list.children[ed.idx[ed.col]];
    }

    function edSave() {
        Home.setHomeItems(ed.items);
        edLoad();
    }

    /*
     * Focus plus hints, but the hint bar is only rebuilt when its content would actually differ.
     * Arrowing through the list is the hot path on this screen and should not churn the DOM.
     */
    function edRefresh() {
        var sig = ed.col + '/' + (ed.moving >= 0);
        if (sig !== ed.hintSig) {
            ed.hintSig = sig;
            UI.refreshHints();
        }
        UI.refresh();
    }

    function edKey(k) {
        var moving = ed.moving >= 0;
        if (k === KEY.UP || k === KEY.DOWN) {
            var d = k === KEY.UP ? -1 : 1;
            if (moving) {
                var to = ed.moving + d;
                if (to < 0 || to >= ed.items.length) return true;
                var tmp = ed.items[to];
                ed.items[to] = ed.items[ed.moving];
                ed.items[ed.moving] = tmp;
                ed.moving = to;
                ed.idx[0] = to;
                edRender();
            } else {
                ed.idx[ed.col] += d;
            }
            edRefresh();
            return true;
        }
        if (k === KEY.LEFT || k === KEY.RIGHT) {
            if (!moving) {
                var col = k === KEY.LEFT ? 0 : 1;
                if ([$('ed-home'), $('ed-other')][col].children.length) ed.col = col;
                edRefresh();
            }
            return true;
        }
        if (k === KEY.ENTER) {
            if (ed.col === 0) {
                if (moving) {
                    ed.moving = -1;
                    ed.snapshot = null;
                    edSave();
                    edRender();
                } else {
                    edMenu();
                }
            } else if (ed.others.length) {
                var added = ed.others[ed.idx[1]];
                ed.items.push(added);
                edSave();
                edRender();
                UI.toast('Added ' + added.label + ' to Home');
            }
            edRefresh();
            return true;
        }
        return false;
    }

    function edMenu() {
        var i = ed.idx[0];
        var item = ed.items[i];
        if (!item) return;
        UI.menu(item.label, [
            {
                label: 'Move', run: function () {
                    ed.moving = i;
                    ed.snapshot = ed.items.slice();
                    edRender();
                    UI.refresh();
                }
            },
            {
                label: 'Remove from Home', run: function () {
                    if (ed.items.length <= 1) {
                        UI.toast('Home needs at least one app');
                        return;
                    }
                    ed.items.splice(i, 1);
                    edSave();
                    edRender();
                    UI.refresh();
                }
            },
            { label: 'Cancel' }
        ]);
    }

    function edBack() {
        if (ed.moving < 0) return false;
        ed.items = ed.snapshot;
        ed.moving = -1;
        ed.snapshot = null;
        edRender();
        UI.refresh();
        return true;
    }

    // ---------- Consoles

    var renderConsoles = null;

    function methodOf(input) {
        var key = input.method || window.LAUNCHER_CONFIG.inputMethod;
        return METHODS.find(function (m) { return m.key === key; }) || METHODS[0];
    }

    function logoOf(input) {
        return LOGOS.find(function (l) { return l.key === (input.brand || ''); }) ||
            LOGOS.find(function (l) { return l.key === ''; }) ||
            LOGOS[LOGOS.length - 1];
    }

    function consoleEntries() {
        var entries = Home.inputs().map(function (input, i) {
            return {
                label: input.label,
                value: input.hidden ? 'Hidden' : 'HDMI ' + input.hdmi + ' · ' + methodOf(input).label,
                mini: Home.miniInputTile(input),
                run: function () { consoleMenu(i); }
            };
        });
        // Ports the TV reports live but that are not in the list yet (Home shows them as
        // "HDMI n"). Adopting one turns it into an ordinary, renamable console entry.
        Home.detectedInputs().forEach(function (input) {
            entries.push({
                label: 'HDMI ' + input.hdmi,
                value: 'Detected · connected',
                mini: Home.miniInputTile(input),
                run: function () { adoptDetected(input.hdmi); }
            });
        });
        entries.push({ label: '+ Add a device', value: '', run: addConsole });
        return entries;
    }

    function editInputs(change) {
        var list = Home.inputs().map(function (i) { return Object.assign({}, i); });
        change(list);
        Home.setInputs(list);
        renderConsoles();
        UI.refresh();
    }

    function consoleMenu(i) {
        var c = Home.inputs()[i];
        var count = Home.inputs().length;
        var status = Home.hdmiStatus();
        var options = [
            {
                label: 'Rename', run: function () {
                    rename(c.label, function (name) { editInputs(function (l) { l[i].label = name; }); });
                }
            },
            {
                label: 'HDMI port · HDMI ' + c.hdmi, run: function () {
                    UI.menu('HDMI port', [1, 2, 3, 4].map(function (n) {
                        return {
                            label: 'HDMI ' + n + (status[n] ? ' · connected' : ''),
                            checked: n === c.hdmi,
                            run: function () { editInputs(function (l) { l[i].hdmi = n; }); }
                        };
                    }));
                }
            },
            {
                label: 'Logo · ' + logoOf(c).label, run: function () {
                    UI.menu('Logo', LOGOS.map(function (logo) {
                        return {
                            label: logo.label,
                            checked: logo.key === (c.brand || ''),
                            run: function () { editInputs(function (l) { l[i].brand = logo.key; }); }
                        };
                    }));
                }
            },
            {
                label: 'Opens · ' + methodOf(c).label, run: function () {
                    UI.menu('Opens', METHODS.map(function (m) {
                        return {
                            label: m.label + ' · ' + m.hint,
                            checked: m.key === methodOf(c).key,
                            run: function () { editInputs(function (l) { l[i].method = m.key; }); }
                        };
                    }));
                }
            },
            {
                label: c.hidden ? 'Show on Home' : 'Hide from Home',
                run: function () { editInputs(function (l) { l[i].hidden = !c.hidden; }); }
            }
        ];
        if (i > 0) {
            options.push({ label: 'Move earlier', run: function () { editInputs(function (l) { l.splice(i - 1, 0, l.splice(i, 1)[0]); }); } });
        }
        if (i < count - 1) {
            options.push({ label: 'Move later', run: function () { editInputs(function (l) { l.splice(i + 1, 0, l.splice(i, 1)[0]); }); } });
        }
        options.push({
            label: 'Remove', run: function () {
                UI.menu('Remove ' + c.label + '?', [
                    { label: 'Remove', run: function () { editInputs(function (l) { l.splice(i, 1); }); } },
                    { label: 'Cancel' }
                ]);
            }
        });
        options.push({ label: 'Cancel' });
        UI.menu(c.label, options);
    }

    function addConsole() {
        var used = {};
        Home.inputs().forEach(function (i) { used[i.hdmi] = true; });
        var port = [1, 2, 3, 4].find(function (n) { return !used[n]; }) || 1;
        editInputs(function (l) { l.push({ hdmi: port, label: 'Device', brand: '' }); });
        var index = Home.inputs().length - 1;
        rename('Device', function (name) { editInputs(function (l) { l[index].label = name; }); });
    }

    // A detected port becomes a normal entry, so it can have a name and a logo like a console.
    function adoptDetected(port) {
        editInputs(function (l) { l.push({ hdmi: port, label: 'HDMI ' + port, brand: '' }); });
        var index = Home.inputs().length - 1;
        rename('HDMI ' + port, function (name) {
            editInputs(function (l) { l[index].label = name; });
        });
    }

    // ---------- Name / number dialog (uses Samsung's on-screen keyboard)

    var renameDone = null;

    function openValueDialog(title, current, hint, numeric, done) {
        renameDone = done;
        $('rename-title').textContent = title;
        $('rename-hint').textContent = hint || '';
        $('rename-hint').classList.toggle('hidden', !hint);
        var input = $('rename-input');
        input.value = String(current);
        input.setAttribute('inputmode', numeric ? 'numeric' : 'text');
        UI.show('rename');
    }

    function rename(current, done) {
        openValueDialog('Name', current, '', false, function (value) { done(value); });
    }

    function askNumber(title, current, min, max, unit, done, decimals) {
        var hint = 'Enter ' + min + '–' + max + (unit ? ' ' + unit : '');
        var places = decimals == null ? 1 : decimals;
        var factor = Math.pow(10, places);
        openValueDialog(title, current, hint, true, function (value) {
            var n = Number(String(value).replace(',', '.'));
            if (!isFinite(n) || n < min || n > max) {
                UI.toast('Enter a number from ' + min + ' to ' + max + (unit ? ' ' + unit : ''));
                return false;
            }
            done(Math.round(n * factor) / factor);
        });
    }

    function closeRename(save) {
        var input = $('rename-input');
        var value = input.value.trim();
        var done = renameDone;
        if (!save) {
            renameDone = null;
            input.blur();
            UI.back();
            return;
        }
        if (!value) {
            UI.toast('Enter a value');
            input.focus();
            return;
        }
        if (done) {
            var result = done(value);
            if (result === false) {
                // A number outside the allowed range: keep the dialog open.
                input.focus();
                return;
            }
        }
        renameDone = null;
        input.blur();
        UI.back();
    }

    // ---------- Advanced

    function advancedEntries() {
        var entries = [
            {
                label: 'Refresh app list', value: 'After installing or removing apps', run: function () {
                    UI.toast('Refreshing the app list…');
                    Home.reloadApps().then(function () { UI.toast('App list refreshed'); });
                }
            }
        ];
        if (window.LAUNCHER_CONFIG.devLogUrl) {
            entries.push({
                label: 'Export settings', value: 'Sends them to the Mac log', run: function () {
                    DevLog.log('Settings export', Prefs.get());
                    UI.toast('Settings sent to the Mac log');
                }
            });
        }
        entries.push({
            label: 'Reset all settings', value: 'Back to the defaults', run: function () {
                UI.menu('Reset all settings?', [
                    {
                        label: 'Reset', run: function () {
                            Prefs.reset();
                            location.reload();
                        }
                    },
                    { label: 'Cancel' }
                ]);
            }
        });
        entries.push({ label: 'Lab', value: 'Developer tests', run: function () { UI.show('lab'); } });
        return entries;
    }

    // ---------- Registration

    function init() {
        registerList('settings', overviewEntries,
            [['OK', 'Change'], ['◀ ▶', 'Switch column'], ['Back', 'Home']], true);
        registerList('advanced', advancedEntries, [['OK', 'Run'], ['Back', 'Settings']]);
        renderWeatherPage = registerList('weather', weatherEntries, [['OK', 'Change'], ['Back', 'Settings']]);
        Weather.onUpdate(function () {
            if (renderWeatherPage && UI.isVisible('weather')) {
                renderWeatherPage();
                UI.refresh();
            }
        });
        renderConsoles = registerList('consoles', consoleEntries,
            [['OK', 'Options'], ['Back', 'Settings']]);

        UI.register('bg', {
            el: $('bg-settings'),
            rows: function () { return chipRows($('bg-body')); },
            onShow: renderBackground,
            onFocus: scrollToBackgroundBlock,
            activate: activateBackground,
            hints: [['OK', 'Select'], ['Back', 'Settings']]
        });

        UI.register('appearance', {
            el: $('appearance'),
            rows: function () { return chipRows($('appearance-body')); },
            onShow: renderAppearance,
            activate: activateAppearance,
            hints: [['OK', 'Select'], ['Back', 'Settings']]
        });

        UI.register('sound-settings', {
            el: $('sound-settings'),
            rows: function () { return chipRows($('sound-body')); },
            onShow: renderSound,
            activate: activateSound,
            hints: [['OK', 'Select / Preview'], ['Back', 'Settings']]
        });

        UI.register('screensaver-settings', {
            el: $('screensaver-settings'),
            rows: function () { return chipRows($('screensaver-body')); },
            onShow: renderScreensaver,
            onFocus: scrollToBlock,
            activate: activateScreensaver,
            hints: [['OK', 'Select'], ['Back', 'Settings']]
        });

        UI.register('homeapps', {
            el: $('homeapps'),
            onShow: function (opts) {
                if (!opts.back) {
                    ed.col = 0;
                    ed.idx = [0, 0];
                    ed.moving = -1;
                }
                edLoad();
                edRender();
            },
            focusEl: edFocusEl,
            onKey: edKey,
            onBack: edBack,
            hints: function () {
                if (ed.moving >= 0) {
                    return [['▲ ▼', 'Reorder'], ['OK', 'Drop here'], ['Back', 'Cancel']];
                }
                return [
                    ['OK', ed.col === 0 ? 'Options' : 'Add to Home'],
                    ['◀ ▶', 'Switch column'],
                    ['Back', 'Settings']
                ];
            }
        });

        UI.register('rename', {
            el: $('rename'),
            overlay: true,
            focusEl: function () { return $('rename-input'); },
            hints: [['OK', 'Save'], ['Back', 'Cancel']],
            onShow: function () {
                setTimeout(function () {
                    var input = $('rename-input');
                    input.focus();
                    input.setSelectionRange(input.value.length, input.value.length);
                }, 0);
            },
            onKey: function (k) {
                if (k === KEY.ENTER || k === IME_DONE) {
                    closeRename(true);
                    return true;
                }
                if (k === KEY.BACK || k === KEY.ESC || k === IME_CANCEL) {
                    closeRename(false);
                    return true;
                }
                return 'pass';
            }
        });

        Home.onAppsChanged(function () {
            if (UI.isVisible('homeapps') && ed.moving < 0) {
                edLoad();
                edRender();
                UI.refresh();
            }
        });
        // The TV's port list arrives asynchronously; redraw Consoles when it does so a newly
        // detected port can be named without leaving and re-entering the page.
        Home.onInputsChanged(function () {
            if (!renderConsoles) return;
            renderConsoles();
            if (UI.isVisible('consoles')) UI.refresh();
        });
    }

    window.Settings = { init: init };
})();
