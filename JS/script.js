// ===== CONFIG =====

const PALETTE_SWAP_SEC = 30;
const MAX_LIVES = 3;
const SCORE_WHITE = 100;

const SPECIAL_SPEED_MUL = 1.8;
const SPAWN_EVERY_MS_BASE = 900;
const MAX_BALL_SPEED = 1200;

const PALETTE_BASE = [
    { name: 'Red', fill: getCSS('--red') },
    { name: 'Orange', fill: getCSS('--orange') },
    { name: 'Yellow', fill: getCSS('--yellow') },
    { name: 'Green', fill: getCSS('--green') },
    { name: 'Blue', fill: getCSS('--blue') },
    { name: 'Indigo', fill: getCSS('--indigo') },
    { name: 'Violet', fill: getCSS('--violet') }
];

const WHITE = getCSS('--white');
const HEART_COLOR = getCSS('--heart');

const COLOR_WAVELENGTHS = {
    'Red': 700,
    'Orange': 620,
    'Yellow': 580,
    'Green': 530,
    'Blue': 470,
    'Indigo': 425,
    'Violet': 400
};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let DPR = Math.max(1, window.devicePixelRatio || 1);
let W = window.innerWidth, H = window.innerHeight;
function resizeCanvas() {
    W = window.innerWidth; H = window.innerHeight;
    DPR = Math.max(1, window.devicePixelRatio || 1);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function getPaddleConfig() { return { w: Math.max(120, W * 0.16), h: 22, y: H - 64, speed: Math.max(520, W * 1.25) }; }
const GAME_SPEED_START = 1.2;
const GAME_SPEED_MAX = 3.0;
function getBallBaseSpeed() {
    const base = 200 * GAME_SPEED_START;
    const speedMul = Math.min(GAME_SPEED_START + elapsed * 0.015, GAME_SPEED_MAX);
    return Math.max(base, H * 0.28 * speedMul);
}

// ===== State =====

let palette = PALETTE_BASE.slice();
let nextPaletteSwapAt = 0;
let score = 0; let lives = MAX_LIVES; let orbs = [];
let scorePopups = [];
let lastSpawnAt = performance.now(); let lastTime = performance.now(); let elapsed = 0;
let paused = false; let gameOver = false;
let colorIndex = 0;
let prevSpawnXs = [null, null];
let prevSpawnShapes = [];

let pulse = 0;
let flash = 0;
let palettePulse = 0;

const uiScore = document.getElementById('uiScore');
const uiLives = document.getElementById('uiLives');
const uiSpeed = document.getElementById('uiSpeed');
const uiTimer = document.getElementById('uiTimer');
const uiCurrDot = document.getElementById('uiCurrDot');
const uiCurrName = document.getElementById('uiCurrName');
const uiNextDot = document.getElementById('uiNextDot');
const uiNextName = document.getElementById('uiNextName');
const overlayEl = document.getElementById('overlay');

const bgm = document.getElementById('bgm');
let musicOn = false;
document.getElementById('btnMusic').addEventListener('click', () => {
    if (!bgm.src) { alert('No music source set. Add a file URL to the element src attribute in the code to enable.'); return; }
    if (!musicOn) { bgm.play().catch(() => { }); musicOn = true; document.getElementById('btnMusic').textContent = 'Music:On'; }
    else { bgm.pause(); musicOn = false; document.getElementById('btnMusic').textContent = 'Music'; }
});

let paddleX = 0;
function resetPaddle() { paddleX = (W - getPaddleConfig().w) / 2; }
resetPaddle();

const keys = new Set();
addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) { keys.add(e.key.toLowerCase()); e.preventDefault(); }
    if (e.key === ' ') { cycleColor(); e.preventDefault(); }
    if (e.key.toLowerCase() === 'p') { togglePause(); }
    if (e.key.toLowerCase() === 'r') { restart(); }
});
addEventListener('keyup', (e) => { if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) keys.delete(e.key.toLowerCase()); });
canvas.addEventListener('pointermove', (ev) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (ev.clientX - rect.left) / rect.width * W;
    paddleX = clamp(mx - getPaddleConfig().w / 2, 0, W - getPaddleConfig().w);
});
let pointerDown = null;
canvas.addEventListener('pointerdown', (ev) => { pointerDown = { x: ev.clientX, y: ev.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (ev) => {
    if (!pointerDown) return; const dt = performance.now() - pointerDown.t; const dx = Math.abs(ev.clientX - pointerDown.x); const dy = Math.abs(ev.clientY - pointerDown.y);
    pointerDown = null;
    if (dt < 260 && dx < 8 && dy < 8) { cycleColor(); }
});
document.getElementById('btnPause').addEventListener('click', togglePause);
document.getElementById('btnRestart').addEventListener('click', restart);
document.getElementById('btnOverlayRestart').addEventListener('click', restart);

function getCSS(varName) { return getComputedStyle(document.documentElement).getPropertyValue(varName).trim(); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function randRange(a, b) { return Math.random() * (b - a) + a; }
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]] } return a; }

// ===== SPAWN & ORBS =====

const SHAPE_TYPES = [
    { type: 'star', points: 45, speed: 1.1, weight: 3 },
    { type: 'triangle', points: 13, speed: 0.9, weight: 13 },
    { type: 'semicircle', points: 7, speed: 0.7, weight: 23 },
    { type: 'square', points: 9, speed: 0.8, weight: 11 },
    { type: 'pentagon', points: 18, speed: 1.2, weight: 7 },
    { type: 'hexagon', points: 24, speed: 1.3, weight: 6 }
];

function pickShapeTypeWeighted(usedShapes) {
    // Pick but not those already used (to ensure scatter for same shapes)
    const viable = SHAPE_TYPES.filter(s => !usedShapes.includes(s.type));
    const total = viable.reduce((a, s) => a + s.weight, 0);
    let r = Math.random() * total;
    for (const s of viable) {
        if (r < s.weight) return s;
        r -= s.weight;
    }
    return viable[viable.length - 1];
}

function chooseColors(shapesCount, currColorIdx) {
    // 40% current color
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
    // Ensure no two same shapes in this spawn share a close horizontal position
    let usedShapes = [];
    let xs = []; prevSpawnShapes = [];
    const colorOrder = chooseColors(orbsPerSpawn, colorIndex);
    for (let i = 0; i < orbsPerSpawn; i++) {
        let shapeObj = pickShapeTypeWeighted(usedShapes);
        usedShapes.push(shapeObj.type);

        let orbX, tries = 0;
        do {
            orbX = randRange(32, W - 32);
            tries++;
        } while ((xs.find(x => Math.abs(x - orbX) < 64 && shapeObj.type === prevSpawnShapes[xs.indexOf(x)]) && tries < 7));
        xs.push(orbX);
        prevSpawnShapes.push(shapeObj.type);

        let isWhite = Math.random() < 0.034;
        spawnOrb({
            isWhite: isWhite,
            colorObj: colorOrder[i],
            shapeObj,
            x: orbX
        });
    }
    prevSpawnXs = xs.slice(-2);
}

function spawnOrb(opts = {}) {
    let r, x, baseVy, isWhite, isHeart, vy, colorObj, shapeType, shapePoints, rotSpeed, shapeObj, bounceY = 0, bounceDir = 1;
    isWhite = !!opts.isWhite;
    isHeart = !!opts.isHeart;

    if (isHeart) {
        r = Math.max(16, Math.min(28, W * 0.014));
        shapeType = 'heart';
        shapePoints = 0;
        rotSpeed = 0;
        colorObj = { name: 'Heart', fill: HEART_COLOR };
    } else {
        r = Math.max(8, Math.min(18, W * 0.008));
        if (isWhite) {
            colorObj = { name: "White", fill: WHITE };
            shapeType = 'whiteStar';
            shapePoints = SCORE_WHITE;
            rotSpeed = (0.18 + Math.random() * 0.08) * 0.75;
            vy = getBallBaseSpeed() * 1.5;
        } else {
            colorObj = opts.colorObj;
            shapeObj = opts.shapeObj;
            shapeType = shapeObj.type;
            shapePoints = shapeObj.points;
            rotSpeed = ((0.12 - ((COLOR_WAVELENGTHS[colorObj.name] || 500 - 400) / 300) * 0.09)) * 0.75;
            vy = Math.min(getBallBaseSpeed() * shapeObj.speed, MAX_BALL_SPEED);
        }
    }

    x = opts.x || randRange(r, W - r);
    const orb = {
        x,
        y: -r * 2,
        r,
        vy,
        colorName: colorObj.name, fill: colorObj.fill,
        isWhite,
        isHeart,
        shapeType,
        shapePoints,
        rot: (!isHeart ? Math.random() * Math.PI * 2 : 0),
        rotSpeed: (!isHeart ? Math.abs(rotSpeed) : 0),
        bounceY: 0,
        bounceDir: 1,
        bounceAnim: false
    };
    orbs.push(orb);
}

// ===== COLLISION/LOGIC =====

function update(dt, now) {
    const paddle = getPaddleConfig();
    let vx = 0;
    if (keys.has('arrowleft') || keys.has('a')) vx -= paddle.speed;
    if (keys.has('arrowright') || keys.has('d')) vx += paddle.speed;
    paddleX = clamp(paddleX + vx * dt, 0, W - paddle.w);

    const spawnEvery = Math.max(220, SPAWN_EVERY_MS_BASE - Math.floor(elapsed) * 2);
    if (now - lastSpawnAt > spawnEvery) {
        lastSpawnAt = now;
        spawnOrbs(6); // spawn 6 orbs per tick
    }

    for (let i = orbs.length - 1; i >= 0; i--) {
        const o = orbs[i];
        o.y += o.vy * dt;
        o.rot += o.rotSpeed * dt * 60;
        if (o.bounceAnim) {
            o.bounceY += o.bounceDir * 18 * dt;
            if (o.bounceY > 28) o.bounceDir = -1;
            if (o.bounceY < 0) {
                o.bounceY = 0; o.bounceAnim = false; o.bounceDir = 1;
            }
        }
        if (o.y - o.r > H) { orbs.splice(i, 1); continue; }
        const px = paddleX, py = paddle.y, pw = paddle.w, ph = paddle.h;
        const cx = clamp(o.x, px, px + pw); const cy = clamp(o.y, py, py + ph);
        const dx = o.x - cx, dy = o.y - cy;
        if (dx * dx + dy * dy <= o.r * o.r) {
            let popupScore = 0;
            if (o.isWhite) { score += SCORE_WHITE; popupScore = SCORE_WHITE; }
            else if (o.isHeart) { lives = Math.min(MAX_LIVES, lives + 1); }
            else if (o.colorName === palette[colorIndex].name) {
                score += o.shapePoints; popupScore = o.shapePoints;
                o.bounceAnim = true; o.bounceY = 0; o.bounceDir = 1;
            } else { lives -= 1; flash = 160; }
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

    // palette auto-swap
    if (now >= nextPaletteSwapAt) {
        const nextColor = palette[(colorIndex + 1) % palette.length];
        const currColor = palette[colorIndex];
        const rest = palette.slice();
        rest.splice(colorIndex, 1);
        const shuffled = shuffle(rest);
        const newCurrIdx = Math.floor(Math.random() * (shuffled.length + 1));
        shuffled.splice(newCurrIdx, 0, currColor);
        palette = shuffled;
        colorIndex = palette.findIndex(c => c.name === nextColor.name);
        nextPaletteSwapAt = now + PALETTE_SWAP_SEC * 1000;
        palettePulse = 80; // trigger big palette pulse
    }

    score = Math.max(0, score);
    lives = Math.max(0, Math.min(MAX_LIVES, lives));
    if (lives <= 0 && !gameOver) { endGame(); }
}

function endGame() {
    gameOver = true; paused = true;
    overlayEl.classList.add('show'); document.getElementById('overlayText').textContent = `Game Over — Score ${score}`;
}

function restart() {
    score = 0; lives = MAX_LIVES; orbs = [];
    palette = PALETTE_BASE.slice();
    colorIndex = Math.floor(Math.random() * palette.length);
    nextPaletteSwapAt = performance.now() + PALETTE_SWAP_SEC * 1000;
    lastSpawnAt = performance.now(); lastTime = performance.now(); elapsed = 0;
    paused = false; gameOver = false; overlayEl.classList.remove('show'); resetPaddle();
    prevSpawnXs = [null, null]; prevSpawnShapes = [];
    palettePulse = 0;
    requestAnimationFrame(loop);
}

function togglePause() { if (gameOver) return; paused = !paused; if (!paused) { lastTime = performance.now(); requestAnimationFrame(loop); } }
function cycleColor() { if (gameOver) return; colorIndex = (colorIndex + 1) % palette.length; pulse = 180; palettePulse = 45; }

// ===== RENDER =====

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

    // Draw orbs
    for (const o of orbs) {
        ctx.save();
        ctx.translate(o.x, o.y - (o.bounceAnim ? o.bounceY : 0));
        if (!o.isHeart) ctx.rotate(o.rot);
        ctx.shadowColor = o.isWhite ? '#fff' : o.fill;
        ctx.shadowBlur = o.isWhite ? 32 : 16;

        if (o.isHeart) {
            ctx.shadowBlur = 24;
            drawHeartPolygon(0, 0, o.r, HEART_COLOR);
        } else if (o.shapeType === 'whiteStar') {
            drawStar(ctx, 0, 0, o.r, o.r * 0.45, 5, WHITE, true);
        } else if (o.shapeType === 'semicircle') {
            drawSemiCircle(ctx, o.r, o.fill);
        } else if (o.shapeType === 'triangle') {
            drawPolygon(ctx, 3, o.r, o.fill, o.rot);
        } else if (o.shapeType === 'square') {
            ctx.beginPath();
            ctx.rect(-o.r * 0.6, -o.r * 0.6, o.r * 1.2, o.r * 1.2);
            ctx.fillStyle = o.fill; ctx.fill();
        } else if (o.shapeType === 'pentagon') {
            drawPolygon(ctx, 5, o.r, o.fill, o.rot);
        } else if (o.shapeType === 'hexagon') {
            drawPolygon(ctx, 6, o.r, o.fill, o.rot);
        } else if (o.shapeType === 'star') {
            drawStar(ctx, 0, 0, o.r, o.r * 0.45, 5, o.fill);
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

    // Palette pulse/bounce effect
    let blinkNow = false;
    const timeLeft = (nextPaletteSwapAt - now) / 1000;
    if (palettePulse > 0) palettePulse -= 5;
    let padColor;
    let paletteScale = 1 + (palettePulse > 0 ? Math.max(0, Math.sin((palettePulse / 60) * Math.PI / 2)) * 0.25 : 0);

    if (timeLeft <= 3 && timeLeft > 0) {
        if (!draw.blinkActive) { draw.blinkActive = true; draw.blinkInterval = now; draw.blinkState = false; }
        if (now - draw.blinkInterval > 200) { draw.blinkState = !draw.blinkState; draw.blinkInterval = now; }
        blinkNow = draw.blinkState;
    } else { draw.blinkActive = false; draw.blinkState = false; }

    if (blinkNow) { padColor = palette[(colorIndex + 1) % palette.length].fill; }
    else { padColor = palette[colorIndex].fill; }

    ctx.save();
    ctx.translate(paddleX + getPaddleConfig().w / 2, getPaddleConfig().y + getPaddleConfig().h / 2);
    ctx.scale(paletteScale, paletteScale);
    ctx.fillStyle = padColor;
    ctx.fillRect(-getPaddleConfig().w / 2, -getPaddleConfig().h / 2, getPaddleConfig().w, getPaddleConfig().h);
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.strokeRect(-getPaddleConfig().w / 2 + .5, -getPaddleConfig().h / 2 + .5, getPaddleConfig().w - 1, getPaddleConfig().h - 1);
    ctx.restore();

    if (pulse > 0) pulse -= 16;

    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, 0, W, 40);
    ctx.fillStyle = '#cfe4ff'; ctx.font = Math.max(12, W * 0.012) + 'px system-ui, ui-sans-serif';
    ctx.fillText('Catch your color • Space to change • Move mouse to steer • Drag/touch to move on mobile', 18, 26);

    if (flash > 0) { ctx.save(); ctx.fillStyle = `rgba(255,0,0,${flash / 480})`; ctx.fillRect(0, 0, W, H); ctx.restore(); flash -= 16; }

    uiScore.textContent = score;
    uiTimer.textContent = Math.max(0, Math.ceil((nextPaletteSwapAt - now) / 1000));
    uiCurrDot.style.background = palette[colorIndex].fill; uiCurrName.textContent = palette[colorIndex].name;
    uiNextDot.style.background = palette[(colorIndex + 1) % palette.length].fill; uiNextName.textContent = palette[(colorIndex + 1) % palette.length].name;
    const speedMul = Math.min(getBallBaseSpeed() / 160, MAX_BALL_SPEED / 160); uiSpeed.textContent = speedMul.toFixed(1) + 'x';
    uiLives.innerHTML = '';
    for (let i = 0; i < MAX_LIVES; i++) { const s = document.createElement('span'); s.className = 'heart-ui' + (i < lives ? '' : ' dim'); uiLives.appendChild(s); }
}

draw.blinkActive = false;
draw.blinkInterval = 0;
draw.blinkState = false;

function drawPolygon(ctx, sides, r, color, rotation = 0) {
    ctx.save();
    ctx.rotate(rotation);
    ctx.beginPath();
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
    ctx.fill();
    ctx.restore();
}

function drawSemiCircle(ctx, r, color) {
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 2 * Math.PI, false);
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
        const [nx, ny] = points[i]; const x = px + nx * w; const y = py + ny * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fillStyle = color || HEART_COLOR; ctx.fill();
}

function drawStar(ctx, cx, cy, outerR, innerR, points, color, twinkle) {
    ctx.save();
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
    if (twinkle) {
        ctx.globalAlpha = 0.18 + 0.12 * Math.sin(Date.now() / 80);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx, cy, outerR * 0.7, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function loop(now) {
    if (paused || gameOver) return;
    if (!lastTime) lastTime = now;
    const dt = Math.min(0.033, Math.max(0.008, (now - lastTime) / 1000));
    lastTime = now; elapsed += dt;
    resizeCanvas();
    const paddle = getPaddleConfig(); if (paddleX > W - paddle.w) paddleX = W - paddle.w;
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
    requestAnimationFrame(loop);
}
function resetPaddle() { const p = getPaddleConfig(); paddleX = (W - p.w) / 2; }
init();
