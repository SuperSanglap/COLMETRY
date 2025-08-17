// ===== CONFIG =====

const PALETTE_SWAP_SEC = 30;
const MAX_LIVES = 3;
const SCORE_GOLDEN = 100;
const POWERUP_DURATION_SEC = 15;
const POWERUP_MIN_SPAWN_DELAY = 5; // seconds between 2 powerups spawning
const SPAWN_EVERY_MS_BASE = 900;
const MAX_BALL_SPEED = 1200;

const PALETTE_BASE = [
    { name: 'Fluoro Red', fill: '#FF385F' },
    { name: 'Electric Orange', fill: '#FF7100' },
    { name: 'Neon Yellow', fill: '#FFE925' },
    { name: 'Acid Lime', fill: '#73FA2E' },
    { name: 'Azure', fill: '#11B5EA' },
    { name: 'Hyper Purple', fill: '#9C1DF8' }
];

const GOLDEN = '#FFD700'; // Golden color for "white" star
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
    { type: 'shield', icon: '🛡️' },
    { type: 'clock', icon: '🕒' },
    { type: 'magnet', icon: '🧲' }
];

const SPECIAL_OBJECTS = ['heart', 'goldenStar', ...POWERUP_TYPES.map(p => p.type)];

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let DPR = Math.max(1, window.devicePixelRatio || 1);
let W = window.innerWidth, H = window.innerHeight;

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

// DOM Element references
const uiScore = document.getElementById('uiScore');
const uiLives = document.getElementById('uiLives');
const uiSpeed = document.getElementById('uiSpeed');
const uiTimer = document.getElementById('uiTimer');
const uiCurrDot = document.getElementById('uiCurrDot');
const uiCurrName = document.getElementById('uiCurrName');
const uiNextDot = document.getElementById('uiNextDot');
const uiNextName = document.getElementById('uiNextName');
const overlayEl = document.getElementById('overlay');

let paddleX = 0;
function resetPaddle() { paddleX = (W - getPaddleConfig().w) / 2; }
resetPaddle();

// ===== INPUTS: mouse only =====
canvas.addEventListener('pointermove', ev => {
    const rect = canvas.getBoundingClientRect();
    const mx = (ev.clientX - rect.left) / rect.width * W;
    paddleX = clamp(mx - getPaddleConfig().w / 2, 0, W - getPaddleConfig().w);
});

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function randRange(a, b) { return Math.random() * (b - a) + a; }
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]] } return a; }

// ==== SPAWN & ORBS ====

const SHAPE_TYPES = [
    { type: 'star', points: 45, speed: 1.1, weight: 3 },
    { type: 'triangle', points: 13, speed: 0.9, weight: 13 },
    { type: 'semicircle', points: 7, speed: 0.7, weight: 23 },
    { type: 'square', points: 9, speed: 0.8, weight: 11 },
    { type: 'pentagon', points: 18, speed: 1.2, weight: 7 },
    { type: 'hexagon', points: 24, speed: 1.3, weight: 6 }
];

// For animation
function nowMs() { return performance.now(); }

// Powerup pool controls simultaneous spawn guarantee
let canSpawnPowerup = true;
let lastPowerupType = null;

function pickShapeTypeWeighted(usedShapes) {
    const viable = SHAPE_TYPES.filter(s => !usedShapes.includes(s.type));
    const total = viable.reduce((a, s) => a + s.weight, 0);
    let r = Math.random() * total;
    for (const s of viable) { if (r < s.weight) return s; r -= s.weight; }
    return viable[viable.length - 1];
}

function chooseColors(shapesCount, currColorIdx) {
    // 40% current color, 60% other colors
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

    // Count current hearts, existing powerups on screen
    const heartCount = orbs.reduce((count, orb) => count + (orb.isHeart ? 1 : 0), 0);
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

        // Allow heart spawn
        let isHeart = false;
        if (!isHeart && lives < MAX_LIVES && heartCount === 0) {
            if (Math.random() < 0.1) isHeart = true;
        }

        // Powerup spawn chance: not at the same time and with min delay, max 1 on screen at once
        let isPowerup = false;
        let powerupType = null;
        if (!isHeart && powerupCount === 0 && nowMs() > lastPowerupSpawn + POWERUP_MIN_SPAWN_DELAY * 1000 && canSpawnPowerup && Math.random() < 0.08) {
            // Randomly select a type, but not two of same in a row
            powerupType = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)].type;
            if (powerupType === lastPowerupType) powerupType = POWERUP_TYPES.filter(p => p.type !== lastPowerupType)[0].type;
            isPowerup = true;
            lastPowerupSpawn = nowMs();
            lastPowerupType = powerupType;
            canSpawnPowerup = false; // will be set true after this one's caught or missed
        }

        // Golden star spawn
        let isGolden = false;
        if (!isHeart && !isPowerup && Math.random() < 0.03) {
            isGolden = true;
        }

        // Only one special per orb
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

    // Heart
    if (isHeart) {
        r = Math.max(16, Math.min(28, W * 0.014));
        shapeType = 'heart';
        colorObj = { name: 'Heart', fill: HEART_COLOR };
        beating = true; bubble = true;
        vy = getBallBaseSpeed();
        shapePoints = 0;
    }
    // Powerups
    else if (isPowerup) {
        r = Math.max(18, Math.min(30, W * 0.016));
        shapeType = powerupType;
        colorObj = { name: powerupType, fill: '#ffffff' };
        beating = true; bubble = true;
        vy = getBallBaseSpeed() * 1.1;
        shapePoints = 0;
    }
    // Golden Star
    else if (isGolden) {
        r = Math.max(13, Math.min(24, W * 0.013));
        shapeType = 'goldenStar';
        colorObj = { name: 'Golden', fill: GOLDEN };
        beating = true; bubble = true;
        vy = getBallBaseSpeed() * 1.4;
        shapePoints = SCORE_GOLDEN;
    }
    // Regular
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

// ==== POWERUP EFFECTS ====
function activatePowerup(type) {
    if (type === 'shield') {
        powerupTimers.shield = POWERUP_DURATION_SEC;
    }
    if (type === 'clock') {
        powerupTimers.clock = POWERUP_DURATION_SEC;
    }
    if (type === 'magnet') {
        powerupTimers.magnet = POWERUP_DURATION_SEC;
    }
}

function updatePowerups(dt) {
    for (const key in powerupTimers) {
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
    const paddle = getPaddleConfig();
    paddleX = clamp(paddleX, 0, W - paddle.w);

    updatePowerups(dt);

    if (started && now - startTime > fallingDelay) {
        const spawnEvery = Math.max(220, SPAWN_EVERY_MS_BASE - Math.floor(elapsed) * 2);
        if (now - lastSpawnAt > spawnEvery) {
            lastSpawnAt = now;
            spawnOrbs(6);
        }
    }

    // Powerup: Magnet
    const magnetActive = powerupTimers.magnet > 0;
    for (let i = orbs.length - 1; i >= 0; i--) {
        const o = orbs[i];
        if (o.isPowerup && (o.y > H)) { orbs.splice(i, 1); canSpawnPowerup = true; continue; }
        o.y += o.vy * dt * (powerupTimers.clock > 0 && !o.isPowerup ? 0.4 : 1);

        // Animate beat/bubble for specials
        if (o.beating) {
            const t = (nowMs() - o.spawnTime) / 240;
            o.beatScale = 1 + Math.sin(t) * 0.18;
        }
        if (magnetActive && o.shapeType !== undefined && o.colorName === palette[colorIndex].name && !o.isPowerup && !o.isHeart && !o.isGolden) {
            // Move toward center of paddle
            let paddleCx = paddleX + paddle.w / 2;
            if (Math.abs(o.x - paddleCx) > 4) {
                o.x += Math.sign(paddleCx - o.x) * 6;
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
        // Collision with paddle
        const px = paddleX, py = paddle.y, pw = paddle.w, ph = paddle.h;
        const cx = clamp(o.x, px, px + pw); const cy = clamp(o.y, py, py + ph);
        const dx = o.x - cx, dy = o.y - cy;
        if (dx * dx + dy * dy <= o.r * o.r) {
            let popupScore = 0;
            if (o.isGolden) {
                score += SCORE_GOLDEN; popupScore = SCORE_GOLDEN;
            } else if (o.isHeart) {
                lives = Math.min(MAX_LIVES, lives + 1);
            } else if (o.isPowerup) {
                activatePowerup(o.powerupType);
                canSpawnPowerup = true;
            } else if (o.colorName === palette[colorIndex].name) {
                score += o.shapePoints; popupScore = o.shapePoints;
                o.bounceAnim = true; o.bounceY = 0; o.bounceDir = 1;
                paddleBounce = 14;
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

    // Score popups
    for (let i = scorePopups.length - 1; i >= 0; i--) {
        scorePopups[i].t += dt;
        if (scorePopups[i].t > 0.9) scorePopups.splice(i, 1);
    }

    // Palette swap
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

    score = Math.max(0, score);
    lives = Math.max(0, Math.min(MAX_LIVES, lives));
    if (lives <= 0 && !gameOver) { endGame(); }
}

function endGame() {
    gameOver = true; paused = true;
    overlayEl.classList.add('show');
    document.getElementById('overlayText').textContent = `Game Over — Score ${score}`;
}

function restart() {
    score = 0; lives = MAX_LIVES; orbs = [];
    palette = PALETTE_BASE.slice();
    colorIndex = Math.floor(Math.random() * palette.length);
    nextPaletteSwapAt = performance.now() + PALETTE_SWAP_SEC * 1000;
    lastSpawnAt = performance.now(); lastTime = performance.now(); elapsed = 0;
    paused = false; gameOver = false;
    overlayEl.classList.remove('show'); resetPaddle();
    prevSpawnXs = [null, null]; prevSpawnShapes = [];
    palettePulse = 0;
    started = false;
    powerupTimers = { shield: 0, clock: 0, magnet: 0 };
    canSpawnPowerup = true;
    startTime = performance.now();
    setTimeout(() => { started = true; }, fallingDelay);
    requestAnimationFrame(loop);
}

function togglePause() {
    if (gameOver) return;
    paused = !paused;
    if (!paused) { lastTime = performance.now(); requestAnimationFrame(loop); }
}

// ==== RENDER DRAWING ====

function drawBubbleAnimate(ctx, r, beatScale, bubbleColor = 'rgba(255,255,255,0.32)') {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.22 * beatScale, 0, Math.PI * 2);
    ctx.fillStyle = bubbleColor;
    ctx.shadowColor = '#fff9';
    ctx.shadowBlur = 13;
    ctx.fill();
    ctx.restore();
}

function draw(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    // bg
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

    // Orbs & specials
    for (const o of orbs) {
        ctx.save();
        ctx.translate(o.x, o.y - (o.bounceAnim ? o.bounceY : 0));
        if (o.rot && !o.isHeart && !o.isPowerup && !o.isGolden) ctx.rotate(o.rot);

        // Draw beating bubble
        if (o.beating && o.bubble) drawBubbleAnimate(ctx, o.r, o.beatScale || 1);

        // Draw shape
        if (o.isHeart) { // heart
            ctx.shadowBlur = 24; drawHeartPolygon(0, 0, o.r, HEART_COLOR);
        } else if (o.isPowerup) {
            ctx.shadowBlur = 10;
            ctx.globalAlpha = 1.0;
            drawPowerupIcon(ctx, o.powerupType, o.r * (o.beatScale || 1));
        } else if (o.isGolden) {
            ctx.shadowBlur = 32;
            drawStar(ctx, 0, 0, o.r, o.r * 0.45, 5, GOLDEN, true, (o.beatScale || 1));
        } else if (o.shapeType === 'semicircle') {
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

    // Score popups
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
    if (paddleBounce > 0) {
        paletteScale += Math.sin(paddleBounce / 14 * Math.PI) * 0.16;
        paddleBounce--;
    }

    if (timeLeft <= 3 && timeLeft > 0) {
        if (!draw.blinkActive) { draw.blinkActive = true; draw.blinkInterval = now; draw.blinkState = false; }
        if (now - draw.blinkInterval > 200) { draw.blinkState = !draw.blinkState; draw.blinkInterval = now; }
        blinkNow = draw.blinkState;
    } else { draw.blinkActive = false; draw.blinkState = false; }
    if (blinkNow) { padColor = palette[(colorIndex + 1) % palette.length].fill; }
    else { padColor = palette[colorIndex].fill; }

    ctx.save();
    ctx.translate(
        paddleX + getPaddleConfig().w / 2,
        getPaddleConfig().y + getPaddleConfig().h / 2
    );
    ctx.scale(paletteScale, paletteScale);
    let paddleW = getPaddleConfig().w;
    let slimH = getPaddleConfig().h * 0.65;
    ctx.fillStyle = padColor;
    ctx.shadowColor = powerupTimers.shield > 0 ? '#00ffd0' : padColor;
    ctx.shadowBlur = 16 + (powerupTimers.shield > 0 ? 10 : 0);
    ctx.fillRect(-paddleW / 2, -slimH / 2, paddleW, slimH);
    if (powerupTimers.shield > 0) {
        ctx.strokeStyle = '#00ffd0'; ctx.lineWidth = 3; ctx.globalAlpha = 0.7;
        ctx.strokeRect(-paddleW / 2 - 3, -slimH / 2 - 2, paddleW + 6, slimH + 4);
    }
    ctx.lineWidth = 2;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#fff6";
    ctx.strokeRect(
        -paddleW / 2 + 1,
        -slimH / 2 + 1,
        paddleW - 2,
        slimH - 2);
    ctx.restore();

    if (pulse > 0) pulse -= 16;

    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, 0, W, 40);

    ctx.fillStyle = '#cfe4ff';
    ctx.font = Math.max(12, W * 0.012) + 'px system-ui, ui-sans-serif';
    ctx.fillText('Catch your color • Move mouse to steer', 18, 26);

    if (flash > 0) { ctx.save(); ctx.fillStyle = `rgba(255,0,0,${flash / 480})`; ctx.fillRect(0, 0, W, H); ctx.restore(); flash -= 16; }

    uiScore.textContent = score;
    uiTimer.textContent = Math.max(0, Math.ceil((nextPaletteSwapAt - now) / 1000));
    uiCurrDot.style.background = palette[colorIndex].fill; uiCurrName.textContent = palette[colorIndex].name;
    uiNextDot.style.background = palette[(colorIndex + 1) % palette.length].fill; uiNextName.textContent = palette[(colorIndex + 1) % palette.length].name;
    const speedMul = Math.min(getBallBaseSpeed() / 160, MAX_BALL_SPEED / 160); uiSpeed.textContent = speedMul.toFixed(1) + 'x';

    uiLives.innerHTML = '';
    for (let i = 0; i < MAX_LIVES; i++) {
        const s = document.createElement('span');
        s.className = 'heart-ui' + (i < lives ? '' : ' dim');
        uiLives.appendChild(s);
    }

    // Powerup indicators (if you have a designated div)
    document.getElementById('pwrShield').style.opacity = powerupTimers.shield > 0 ? 1 : 0.4;
    document.getElementById('pwrClock').style.opacity = powerupTimers.clock > 0 ? 1 : 0.4;
    document.getElementById('pwrMagnet').style.opacity = powerupTimers.magnet > 0 ? 1 : 0.4;
}

// drawPowerupIcon: keeps it simple, for effect swap with appropriate emoji or SVG as you wish
function drawPowerupIcon(ctx, type, r) {
    ctx.save();
    ctx.font = `bold ${r * 1.2}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.95;
    let emoji = '★';
    if (type === 'shield') emoji = '🛡️';
    if (type === 'clock') emoji = '🕒';
    if (type === 'magnet') emoji = '🧲';
    ctx.fillText(emoji, 0, 2);
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
    ctx.shadowColor = color;
    ctx.shadowBlur = twinkle ? 36 : 24;
    ctx.globalAlpha = twinkle ? (0.85 + 0.15 * Math.sin(Date.now() / 120)) : 1;
    ctx.fill();
    ctx.restore();
}

function loop(now) {
    if (paused || gameOver) return;
    if (!lastTime) lastTime = now;
    const dt = Math.min(0.033, Math.max(0.008, (now - lastTime) / 1000));
    lastTime = now; elapsed += dt;
    resizeCanvas();
    update(dt, now);
    draw(now);
    requestAnimationFrame(loop);
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
    startTime = performance.now();
    setTimeout(() => { started = true; }, fallingDelay);
    requestAnimationFrame(loop);
}

init();
