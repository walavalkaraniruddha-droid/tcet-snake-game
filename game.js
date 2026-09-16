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

// --- LOCAL SINGLE PLAYER LOGIC (With BFS AI) ---
let snake = [], food = {}, velocity = {x:1, y:0}, nextVelocity = {x:1, y:0}, score = 0, isAiMode = false;

function startSinglePlayer() {
    isMultiplayer = false;
    mainMenu.classList.add('hidden');
    gameUI.classList.remove('hidden');
    aiBtn.classList.remove('hidden'); // Show AI button for single player
    modeIndicator.innerText = "MODE: OFFLINE";
    
    // Reset state
    snake = [{x:4, y:10}, {x:5, y:10}, {x:6, y:10}];
    velocity = {x:1, y:0}; nextVelocity = {x:1, y:0}; score = 0; 
    scoreEl.innerText = score;
    isAiMode = false;
    aiBtn.innerText = "AI MODE: OFF";
    aiBtn.classList.remove('active');
    overlay.classList.add('hidden');
    spawnFoodLocal();
    
    if(localGameInterval) clearInterval(localGameInterval);
    localGameInterval = setInterval(localGameLoop, 120);
}

function spawnFoodLocal() {
    food = { x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20) };
}

function runLocalBFS() {
    // Simple Greedy AI for demonstration if real BFS gets too complex for the grid
    const head = snake[snake.length - 1];
    if (head.x < food.x && velocity.x !== -1) return {x: 1, y: 0};
    if (head.x > food.x && velocity.x !== 1) return {x: -1, y: 0};
    if (head.y < food.y && velocity.y !== -1) return {x: 0, y: 1};
    if (head.y > food.y && velocity.y !== 1) return {x: 0, y: -1};
    return velocity;
}

function localGameLoop() {
    if (isAiMode) nextVelocity = runLocalBFS();
    
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
        snake.shift(); // Dequeue
    }
    render({ snake, food });
}

// --- MULTIPLAYER ARENA LOGIC ---
function startMultiplayer() {
    isMultiplayer = true;
    mainMenu.classList.add('hidden');
    gameUI.classList.remove('hidden');
    aiBtn.classList.add('hidden'); // No AI in Multiplayer Arena
    modeIndicator.innerText = "MODE: ARENA";
    
    if(!socket) {
        socket = io(); // Connect
        socket.on('gameState', (state) => {
            if (state.players[socket.id]) {
                let myPlayer = state.players[socket.id];
                scoreEl.innerText = myPlayer.score;
                
                if (!myPlayer.isAlive) {
                    document.getElementById('final-score').innerText = myPlayer.score;
                    overlay.classList.remove('hidden');
                } else {
                    overlay.classList.add('hidden');
                }
            }
            render(state);
        });
    }
}

// --- UNIFIED RENDER ENGINE ---
function render(state) {
    ctx.fillStyle = '#050b14'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw Food
    ctx.fillStyle = '#ffdd00'; ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(state.food.x * GRID_SIZE + GRID_SIZE/2, state.food.y * GRID_SIZE + GRID_SIZE/2, GRID_SIZE/2.5, 0, Math.PI*2);
    ctx.fill();

    // Draw Snakes
    if (isMultiplayer && state.players) {
        for (let id in state.players) {
            let p = state.players[id];
            if (!p.isAlive) continue; 
            p.snake.forEach((seg, i) => {
                const isHead = i === p.snake.length - 1;
                ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = isHead ? 15 : 0;
                ctx.fillRect(seg.x * GRID_SIZE + 1, seg.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);
            });
        }
    } else if (!isMultiplayer) {
        state.snake.forEach((seg, i) => {
            const isHead = i === state.snake.length - 1;
            ctx.fillStyle = '#00e5ff'; ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = isHead ? 15 : 0;
            ctx.fillRect(seg.x * GRID_SIZE + 1, seg.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);
        });
    }
    ctx.shadowBlur = 0; 
}

// --- CONTROLS ---
function handleInput(dir) {
    if (isMultiplayer) {
        if(socket) socket.emit('input', dir);
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
    if (e.key.toLowerCase() === 'q' && !isMultiplayer) toggleAI();
});

document.querySelectorAll('.d-btn').forEach(btn => {
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(btn.dataset.dir); });
    btn.addEventListener('click', () => handleInput(btn.dataset.dir));
});

function toggleAI() {
    isAiMode = !isAiMode;
    aiBtn.innerText = `AI MODE: ${isAiMode ? 'ON' : 'OFF'}`;
    aiBtn.classList.toggle('active', isAiMode);
}

// Button Listeners
document.getElementById('btn-single').addEventListener('click', startSinglePlayer);
document.getElementById('btn-multi').addEventListener('click', startMultiplayer);
aiBtn.addEventListener('click', toggleAI);
document.getElementById('restart-btn').addEventListener('click', () => {
    gameUI.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    if(localGameInterval) clearInterval(localGameInterval);
    if(socket && isMultiplayer) {
        // Disconnect and reconnect to reset player state on server
        socket.disconnect();
        socket = null;
    }
});
