// ===== CONFIG & UI BOOTSTRAP =====
// Mobile detection
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Show overlays and block game on mobile
window.addEventListener('DOMContentLoaded', function() {
    // Render a sparse, game-like field of falling shapes for the home screen.
    // It intentionally has no hoverboard or HUD elements.
    const HOME_ORB_DENSITY = 0.15;
    const HOME_ORB_COLORS = ['#FF385F', '#FF7A18', '#FFD814', '#61EC2E', '#18B7EE', '#8B25EE'];
    const HOME_ORB_SHAPES = ['circle', 'triangle', 'square', 'pentagon', 'hexagon', 'star', 'semicircle'];
    let homeOrbs = [];
    let homeBgSize = { width: 0, height: 0 };
    let homeBgLastFrame = performance.now();

    function makeHomeOrb(width, height, entering) {
        const radius = 7 + Math.random() * 8;
        return {
            x: radius + Math.random() * Math.max(1, width - radius * 2),
            y: entering ? -radius - Math.random() * height * 0.18 : Math.random() * height,
            radius,
            color: HOME_ORB_COLORS[Math.floor(Math.random() * HOME_ORB_COLORS.length)],
            shape: HOME_ORB_SHAPES[Math.floor(Math.random() * HOME_ORB_SHAPES.length)],
            speed: 26 + Math.random() * 38,
            rotation: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 0.8
        };
    }

    function drawHomeOrb(ctx, orb) {
        const sides = orb.shape === 'triangle' ? 3 : orb.shape === 'square' ? 4 : orb.shape === 'pentagon' ? 5 : orb.shape === 'hexagon' ? 6 : 0;
        ctx.save();
        ctx.translate(orb.x, orb.y);
        ctx.rotate(orb.rotation);
        ctx.fillStyle = orb.color;
        ctx.shadowColor = orb.color;
        ctx.shadowBlur = 10;
        ctx.globalAlpha = 0.78;
        ctx.beginPath();
        if (orb.shape === 'circle') {
            ctx.arc(0, 0, orb.radius, 0, Math.PI * 2);
        } else if (orb.shape === 'semicircle') {
            ctx.arc(0, 0, orb.radius, -Math.PI / 2, Math.PI / 2);
            ctx.lineTo(0, orb.radius);
            ctx.closePath();
        } else if (orb.shape === 'star') {
            for (let point = 0; point < 10; point++) {
                const angle = -Math.PI / 2 + point * Math.PI / 5;
                const radius = point % 2 ? orb.radius * 0.46 : orb.radius;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                point ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.closePath();
        } else {
            for (let point = 0; point < sides; point++) {
                const angle = -Math.PI / 2 + point * Math.PI * 2 / sides;
                const x = Math.cos(angle) * orb.radius;
                const y = Math.sin(angle) * orb.radius;
                point ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.closePath();
        }
        ctx.fill();
        ctx.restore();
    }

    function drawStartBgOnce() {
        const canvas = document.getElementById('startBgCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = window.innerWidth;
        const H = window.innerHeight;
        if (canvas.width !== W || canvas.height !== H) {
            canvas.width = W;
            canvas.height = H;
        }
        if (homeBgSize.width !== W || homeBgSize.height !== H) {
            const orbCount = Math.max(7, Math.round((W * H / (1920 * 1080)) * 80 * HOME_ORB_DENSITY));
            homeOrbs = Array.from({ length: orbCount }, () => makeHomeOrb(W, H, false));
            homeBgSize = { width: W, height: H };
        }
        const now = performance.now();
        const dt = Math.min(0.05, (now - homeBgLastFrame) / 1000);
        homeBgLastFrame = now;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#061017';
        ctx.fillRect(0, 0, W, H);
        const bgWaveCount = 3;
        for (let i = 0; i < bgWaveCount; i++) {
            const t = now / 1000 + i * 2;
            ctx.globalAlpha = 0.09 + 0.06 * Math.sin(t + i);
            const grad = ctx.createLinearGradient(0, 0, W, H);
            grad.addColorStop(0, `hsl(${200 + i * 30}, 80%, 18%)`);
            grad.addColorStop(1, `hsl(${220 + i * 30}, 90%, 11%)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(0, H * (0.2 + 0.2 * Math.sin(t)));
            for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H * (0.2 + 0.2 * Math.sin(t + x / 200 + i)));
            ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
        }
        homeOrbs.forEach((orb, index) => {
            orb.y += orb.speed * dt;
            orb.rotation += orb.spin * dt;
            if (orb.y - orb.radius > H + 10) homeOrbs[index] = makeHomeOrb(W, H, true);
            drawHomeOrb(ctx, homeOrbs[index]);
        });
        ctx.globalAlpha = 1;
    }

    // Continuous animation loop for start background while tutorial overlay exists
    function startBgLoop() {
        const canvas = document.getElementById('startBgCanvas');
        if (!canvas) return;
        drawStartBgOnce();
        // keep animating only while tutorial overlay is present and visible
        const t = document.getElementById('tutorialOverlay');
        if (t && window.getComputedStyle(t).display !== 'none') {
            window._startBgAnimId = requestAnimationFrame(startBgLoop);
        } else {
            try { if (window._startBgAnimId) { cancelAnimationFrame(window._startBgAnimId); window._startBgAnimId = null; } } catch(e){}
        }
    }
    // kick off the start bg animation if overlay is present
    try { setTimeout(startBgLoop, 80); } catch(e){}
    // Title colorizer: assign each character of #coloroidTitle a random color from the palette (single run)
    function randomizeTitleColors() {
        try {
            var el = document.getElementById('coloroidTitle');
            if (!el) return;
            var text = el.textContent || el.innerText || 'COLMETRY';
            // Build color set from the game's palette constants (PALETTE_BASE). Exclude white/GOLDEN.
            var cset = PALETTE_BASE.map(function(p){ return (p && p.fill) ? p.fill : null; }).filter(Boolean);
            try { if (HEART_COLOR && HEART_COLOR.trim() && HEART_COLOR.toUpperCase() !== (GOLDEN || '').toUpperCase()) cset.push(HEART_COLOR.trim()); } catch(e){}
            var goldenVal = (GOLDEN || '').toUpperCase();
            cset = cset.filter(function(col){ return col && col.toUpperCase() !== goldenVal; });
            if (cset.length === 0) { cset = PALETTE_BASE.map(p=>p.fill).filter(f=>f && f.toUpperCase() !== goldenVal); }

            // Prepare unique-per-character assignment. Keep order random by shuffling.
            var pool = cset.slice();
            try { pool = shuffle(pool); } catch(e) { /* fallback: use as-is */ }
            // Count non-space characters to color
            var letters = text.split('').filter(function(ch){ return ch.trim() !== ''; }).length;
            // If we don't have enough distinct colors, repeat the shuffled pool until we have enough
            var assigned = [];
            while (assigned.length < letters) {
                assigned = assigned.concat(pool.slice(0, Math.min(pool.length, letters - assigned.length)));
                if (pool.length === 0) break; // safety
            }

            // Build spans, consuming assigned colors in order for non-space characters
            var parts = [];
            var idx = 0;
            for (var i = 0; i < text.length; i++) {
                var ch = text[i];
                if (ch.trim() === '') { parts.push(ch); continue; }
                var col = assigned[idx % assigned.length] || cset[Math.floor(Math.random() * cset.length)];
                // outline using webkit-text-stroke and a subtle multi-shadow fallback
                var span = '<span style="color:' + col + '; -webkit-text-stroke:1px rgba(0,0,0,0.85); text-shadow:0 0 2px rgba(0,0,0,0.6), 0 1px 0 rgba(0,0,0,0.6);">' + ch + '</span>';
                parts.push(span);
                idx++;
            }
            el.innerHTML = parts.join('');
        } catch (e) { }
    }
    // Run once shortly after load so the title is colorized randomly on the home screen
    try { setTimeout(randomizeTitleColors, 120); } catch (e) {}

    // Re-run randomization whenever the tutorial overlay is shown or inserted into the DOM
    try {
        function observeTutorialOverlay() {
            try {
                var checkAndRun = function() {
                    var t = document.getElementById('tutorialOverlay');
                    if (t && window.getComputedStyle(t).display !== 'none') {
                        randomizeTitleColors();
                    }
                };
                // Initial check
                checkAndRun();
                // Observe body for new nodes (overlay may be cloned and reinserted)
                var mo = new MutationObserver(function(muts){
                    for (var m of muts) {
                        if (m.type === 'childList') {
                            for (var n of m.addedNodes) {
                                if (n && (n.id === 'tutorialOverlay' || (n.querySelector && n.querySelector('#tutorialOverlay')))) { checkAndRun(); return; }
                            }
                        } else if (m.type === 'attributes') {
                            if (m.target && m.target.id === 'tutorialOverlay') { checkAndRun(); }
                        }
                    }
                });
                mo.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['style','class'] });
            } catch(e){}
        }
        observeTutorialOverlay();
    } catch(e){}
    // (duplicate endGame/restart removed — single canonical implementations exist earlier in the file)
    const gameContainer = document.querySelector('.game-container');

    // Show tutorial overlay
    if (tutorial) tutorial.style.display = 'flex';
    if (gameContainer) gameContainer.style.pointerEvents = 'none';

    // Click to play handler (anywhere on overlay)
    function startGameFromTutorial(e) {
    // Hide overlay bg canvas
    const startBgCanvas = document.getElementById('startBgCanvas');
    if (startBgCanvas) startBgCanvas.style.display = 'none';
        // Only allow click if overlay is visible
        if (tutorial && tutorial.style.display !== 'flex') return;
        // Prevent accidental double start
        if (!window._coloroidGameBlocked) return;
        // Hide overlay and enable game
        tutorial.style.display = 'none';
        if (gameContainer) gameContainer.style.pointerEvents = '';
        // Fullscreen
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
        }
        // Actually start game
        if (typeof window.startColoroidGame === 'function') {
            window.startColoroidGame();
        }
    }
    if (tutorial) {
        tutorial.addEventListener('click', startGameFromTutorial);
        // Also allow pressing Enter/Space to start
        window.addEventListener('keydown', function(e) {
            if (window._coloroidGameBlocked && (e.code === 'Enter' || e.code === 'Space')) {
                startGameFromTutorial();
            }
        });
    }
    // Prevent game loop until click
    window._coloroidGameBlocked = true;
});
const PALETTE_SWAP_SEC = 30;
const MAX_LIVES = 3;
const SCORE_GOLDEN = 100;
const POWERUP_DURATION_SEC = 15;
const POWERUP_MIN_SPAWN_DELAY = 5;
const SPAWN_EVERY_MS_BASE = 900;
const MAX_BALL_SPEED = 1000;
const PALETTE_BASE = [
    { name: 'Fluoro Red', fill: '#FF385F' },
    { name: 'Electric Orange', fill: '#FF7100' },
    { name: 'Neon Yellow', fill: '#FFE925' },
    { name: 'Acid Lime', fill: '#73FA2E' },
    { name: 'Azure', fill: '#11B5EA' },
    { name: 'Hyper Purple', fill: '#9C1DF8' }
];
const GOLDEN = '#FFFFFF'; // Bright white star for 100 pts
const HEART_COLOR = getCSS('--heart');
const COLOR_WAVELENGTHS = {
    'Fluoro Red': 700,
    'Electric Orange': 620,
    'Neon Yellow': 580,
    'Acid Lime': 530,
    'Azure': 470,
    'Hyper Purple': 425
};
// Powerup Types
const POWERUP_TYPES = [
    { type: 'shield' },
    { type: 'clock' },
    { type: 'magnet' }
];
const SPECIAL_OBJECTS = ['heart', 'goldenStar', ...POWERUP_TYPES.map(p => p.type)];

const SPECIAL_ORB_SIZE = () => Math.max(20, Math.min(30, W * 0.017)); // all specials same size
const ORBS_MIN = 3; // Start orb density
const ORBS_MAX = 10; // Max orb density

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let DPR = Math.max(1, window.devicePixelRatio || 1);
let W = window.innerWidth, H = window.innerHeight;

let mouseX = W / 2, mouseY = H / 2;
let mouseInGame = false;

function getCSS(varName) {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim();
}

function resizeCanvas() {
    W = window.innerWidth; H = window.innerHeight;
    DPR = Math.max(1, window.devicePixelRatio || 1);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function getPaddleConfig() {
    return {
        w: Math.max(108, W * 0.144),
        h: 22,
        y: H - 64,
        speed: Math.max(520, W * 1.25)
    };
}

const GAME_SPEED_START = 1.2;
const GAME_SPEED_MAX = 3.0;
function getBallBaseSpeed() {
    const base = 200 * GAME_SPEED_START;
    const speedMul = Math.min(GAME_SPEED_START + elapsed * 0.015, GAME_SPEED_MAX);
    return Math.max(base, H * 0.28 * speedMul);
}

// ===== STATE =====

let palette = PALETTE_BASE.slice();
let nextPaletteSwapAt = 0;

let score = 0;
let lives = MAX_LIVES;
let orbs = [];
let scorePopups = [];
let lastSpawnAt = performance.now();
let lastTime = performance.now();
let animationFrameId = null;
let elapsed = 0;
let paused = false;
let gameOver = false;
let colorIndex = 0;
let prevSpawnXs = [null, null];
let prevSpawnShapes = [];
let pulse = 0;
let flash = 0;
let palettePulse = 0;
let paddleBounce = 0;
let powerupTimers = { shield: 0, clock: 0, magnet: 0 };
let lastPowerupSpawn = -POWERUP_MIN_SPAWN_DELAY * 2000; // allow spawn at start
// Session guards to prevent powerup carry-over between restarts
let powerupSessionId = 1;
let powerupActiveSession = { shield: 0, clock: 0, magnet: 0 };
// Startup / engine guard
window._coloroidGameBlocked = window._coloroidGameBlocked === undefined ? true : window._coloroidGameBlocked;
let engineRunning = false;

const uiScore = document.getElementById('uiScore');
const uiLives = document.getElementById('uiLives');
const uiSpeed = document.getElementById('uiSpeed');
const uiTimer = document.getElementById('uiTimer');
const uiCurrDot = document.getElementById('uiCurrDot');
const uiNextDot = document.getElementById('uiNextDot');
const uiNextName = document.getElementById('uiNextName');
const overlayEl = document.getElementById('overlay');

let paddleX = 0;
let paddleShrinkActive = false;
let paddleShrinkTarget = 1;
let paddleShrinkCurrent = 1;
let paddleBounceAnim = 0;
const HOVERBOARD_SCORE_STEP = 1000;
const HOVERBOARD_CHANGE_DURATION = 0.55;
const HOVERBOARD_ASPECT = 1200 / 120;
const HOVERBOARD_SOURCES = [
    'SPRITES/RECT.png',
    'SPRITES/TRAP.png',
    'SPRITES/HEXE.png',
    'SPRITES/OCTE.png',
    'SPRITES/OCEL.png',
    'SPRITES/AHED.png'
];
const hoverboardSprites = HOVERBOARD_SOURCES.map((src) => {
    const image = new Image();
    image.src = src;
    return image;
});
const hoverboardLayers = new Array(HOVERBOARD_SOURCES.length);
const hoverboardRenderCanvas = document.createElement('canvas');
hoverboardRenderCanvas.width = 512;
hoverboardRenderCanvas.height = Math.round(512 / HOVERBOARD_ASPECT);
const hoverboardRenderCtx = hoverboardRenderCanvas.getContext('2d');
// Extra transparent room lets the Shield sit outside the board instead of tinting it.
const HOVERBOARD_SHIELD_PADDING_X = 12;
const HOVERBOARD_SHIELD_PADDING_Y = 8;
const hoverboardShieldCanvas = document.createElement('canvas');
hoverboardShieldCanvas.width = hoverboardRenderCanvas.width + HOVERBOARD_SHIELD_PADDING_X * 2;
hoverboardShieldCanvas.height = hoverboardRenderCanvas.height + HOVERBOARD_SHIELD_PADDING_Y * 2;
const hoverboardShieldCtx = hoverboardShieldCanvas.getContext('2d');
let hoverboardLevel = 0;
let hoverboardChangeTime = 0;

function createHoverboardLayers(image) {
    const source = document.createElement('canvas');
    source.width = image.naturalWidth;
    source.height = image.naturalHeight;
    const sourceCtx = source.getContext('2d', { willReadFrequently: true });
    sourceCtx.drawImage(image, 0, 0);
    const pixels = sourceCtx.getImageData(0, 0, source.width, source.height);
    const darkPixels = new ImageData(source.width, source.height);
    const lightPixels = new ImageData(source.width, source.height);
    const shapePixels = new ImageData(source.width, source.height);

    for (let i = 0; i < pixels.data.length; i += 4) {
        const alpha = pixels.data[i + 3];
        if (!alpha) continue;
        const brightness = (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 3;
        const target = brightness < 128 ? darkPixels.data : lightPixels.data;
        target[i] = 255;
        target[i + 1] = 255;
        target[i + 2] = 255;
        target[i + 3] = alpha;
        shapePixels.data[i] = 255;
        shapePixels.data[i + 1] = 255;
        shapePixels.data[i + 2] = 255;
        shapePixels.data[i + 3] = alpha;
    }

    const dark = document.createElement('canvas');
    dark.width = source.width;
    dark.height = source.height;
    dark.getContext('2d').putImageData(darkPixels, 0, 0);

    const light = document.createElement('canvas');
    light.width = source.width;
    light.height = source.height;
    light.getContext('2d').putImageData(lightPixels, 0, 0);

    const shape = document.createElement('canvas');
    shape.width = source.width;
    shape.height = source.height;
    shape.getContext('2d').putImageData(shapePixels, 0, 0);
    return { dark, light, shape, width: source.width, height: source.height };
}

hoverboardSprites.forEach((image, index) => {
    const prepareLayers = () => { hoverboardLayers[index] = createHoverboardLayers(image); };
    if (image.complete && image.naturalWidth) prepareLayers();
    else image.addEventListener('load', prepareLayers, { once: true });
});

function updateHoverboardLevel(dt) {
    const nextLevel = Math.min(hoverboardSprites.length - 1, Math.floor(score / HOVERBOARD_SCORE_STEP));
    if (nextLevel !== hoverboardLevel) {
        hoverboardLevel = nextLevel;
        hoverboardChangeTime = HOVERBOARD_CHANGE_DURATION;
    }
    if (hoverboardChangeTime > 0) hoverboardChangeTime = Math.max(0, hoverboardChangeTime - dt);
}

function getPaddleWidth() {
    const baseW = getPaddleConfig().w;
    return baseW * paddleShrinkCurrent;
}
function resetPaddle() { paddleX = W / 2; }
resetPaddle();

// ===== INPUT =====
canvas.addEventListener('pointermove', ev => {
    const rect = canvas.getBoundingClientRect();
    const mx = ((ev.clientX - rect.left) / rect.width) * W;
    mouseX = mx;
    mouseY = ((ev.clientY - rect.top) / rect.height) * H;

    // Always set paddleX to mouse center, clamp to screen
    paddleX = clamp(mx, getPaddleWidth() / 2, W - getPaddleWidth() / 2);
// Ensure paddleX is always the center, even after resize
window.addEventListener('resize', () => {
    paddleX = clamp(paddleX, getPaddleWidth() / 2, W - getPaddleWidth() / 2);
});
    mouseInGame = true;
});
canvas.addEventListener('pointerleave', () => {
    mouseInGame = false;
});
canvas.addEventListener('pointerdown', ev => {
    if (ev.button === 0) {
        // Only allow shrink if enough mana
        if (mana > 0) {
            paddleShrinkActive = true;
            paddleShrinkTarget = 0.5;
        }
    }
});
canvas.addEventListener('pointerup', ev => {
    if (ev.button === 0) {
        paddleShrinkActive = false;
        paddleShrinkTarget = 1;
        // Trigger bounce animation if fully shrunk
        if (paddleShrinkCurrent <= 0.51) {
            paddleBounceAnim = 18; // frames for bounce
        }
    }
});
canvas.addEventListener('contextmenu', ev => {
    if (!paused && !gameOver && !window._coloroidGameBlocked) ev.preventDefault();
});
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function randRange(a, b) { return Math.random() * (b - a) + a; }
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]] } return a; }
function lerp(a, b, t) { return a + (b - a) * t; }

// ==== SPAWN & ORBS ====
const SHAPE_TYPES = [
    { type: 'semicircle', points: 5, speed: 0.4, weight: 35 },
    { type: 'triangle', points: 10, speed: 0.5, weight: 30 },
    { type: 'square', points: 15, speed: 0.6, weight: 25 },
    { type: 'pentagon', points: 20, speed: 0.7, weight: 20 },
    { type: 'hexagon', points: 25, speed: 0.8, weight: 15 },
    { type: 'star', points: 30, speed: 0.9, weight: 10 },
];
function nowMs() { return performance.now(); }

let canSpawnPowerup = true;
let lastPowerupType = null; function pickShapeTypeWeighted(usedShapes) {
    const viable = SHAPE_TYPES.filter(s => !usedShapes.includes(s.type));
    if (viable.length === 0) {
        usedShapes.length = 0;
        return pickShapeTypeWeighted(usedShapes);
    }
    const total = viable.reduce((a, s) => a + s.weight, 0);
    let r = Math.random() * total;
    for (const s of viable) {
        if (r < s.weight) return s;
        r -= s.weight;
    }
    return viable[viable.length - 1];
}
function chooseColors(shapesCount, currColorIdx) {
    const outColors = [];
    let currColorSpawns = Math.floor(shapesCount * 0.4);
    let restSpawns = shapesCount - currColorSpawns;
    let paletteOthers = palette.filter((c, idx) => idx !== currColorIdx);
    let restDist = restSpawns / paletteOthers.length;
    let counts = paletteOthers.map(() => Math.floor(restDist));
    let left = restSpawns - counts.reduce((a, b) => a + b, 0);
    for (let i = 0; i < left; i++) counts[i % counts.length]++;
    for (let i = 0; i < currColorSpawns; i++) outColors.push(palette[currColorIdx]);
    paletteOthers.forEach((color, idx) => { for (let c = 0; c < counts[idx]; c++) outColors.push(color); });
    shuffle(outColors);
    return outColors;
}

function spawnOrbs(orbsPerSpawn) {
    let usedShapes = [];
    let xs = [];
    prevSpawnShapes = [];
    const colorOrder = chooseColors(orbsPerSpawn, colorIndex);

    // Only allow one heart in orbs or in this spawn batch
    const heartCount = orbs.reduce((count, orb) => count + (orb.isHeart ? 1 : 0), 0);
    let heartSpawnedThisBatch = false;
    const powerupCount = orbs.reduce((count, orb) => orb.isPowerup ? count + 1 : count, 0);

    for (let i = 0; i < orbsPerSpawn; i++) {
        let shapeObj = pickShapeTypeWeighted(usedShapes);
        usedShapes.push(shapeObj.type);
        let orbX, tries = 0;
        do {
            orbX = randRange(32, W - 32);
            tries++;
        } while (xs.some((x, idx) => Math.abs(x - orbX) < 64 && prevSpawnShapes[idx] === shapeObj.type) && tries < 20);
        xs.push(orbX);
        prevSpawnShapes.push(shapeObj.type);

        let isHeart = false;
        if (!isHeart && lives < MAX_LIVES && heartCount === 0 && !heartSpawnedThisBatch) {
            if (Math.random() < 0.1) {
                isHeart = true;
                heartSpawnedThisBatch = true;
            }
        }

        let isPowerup = false;
        let powerupType = null;
        if (!isHeart && powerupCount === 0 && nowMs() > lastPowerupSpawn + POWERUP_MIN_SPAWN_DELAY * 1000 && canSpawnPowerup && Math.random() < 0.08) {
            powerupType = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)].type;
            if (powerupType === lastPowerupType) powerupType = POWERUP_TYPES.filter(p => p.type !== lastPowerupType)[0].type;
            isPowerup = true;
            lastPowerupSpawn = nowMs();
            lastPowerupType = powerupType;
            canSpawnPowerup = false;
        }

        let isGolden = false;
        if (!isHeart && !isPowerup && Math.random() < 0.03) {
            isGolden = true;
        }

        if (isHeart) {
            spawnOrb({ isHeart: true, x: orbX });
        } else if (isPowerup) {
            spawnOrb({ isPowerup: true, powerupType, x: orbX });
        } else if (isGolden) {
            spawnOrb({ isGolden: true, x: orbX });
        } else {
            spawnOrb({
                colorObj: colorOrder[i],
                shapeObj,
                x: orbX
            });
        }
    }
    prevSpawnXs = xs.slice(-2);
}

function spawnOrb(opts = {}) {
    let r, x, colorObj, shapeType, shapePoints, vy, rotSpeed;
    let isPowerup = !!opts.isPowerup;
    let isGolden = !!opts.isGolden;
    let isHeart = !!opts.isHeart;
    let beating = false;
    let bubble = false;
    let powerupType = opts.powerupType || null;

    if (isHeart) {
        r = SPECIAL_ORB_SIZE();
        shapeType = 'heart';
        colorObj = { name: 'Heart', fill: HEART_COLOR };
        beating = true; bubble = true;
        vy = getBallBaseSpeed();
        shapePoints = 0;
    }
    else if (isPowerup) {
        r = SPECIAL_ORB_SIZE();
        shapeType = powerupType;
        colorObj = { name: powerupType, fill: '#ffffff' };
        beating = true; bubble = true;
        vy = getBallBaseSpeed() * 1.1;
        shapePoints = 0;
    }
    else if (isGolden) {
        r = SPECIAL_ORB_SIZE();
        shapeType = 'goldenStar';
        colorObj = { name: 'Golden', fill: GOLDEN };
        beating = true; bubble = true;
        vy = getBallBaseSpeed() * 1.4;
        shapePoints = SCORE_GOLDEN;
    }
    else {
        r = Math.max(8, Math.min(18, W * 0.008));
        colorObj = opts.colorObj;
        shapeType = opts.shapeObj.type;
        shapePoints = opts.shapeObj.points;
        rotSpeed = ((0.12 - ((COLOR_WAVELENGTHS[colorObj.name] || 500 - 400) / 300) * 0.09)) * 0.75;
        vy = Math.min(getBallBaseSpeed() * opts.shapeObj.speed, MAX_BALL_SPEED);
    }

    x = opts.x || randRange(r, W - r);
    const orb = {
        x,
        y: -r * 2,
        r,
        vy,
        colorName: colorObj.name,
        fill: colorObj.fill,
        shapeType,
        shapePoints,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (isHeart || isPowerup || isGolden) ? 0 : Math.abs(rotSpeed),
        bounceY: 0,
        bounceDir: 1,
        bounceAnim: false,
        isHeart, isGolden, isPowerup, powerupType,
        beating, bubble,
        spawnTime: nowMs()
    };
    orbs.push(orb);
}

function activatePowerup(type) {
    if (type === 'shield') powerupTimers.shield = POWERUP_DURATION_SEC;
    if (type === 'clock') powerupTimers.clock = POWERUP_DURATION_SEC;
    if (type === 'magnet') powerupTimers.magnet = POWERUP_DURATION_SEC;
    try { if (powerupActiveSession && typeof powerupSessionId !== 'undefined') powerupActiveSession[type] = powerupSessionId; } catch(e){}
}

function updatePowerups(dt) {
    // Clear any timers that belong to a previous session
    for (const key in powerupTimers) {
        try { if (powerupActiveSession[key] !== powerupSessionId) { powerupTimers[key] = 0; } } catch(e){}
        if (powerupTimers[key] > 0) {
            powerupTimers[key] -= dt;
            if (powerupTimers[key] < 0) powerupTimers[key] = 0;
        }
    }
    if (powerupTimers.shield > 0 || powerupTimers.clock > 0 || powerupTimers.magnet > 0) {
        document.body.classList.add('powerup-active');
    } else {
        document.body.classList.remove('powerup-active');
    }
}

// ==== GAME LOOP: COLLISIONS/LOGIC ====

let started = false;
let fallingDelay = 2000;
let startTime = 0;
function update(dt, now) {
    // Smoothly animate paddle shrink/grow
    const lerpSpeed = 0.13 + 0.25 * dt;
    paddleShrinkCurrent += (paddleShrinkTarget - paddleShrinkCurrent) * lerpSpeed;
    if (Math.abs(paddleShrinkCurrent - paddleShrinkTarget) < 0.01) paddleShrinkCurrent = paddleShrinkTarget;

    const paddle = getPaddleConfig();
    paddle.w = getPaddleWidth();
    paddleX = clamp(paddleX, paddle.w / 2, W - paddle.w / 2);

    updatePowerups(dt);

    // Orbs density grows with time
    const progress = Math.min(elapsed / 35, 1); // Full after 35 seconds
    const orbDensity = Math.floor(ORBS_MIN + (ORBS_MAX - ORBS_MIN) * progress);

    if (started && now - startTime > fallingDelay) {
        let spawnEvery = Math.max(220, SPAWN_EVERY_MS_BASE - Math.floor(elapsed) * 2);
        if (powerupTimers.clock > 0) {
            spawnEvery = spawnEvery * 2.5; // Or some other multiplier
        }
        if (now - lastSpawnAt > spawnEvery) {
            lastSpawnAt = now;
            spawnOrbs(orbDensity);
        }
    }

    const magnetActive = powerupTimers.magnet > 0;

    for (let i = orbs.length - 1; i >= 0; i--) {
        const o = orbs[i];
        if (o.isPowerup && (o.y > H)) { orbs.splice(i, 1); canSpawnPowerup = true; continue; }
        o.y += o.vy * dt * (powerupTimers.clock > 0 && !o.isPowerup ? 0.4 : 1);

        if (o.beating) {
            const t = (nowMs() - o.spawnTime) / 240;
            o.beatScale = 1 + Math.sin(t) * 0.18;
        }
        // Magnet: attraction by displacement path to palette center
        if (
            magnetActive &&
            o.shapeType !== undefined &&
            o.colorName === palette[colorIndex].name &&
            !o.isPowerup && !o.isHeart && !o.isGolden
        ) {
            // Only attract after orb has fallen 30% of the screen height
            if (o.y > H * 0.3) {
                let paddleCx = paddleX;
                let paddleCy = getPaddleConfig().y + getPaddleConfig().h / 2;
                const dx = paddleCx - o.x;
                const dy = paddleCy - o.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 2) {
                    o.x += dx * 0.13 * 0.3;
                    o.y += dy * 0.11 * 0.3;
                }
            }
        }

        o.rot += o.rotSpeed * dt * 60;

        if (o.bounceAnim) {
            o.bounceY += o.bounceDir * 18 * dt;
            if (o.bounceY > 28) o.bounceDir = -1;
            if (o.bounceY < 0) {
                o.bounceY = 0;
                o.bounceAnim = false;
                o.bounceDir = 1;
            }
        }

        if (o.y - o.r > H) { orbs.splice(i, 1); continue; }

        const px = paddleX, py = paddle.y, pw = paddle.w, ph = paddle.h;
    const cx = clamp(o.x, px - pw / 2, px + pw / 2); const cy = clamp(o.y, py, py + ph);
        const dx = o.x - cx, dy = o.y - cy;
        if (dx * dx + dy * dy <= o.r * o.r) {
            let popupScore = 0;
            if (o.isGolden) {
                score += SCORE_GOLDEN; popupScore = SCORE_GOLDEN;
                mana = Math.min(maxMana, mana + SCORE_GOLDEN); // Golden star points also add to mana
            } else if (o.isHeart) {
                lives = Math.min(MAX_LIVES, lives + 1);
            } else if (o.isPowerup) {
                activatePowerup(o.powerupType);
                canSpawnPowerup = true;
            } else if (o.colorName === palette[colorIndex].name) {
                score += o.shapePoints; popupScore = o.shapePoints;
                o.bounceAnim = true; o.bounceY = 0; o.bounceDir = 1;
                paddleBounce = 14;
                mana = Math.min(maxMana, mana + o.shapePoints); // 10 points = 10 mana
            } else {
                if (powerupTimers.shield > 0) {
                    // Immune from losing life
                } else {
                    lives -= 1; flash = 160;
                }
            }
            if (popupScore > 0) {
                scorePopups.push({ x: o.x, y: o.y, val: '+' + popupScore, t: 0, color: o.fill });
            }
            orbs.splice(i, 1);
        }
    }

    for (let i = scorePopups.length - 1; i >= 0; i--) {
        scorePopups[i].t += dt;
        if (scorePopups[i].t > 0.9) scorePopups.splice(i, 1);
    }

    if (now >= nextPaletteSwapAt) {
        const nextColor = palette[(colorIndex + 1) % palette.length];
        const currColor = palette[colorIndex];
        const rest = palette.slice(); rest.splice(colorIndex, 1);
        const shuffled = shuffle(rest);
        const newCurrIdx = Math.floor(Math.random() * (shuffled.length + 1));
        shuffled.splice(newCurrIdx, 0, currColor);
        palette = shuffled;
        colorIndex = palette.findIndex(c => c.name === nextColor.name);
        nextPaletteSwapAt = now + PALETTE_SWAP_SEC * 1000;
        palettePulse = 80;
    }

    // Shrink consumes mana
    if (paddleShrinkActive && mana > 0) {
        mana -= (dt * 10 * maxMana) / 100; // 10% per second
        if (mana <= 0) {
            mana = 0;
            paddleShrinkActive = false;
            paddleShrinkTarget = 1;
        }
    }
    // Clamp mana
    mana = Math.max(0, Math.min(maxMana, mana));
    updateManaBar();

    score = Math.max(0, score);
    lives = Math.max(0, Math.min(MAX_LIVES, lives));
    if (lives <= 0 && !gameOver) { endGame(); }
}

function endGame() {
    gameOver = true; paused = true;
    window.gameOver = true;
    window.paused = true;
    const menuButton = document.getElementById('btnMenu');
    if (menuButton) menuButton.style.display = 'none';
    overlayEl.classList.add('show');
    document.getElementById('overlayText').textContent = `Game Over — Score ${score}`;
    // Reveal footer credit on game over / overlay
    try{ var foot = document.querySelector('.footer-credit'); if (foot) { foot.style.display = 'flex'; foot.style.pointerEvents = 'auto'; } }catch(e){}
}

function restart() {
    score = 0;
    lives = MAX_LIVES;
    // Start restart with zero mana by design
    mana = 0;
    orbs = [];
    // Reset powerup timers so no powerups persist into the next session (preserve object identity)
    try {
        Object.keys(powerupTimers).forEach(function(k){ powerupTimers[k] = 0; });
    } catch (e) { powerupTimers = { shield: 0, clock: 0, magnet: 0 }; }
    // Bump session id to invalidate any previous powerup activations and clear active-session map
    try { powerupSessionId = (powerupSessionId || 0) + 1; Object.keys(powerupActiveSession).forEach(k=>powerupActiveSession[k]=0); } catch(e){}
    // Remove any UI indicators for active powerups
    try {
        document.body.classList.remove('powerup-active');
        var pShield = document.getElementById('pwrShield'); if (pShield) pShield.hidden = true;
        var pClock = document.getElementById('pwrClock'); if (pClock) pClock.hidden = true;
        var pMag = document.getElementById('pwrMagnet'); if (pMag) pMag.hidden = true;
        var powerupBar = document.getElementById('powerupBar'); if (powerupBar) powerupBar.hidden = true;
    } catch (e) {}
    // Reset powerup spawn gating so new session can spawn powerups normally
    try { canSpawnPowerup = true; lastPowerupSpawn = performance.now() - POWERUP_MIN_SPAWN_DELAY * 1000; lastPowerupType = null; } catch(e){}
    palette = PALETTE_BASE.slice();
    colorIndex = Math.floor(Math.random() * palette.length);
    nextPaletteSwapAt = performance.now() + PALETTE_SWAP_SEC * 1000;
    lastSpawnAt = performance.now();
    lastTime = performance.now();
    elapsed = 0;
    paused = false;
    gameOver = false;
    window.paused = false;
    window.gameOver = false;
    const menuButton = document.getElementById('btnMenu');
    if (menuButton) menuButton.style.display = 'grid';
    overlayEl.classList.remove('show');
    resetPaddle();
    paddleShrinkActive = false;
    paddleShrinkTarget = 1;
    paddleShrinkCurrent = 1;
    paddleBounceAnim = 0;
    hoverboardLevel = 0;
    hoverboardChangeTime = 0;
    updateManaBar();
    // Hide mouse pointer on restart
    const gameCanvas = document.getElementById('game');
    if (gameCanvas) gameCanvas.style.cursor = 'none';
    // Ensure footer credit stays hidden during gameplay
    try{ var foot = document.querySelector('.footer-credit'); if (foot) { foot.style.display = 'none'; foot.style.pointerEvents = 'none'; } }catch(e){}
    setTimeout(() => { started = true; }, fallingDelay);
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = requestAnimationFrame(loop);
}

function togglePause() {
    if (gameOver) return;
    paused = !paused;
    window.paused = paused;
    // Toggle Font Awesome play/pause icons
    if (typeof window.syncPlayPauseIcon === 'function') {
        window.syncPlayPauseIcon();
    }
    // Show mouse pointer when paused
    const gameCanvas = document.getElementById('game');
    if (gameCanvas) gameCanvas.style.cursor = paused ? 'default' : 'none';
    if (!paused) { lastTime = performance.now(); requestAnimationFrame(loop); }
}

// ==== RENDER DRAWING ====

function drawHoverboard(boardWidth, boardColor) {
    const boardHeight = Math.max(26, boardWidth / HOVERBOARD_ASPECT);
    const layer = hoverboardLayers[hoverboardLevel];
    const changeProgress = hoverboardChangeTime > 0
        ? 1 - hoverboardChangeTime / HOVERBOARD_CHANGE_DURATION
        : 1;
    const upgradePulse = Math.sin(changeProgress * Math.PI);
    const changeScale = 1 + upgradePulse * 0.08;

    ctx.save();
    ctx.translate(0, -upgradePulse * 4);
    ctx.scale(changeScale, 1 + upgradePulse * 0.035);

    if (layer) {
        // Build on an isolated canvas so sprite masking never affects the game scene.
        const bufferW = hoverboardRenderCanvas.width;
        const bufferH = hoverboardRenderCanvas.height;
        hoverboardRenderCtx.clearRect(0, 0, bufferW, bufferH);

        // Dark source pixels become the live active color.
        hoverboardRenderCtx.fillStyle = boardColor;
        hoverboardRenderCtx.fillRect(0, 0, bufferW, bufferH);
        hoverboardRenderCtx.globalCompositeOperation = 'destination-in';
        hoverboardRenderCtx.drawImage(layer.dark, 0, 0, bufferW, bufferH);
        hoverboardRenderCtx.globalCompositeOperation = 'source-over';

        // White source pixels form a Mana meter, expanding evenly from the board centre.
        const manaRatio = Math.max(0, Math.min(1, mana / maxMana));
        const fillWidth = bufferW * manaRatio;
        if (fillWidth > 0) {
            hoverboardRenderCtx.save();
            hoverboardRenderCtx.beginPath();
            hoverboardRenderCtx.rect((bufferW - fillWidth) / 2, 0, fillWidth, bufferH);
            hoverboardRenderCtx.clip();
            hoverboardRenderCtx.drawImage(layer.light, 0, 0, bufferW, bufferH);
            hoverboardRenderCtx.restore();
        }

        ctx.save();
        ctx.shadowColor = boardColor;
        ctx.shadowBlur = 14 + upgradePulse * 12;
        ctx.drawImage(hoverboardRenderCanvas, -boardWidth / 2, -boardHeight / 2, boardWidth, boardHeight);
        ctx.restore();

        // A restrained board-shaped afterimage makes a level change readable without obscuring play.
        if (hoverboardChangeTime > 0) {
            ctx.save();
            ctx.globalAlpha = upgradePulse * 0.16;
            ctx.shadowColor = boardColor;
            ctx.shadowBlur = 14;
            ctx.drawImage(hoverboardRenderCanvas, -boardWidth / 2, -boardHeight / 2 + upgradePulse * 7, boardWidth, boardHeight);
            ctx.restore();
        }

        if (powerupTimers.shield > 0) {
            // Build only the outside edge of the sprite alpha mask. The coloured and
            // Mana portions of the board remain untouched and fully visible beneath it.
            const shieldW = hoverboardShieldCanvas.width;
            const shieldH = hoverboardShieldCanvas.height;
            const shapeX = HOVERBOARD_SHIELD_PADDING_X;
            const shapeY = HOVERBOARD_SHIELD_PADDING_Y;
            hoverboardShieldCtx.clearRect(0, 0, shieldW, shieldH);
            hoverboardShieldCtx.save();
            for (const [offsetX, offsetY] of [[-6, 0], [6, 0], [0, -5], [0, 5], [-4, -4], [4, -4], [-4, 4], [4, 4]]) {
                hoverboardShieldCtx.drawImage(layer.shape, shapeX + offsetX, shapeY + offsetY, bufferW, bufferH);
            }
            hoverboardShieldCtx.globalCompositeOperation = 'destination-out';
            hoverboardShieldCtx.drawImage(layer.shape, shapeX, shapeY, bufferW, bufferH);
            hoverboardShieldCtx.globalCompositeOperation = 'source-in';
            hoverboardShieldCtx.fillStyle = '#00ffd0';
            hoverboardShieldCtx.fillRect(0, 0, shieldW, shieldH);
            hoverboardShieldCtx.globalCompositeOperation = 'source-over';
            hoverboardShieldCtx.restore();

            ctx.save();
            ctx.globalAlpha = 0.9;
            ctx.shadowColor = '#00ffd0';
            ctx.shadowBlur = 15;
            const shieldDrawWidth = boardWidth * shieldW / bufferW;
            const shieldDrawHeight = boardHeight * shieldH / bufferH;
            ctx.drawImage(hoverboardShieldCanvas, -shieldDrawWidth / 2, -shieldDrawHeight / 2, shieldDrawWidth, shieldDrawHeight);
            ctx.restore();
        }
    } else {
        // Keep the paddle playable while the sprite images are loading.
        ctx.fillStyle = boardColor;
        ctx.fillRect(-boardWidth / 2, -boardHeight * 0.18, boardWidth, boardHeight * 0.36);
    }

    ctx.restore();
}

function draw(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    const bgWaveCount = 3;
    for (let i = 0; i < bgWaveCount; i++) {
        const t = now / 1000 + i * 2;
        ctx.globalAlpha = 0.10 + 0.07 * Math.sin(t + i);
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, `hsl(${200 + i * 30}, 80%, 18%)`);
        grad.addColorStop(1, `hsl(${220 + i * 30}, 90%, 12%)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, H * (0.2 + 0.2 * Math.sin(t)));
        for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H * (0.2 + 0.2 * Math.sin(t + x / 200 + i)));
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    for (const o of orbs) {
        ctx.save();
        ctx.translate(o.x, o.y - (o.bounceAnim ? o.bounceY : 0));
        if (o.rot && !o.isHeart && !o.isPowerup && !o.isGolden) ctx.rotate(o.rot);

        // Bubble: nearly transparent, not beating
        if (o.bubble) {
            ctx.save();
            ctx.globalAlpha = 0.2;
            ctx.beginPath();
            ctx.arc(0, 0, o.r * 1.15, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255,255,255,0.22)";
            ctx.shadowColor = "#fff";
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.restore();
        }

        if (o.isHeart) {
            ctx.shadowBlur = 24; drawHeartPolygon(0, 0, o.r, HEART_COLOR);
        }
        else if (o.isPowerup) {
            ctx.shadowBlur = 14; ctx.globalAlpha = 1.0;
            drawPowerupIcon(ctx, o.powerupType, o.r);
        }
        else if (o.isGolden) {
            ctx.shadowBlur = 26;
            drawStar(ctx, 0, 0, o.r, o.r * 0.45, 5, GOLDEN, true, o.beatScale || 1);
        }
        else if (o.shapeType === 'semicircle') {
            drawSemiCircle(ctx, o.r, o.fill);
        } else if (o.shapeType === 'triangle') {
            drawPolygon(ctx, 3, o.r, o.fill, o.rot);
        } else if (o.shapeType === 'square') {
            ctx.beginPath(); ctx.rect(-o.r * 0.6, -o.r * 0.6, o.r * 1.2, o.r * 1.2);
            ctx.fillStyle = o.fill; ctx.fill();
        } else if (o.shapeType === 'pentagon') {
            drawPolygon(ctx, 5, o.r, o.fill, o.rot);
        } else if (o.shapeType === 'hexagon') {
            drawPolygon(ctx, 6, o.r, o.fill, o.rot);
        } else if (o.shapeType === 'star') {
            drawStar(ctx, 0, 0, o.r, o.r * 0.45, 5, o.fill, false);
        }
        ctx.restore();
    }

    for (const popup of scorePopups) {
        ctx.save();
        ctx.globalAlpha = 1 - popup.t;
        ctx.font = `bold ${Math.max(16, W * 0.018)}px system-ui, ui-sans-serif`;
        ctx.fillStyle = popup.color || '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 3;
        ctx.strokeText(popup.val, popup.x, popup.y - 24 - popup.t * 32);
        ctx.fillText(popup.val, popup.x, popup.y - 24 - popup.t * 32);
        ctx.restore();
    }

    // Paddle: palette, scale, effect
    let blinkNow = false;
    const timeLeft = (nextPaletteSwapAt - now) / 1000;
    if (palettePulse > 0) palettePulse -= 5;
    let padColor;
    let paletteScale = 1 + (palettePulse > 0 ? Math.max(0, Math.sin((palettePulse / 60) * Math.PI / 2)) * 0.25 : 0);
    if (paddleBounce > 0) paletteScale += Math.sin(paddleBounce / 14 * Math.PI) * 0.16, paddleBounce--;

    if (timeLeft <= 3 && timeLeft > 0) {
        if (!draw.blinkActive) { draw.blinkActive = true; draw.blinkInterval = now; draw.blinkState = false; }
        if (now - draw.blinkInterval > 200) { draw.blinkState = !draw.blinkState; draw.blinkInterval = now; }
        blinkNow = draw.blinkState;
    } else { draw.blinkActive = false; draw.blinkState = false; }
    padColor = blinkNow ? palette[(colorIndex + 1) % palette.length].fill : palette[colorIndex].fill;

    ctx.save();
    ctx.translate(paddleX, getPaddleConfig().y + getPaddleConfig().h / 2);
    ctx.scale(paletteScale, paletteScale);
    // Bounce effect
    let bounceScale = 1;
    if (paddleBounceAnim > 0) {
        bounceScale = 1 + Math.sin((18 - paddleBounceAnim) / 18 * Math.PI) * 0.22;
        paddleBounceAnim--;
    }
    const paddleW = getPaddleWidth() * bounceScale;
    drawHoverboard(paddleW, padColor);
    ctx.restore();

    if (pulse > 0) pulse -= 16;


    if (flash > 0) { ctx.save(); ctx.fillStyle = `rgba(255,0,0,${flash / 480})`; ctx.fillRect(0, 0, W, H); ctx.restore(); flash -= 16; }

    uiScore.textContent = score;
    uiTimer.textContent = Math.max(0, Math.ceil((nextPaletteSwapAt - now) / 1000));
    uiCurrDot.style.background = palette[colorIndex].fill;
    uiLives.innerHTML = '';
    for (let i = 0; i < MAX_LIVES; i++) {
        const s = document.createElement('span');
        s.className = 'heart-ui' + (i < lives ? '' : ' dim');
        uiLives.appendChild(s);
    }
    const powerupUi = [
        { type: 'shield', label: 'Shield', element: document.getElementById('pwrShield') },
        { type: 'clock', label: 'Slow', element: document.getElementById('pwrClock') },
        { type: 'magnet', label: 'Magnet', element: document.getElementById('pwrMagnet') }
    ];
    const activePowerup = powerupUi.some(({ type }) => powerupTimers[type] > 0);
    for (const { type, label, element } of powerupUi) {
        if (!element) continue;
        const remaining = Math.max(0, powerupTimers[type]);
        element.hidden = remaining <= 0;
        if (remaining > 0) {
            element.style.setProperty('--powerup-angle', `${(remaining / POWERUP_DURATION_SEC) * 360}deg`);
            element.setAttribute('aria-label', `${label} active: ${Math.ceil(remaining)} seconds remaining`);
        }
    }
    const powerupBar = document.getElementById('powerupBar');
    if (powerupBar) powerupBar.hidden = !activePowerup;

    if (mouseInGame) {
        ctx.save();
        // Use palette color (with blinking logic if desired)
        let currPaletteColor = palette[colorIndex].fill;
        let blink = false;
        const timeLeft = (nextPaletteSwapAt - performance.now()) / 1000;
        if (timeLeft <= 3 && timeLeft > 0) {
            blink = Math.floor(performance.now() / 200) % 2 === 0;
        }
        if (blink) {
            currPaletteColor = palette[(colorIndex + 1) % palette.length].fill;
        }
        // Pointer arrow coordinates
        ctx.translate(mouseX, mouseY);
        const SCALE = 1.5;
        ctx.scale(SCALE, SCALE);
        ctx.beginPath();
        ctx.moveTo(0, 0);      // tip
        ctx.lineTo(0, 24);     // left
        ctx.lineTo(7, 14);     // up right
        ctx.lineTo(7, 14);     // up more left
        ctx.lineTo(20, 12);    // right (horizontal part)
        ctx.closePath();
        ctx.fillStyle = currPaletteColor;
        ctx.shadowColor = "#fff";
        ctx.shadowBlur = blink ? 16 : 0;
        ctx.globalAlpha = 0.92;
        ctx.fill();
        // Border
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = 0.63;
        ctx.strokeStyle = "#111";
        ctx.stroke();
        ctx.restore();
    }
}

// ---- DRAW SHAPES ----
//  icons for powerups

function drawPowerupIcon(ctx, type, r) {
    ctx.save();
    ctx.font = `${r * 1.15}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let emoji = '❓';
    if (type === 'shield') emoji = '🛡️';
    else if (type === 'clock') emoji = '⏰';
    else if (type === 'magnet') emoji = '🧲';
    ctx.fillText(emoji, 0, 2); // (x=0,y=2) centers nicely in orb
    ctx.restore();
}


function drawPolygon(ctx, sides, r, color, rotation = 0) {
    ctx.save(); ctx.rotate(rotation); ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        const angle = Math.PI / 2 + i * (2 * Math.PI / sides);
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.95 + 0.05 * Math.sin(Date.now() / 400);
    ctx.shadowBlur = 14 + 6 * Math.abs(Math.sin(Date.now() / 540));
    ctx.fill(); ctx.restore();
}

function drawSemiCircle(ctx, r, color) {
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 1 * Math.PI, false);
    ctx.lineTo(r, 0);
    ctx.arc(0, 0, r, 0, Math.PI, false);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

function drawHeartPolygon(cx, cy, s, color) {
    const w = s * 1.2, h = s * 1.2;
    const px = cx - w / 2, py = cy - h / 2;
    const points = [[0.5, 0.8], [0, 0.4], [0.2, 0], [0.5, 0.2], [0.8, 0], [1, 0.4]];
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
        const [nx, ny] = points[i];
        const x = px + nx * w;
        const y = py + ny * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color || HEART_COLOR;
    ctx.fill();
}

function drawStar(ctx, cx, cy, outerR, innerR, points, color, twinkle, beatScale) {
    ctx.save();
    if (beatScale) ctx.scale(beatScale, beatScale);
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const angle = (Math.PI / points) * i;
        const r = i % 2 === 0 ? outerR : innerR;
        ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.shadowColor = color == '#FFFFFF' ? '#eeeeee' : color;
    ctx.shadowBlur = twinkle ? 40 : 24;
    ctx.globalAlpha = twinkle ? (0.88 + 0.12 * Math.sin(Date.now() / 134)) : 1;
    ctx.fill();
    ctx.restore();
}

function loop(now) {
    // Block game loop if not started (e.g. before click-to-play)
    if (paused || gameOver || window._coloroidGameBlocked) return;
    if (!lastTime) lastTime = now;
    const dt = Math.min(0.033, Math.max(0.008, (now - lastTime) / 1000));
    lastTime = now; elapsed += dt;
    resizeCanvas();
    update(dt, now);
    draw(now);
    animationFrameId = requestAnimationFrame(loop);
}

function init() {
    resizeCanvas();
    resetPaddle();
    lastSpawnAt = performance.now();
    lastTime = performance.now();
    palette = PALETTE_BASE.slice();
    colorIndex = Math.floor(Math.random() * palette.length);
    nextPaletteSwapAt = performance.now() + PALETTE_SWAP_SEC * 1000;
    prevSpawnXs = [null, null]; prevSpawnShapes = [];
    pulse = 0; palettePulse = 0;
    started = false;
    canSpawnPowerup = true;
    // ensure mana starts at 0 on initial init (design choice)
    try { mana = 0; } catch (e) { mana = 0; }
    // bump session id to make any previous powerup activations invalid
    try { powerupSessionId = (powerupSessionId || 0) + 1; Object.keys(powerupActiveSession).forEach(k=>powerupActiveSession[k]=0); } catch(e){}
    startTime = performance.now();
    // Hide mouse pointer on restart
    const gameCanvas = document.getElementById('game');
    if (gameCanvas) gameCanvas.style.cursor = 'none';
    setTimeout(() => { started = true; }, fallingDelay);
    // prevent multiple loops
    if (engineRunning && animationFrameId) cancelAnimationFrame(animationFrameId);
    engineRunning = true;
    animationFrameId = requestAnimationFrame(loop);
}

// Only start game after tutorial click
window.startColoroidGame = function() {
    // Unblock and init safely even if called multiple times
    if (window._coloroidGameBlocked) {
        window._coloroidGameBlocked = false;
    }
    // Ensure footer credit is hidden during gameplay so it doesn't overlay the canvas
    try{
        var foot = document.querySelector('.footer-credit');
        if (foot) { foot.style.display = 'none'; foot.style.pointerEvents = 'none'; }
    }catch(e){}
    // Remove tutorial overlay (defensive) so it can't block input
    try{
        var t = document.getElementById('tutorialOverlay');
        if (t && t.parentNode) { t.style.display = 'none'; t.parentNode.removeChild(t); }
    }catch(e){}
    if (!engineRunning) init();
};

// If not blocked, start immediately (for reloads, dev, etc)
if (!window._coloroidGameBlocked) {
    init();
}

let mana = 0;
const maxMana = 200;
let manaBarEl = document.getElementById('manaBar');

function updateManaBar() {
    if (!manaBarEl) return;
    const fill = document.getElementById('manaBarFill');
    if (fill) fill.style.width = Math.max(0, Math.min(1, mana / maxMana)) * 100 + '%';
}

// Update logic
function update(dt, now) {
    // Smoothly animate paddle shrink/grow
    const lerpSpeed = 0.13 + 0.25 * dt;
    paddleShrinkCurrent += (paddleShrinkTarget - paddleShrinkCurrent) * lerpSpeed;
    if (Math.abs(paddleShrinkCurrent - paddleShrinkTarget) < 0.01) paddleShrinkCurrent = paddleShrinkTarget;

    const paddle = getPaddleConfig();
    paddle.w = getPaddleWidth();
    paddleX = clamp(paddleX, paddle.w / 2, W - paddle.w / 2);

    updatePowerups(dt);

    // Orbs density grows with time
    const progress = Math.min(elapsed / 35, 1); // Full after 35 seconds
    const orbDensity = Math.floor(ORBS_MIN + (ORBS_MAX - ORBS_MIN) * progress);

    if (started && now - startTime > fallingDelay) {
        let spawnEvery = Math.max(220, SPAWN_EVERY_MS_BASE - Math.floor(elapsed) * 2);
        if (powerupTimers.clock > 0) {
            spawnEvery = spawnEvery * 2.5; // Or some other multiplier
        }
        if (now - lastSpawnAt > spawnEvery) {
            lastSpawnAt = now;
            spawnOrbs(orbDensity);
        }
    }

    const magnetActive = powerupTimers.magnet > 0;

    for (let i = orbs.length - 1; i >= 0; i--) {
        const o = orbs[i];
        if (o.isPowerup && (o.y > H)) { orbs.splice(i, 1); canSpawnPowerup = true; continue; }
        o.y += o.vy * dt * (powerupTimers.clock > 0 && !o.isPowerup ? 0.4 : 1);

        if (o.beating) {
            const t = (nowMs() - o.spawnTime) / 240;
            o.beatScale = 1 + Math.sin(t) * 0.18;
        }
        // Magnet: attraction by displacement path to palette center
        if (
            magnetActive &&
            o.shapeType !== undefined &&
            o.colorName === palette[colorIndex].name &&
            !o.isPowerup && !o.isHeart && !o.isGolden
        ) {
            // Only attract after orb has fallen 30% of the screen height
            if (o.y > H * 0.3) {
                let paddleCx = paddleX;
                let paddleCy = getPaddleConfig().y + getPaddleConfig().h / 2;
                const dx = paddleCx - o.x;
                const dy = paddleCy - o.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 2) {
                    o.x += dx * 0.13 * 0.3;
                    o.y += dy * 0.11 * 0.3;
                }
            }
        }

        o.rot += o.rotSpeed * dt * 60;

        if (o.bounceAnim) {
            o.bounceY += o.bounceDir * 18 * dt;
            if (o.bounceY > 28) o.bounceDir = -1;
            if (o.bounceY < 0) {
                o.bounceY = 0;
                o.bounceAnim = false;
                o.bounceDir = 1;
            }
        }

        if (o.y - o.r > H) { orbs.splice(i, 1); continue; }

        const px = paddleX, py = paddle.y, pw = paddle.w, ph = paddle.h;
    const cx = clamp(o.x, px - pw / 2, px + pw / 2); const cy = clamp(o.y, py, py + ph);
        const dx = o.x - cx, dy = o.y - cy;
        if (dx * dx + dy * dy <= o.r * o.r) {
            let popupScore = 0;
            if (o.isGolden) {
                score += SCORE_GOLDEN; popupScore = SCORE_GOLDEN;
                mana = Math.min(maxMana, mana + SCORE_GOLDEN); // Golden star points also add to mana
            } else if (o.isHeart) {
                lives = Math.min(MAX_LIVES, lives + 1);
            } else if (o.isPowerup) {
                activatePowerup(o.powerupType);
                canSpawnPowerup = true;
            } else if (o.colorName === palette[colorIndex].name) {
                score += o.shapePoints; popupScore = o.shapePoints;
                o.bounceAnim = true; o.bounceY = 0; o.bounceDir = 1;
                paddleBounce = 14;
                mana = Math.min(maxMana, mana + o.shapePoints); // 10 points = 10 mana
            } else {
                if (powerupTimers.shield > 0) {
                    // Immune from losing life
                } else {
                    lives -= 1; flash = 160;
                }
            }
            if (popupScore > 0) {
                scorePopups.push({ x: o.x, y: o.y, val: '+' + popupScore, t: 0, color: o.fill });
            }
            orbs.splice(i, 1);
        }
    }

    for (let i = scorePopups.length - 1; i >= 0; i--) {
        scorePopups[i].t += dt;
        if (scorePopups[i].t > 0.9) scorePopups.splice(i, 1);
    }

    if (now >= nextPaletteSwapAt) {
        const nextColor = palette[(colorIndex + 1) % palette.length];
        const currColor = palette[colorIndex];
        const rest = palette.slice(); rest.splice(colorIndex, 1);
        const shuffled = shuffle(rest);
        const newCurrIdx = Math.floor(Math.random() * (shuffled.length + 1));
        shuffled.splice(newCurrIdx, 0, currColor);
        palette = shuffled;
        colorIndex = palette.findIndex(c => c.name === nextColor.name);
        nextPaletteSwapAt = now + PALETTE_SWAP_SEC * 1000;
        palettePulse = 80;
    }

    // Shrink consumes mana
    if (paddleShrinkActive && mana > 0) {
        mana -= (dt * 10 * maxMana) / 100; // 10% per second
        if (mana <= 0) {
            mana = 0;
            paddleShrinkActive = false;
            paddleShrinkTarget = 1;
        }
    }
    // Clamp mana
    mana = Math.max(0, Math.min(maxMana, mana));
    updateManaBar();

    score = Math.max(0, score);
    lives = Math.max(0, Math.min(MAX_LIVES, lives));
    updateHoverboardLevel(dt);
    if (lives <= 0 && !gameOver) { endGame(); }
}

