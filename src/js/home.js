/* Home, All apps and Lab screens; app list loading, launching and HDMI inputs. */
(function () {
    'use strict';

    var CACHE_KEY = 'arn0.apps.v1';
    var REFRESH_AFTER_MS = 5 * 60 * 1000;
    var GRID_COLS = 5;

    var cfg = window.LAUNCHER_CONFIG;
    var log = DevLog.log;
    var $ = UI.$;
    var el = UI.el;
    var KEY = UI.KEY;

    var state = {
        apps: [],              // launchable apps from the TV (or the cache)
        appsSig: null,
        lastFetch: 0,
        layoutSig: null,       // sizes/order currently applied to the shelves
        showEverything: false, // All apps: bypass the consumer filter
        tvMode: false,         // HDMI shown inside the launcher
        hdmi: {}               // last known { port: connected }
    };

    var inputListeners = [];
    var SAMSUNG_HOME = 'com.samsung.tv.csfs';

    function samsungHomeItem() {
        return {
            kind: 'app',
            id: SAMSUNG_HOME,
            label: 'Samsung Home',
            brand: window.findBrand ? findBrand('samsunghome') : null
        };
    }

    // ---------- Tiles

    // Pre-coloured by scripts/build-marks.mjs
    function markEl(brand) {
        var m = new Image();
        m.className = 'mark';
        m.src = 'img/tiles/' + brand.key + '.svg';
        if (brand.pad) {
            m.style.top = brand.pad[0] + '%';
            m.style.height = (100 - 2 * brand.pad[0]) + '%';
            m.style.left = brand.pad[1] + '%';
            m.style.width = (100 - 2 * brand.pad[1]) + '%';
        }
        return m;
    }

    function initials(label) {
        var words = label.replace(/[^\w\s+]/g, ' ').trim().split(/\s+/);
        return (words[0] ? words[0][0] : '?') + (words[1] ? words[1][0] : '');
    }

    function hue(text) {
        var h = 0;
        for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
        return h;
    }

    // Installed apps report a native path; it may or may not be readable from a web app.
    function tryIcon(tile, mono, path) {
        var img = new Image();
        img.className = 'icon';
        img.onload = function () {
            mono.style.display = 'none';
            tile.appendChild(img);
        };
        img.src = path.charAt(0) === '/' ? 'file://' + path : path;
    }

    function tileFace(item) {
        var tile = el('div', 'tile');
        if (item.brand) {
            tile.style.background = item.brand.bg;
            if (item.brand.text) {
                var word = el('div', 'wordmark', item.brand.text);
                word.style.color = item.brand.fg;
                tile.appendChild(word);
            } else {
                tile.appendChild(markEl(item.brand));
            }
        } else {
            tile.style.background = 'hsl(' + hue(item.label) + ',32%,24%)';
            var mono = el('div', 'mono', initials(item.label).toUpperCase());
            tile.appendChild(mono);
            if (item.iconPath) tryIcon(tile, mono, item.iconPath);
        }
        return tile;
    }

    function appTile(item) {
        var wrap = el('div', 'app');
        wrap.appendChild(tileFace(item));
        wrap.appendChild(el('div', 'label', item.label));
        wrap._item = item;
        return wrap;
    }

    // Small tile used in Settings lists.
    function miniTile(item) {
        var wrap = el('div', 'mini');
        if (item.glyph) {
            var tile = el('div', 'tile');
            tile.style.background = item.bg || '#2a2f3a';
            tile.appendChild(inputGlyph());
            wrap.appendChild(tile);
            return wrap;
        }
        wrap.appendChild(tileFace(item));
        return wrap;
    }

    function allAppsTile() {
        var wrap = el('div', 'app');
        var tile = el('div', 'tile all-tile');
        tile.innerHTML = '<svg viewBox="0 0 24 24" fill="#fff"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/>' +
            '<rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/>' +
            '<rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>';
        wrap.appendChild(tile);
        wrap.appendChild(el('div', 'label', 'All apps'));
        wrap._item = { kind: 'all' };
        return wrap;
    }

    // Neutral screen-with-arrow glyph for an input nobody has given a brand yet.
    function inputGlyph() {
        var g = el('div', 'input-glyph');
        g.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
            'stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="2.5" y="4.5" width="19" height="12.5" rx="2.2"/>' +
            '<path d="M8.5 21h7M12 17v4"/><path d="M15 10.75H8.5m0 0 2.6-2.6m-2.6 2.6 2.6 2.6"/></svg>';
        return g;
    }

    function inputTile(input) {
        var brand = findBrand(input.brand || '') || { bg: '#2a2f3a', fg: '#fff', mark: null };
        var wrap = el('div', 'input');
        var tile = el('div', 'tile');
        tile.style.background = brand.bg;
        if (brand.mark) tile.appendChild(markEl(brand));
        else tile.appendChild(inputGlyph());
        var meta = el('div', 'meta');
        meta.appendChild(el('div', 'name', input.label));
        var port = el('div', 'port');
        var dot = el('span', 'dot');
        port.appendChild(dot);
        // A configured console sounds better as "HDMI 4"; an auto-discovered port already
        // carries that as its name, so say what it is instead.
        port.appendChild(document.createTextNode(input.auto ? 'Connected output' : 'HDMI ' + input.hdmi));
        meta.appendChild(port);
        tile.appendChild(meta);
        wrap.appendChild(tile);
        wrap._item = { kind: 'input', hdmi: input.hdmi, label: input.label, method: input.method };
        wrap._dot = dot;
        return wrap;
    }

    // Console tile for Settings lists: brand colours and logo only.
    function miniInputTile(input) {
        var brand = findBrand(input.brand || '');
        if (!brand) return miniTile({ glyph: true });
        return miniTile({ label: input.label, brand: brand && { key: brand.key, bg: brand.bg, fg: brand.fg, mark: brand.mark } });
    }

    // ---------- Home content

    // Consoles: edited list from Settings, else config.js.
    function inputs() {
        return Prefs.get().inputs || cfg.inputs || [];
    }

    /*
     * Everything the second row should show: the configured consoles, then any HDMI port
     * the TV reports as connected that has not been configured yet. Discovery is what makes
     * a console or a computer appear when it is plugged in, instead of the row staying empty
     * on a fresh install (config.js ships no inputs).
     */
    function homeInputs() {
        var list = inputs();
        var used = {};
        list.forEach(function (i) { used[i.hdmi] = true; });
        var discovered = Object.keys(state.hdmi)
            .map(Number)
            .filter(function (port) { return state.hdmi[port] && !used[port]; })
            .sort(function (a, b) { return a - b; })
            .map(function (port) {
                return {
                    hdmi: port,
                    label: 'HDMI ' + port,
                    brand: '',
                    method: cfg.inputMethod,
                    auto: true
                };
            });
        return list.concat(discovered);
    }

    function homeInputsSig() {
        return homeInputs().map(function (i) {
            return i.hdmi + ':' + (i.hidden ? 'h' : 's') + ':' + i.label;
        }).join(',');
    }

    function setInputs(list) {
        Prefs.get().inputs = list;
        Prefs.save();
        renderHome();
    }

    // Entries shown on Home: edited list from Settings, else config.js.
    function homeEntries() {
        return Prefs.get().home || cfg.apps || [];
    }

    function homeItems() {
        var entries = homeEntries();
        var items = Apps.curated(state.apps, { apps: entries });
        var present = {};
        items.forEach(function (i) { present[i.id] = true; });
        entries.forEach(function (entry) {
            if (entry.id === SAMSUNG_HOME && !present[entry.id]) {
                items.push(samsungHomeItem());
                present[entry.id] = true;
            }
        });
        items.forEach(function (item) {
            if (item.id === SAMSUNG_HOME) {
                item.label = 'Samsung Home';
                item.brand = window.findBrand ? findBrand('samsunghome') : null;
            }
        });
        return items;
    }

    function setHomeItems(items) {
        Prefs.get().home = items.map(function (i) {
            var entry = { id: i.id, label: i.label };
            if (i.brand) entry.brand = i.brand.key;
            return entry;
        });
        Prefs.save();
        renderHome();
    }

    function renderHome() {
        var focusedInput = document.querySelector('#inputs-row .focused');
        var focusPort = focusedInput && focusedInput._item ? focusedInput._item.hdmi : null;

        var row = $('apps-row');
        row.innerHTML = '';
        var items = homeItems();
        if (!items.length) items = Apps.allSorted(state.apps, false).slice(0, 8);
        items.forEach(function (item) { row.appendChild(appTile(item)); });
        row.appendChild(allAppsTile());

        var row2 = $('inputs-row');
        row2.innerHTML = '';
        var list = homeInputs();
        list.forEach(function (input) {
            if (!input.hidden) row2.appendChild(inputTile(input));
        });
        $('inputs-section').classList.toggle('hidden', !row2.children.length);
        applyInputStatus();

        if (focusPort) {
            var again = UI.children(row2).find(function (t) {
                return t._item && t._item.hdmi === focusPort;
            });
            if (again) UI.focusOn(again);
        }
        applyLayout();
        if (UI.isVisible('home')) UI.refresh();
    }

    function applyInputStatus() {
        UI.children($('inputs-row')).forEach(function (tile) {
            tile._dot.classList.toggle('on', state.hdmi[tile._item.hdmi] === true);
        });
    }

    function refreshInputStatus() {
        return Inputs.hdmiStatus().then(function (status) {
            var before = homeInputsSig();
            state.hdmi = status;
            // Rebuild only when the set of ports changed: a green dot does not need new tiles,
            // and rebuilding on every poll would throw away the focused tile.
            if (homeInputsSig() !== before) renderHome();
            else applyInputStatus();
            inputListeners.forEach(function (fn) { fn(); });
        }).catch(function (err) {
            log('Input status unavailable: ' + DevLog.errorText(err));
        });
    }

    function renderAll() {
        var grid = $('all-grid');
        grid.innerHTML = '';
        UI.resetScroll(grid);
        var items = Apps.allSorted(state.apps, state.showEverything);
        items.forEach(function (item) { grid.appendChild(appTile(item)); });
        $('all-count').textContent = items.length + ' apps';
    }

    function renderLab() {
        var actions = [
            { label: 'Send installed app list to log', run: labDumpApps },
            { label: 'Read inputs', run: labReadInputs },
            { label: 'Open Samsung TV viewer only', run: function () { runLogged('Open TV viewer', Inputs.openViewer()); } }
        ];
        if (window.Sound) actions = actions.concat(Sound.actions());
        if (window.Weather) actions = actions.concat(Weather.actions());
        if (window.RenderProbe) actions = actions.concat(RenderProbe.actions());
        if (window.PlatformProbe) actions = actions.concat(PlatformProbe.actions());
        inputs().forEach(function (input) {
            var item = { kind: 'input', hdmi: input.hdmi, label: input.label };
            var name = input.label + ' (HDMI ' + input.hdmi + ')';
            actions.push({ label: name + ': switch + viewer', run: function () { openInput(item, 'switch+viewer'); } });
            actions.push({ label: name + ': switch only', run: function () { openInput(item, 'switch'); } });
            actions.push({ label: name + ': inside launcher', run: function () { openInput(item, 'inapp'); } });
        });
        var list = $('lab-list');
        list.innerHTML = '';
        actions.forEach(function (a) {
            var li = el('li', '', a.label);
            li._item = { kind: 'lab', run: a.run };
            list.appendChild(li);
        });
        DevLog.onLine(function () {
            $('lab-log').textContent = DevLog.lines().slice(-26).join('\n');
        });
    }

    // ---------- Actions

    function runLogged(what, promise) {
        log(what + '…');
        return promise.then(function (v) {
            log(what + ': ok');
            return v;
        }, function (err) {
            log(what + ': FAILED ' + DevLog.errorText(err));
            throw err;
        });
    }

    function launchApp(item) {
        runLogged('Launch ' + item.id, Apps.launch(item.id)).catch(function (err) {
            UI.toast('Could not open ' + item.label + ': ' + DevLog.errorText(err));
        });
    }

    function openInput(item, method) {
        method = method || item.method || cfg.inputMethod;
        UI.toast('Switching to ' + item.label + '…');
        runLogged('Input HDMI ' + item.hdmi + ' via ' + method, Inputs.open(item.hdmi, method)).then(function (result) {
            log('Current source now: ' + Inputs.describeSource(Inputs.current()));
            if (result === 'inapp') enterTvMode();
        }).catch(function (err) {
            UI.toast('Could not switch to ' + item.label + ': ' + DevLog.errorText(err));
        });
    }

    function enterTvMode() {
        state.tvMode = true;
        document.documentElement.classList.add('tv-mode');
    }

    function exitTvMode() {
        state.tvMode = false;
        document.documentElement.classList.remove('tv-mode');
        Inputs.hide().catch(function (err) { log('Hide input failed: ' + DevLog.errorText(err)); });
    }

    function labDumpApps() {
        runLogged('App list', Apps.getInstalledApps()).then(function (apps) {
            log('apps: ' + apps.length + ' total, ' + apps.filter(function (a) { return a.show; }).length + ' with show=true',
                apps.map(Apps.describe));
            UI.toast('Sent ' + apps.length + ' apps to the log');
        }).catch(function () {});
    }

    function labReadInputs() {
        runLogged('Inputs', Inputs.sources()).then(function (info) {
            var fmt = function (list) { return (list || []).map(Inputs.describeSource).join(', ') || 'none'; };
            log('connected: ' + fmt(info.connected));
            log('disconnected: ' + fmt(info.disconnected));
            log('current: ' + Inputs.describeSource(Inputs.current()));
        }).catch(function () {});
    }

    function nextWallpaper() {
        var w = Wallpaper.next();
        if (w) UI.toast(w.title + (w.credit ? ' · ' + w.credit : ''));
    }

    // Colour keys are hidden shortcuts; everything is also reachable from Settings.
    function colourKey(k, view) {
        if (k === KEY.RED || k === KEY.R) {
            UI.show(view === 'all' ? 'home' : 'all');
        } else if (k === KEY.GREEN || k === KEY.G) {
            if (view === 'home') nextWallpaper();
        } else if (k === KEY.BLUE || k === KEY.B) {
            UI.show(view === 'lab' ? 'home' : 'lab');
        } else if (k === KEY.YELLOW || k === KEY.Y) {
            if (view === 'all') {
                state.showEverything = !state.showEverything;
                UI.show('all', { back: true });
            } else if (view === 'home' && window.RunnerGame) {
                RunnerGame.open();
            } else return false;
        } else {
            return false;
        }
        return true;
    }

    // ---------- Clock, data, lifecycle

    function updateClock() {
        var d = new Date();
        var t = Appearance.time(d);
        $('time-main').textContent = t.time;
        $('time-suffix').textContent = t.suffix;
        $('date').textContent = Appearance.date(d);
    }

    // The weather reading is shared with the screen saver; hide the line when there is none.
    function renderHomeWeather() {
        var box = $('home-weather');
        if (!box) return;
        var layout = Prefs.get().layout || {};
        if (layout.showWeather === false) {
            box.classList.add('hidden');
            return;
        }
        var w = window.Weather && Weather.current();
        if (!w) {
            box.classList.add('hidden');
            return;
        }
        $('home-wx-icon').innerHTML = w.icon;
        $('home-wx-temp').textContent = w.temp;
        $('home-wx-detail').textContent = w.detail;
        box.classList.remove('hidden');
    }

    // Applies Settings ▸ Home Layout. The shelves are a flex column, so size/order changes
    // reflow without hard-coded row positions; measuring keeps the block above the hint bar.
    function applyLayout() {
        var p = Prefs.get().layout || {};
        var home = $('home');
        var appSize = (p.appSize === 'small' || p.appSize === 'large') ? p.appSize : 'medium';
        var inputSize = (p.inputSize === 'small' || p.inputSize === 'large') ? p.inputSize : 'medium';

        home.classList.remove('app-size-small', 'app-size-medium', 'app-size-large');
        home.classList.remove('input-size-small', 'input-size-medium', 'input-size-large');
        home.classList.add('app-size-' + appSize);
        home.classList.add('input-size-' + inputSize);
        home.classList.toggle('layout-inputs-top', p.top === 'inputs');
        home.classList.toggle('layout-apps-top', p.top !== 'inputs');
        home.classList.toggle('clock-right', p.clockSide === 'right');
        home.classList.toggle('gear-left', p.clockSide === 'right');
        home.classList.toggle('hide-clock', p.showClock === false);
        home.classList.toggle('hide-weather', p.showWeather === false);

        var shelves = $('shelves');
        if (shelves) {
            var total = 0;
            var visible = 0;
            UI.children(shelves).forEach(function (section) {
                if (section.classList.contains('hidden')) return;
                var h = section.offsetHeight;
                if (!h) return;
                if (visible) total += 24;
                total += h;
                visible++;
            });
            var top = Math.max(520, Math.min(610, 990 - total));
            shelves.style.top = top + 'px';
        }

        var sig = appSize + '/' + inputSize + '/' + (p.top === 'inputs' ? 'inputs' : 'apps');
        if (state.layoutSig !== sig) {
            state.layoutSig = sig;
            UI.resetScroll($('apps-row'));
            UI.resetScroll($('inputs-row'));
        }

        renderHomeWeather();
    }

    // The TV takes ~4 s to list its ~450 apps, so Home is drawn from the last list we saw
    // and only redrawn if a fresh list differs.
    function readCache() {
        try {
            return JSON.parse(localStorage.getItem(CACHE_KEY));
        } catch (e) {
            return null;
        }
    }

    function writeCache(apps) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(apps));
        } catch (e) {
            // Without the cache we only lose the fast start.
        }
    }

    var listeners = [];
    /*
     * Hidden game code: Left and Right alternating three times.
     *
     * Two properties matter on a remote. It is matched against the tail of the last few keys,
     * not with a position counter, because a held key repeats and one extra press would
     * otherwise reset progress so the code could never complete. And it alternates rather than
     * repeating a key, because both auto-repeat and sweeping along a row produce runs of the
     * same key — a code made of runs fires by accident during ordinary browsing.
     */
    var gameCode = [KEY.LEFT, KEY.RIGHT, KEY.LEFT, KEY.RIGHT, KEY.LEFT, KEY.RIGHT];
    var recentKeys = [];

    function gameCodeEntered(k) {
        recentKeys.push(k);
        if (recentKeys.length > gameCode.length) recentKeys.shift();
        if (recentKeys.length < gameCode.length) return false;
        for (var i = 0; i < gameCode.length; i++) {
            if (recentKeys[i] !== gameCode[i]) return false;
        }
        recentKeys.length = 0;
        return true;
    }

    function setApps(apps) {
        var sig = apps.map(function (a) { return a.id + '|' + a.name + '|' + a.show; }).join(',');
        if (sig === state.appsSig) return;
        state.appsSig = sig;
        state.apps = apps;
        renderHome();
        if (UI.isVisible('all')) UI.show('all', { back: true });
        listeners.forEach(function (fn) { fn(); });
    }

    function loadApps() {
        state.lastFetch = Date.now();
        return Apps.getInstalledApps().then(function (apps) {
            var list = Apps.launchable(apps).map(function (a) {
                return { id: a.id, name: a.name, show: a.show, iconPath: a.iconPath || '' };
            });
            writeCache(list);
            setApps(list);
        }).catch(function (err) {
            UI.toast('Could not list apps: ' + DevLog.errorText(err));
            log('App list failed: ' + DevLog.errorText(err));
        });
    }

    function registerKeys() {
        try {
            tizen.tvinputdevice.registerKeyBatch(['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue']);
        } catch (e) {
            log('Colour keys unavailable: ' + DevLog.errorText(e));
        }
    }

    function registerViews() {
        UI.register('home', {
            el: $('home'),
            startRow: 1,
            hints: [['OK', 'Open'], ['▲', 'Settings']],
            onShow: applyLayout,
            rows: function () {
                var apps = UI.children($('apps-row'));
                var inputs = UI.children($('inputs-row'));
                var top = Prefs.get().layout && Prefs.get().layout.top;
                var order = top === 'inputs' ? [inputs, apps] : [apps, inputs];
                var rows = [[$('gear')]];
                order.forEach(function (row) { if (row.length) rows.push(row); });
                return rows;
            },
            activate: function (item) {
                if (item.kind === 'app') launchApp(item);
                else if (item.kind === 'all') UI.show('all');
                else if (item.kind === 'input') openInput(item);
                else if (item.kind === 'settings') UI.show('settings');
            },
            // Home is the root: Back does nothing.
            onBack: function () { return true; }
        });
        $('gear')._item = { kind: 'settings' };

        UI.register('all', {
            el: $('all'),
            rows: function () { return UI.chunk(UI.children($('all-grid')), GRID_COLS); },
            onShow: renderAll,
            activate: launchApp,
            hints: [['OK', 'Open'], ['Back', 'Home']]
        });

        UI.register('lab', {
            el: $('lab'),
            rows: function () { return UI.children($('lab-list')).map(function (li) { return [li]; }); },
            activate: function (item) { item.run(); },
            hints: [['OK', 'Run'], ['Back', 'Home']]
        });
    }

    function init() {
        registerKeys();
        registerViews();
        UI.setColourKey(colourKey);
        UI.setKeyHook(function (k) {
            if (state.tvMode) {
                if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) exitTvMode();
                return true;
            }
            if (!UI.isVisible('home')) { recentKeys.length = 0; return false; }
            if (gameCodeEntered(k)) {
                if (window.RunnerGame) RunnerGame.open(true);
                return true;
            }
            return false;
        });
        Appearance.apply();
        updateClock();
        setInterval(updateClock, 10000);
        if (window.Weather) Weather.onUpdate(renderHomeWeather);
        renderHomeWeather();
        renderLab();
        var cached = readCache();
        if (cached && cached.length) setApps(cached);
        else renderHome();
        UI.show('home');
        Wallpaper.start();

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                if (state.tvMode) exitTvMode();
                return;
            }
            updateClock();
            refreshInputStatus();
            renderHomeWeather();
            if (UI.isVisible('home')) Wallpaper.homeShown();
            if (Date.now() - state.lastFetch > REFRESH_AFTER_MS) setTimeout(loadApps, 1500);
        });
        // With a cache, let the first frames and key presses through before the slow app list.
        setTimeout(loadApps, cached ? 2000 : 0);
        refreshInputStatus();
        // A console is often plugged in or powered on after the launcher started, and the TV
        // only reports it through VIDEOSOURCE. Poll while Home is on screen so the row keeps up.
        setInterval(function () {
            if (!document.hidden && UI.isVisible('home')) refreshInputStatus();
        }, 30 * 1000);
        log('Launcher started');
    }

    window.Home = {
        init: init,
        apps: function () { return state.apps; },
        homeItems: homeItems,
        setHomeItems: setHomeItems,
        inputs: inputs,
        homeInputs: homeInputs,
        detectedInputs: function () {
            return homeInputs().filter(function (i) { return i.auto; });
        },
        setInputs: setInputs,
        hdmiStatus: function () { return state.hdmi; },
        // An HDMI input shown inside the launcher: no screen saver over it.
        tvMode: function () { return state.tvMode; },
        refreshInputStatus: refreshInputStatus,
        renderLab: renderLab,
        applyLayout: applyLayout,
        updateClock: updateClock,
        reloadApps: loadApps,
        miniTile: miniTile,
        miniInputTile: miniInputTile,
        onAppsChanged: function (fn) { listeners.push(fn); },
        onInputsChanged: function (fn) { inputListeners.push(fn); }
    };
})();
