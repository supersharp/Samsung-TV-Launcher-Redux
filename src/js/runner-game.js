/* Small, self-contained remote-controlled runner Easter egg. */
(function () {
    'use strict';

    var canvas = document.getElementById('runner-canvas');
    var ctx = canvas.getContext('2d');
    var runner = new Image();
    var obstacle = new Image();
    var music = new Audio('audio/lumiere.m4a');
    music.loop = true;
    music.volume = 0.24;
    music.preload = 'none';
    runner.src = 'img/easter-egg/runner-sprite.png';
    obstacle.src = 'img/easter-egg/obstacle-sprite.png';

    var state = 'intro';
    var raf = 0;
    var last = 0;
    var elapsed = 0;
    var score = 0;
    var speed = 520;
    var ground = 870;
    var jumpY = 0;
    var jumpV = 0;
    var crouching = false;
    var crouchTimer = null;
    var nextObstacle = 1.8;
    var obstacles = [];
    var lastAirType = null;
    var sameTypeCount = 0;
    var obstacleCount = 0;
    var imageError = false;

    function text(value, x, y, size, color, align, weight) {
        ctx.fillStyle = color || '#fff';
        ctx.font = (weight || 500) + ' ' + size + 'px Manrope, Arial, sans-serif';
        ctx.textAlign = align || 'left';
        ctx.fillText(value, x, y);
    }

    function spriteRect(img, x, bottom, maxW, maxH) {
        var scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
        var w = img.naturalWidth * scale;
        var h = img.naturalHeight * scale;
        return { x: x + (maxW - w) / 2, y: bottom - h, w: w, h: h };
    }

    function drawSprite(img, x, bottom, maxW, maxH) {
        if (!img.complete || !img.naturalWidth) return null;
        var r = spriteRect(img, x, bottom, maxW, maxH);
        ctx.drawImage(img, r.x, r.y, r.w, r.h);
        return r;
    }

    function playerRect(bottom) {
        var r = spriteRect(runner, 235, bottom, 230, 310);
        if (crouching) {
            r.h *= 0.58;
            r.y = bottom - r.h;
        }
        return r;
    }

    function drawCamille(bottom) {
        if (!runner.complete || !runner.naturalWidth) return;
        var r = playerRect(bottom);
        ctx.drawImage(runner, r.x, r.y, r.w, r.h);
    }

    function playMusic() {
        try {
            music.currentTime = 0;
            var result = music.play();
            if (result && result.catch) result.catch(function () {});
        } catch (e) {}
    }

    function stopMusic() {
        try { music.pause(); music.currentTime = 0; } catch (e) {}
    }

    /*
     * The sky never changes, so it is built once. Rebuilding it per frame allocated a gradient
     * object sixty times a second for an identical result — and large gradient fills are the one
     * thing this TV measured badly at (see the header of css/style.css).
     */
    var sky = null;

    function skyFill() {
        if (!sky) {
            sky = ctx.createLinearGradient(0, 0, 0, 1080);
            sky.addColorStop(0, '#14222e');
            sky.addColorStop(1, '#34433c');
        }
        return sky;
    }

    function draw() {
        ctx.fillStyle = skyFill();
        ctx.fillRect(0, 0, 1920, 1080);
        ctx.fillStyle = 'rgba(255,255,255,.06)';
        ctx.beginPath(); ctx.arc(1500, 230, 120, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#26352f';
        ctx.fillRect(0, ground, 1920, 1080 - ground);
        ctx.fillStyle = '#d4c9a1';
        ctx.fillRect(0, ground, 1920, 5);
        for (var i = 0; i < 9; i++) {
            var x = (i * 271 - (elapsed * speed * 0.22) % 271 + 1920) % 1920;
            ctx.fillStyle = 'rgba(216,229,204,.14)';
            ctx.fillRect(x, ground + 62 + (i % 3) * 23, 72, 5);
        }
        text('CAMILLE: THE RUNAWAY BRIDE', 120, 125, 28, 'rgba(255,255,255,.72)', 'left', 700);
        text(String(Math.floor(score)).padStart(5, '0'), 1800, 130, 44, '#fff', 'right', 700);

        drawCamille(ground - jumpY);
        obstacles.forEach(function (o) {
            if (o.air) drawSprite(obstacle, o.x, ground - o.airHeight, 135, 125);
            else drawSprite(obstacle, o.x, ground, o.size, o.size);
        });

        if (state === 'loading') {
            ctx.fillStyle = 'rgba(5,9,14,.78)'; ctx.fillRect(0, 0, 1920, 1080);
            text('Getting the game ready…', 960, 520, 42, '#fff', 'center', 700);
        } else if (state === 'intro') {
            ctx.fillStyle = 'rgba(5,9,14,.56)'; ctx.fillRect(0, 0, 1920, 1080);
            text('A ONE-PLAYER WEDDING ESCAPE', 960, 360, 28, '#d9dfd4', 'center', 700);
            text('Help Camille make her getaway', 960, 450, 58, '#fff', 'center', 700);
            text('OK / Up: jump     Down: duck', 960, 555, 31, '#d9dfd4', 'center', 500);
            text('OK  Start', 960, 700, 25, '#fff', 'center', 700);
        } else if (state === 'error') {
            ctx.fillStyle = 'rgba(5,9,14,.78)'; ctx.fillRect(0, 0, 1920, 1080);
            text('The game photos could not be loaded.', 960, 470, 42, '#fff', 'center', 700);
            text('Press Back to return Home.', 960, 540, 27, '#d9dfd4', 'center', 500);
        } else if (state === 'over') {
            ctx.fillStyle = 'rgba(5,9,14,.64)'; ctx.fillRect(0, 0, 1920, 1080);
            text('Arnaud caught Camille.', 960, 440, 58, '#fff', 'center', 700);
            text('Distance  ' + Math.floor(score), 960, 525, 32, '#d9dfd4', 'center', 500);
            text('OK  Try again', 960, 640, 27, '#fff', 'center', 700);
        }
    }

    function start() {
        if (imageError) {
            state = 'error';
            draw();
            return;
        }
        if (!runner.complete || !runner.naturalWidth || !obstacle.complete || !obstacle.naturalWidth) {
            state = 'loading';
            draw();
            return;
        }
        state = 'play'; elapsed = 0; score = 0; speed = 480;
        nextObstacle = 2.2; obstacles = []; jumpY = 0; jumpV = 0;
        lastAirType = null; sameTypeCount = 0; obstacleCount = 0;
        crouching = false; clearTimeout(crouchTimer);
        last = 0;
        cancelAnimationFrame(raf);
        playMusic();
        raf = requestAnimationFrame(frame);
    }

    function jump() {
        if (state !== 'play') { start(); return; }
        if (jumpY === 0 && !crouching) jumpV = 910;
    }

    function duck() {
        if (state !== 'play' || jumpY > 0) return;
        crouching = true;
        clearTimeout(crouchTimer);
        crouchTimer = setTimeout(function () { crouching = false; }, 650);
    }

    function frame(now) {
        if (state !== 'play') return;
        var dt = Math.min((now - (last || now)) / 1000, 0.04);
        last = now;
        elapsed += dt;
        score += dt * 12;
        speed = Math.min(830, 480 + elapsed * 8);
        jumpY += jumpV * dt;
        jumpV -= 2200 * dt;
        if (jumpY < 0) { jumpY = 0; jumpV = 0; }
        nextObstacle -= dt;
        if (nextObstacle <= 0) {
            var air = obstacleCount === 0 ? false : Math.random() < 0.48;
            sameTypeCount = air === lastAirType ? sameTypeCount + 1 : 1;
            if (sameTypeCount > 2) { air = !air; sameTypeCount = 1; }
            lastAirType = air;
            obstacles.push({
                x: 1960,
                air: air,
                airHeight: Math.random() < 0.5 ? 215 : 235,
                size: obstacleCount === 0 ? 120 : (Math.random() < 0.5 ? 132 : 145)
            });
            obstacleCount++;
            nextObstacle = Math.max(1.95, 2.9 - elapsed * 0.015) + Math.random() * 0.35;
        }
        obstacles.forEach(function (o) { o.x -= speed * dt; });
        obstacles = obstacles.filter(function (o) { return o.x > -140; });
        var player = playerRect(ground - jumpY);
        obstacles.forEach(function (o) {
            var target = o.air
                ? spriteRect(obstacle, o.x, ground - o.airHeight, 135, 125)
                : spriteRect(obstacle, o.x, ground, o.size, o.size);
            var horizontalOverlap = player.x + player.w * 0.78 > target.x + target.w * 0.12 &&
                player.x + player.w * 0.22 < target.x + target.w * 0.88;
            var verticalOverlap = player.y + player.h > target.y + target.h * 0.08 &&
                player.y < target.y + target.h * 0.88;
            if (state === 'play' && horizontalOverlap && verticalOverlap) {
                state = 'over';
                stopMusic();
            }
        });
        draw();
        if (state === 'play') raf = requestAnimationFrame(frame);
    }

    function show() { state = 'intro'; draw(); }
    function hide() { cancelAnimationFrame(raf); stopMusic(); }

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            stopMusic();
            cancelAnimationFrame(raf);
        } else if (UI.isVisible('runner-game') && state === 'play') {
            last = 0;
            playMusic();
            raf = requestAnimationFrame(frame);
        }
    });

    document.addEventListener('keyup', function (event) {
        if (event.keyCode !== UI.KEY.DOWN) return;
        clearTimeout(crouchTimer);
        crouching = false;
        if (UI.isVisible('runner-game') && state === 'play') draw();
    });

    runner.onerror = obstacle.onerror = function () {
        imageError = true;
        if (UI.isVisible('runner-game')) { state = 'error'; draw(); }
    };
    runner.onload = obstacle.onload = function () {
        if (!UI.isVisible('runner-game')) return;
        if (state === 'loading' && runner.complete && runner.naturalWidth &&
                obstacle.complete && obstacle.naturalWidth) start();
        else if (state === 'intro') draw();
    };

    UI.register('runner-game', {
        el: document.getElementById('runner-game'),
        hints: [['OK / Up', 'Jump'], ['Down', 'Duck'], ['Back', 'Home']],
        rows: function () { return []; },
        onShow: show,
        onKey: function (key) {
            if (key === UI.KEY.ENTER || key === UI.KEY.UP) { jump(); return true; }
            if (key === UI.KEY.DOWN) { duck(); return true; }
            return false;
        },
        onBack: function () { hide(); return false; }
    });
    window.RunnerGame = {
        open: function (startNow) {
            UI.show('runner-game');
            if (startNow) start();
        },
        // False when the personal sprites are not in this build (they are gitignored).
        assetsReady: function () {
            if (imageError) return false;
            if (runner.complete && runner.naturalWidth === 0) return false;
            if (obstacle.complete && obstacle.naturalWidth === 0) return false;
            return true;
        }
    };
})();
