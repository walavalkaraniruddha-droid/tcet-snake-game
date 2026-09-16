// UI Elements
const mainMenu = document.getElementById('main-menu');
const gameUI = document.getElementById('game-ui');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const modeIndicator = document.getElementById('mode-indicator');
const overlay = document.getElementById('game-over-overlay');
const aiBtn = document.getElementById('ai-toggle');
const GRID_SIZE = 20;

let socket = null;
let isMultiplayer = false;
let localGameInterval = null;

// --- LOCAL SINGLE PLAYER LOGIC ---
let snake = [], food = {}, velocity = {x:1, y:0}, nextVelocity = {x:1, y:0}, score = 0, isAiMode = false;

function startSinglePlayer() {
    isMultiplayer = false;
    mainMenu.classList.add('hidden');
    gameUI.classList.remove('hidden');
    modeIndicator.innerText = "MODE: OFFLINE";
    
    // Reset local state
    snake = [{x:4, y:10}, {x:5, y:10}, {x:6, y:10}];
    velocity = {x:1, y:0}; nextVelocity = {x:1, y:0}; score = 0; scoreEl.innerText = score;
    overlay.classList.add('hidden');
    spawnFoodLocal();
    
    if(localGameInterval) clearInterval(localGameInterval);
    localGameInterval = setInterval(localGameLoop, 120);
}

function spawnFoodLocal() {
    food = { x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20) };
}

function localGameLoop() {
    velocity = {...nextVelocity};
    const head = snake[snake.length - 1];
    const newHead = { x: head.x + velocity.x, y: head.y + velocity.y };

    if (newHead.x < 0 || newHead.x >= 20 || newHead.y < 0 || newHead.y >= 20 || 
        snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
        clearInterval(localGameInterval);
        document.getElementById('final-score').innerText = score;
        overlay.classList.remove('hidden');
        return;
    }

    snake.push(newHead);
    if (newHead.x === food.x && newHead.y === food.y) {
        score += 10; scoreEl.innerText = score; spawnFoodLocal();
    } else {
        snake.shift();
    }
    render({ snake, food });
}

// --- MULTIPLAYER LOGIC ---
function startMultiplayer() {
    isMultiplayer = true;
    mainMenu.classList.add('hidden');
    gameUI.classList.remove('hidden');
    modeIndicator.innerText = "MODE: ONLINE (SYNCED)";
    
    if(!socket) {
        socket = io(); // Connect to server
        socket.on('gameState', (state) => {
            if (state.isGameOver) {
                document.getElementById('final-score').innerText = state.score;
                overlay.classList.remove('hidden');
            } else {
                overlay.classList.add('hidden');
            }
            scoreEl.innerText = state.score;
            render(state);
        });
    }
    socket.emit('restart'); // Tell server to start
}

// --- RENDER ENGINE ---
function render(state) {
    ctx.fillStyle = '#050b14'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Food
    ctx.fillStyle = '#ff0055'; ctx.shadowColor = '#ff0055'; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(state.food.x * GRID_SIZE + GRID_SIZE/2, state.food.y * GRID_SIZE + GRID_SIZE/2, GRID_SIZE/2.5, 0, Math.PI*2);
    ctx.fill();

    // Snake
    state.snake.forEach((seg, i) => {
        const isHead = i === state.snake.length - 1;
        ctx.fillStyle = isHead ? '#00e5ff' : '#0077ff';
        ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = isHead ? 15 : 0;
        ctx.fillRect(seg.x * GRID_SIZE + 1, seg.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);
    });
    ctx.shadowBlur = 0; // reset
}

// --- CONTROLS ---
function handleInput(dir) {
    if (isMultiplayer) {
        socket.emit('input', dir);
    } else {
        if (dir === 'UP' && velocity.y === 0) nextVelocity = { x: 0, y: -1 };
        if (dir === 'DOWN' && velocity.y === 0) nextVelocity = { x: 0, y: 1 };
        if (dir === 'LEFT' && velocity.x === 0) nextVelocity = { x: -1, y: 0 };
        if (dir === 'RIGHT' && velocity.x === 0) nextVelocity = { x: 1, y: 0 };
    }
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') handleInput('UP');
    if (e.key === 'ArrowDown') handleInput('DOWN');
    if (e.key === 'ArrowLeft') handleInput('LEFT');
    if (e.key === 'ArrowRight') handleInput('RIGHT');
});

document.querySelectorAll('.d-btn').forEach(btn => {
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(btn.dataset.dir); });
    btn.addEventListener('click', () => handleInput(btn.dataset.dir));
});

// Buttons
document.getElementById('btn-single').addEventListener('click', startSinglePlayer);
document.getElementById('btn-multi').addEventListener('click', startMultiplayer);
document.getElementById('restart-btn').addEventListener('click', () => {
    gameUI.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    if(localGameInterval) clearInterval(localGameInterval);
});