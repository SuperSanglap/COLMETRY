// ===== CONFIG =====
const PALETTE_SWAP_SEC = 30; // set to 300 for 5 minutes
const MAX_LIVES = 3;
const SCORE_NORMAL = 10;
const SCORE_WHITE = SCORE_NORMAL * 5;
const SPECIAL_SPEED_MUL = 1.8; // faster specials
const SPAWN_EVERY_MS_BASE = 900; // faster spawn
const MAX_BALL_SPEED = 1200; // px/sec cap

// rainbow palette
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

// Color wavelength mapping (nm, approx): Red=700, Orange=620, Yellow=580, Green=530, Blue=470, Indigo=425, Violet=400
const COLOR_WAVELENGTHS = {
    'Red': 700,
    'Orange': 620,
    'Yellow': 580,
    'Green': 530,
    'Blue': 470,
    'Indigo': 425,
    'Violet': 400
};

// ===== Canvas & responsive sizing =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let DPR = Math.max(1, window.devicePixelRatio || 1);
let W = window.innerWidth, H = window.innerHeight; // viewport size

function resizeCanvas() {
    W = window.innerWidth; H = window.innerHeight;
    DPR = Math.max(1, window.devicePixelRatio || 1);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// dynamic gameplay constants (scaled to viewport)
function getPaddleConfig() { return { w: Math.max(120, W * 0.16), h: 22, y: H - 64, speed: Math.max(520, W * 1.25) }; }
// Start a bit faster (1.2x), and cap at a max speed
const GAME_SPEED_START = 1.2;
const GAME_SPEED_MAX = 3.0;
function getBallBaseSpeed() {
    const base = 200 * GAME_SPEED_START; // 1.2x of 200
    // Speed up as time passes, but cap at GAME_SPEED_MAX
    const speedMul = Math.min(GAME_SPEED_START + elapsed * 0.015, GAME_SPEED_MAX);
    return Math.max(base, H * 0.28 * speedMul);
}
// No trails needed anymore

// ===== State =====
let palette = PALETTE_BASE.slice();
let nextPaletteSwapAt = 0; // will be set in init
let score = 0; let lives = MAX_LIVES; let orbs = [];
let scorePopups = [];
let lastSpawnAt = performance.now(); let lastTime = performance.now(); let elapsed = 0; let paused = false; let gameOver = false;
let colorIndex = 0; // current paddle color index

// UI refs
const uiScore = document.getElementById('uiScore');
const uiLives = document.getElementById('uiLives');
const uiSpeed = document.getElementById('uiSpeed');
const uiTimer = document.getElementById('uiTimer');
const uiCurrDot = document.getElementById('uiCurrDot');
const uiCurrName = document.getElementById('uiCurrName');
const uiNextDot = document.getElementById('uiNextDot');
const uiNextName = document.getElementById('uiNextName');
const overlayEl = document.getElementById('overlay');

// audio placeholder
const bgm = document.getElementById('bgm');
let musicOn = false;
document.getElementById('btnMusic').addEventListener('click', () => {
    if (!bgm.src) { alert('No music source set. Add a file URL to the <audio id="bgm"> element src attribute in the code to enable.'); return; }
    if (!musicOn) { bgm.play().catch(() => { }); musicOn = true; document.getElementById('btnMusic').textContent = 'Music:On'; }
    else { bgm.pause(); musicOn = false; document.getElementById('btnMusic').textContent = 'Music'; }
});

// paddle
let paddleX = 0; function resetPaddle() { paddleX = (W - getPaddleConfig().w) / 2; }
resetPaddle();

// ===== INPUT: keyboard + pointer (hover moves paddle, tap/click cycles color) =====
const keys = new Set();
addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) { keys.add(e.key.toLowerCase()); e.preventDefault(); }
    if (e.key === ' ') { cycleColor(); e.preventDefault(); }
    if (e.key.toLowerCase() === 'p') { togglePause(); }
    if (e.key.toLowerCase() === 'r') { restart(); }
});
addEventListener('keyup', (e) => { if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) keys.delete(e.key.toLowerCase()); });

// pointer: hover moves paddle (no click required). Click/tap cycles color only.
canvas.addEventListener('pointermove', (ev) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (ev.clientX - rect.left) / rect.width * W;
    paddleX = clamp(mx - getPaddleConfig().w / 2, 0, W - getPaddleConfig().w);
});

// pointerdown/up for tap detection (tap = quick pointerdown + up without much movement)
let pointerDown = null;
canvas.addEventListener('pointerdown', (ev) => { pointerDown = { x: ev.clientX, y: ev.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (ev) => {
    if (!pointerDown) return; const dt = performance.now() - pointerDown.t; const dx = Math.abs(ev.clientX - pointerDown.x); const dy = Math.abs(ev.clientY - pointerDown.y);
    pointerDown = null;
    if (dt < 260 && dx < 8 && dy < 8) { cycleColor(); }
});

// buttons
document.getElementById('btnPause').addEventListener('click', togglePause);
document.getElementById('btnRestart').addEventListener('click', restart);
document.getElementById('btnOverlayRestart').addEventListener('click', restart);

// ===== HELPERS =====
function getCSS(varName) { return getComputedStyle(document.documentElement).getPropertyValue(varName).trim(); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function randRange(a, b) { return Math.random() * (b - a) + a; }
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]] } return a; }

// ===== SPAWN & ORBS =====
// Shape types and their point values
const SHAPE_TYPES = [
    { type: 'star', points: 30, weight: 10 },
    { type: 'triangle', points: 20, weight: 15 },
    { type: 'square', points: 10, weight: 20 },
    { type: 'circle', points: 5, weight: 25 }
];

// Helper to pick a shape by weighted random
function pickShapeType() {
    const total = SHAPE_TYPES.reduce((a, s) => a + s.weight, 0);
    let r = Math.random() * total;
    for (const s of SHAPE_TYPES) {
        if (r < s.weight) return s;
        r -= s.weight;
    }
    return SHAPE_TYPES[SHAPE_TYPES.length - 1];
}

function spawnOrb(opts = {}) {
    // Size and spawn logic
    let r, x, baseVy, isWhite, isHeart, vy, colorObj, shapeType, shapePoints, rotSpeed;
    isWhite = !!opts.isWhite;
    isHeart = !!opts.isHeart;
    if (isHeart) {
        r = Math.max(16, Math.min(28, W * 0.014)); // bigger heart
    } else {
        r = Math.max(8, Math.min(18, W * 0.008));
    }
    x = randRange(r, W - r);
    baseVy = Math.min(getBallBaseSpeed(), MAX_BALL_SPEED);
    vy = (isWhite || isHeart) ? baseVy * SPECIAL_SPEED_MUL : baseVy;
    colorObj = palette[(Math.random() * palette.length) | 0];
    shapeType = 'circle'; shapePoints = 5; rotSpeed = 0.03;
    if (isWhite) {
        shapeType = 'whiteStar';
        shapePoints = SCORE_WHITE;
        rotSpeed = 0.07 + Math.random() * 0.05;
    } else if (!isWhite && !isHeart) {
        const shape = pickShapeType();
        shapeType = shape.type;
        shapePoints = shape.points;
        const wl = COLOR_WAVELENGTHS[colorObj.name] || 500;
        rotSpeed = 0.12 - ((wl - 400) / 300) * 0.09;
    }
    // All rotate clockwise, except heart (no rotation)
    const orb = {
        x, y: -r * 2, r, vy,
        colorName: colorObj.name, fill: colorObj.fill,
        isWhite, isHeart,
        shapeType, shapePoints,
        // No trail for any orb
        rot: (isHeart ? 0 : Math.random() * Math.PI * 2),
        rotSpeed: (isHeart ? 0 : Math.abs(rotSpeed))
    };
    orbs.push(orb);
}

// ===== COLLISION/LOGIC =====
function update(dt, now) {
    const paddle = getPaddleConfig();
    // keyboard movement (smooth)
    let vx = 0; if (keys.has('arrowleft') || keys.has('a')) vx -= paddle.speed; if (keys.has('arrowright') || keys.has('d')) vx += paddle.speed;
    paddleX = clamp(paddleX + vx * dt, 0, W - paddle.w);

    // spawn logic
    const spawnEvery = Math.max(220, SPAWN_EVERY_MS_BASE - Math.floor(elapsed) * 2); // gradually spawn faster
    if (now - lastSpawnAt > spawnEvery) {
        lastSpawnAt = now;
        const roll = Math.random();
        if (roll < 0.02) spawnOrb({ isWhite: true }); // white star is rare
        else if (roll < 0.07 && lives < MAX_LIVES) spawnOrb({ isHeart: true });
        else spawnOrb({});
    }

    // move orbs & collision
    for (let i = orbs.length - 1; i >= 0; i--) {
        const o = orbs[i];
        o.y += o.vy * dt;
        o.rot += o.rotSpeed; // rotate shape
        if (o.y - o.r > H) { orbs.splice(i, 1); continue; }
        const px = paddleX, py = paddle.y, pw = paddle.w, ph = paddle.h;
        const cx = clamp(o.x, px, px + pw); const cy = clamp(o.y, py, py + ph);
        const dx = o.x - cx, dy = o.y - cy;
        if (dx * dx + dy * dy <= o.r * o.r) {
            let popupScore = 0;
            if (o.isWhite) { score += SCORE_WHITE; popupScore = SCORE_WHITE; }
            else if (o.isHeart) { lives = Math.min(MAX_LIVES, lives + 1); }
            else if (o.colorName === palette[colorIndex].name) { score += o.shapePoints; popupScore = o.shapePoints; }
            else { lives -= 1; flash = 160; }
            if (popupScore > 0) {
                scorePopups.push({ x: o.x, y: o.y, val: '+' + popupScore, t: 0, color: o.fill });
            }
            orbs.splice(i, 1);
        }
    }

    // Update score popups
    for (let i = scorePopups.length - 1; i >= 0; i--) {
        scorePopups[i].t += dt;
        if (scorePopups[i].t > 0.9) scorePopups.splice(i, 1);
    }

    // palette auto-swap using timestamp (reliable)
    if (now >= nextPaletteSwapAt) {
        // Identify the next color (the one that was blinking)
        const nextColor = palette[(colorIndex + 1) % palette.length];
        // Remove current color
        const currColor = palette[colorIndex];
        const rest = palette.slice();
        rest.splice(colorIndex, 1);
        // Shuffle the rest
        const shuffled = shuffle(rest);
        // Insert current color at a random new position
        const newCurrIdx = Math.floor(Math.random() * (shuffled.length + 1));
        shuffled.splice(newCurrIdx, 0, currColor);
        palette = shuffled;
        // Set colorIndex to the new index of the previous 'next' color
        colorIndex = palette.findIndex(c => c.name === nextColor.name);
        nextPaletteSwapAt = now + PALETTE_SWAP_SEC * 1000;
    }

    // clamp & game over
    score = Math.max(0, score);
    lives = Math.max(0, Math.min(MAX_LIVES, lives));
    if (lives <= 0 && !gameOver) { endGame(); }
}

function endGame() { gameOver = true; paused = true; overlayEl.classList.add('show'); document.getElementById('overlayText').textContent = `Game Over — Score ${score}`; }
function restart() { score = 0; lives = MAX_LIVES; orbs = []; palette = PALETTE_BASE.slice(); colorIndex = 0; nextPaletteSwapAt = performance.now() + PALETTE_SWAP_SEC * 1000; lastSpawnAt = performance.now(); lastTime = performance.now(); elapsed = 0; paused = false; gameOver = false; overlayEl.classList.remove('show'); resetPaddle(); requestAnimationFrame(loop); }
function togglePause() { if (gameOver) return; paused = !paused; if (!paused) { lastTime = performance.now(); requestAnimationFrame(loop); } }
function cycleColor() { if (gameOver) return; colorIndex = (colorIndex + 1) % palette.length; pulse = 180; }

// ===== RENDER =====
let pulse = 0; let flash = 0;
function draw(now) {
    // clear
    ctx.clearRect(0, 0, W, H);

    // animated background (moving gradient waves)
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
        for (let x = 0; x <= W; x += 40) {
            ctx.lineTo(x, H * (0.2 + 0.2 * Math.sin(t + x / 200 + i)));
        }
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();

    // orbs trails & shapes
    // No trails for any orbs
    // Draw shapes above trails
    for (const o of orbs) {
        ctx.save();
        ctx.translate(o.x, o.y);
        if (!o.isHeart) ctx.rotate(o.rot);
        ctx.shadowColor = o.isWhite ? '#fff' : o.fill;
        ctx.shadowBlur = o.isWhite ? 32 : 16;
        // Draw shape
        if (o.isHeart) {
            ctx.shadowBlur = 24;
            drawHeartPolygon(0, 0, o.r, HEART_COLOR);
        } else if (o.shapeType === 'whiteStar') {
            drawStar(ctx, 0, 0, o.r, o.r * 0.45, 5, WHITE, true);
        } else if (o.isWhite) {
            ctx.beginPath(); ctx.arc(0, 0, o.r, 0, Math.PI * 2);
            ctx.fillStyle = WHITE; ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.stroke();
        } else if (o.shapeType === 'circle') {
            ctx.beginPath(); ctx.arc(0, 0, o.r, 0, Math.PI * 1);
            ctx.fillStyle = o.fill; ctx.fill();
        } else if (o.shapeType === 'square') {
            ctx.beginPath(); ctx.rect(-o.r, -o.r, o.r * 2, o.r * 2);
            ctx.fillStyle = o.fill; ctx.fill();
        } else if (o.shapeType === 'triangle') {
            ctx.beginPath();
            for (let j = 0; j < 3; j++) {
                const angle = Math.PI / 2 + j * (2 * Math.PI / 3);
                const x = Math.cos(angle) * o.r;
                const y = Math.sin(angle) * o.r;
                if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fillStyle = o.fill; ctx.fill();
        } else if (o.shapeType === 'star') {
            drawStar(ctx, 0, 0, o.r, o.r * 0.45, 5, o.fill);
        }
        ctx.restore();
    }
    // Draw score popups above orbs
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

    // palette blinking logic
    let blinkNow = false;
    const timeLeft = (nextPaletteSwapAt - now) / 1000;
    if (timeLeft <= 3 && timeLeft > 0) {
        if (!blinkActive) {
            blinkActive = true;
            blinkInterval = now;
            blinkState = false;
        }
        // Blink every 200ms
        if (now - blinkInterval > 200) {
            blinkState = !blinkState;
            blinkInterval = now;
        }
        blinkNow = blinkState;
    } else {
        blinkActive = false;
        blinkState = false;
    }

    // paddle
    const paddle = getPaddleConfig();
    let padColor;
    if (blinkNow) {
        padColor = palette[(colorIndex + 1) % palette.length].fill;
    } else {
        padColor = palette[colorIndex].fill;
    }
    const padH = paddle.h + (pulse > 0 ? Math.sin((180 - pulse) / 180 * Math.PI) * 4 : 0);
    ctx.fillStyle = padColor; ctx.fillRect(paddleX, paddle.y, paddle.w, padH);
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.strokeRect(paddleX + .5, paddle.y + .5, paddle.w - 1, padH - 1);
    if (pulse > 0) pulse -= 16;

    // top hint
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, 0, W, 40);
    ctx.fillStyle = '#cfe4ff'; ctx.font = Math.max(12, W * 0.012) + 'px system-ui, ui-sans-serif'; ctx.fillText('Catch your color • Space to change • Move mouse to steer • Drag/touch to move on mobile', 18, 26);

    // flash
    if (flash > 0) { ctx.save(); ctx.fillStyle = `rgba(255,0,0,${flash / 480})`; ctx.fillRect(0, 0, W, H); ctx.restore(); flash -= 16; }

    // DOM HUD updates
    uiScore.textContent = score;
    uiTimer.textContent = Math.max(0, Math.ceil((nextPaletteSwapAt - now) / 1000));
    uiCurrDot.style.background = palette[colorIndex].fill; uiCurrName.textContent = palette[colorIndex].name;
    uiNextDot.style.background = palette[(colorIndex + 1) % palette.length].fill; uiNextName.textContent = palette[(colorIndex + 1) % palette.length].name;
    const speedMul = Math.min(getBallBaseSpeed() / 160, MAX_BALL_SPEED / 160); uiSpeed.textContent = speedMul.toFixed(1) + 'x';
    uiLives.innerHTML = '';
    for (let i = 0; i < MAX_LIVES; i++) { const s = document.createElement('span'); s.className = 'heart-ui' + (i < lives ? '' : ' dim'); uiLives.appendChild(s); }
}

function drawHeartPolygon(cx, cy, s, color) {
    // Raw polygon heart matching CSS clip-path: polygon(50% 80%, 0 40%, 20% 0, 50% 20%, 80% 0, 100% 40%);
    const w = s * 1.2, h = s * 1.2; // scale
    const px = cx - w / 2, py = cy - h / 2;
    const points = [[0.5, 0.8], [0, 0.4], [0.2, 0], [0.5, 0.2], [0.8, 0], [1, 0.4]];
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
        const [nx, ny] = points[i]; const x = px + nx * w; const y = py + ny * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fillStyle = color || HEART_COLOR; ctx.fill();
}

// Draw star helper (add twinkle for whiteStar)
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
        // Add a soft white overlay for sparkle
        ctx.globalAlpha = 0.18 + 0.12 * Math.sin(Date.now() / 80);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx, cy, outerR * 0.7, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// ===== LOOP =====
function loop(now) {
    if (paused || gameOver) return;
    if (!lastTime) lastTime = now; const dt = Math.min(0.033, Math.max(0.008, (now - lastTime) / 1000)); lastTime = now; elapsed += dt;
    resizeCanvas(); // ensure up-to-date
    const paddle = getPaddleConfig(); if (paddleX > W - paddle.w) paddleX = W - paddle.w;
    update(dt, now);
    draw(now);
    requestAnimationFrame(loop);
}

// ===== INIT =====
function init() {
    resizeCanvas();
    resetPaddle();
    lastSpawnAt = performance.now();
    lastTime = performance.now();
    nextPaletteSwapAt = performance.now() + PALETTE_SWAP_SEC * 1000;
    requestAnimationFrame(loop);
}
function resetPaddle() { const p = getPaddleConfig(); paddleX = (W - p.w) / 2; }

// start
init();