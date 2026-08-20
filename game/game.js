// ============================================
// FLAPPY FOOTBALL - Game Engine
// ============================================

// --- Canvas Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Game Constants ---
const GAME_WIDTH = 420;
const GAME_HEIGHT = 680;
const GRAVITY = 0.45;
const JUMP_FORCE = -7.5;
const PIPE_SPEED = 2.8;
const PIPE_GAP = 155;
const PIPE_WIDTH = 70;
const PIPE_SPAWN_INTERVAL = 100; // frames between pipes
const GROUND_HEIGHT = 70;
const PLAYER_SIZE = 42;
const FOOTBALL_SIZE = 22;
const FOOTBALL_SPAWN_CHANCE = 0.4; // 40% chance per pipe pair

// --- Colors (Football Theme) ---
const COLORS = {
    sky1: '#1a3a5c',
    sky2: '#2d5a87',
    sky3: '#87CEEB',
    grassDark: '#1B5E20',
    grassLight: '#2E7D32',
    grassLine: 'rgba(255,255,255,0.3)',
    pipeBody: '#e0e0e0',
    pipeRim: '#C8102E',
    pipeShadow: 'rgba(0,0,0,0.15)',
    pipeNet: 'rgba(255,255,255,0.5)',
    football: '#F5F5DC',
    footballLine: '#333333',
    cloud: 'rgba(255,255,255,0.7)',
    crowd1: '#C8102E',
    crowd2: '#ffffff',
    crowd3: '#1B5E20',
    stadiumWall: '#2a2a3e',
    stadiumLight: '#FFD700',
    gold: '#FFD700',
    white: '#FFFFFF',
    particle: '#FFD700',
};

// --- Game State ---
let gameState = 'START'; // START, PLAYING, GAME_OVER, PAUSED
let score = 0;
let coins = 0;
let highScore = parseInt(localStorage.getItem('flappyFootballHigh')) || 0;
let frameCount = 0;
let difficulty = 1;
let screenShake = 0;
let flashAlpha = 0;

// --- Player ---
const player = {
    x: 80,
    y: GAME_HEIGHT / 2 - 50,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    velocity: 0,
    rotation: 0,
    frame: 0,
    frameTimer: 0,
    trail: [],
};

// --- Game Objects ---
let pipes = [];
let footballs = [];
let particles = [];
let clouds = [];
let crowdWave = 0;
let bgStars = [];

// --- Assets ---
const playerImg = new Image();
playerImg.src = 'assets/player.jpg';
let playerImgLoaded = false;
playerImg.onload = () => { playerImgLoaded = true; };

const bgImg = new Image();
bgImg.src = 'assets/stadium_bg.jpg';
let bgImgLoaded = false;
bgImg.onload = () => { bgImgLoaded = true; };

// --- Audio (Web Audio API) ---
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    switch (type) {
        case 'jump':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(500, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.15);
            break;
        case 'score':
            osc.type = 'square';
            osc.frequency.setValueAtTime(600, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.2);
            break;
        case 'coin':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
            osc.frequency.setValueAtTime(1500, audioCtx.currentTime + 0.05);
            osc.frequency.setValueAtTime(2000, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.2);
            break;
        case 'hit':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.3);
            break;
        case 'whistle':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(3000, audioCtx.currentTime);
            osc.frequency.setValueAtTime(2500, audioCtx.currentTime + 0.15);
            osc.frequency.setValueAtTime(3000, audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.3);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.5);
            break;
    }
}

// --- Canvas Resize ---
function resizeCanvas() {
    const ratio = GAME_WIDTH / GAME_HEIGHT;
    const windowRatio = window.innerWidth / window.innerHeight;

    if (windowRatio > ratio) {
        canvas.height = window.innerHeight;
        canvas.width = canvas.height * ratio;
    } else {
        canvas.width = window.innerWidth;
        canvas.height = canvas.width / ratio;
    }
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- Initialize Background Elements ---
function initBackground() {
    // Clouds
    clouds = [];
    for (let i = 0; i < 6; i++) {
        clouds.push({
            x: Math.random() * GAME_WIDTH,
            y: 30 + Math.random() * 150,
            width: 50 + Math.random() * 80,
            speed: 0.2 + Math.random() * 0.5,
            opacity: 0.3 + Math.random() * 0.4,
        });
    }

    // Stars/lights
    bgStars = [];
    for (let i = 0; i < 20; i++) {
        bgStars.push({
            x: Math.random() * GAME_WIDTH,
            y: Math.random() * 200,
            size: 1 + Math.random() * 2,
            twinkle: Math.random() * Math.PI * 2,
        });
    }
}

initBackground();

// --- Spawn Functions ---
function spawnPipe() {
    const minY = 80;
    const maxY = GAME_HEIGHT - GROUND_HEIGHT - PIPE_GAP - 80;
    const gapY = minY + Math.random() * (maxY - minY);

    pipes.push({
        x: GAME_WIDTH + 10,
        gapY: gapY,
        scored: false,
    });

    // Maybe spawn football
    if (Math.random() < FOOTBALL_SPAWN_CHANCE) {
        footballs.push({
            x: GAME_WIDTH + 10 + PIPE_WIDTH / 2,
            y: gapY + PIPE_GAP / 2,
            collected: false,
            bobPhase: Math.random() * Math.PI * 2,
        });
    }
}

function spawnParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed * (0.5 + Math.random()),
            vy: Math.sin(angle) * speed * (0.5 + Math.random()),
            life: 1,
            decay: 0.02 + Math.random() * 0.03,
            color: color,
            size: 2 + Math.random() * 4,
        });
    }
}

// --- Reset Game ---
function resetGame() {
    player.y = GAME_HEIGHT / 2 - 50;
    player.velocity = 0;
    player.rotation = 0;
    player.trail = [];
    pipes = [];
    footballs = [];
    particles = [];
    score = 0;
    coins = 0;
    frameCount = 0;
    difficulty = 1;
    screenShake = 0;
    flashAlpha = 0;
    crowdWave = 0;
    initBackground();
}

// --- Jump ---
function jump() {
    if (gameState === 'PLAYING') {
        player.velocity = JUMP_FORCE;
        playSound('jump');

        // Trail particles
        spawnParticles(
            player.x + player.width / 2,
            player.y + player.height,
            COLORS.white,
            3,
            2
        );
    }
}

// --- Update ---
function update() {
    if (gameState !== 'PLAYING') return;

    frameCount++;

    // Increase difficulty over time
    difficulty = 1 + Math.floor(score / 10) * 0.15;

    // Player physics
    player.velocity += GRAVITY;
    player.y += player.velocity;

    // Player rotation (tilt based on velocity)
    const targetRotation = Math.max(-30, Math.min(player.velocity * 4, 70));
    player.rotation += (targetRotation - player.rotation) * 0.15;

    // Player trail
    player.trail.push({ x: player.x + player.width / 2, y: player.y + player.height / 2, alpha: 0.5 });
    if (player.trail.length > 8) player.trail.shift();

    // Ceiling collision
    if (player.y < 0) {
        player.y = 0;
        player.velocity = 0;
    }

    // Ground collision
    if (player.y + player.height > GAME_HEIGHT - GROUND_HEIGHT) {
        gameOver();
        return;
    }

    // Spawn pipes
    const spawnRate = Math.max(PIPE_SPAWN_INTERVAL - difficulty * 5, 65);
    if (frameCount % Math.round(spawnRate) === 0) {
        spawnPipe();
    }

    // Update pipes
    const currentSpeed = PIPE_SPEED + difficulty * 0.3;
    for (let i = pipes.length - 1; i >= 0; i--) {
        const pipe = pipes[i];
        pipe.x -= currentSpeed;

        // Score when passing pipe
        if (!pipe.scored && pipe.x + PIPE_WIDTH < player.x) {
            pipe.scored = true;
            score++;
            playSound('score');
            spawnParticles(player.x + player.width, player.y, COLORS.gold, 8, 3);
            updateHUD();
        }

        // Remove off-screen pipes
        if (pipe.x + PIPE_WIDTH < -10) {
            pipes.splice(i, 1);
        }

        // Collision detection
        if (checkPipeCollision(pipe)) {
            gameOver();
            return;
        }
    }

    // Update footballs
    for (let i = footballs.length - 1; i >= 0; i--) {
        const fb = footballs[i];
        fb.x -= currentSpeed;
        fb.bobPhase += 0.08;

        if (!fb.collected) {
            const fbY = fb.y + Math.sin(fb.bobPhase) * 8;
            const dx = (player.x + player.width / 2) - fb.x;
            const dy = (player.y + player.height / 2) - fbY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < PLAYER_SIZE / 2 + FOOTBALL_SIZE / 2 + 5) {
                fb.collected = true;
                coins++;
                score += 3;
                playSound('coin');
                spawnParticles(fb.x, fbY, COLORS.gold, 12, 4);
                updateHUD();
            }
        }

        if (fb.x < -30) {
            footballs.splice(i, 1);
        }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity on particles
        p.life -= p.decay;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }

    // Update clouds
    clouds.forEach(cloud => {
        cloud.x -= cloud.speed;
        if (cloud.x + cloud.width < 0) {
            cloud.x = GAME_WIDTH + cloud.width;
            cloud.y = 30 + Math.random() * 150;
        }
    });

    // Screen shake decay
    if (screenShake > 0) screenShake *= 0.85;
    if (flashAlpha > 0) flashAlpha *= 0.9;

    // Crowd wave
    crowdWave += 0.03;
}

// --- Collision Detection ---
function checkPipeCollision(pipe) {
    const px = player.x + 5;
    const py = player.y + 5;
    const pw = player.width - 10;
    const ph = player.height - 10;

    // Top pipe
    if (px + pw > pipe.x && px < pipe.x + PIPE_WIDTH &&
        py < pipe.gapY) {
        return true;
    }

    // Bottom pipe
    if (px + pw > pipe.x && px < pipe.x + PIPE_WIDTH &&
        py + ph > pipe.gapY + PIPE_GAP) {
        return true;
    }

    return false;
}

// --- Game Over ---
function gameOver() {
    gameState = 'GAME_OVER';
    playSound('hit');
    setTimeout(() => playSound('whistle'), 300);

    screenShake = 15;
    flashAlpha = 1;

    // Explosion particles
    spawnParticles(
        player.x + player.width / 2,
        player.y + player.height / 2,
        COLORS.crowd1,
        20,
        5
    );

    // Update high score
    const isNewRecord = score > highScore;
    if (isNewRecord) {
        highScore = score;
        localStorage.setItem('flappyFootballHigh', highScore);
    }

    // Show game over screen
    setTimeout(() => {
        document.getElementById('final-score').textContent = score;
        document.getElementById('final-coins').textContent = coins;
        document.getElementById('final-high').textContent = highScore;
        document.getElementById('new-record').classList.toggle('hidden', !isNewRecord);
        document.getElementById('gameover-screen').classList.add('active');
        document.getElementById('hud').classList.add('hidden');
    }, 600);
}

// --- HUD Update ---
function updateHUD() {
    document.getElementById('hud-score-value').textContent = score;
    document.getElementById('hud-coins-value').textContent = coins;
    document.getElementById('hud-high-value').textContent = highScore;
}

// --- Draw Functions ---
function drawBackground() {
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT - GROUND_HEIGHT);
    skyGrad.addColorStop(0, COLORS.sky1);
    skyGrad.addColorStop(0.4, COLORS.sky2);
    skyGrad.addColorStop(1, COLORS.sky3);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT - GROUND_HEIGHT);

    // Stadium lights (twinkling)
    bgStars.forEach(star => {
        star.twinkle += 0.05;
        const brightness = 0.5 + Math.sin(star.twinkle) * 0.5;
        ctx.fillStyle = `rgba(255, 215, 0, ${brightness * 0.8})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        // Light glow
        ctx.fillStyle = `rgba(255, 215, 0, ${brightness * 0.2})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // Clouds
    clouds.forEach(cloud => {
        ctx.fillStyle = `rgba(255, 255, 255, ${cloud.opacity})`;
        ctx.beginPath();
        ctx.ellipse(cloud.x, cloud.y, cloud.width / 2, cloud.width / 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cloud.x - cloud.width / 4, cloud.y + 5, cloud.width / 3, cloud.width / 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cloud.x + cloud.width / 4, cloud.y + 3, cloud.width / 3, cloud.width / 5, 0, 0, Math.PI * 2);
        ctx.fill();
    });

    // Stadium crowd (rows of dots)
    const crowdY = GAME_HEIGHT - GROUND_HEIGHT - 120;
    const crowdColors = [COLORS.crowd1, COLORS.crowd2, COLORS.crowd3, COLORS.crowd1, COLORS.crowd2];

    for (let row = 0; row < 5; row++) {
        for (let i = 0; i < 60; i++) {
            const waveOffset = Math.sin(crowdWave + i * 0.3 + row * 0.5) * 3;
            const x = i * 7 + 2;
            const y = crowdY + row * 10 + waveOffset;
            ctx.fillStyle = crowdColors[(i + row) % crowdColors.length];
            ctx.fillRect(x, y, 5, 7);
        }
    }

    // Stadium wall
    ctx.fillStyle = COLORS.stadiumWall;
    ctx.fillRect(0, GAME_HEIGHT - GROUND_HEIGHT - 20, GAME_WIDTH, 20);

    // Stadium wall pattern
    for (let i = 0; i < GAME_WIDTH; i += 30) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(i, GAME_HEIGHT - GROUND_HEIGHT - 20, 15, 20);
    }
}

function drawGround() {
    const groundY = GAME_HEIGHT - GROUND_HEIGHT;

    // Main grass
    const grassGrad = ctx.createLinearGradient(0, groundY, 0, GAME_HEIGHT);
    grassGrad.addColorStop(0, COLORS.grassLight);
    grassGrad.addColorStop(0.3, COLORS.grassDark);
    grassGrad.addColorStop(1, '#0a2e0a');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, groundY, GAME_WIDTH, GROUND_HEIGHT);

    // Grass stripes
    const stripeWidth = 40;
    const offset = (frameCount * (PIPE_SPEED + difficulty * 0.3)) % (stripeWidth * 2);
    for (let i = -1; i < GAME_WIDTH / stripeWidth + 2; i++) {
        if (i % 2 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.fillRect(i * stripeWidth - offset, groundY, stripeWidth, GROUND_HEIGHT);
        }
    }

    // White line at top of grass
    ctx.strokeStyle = COLORS.grassLine;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY + 2);
    ctx.lineTo(GAME_WIDTH, groundY + 2);
    ctx.stroke();

    // Grass blades
    ctx.strokeStyle = 'rgba(76, 175, 80, 0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < GAME_WIDTH; i += 8) {
        const bladeOffset = Math.sin(frameCount * 0.05 + i * 0.3) * 3;
        ctx.beginPath();
        ctx.moveTo(i, groundY + 2);
        ctx.lineTo(i + bladeOffset, groundY - 4);
        ctx.stroke();
    }
}

function drawPipe(pipe) {
    const topHeight = pipe.gapY;
    const bottomY = pipe.gapY + PIPE_GAP;
    const bottomHeight = GAME_HEIGHT - GROUND_HEIGHT - bottomY;

    // --- Goal Post Style ---

    // Top pipe (inverted goal post)
    // Main body
    const topGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0);
    topGrad.addColorStop(0, '#d0d0d0');
    topGrad.addColorStop(0.3, '#ffffff');
    topGrad.addColorStop(0.7, '#f0f0f0');
    topGrad.addColorStop(1, '#b0b0b0');
    ctx.fillStyle = topGrad;
    ctx.fillRect(pipe.x, 0, PIPE_WIDTH, topHeight);

    // Top pipe rim (crossbar)
    const rimHeight = 18;
    ctx.fillStyle = COLORS.pipeRim;
    ctx.fillRect(pipe.x - 5, topHeight - rimHeight, PIPE_WIDTH + 10, rimHeight);

    // Rim shine
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(pipe.x - 5, topHeight - rimHeight, PIPE_WIDTH + 10, 4);

    // Net pattern on top pipe
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    for (let y = 5; y < topHeight - rimHeight; y += 15) {
        ctx.beginPath();
        ctx.moveTo(pipe.x, y);
        ctx.lineTo(pipe.x + PIPE_WIDTH, y);
        ctx.stroke();
    }
    for (let x = pipe.x + 10; x < pipe.x + PIPE_WIDTH; x += 15) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, topHeight - rimHeight);
        ctx.stroke();
    }

    // Bottom pipe (goal post)
    ctx.fillStyle = topGrad;
    ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, bottomHeight);

    // Bottom pipe rim (crossbar)
    ctx.fillStyle = COLORS.pipeRim;
    ctx.fillRect(pipe.x - 5, bottomY, PIPE_WIDTH + 10, rimHeight);

    // Rim shine
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(pipe.x - 5, bottomY, PIPE_WIDTH + 10, 4);

    // Net pattern on bottom pipe
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    for (let y = bottomY + rimHeight; y < bottomY + bottomHeight; y += 15) {
        ctx.beginPath();
        ctx.moveTo(pipe.x, y);
        ctx.lineTo(pipe.x + PIPE_WIDTH, y);
        ctx.stroke();
    }
    for (let x = pipe.x + 10; x < pipe.x + PIPE_WIDTH; x += 15) {
        ctx.beginPath();
        ctx.moveTo(x, bottomY + rimHeight);
        ctx.lineTo(x, bottomY + bottomHeight);
        ctx.stroke();
    }

    // Shadow
    ctx.fillStyle = COLORS.pipeShadow;
    ctx.fillRect(pipe.x + PIPE_WIDTH, 0, 5, topHeight);
    ctx.fillRect(pipe.x + PIPE_WIDTH, bottomY, 5, bottomHeight);
}

function drawFootball(fb) {
    if (fb.collected) return;

    const bobY = fb.y + Math.sin(fb.bobPhase) * 8;

    ctx.save();
    ctx.translate(fb.x, bobY);

    // Glow
    ctx.fillStyle = `rgba(255, 215, 0, ${0.2 + Math.sin(fb.bobPhase * 2) * 0.1})`;
    ctx.beginPath();
    ctx.arc(0, 0, FOOTBALL_SIZE + 8, 0, Math.PI * 2);
    ctx.fill();

    // Ball body
    const ballGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, FOOTBALL_SIZE);
    ballGrad.addColorStop(0, '#FFFFFF');
    ballGrad.addColorStop(0.5, COLORS.football);
    ballGrad.addColorStop(1, '#d4c89a');
    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(0, 0, FOOTBALL_SIZE, 0, Math.PI * 2);
    ctx.fill();

    // Pentagon pattern (simplified)
    ctx.strokeStyle = COLORS.footballLine;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(50,50,50,0.7)';

    // Center pentagon
    drawPentagon(0, 0, 9);

    // Border
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, FOOTBALL_SIZE, 0, Math.PI * 2);
    ctx.stroke();

    // ⚽ sparkle
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(-7, -8, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawPentagon(x, y, size) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
        const px = x + Math.cos(angle) * size;
        const py = y + Math.sin(angle) * size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function drawPlayer() {
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
    ctx.rotate((player.rotation * Math.PI) / 180);

    if (playerImgLoaded) {
        // Draw circular clipped player image
        ctx.beginPath();
        ctx.arc(0, 0, player.width / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(
            playerImg,
            -player.width / 2, -player.height / 2,
            player.width, player.height
        );

        // Border
        ctx.restore();
        ctx.save();
        ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
        ctx.rotate((player.rotation * Math.PI) / 180);
        ctx.strokeStyle = COLORS.crowd1;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, player.width / 2, 0, Math.PI * 2);
        ctx.stroke();

        // Glow effect
        ctx.strokeStyle = `rgba(200, 16, 46, ${0.3 + Math.sin(frameCount * 0.1) * 0.2})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, player.width / 2 + 3, 0, Math.PI * 2);
        ctx.stroke();
    } else {
        // Fallback: Draw a simple player
        ctx.fillStyle = COLORS.crowd1;
        ctx.beginPath();
        ctx.arc(0, 0, player.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.white;
        ctx.font = '20px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚽', 0, 0);
    }

    ctx.restore();
}

function drawPlayerTrail() {
    player.trail.forEach((point, idx) => {
        const alpha = (idx / player.trail.length) * 0.3;
        ctx.fillStyle = `rgba(200, 16, 46, ${alpha})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3 + idx * 0.5, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawParticles() {
    particles.forEach(p => {
        ctx.fillStyle = typeof p.color === 'string' ? p.color : COLORS.particle;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function drawScorePopup() {
    // Flash effect on score
    if (flashAlpha > 0.01) {
        ctx.fillStyle = `rgba(255, 0, 0, ${flashAlpha * 0.3})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
}

function drawIdlePlayer() {
    // Floating animation on start screen canvas
    const bobY = GAME_HEIGHT / 2 - 50 + Math.sin(frameCount * 0.04) * 15;
    player.y = bobY;

    ctx.save();
    ctx.translate(player.x + player.width / 2, bobY + player.height / 2);

    if (playerImgLoaded) {
        ctx.beginPath();
        ctx.arc(0, 0, player.width / 2 + 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(
            playerImg,
            -player.width / 2 - 2, -player.height / 2 - 2,
            player.width + 4, player.height + 4
        );
    }

    ctx.restore();
}

// --- Main Render ---
function render() {
    // Scale canvas
    ctx.save();
    const scaleX = canvas.width / GAME_WIDTH;
    const scaleY = canvas.height / GAME_HEIGHT;
    ctx.scale(scaleX, scaleY);

    // Screen shake
    if (screenShake > 0.5) {
        const shakeX = (Math.random() - 0.5) * screenShake;
        const shakeY = (Math.random() - 0.5) * screenShake;
        ctx.translate(shakeX, shakeY);
    }

    // Clear
    ctx.clearRect(-20, -20, GAME_WIDTH + 40, GAME_HEIGHT + 40);

    // Draw background
    drawBackground();

    // Draw pipes
    pipes.forEach(pipe => drawPipe(pipe));

    // Draw footballs
    footballs.forEach(fb => drawFootball(fb));

    // Draw player trail
    if (gameState === 'PLAYING') {
        drawPlayerTrail();
    }

    // Draw player
    if (gameState === 'START') {
        drawIdlePlayer();
    } else {
        drawPlayer();
    }

    // Draw ground (over everything)
    drawGround();

    // Draw particles
    drawParticles();

    // Flash effect
    drawScorePopup();

    ctx.restore();
}

// --- Game Loop ---
function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);

    // Increment frame for idle animation
    if (gameState === 'START') {
        frameCount++;
    }
}

// --- Start Game ---
function startGame() {
    initAudio();
    resetGame();
    gameState = 'PLAYING';
    playSound('whistle');

    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('gameover-screen').classList.remove('active');
    document.getElementById('hud').classList.remove('hidden');
    updateHUD();
}

function restartGame() {
    document.getElementById('gameover-screen').classList.remove('active');
    startGame();
}

// --- Input Handlers ---
function handleInput(e) {
    e.preventDefault();

    if (gameState === 'START') {
        startGame();
    } else if (gameState === 'PLAYING') {
        jump();
    } else if (gameState === 'GAME_OVER') {
        // Small delay to prevent accidental restart
    }
}

// Keyboard
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        handleInput(e);
    }
    if (e.code === 'KeyP' && gameState === 'PLAYING') {
        gameState = 'PAUSED';
        document.getElementById('pause-indicator').classList.remove('hidden');
    } else if (e.code === 'KeyP' && gameState === 'PAUSED') {
        gameState = 'PLAYING';
        document.getElementById('pause-indicator').classList.add('hidden');
    }
});

// Mouse / Touch
canvas.addEventListener('mousedown', handleInput);
canvas.addEventListener('touchstart', handleInput, { passive: false });

// Buttons
document.getElementById('start-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    startGame();
});

document.getElementById('restart-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    restartGame();
});

// --- Init ---
document.getElementById('start-high-score').textContent = highScore;
document.getElementById('hud-high-value').textContent = highScore;

// Start game loop
gameLoop();

console.log('⚽ Flappy Football loaded! Have fun!');
