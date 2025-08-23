// ===== CONFIG =====
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
const ORBS_MIN = 2; // Start orb density
const ORBS_MAX = 7; // Max orb density

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

// ===== INPUT =====
canvas.addEventListener('pointermove', ev => {
    const rect = canvas.getBoundingClientRect();
    const mx = ((ev.clientX - rect.left) / rect.width) * W;
    mouseX = mx;
    mouseY = ((ev.clientY - rect.top) / rect.height) * H;

    paddleX = clamp(mx - getPaddleConfig().w / 2, 0, W - getPaddleConfig().w);
    mouseInGame = true;
});
canvas.addEventListener('pointerleave', () => {
    mouseInGame = false;
});
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function randRange(a, b) { return Math.random() * (b - a) + a; }
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]] } return a; }

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

        let isHeart = false;
        if (!isHeart && lives < MAX_LIVES && heartCount === 0) {
            if (Math.random() < 0.1) isHeart = true;
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
            // Only attract if orb is below a third of the screen
            if (o.y > H / 3) {
                let paddleCx = paddleX + paddle.w / 2;
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
    palette = PALETTE_BASE.slice(); colorIndex = Math.floor(Math.random() * palette.length);
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
    ctx.translate(paddleX + getPaddleConfig().w / 2, getPaddleConfig().y + getPaddleConfig().h / 2);
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
    ctx.strokeRect(-paddleW / 2 + 1, -slimH / 2 + 1, paddleW - 2, slimH - 2);
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
    if (document.getElementById('pwrShield')) document.getElementById('pwrShield').style.opacity = powerupTimers.shield > 0 ? 1 : 0.4;
    if (document.getElementById('pwrClock')) document.getElementById('pwrClock').style.opacity = powerupTimers.clock > 0 ? 1 : 0.4;
    if (document.getElementById('pwrMagnet')) document.getElementById('pwrMagnet').style.opacity = powerupTimers.magnet > 0 ? 1 : 0.4;

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
