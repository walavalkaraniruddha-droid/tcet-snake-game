// --- DSA: Frontend Queue Implementation for Academic Requirements ---
class Queue {
    constructor() { this.items = []; }
    enqueue(element) { this.items.push(element); }
    dequeue() { return this.items.shift(); }
    rear() { return this.items[this.items.length - 1]; }
    toArray() { return [...this.items]; }
    clear() { this.items = []; }
}

// UI Elements
const mainMenu = document.getElementById('main-menu');
const gameUI = document.getElementById('game-ui');
const nameInput = document.getElementById('player-name');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const p1ScoreEl = document.getElementById('p1-score');
const p2ScoreEl = document.getElementById('p2-score');
const modeIndicator = document.getElementById('mode-indicator');
const matchWinsEl = document.getElementById('match-wins');
const aiBtn = document.getElementById('ai-toggle');

const overlay = document.getElementById('game-overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySubtext = document.getElementById('overlay-subtext');
const btnAction = document.getElementById('btn-action');
const btnMenu = document.getElementById('btn-menu');

const GRID_SIZE = 20;

let socket = null;
let isMultiplayer = false;
let localGameInterval = null;
let isAiMode = false;

// --- LOCAL SINGLE PLAYER LOGIC ---
let snakeQ = new Queue();
let food = {}, velocity = {x:1, y:0}, nextVelocity = {x:1, y:0}, score = 0;

function startSinglePlayer() {
    isMultiplayer = false;
    mainMenu.classList.add('hidden');
    gameUI.classList.remove('hidden');
    aiBtn.classList.remove('hidden');
    matchWinsEl.classList.add('hidden');
    p2ScoreEl.classList.add('hidden'); 
    modeIndicator.innerText = "SINGLE PLAYER";
    
    resetLocalGame();
}

function resetLocalGame() {
    snakeQ.clear();
    snakeQ.enqueue({x:4, y:10});
    snakeQ.enqueue({x:5, y:10});
    snakeQ.enqueue({x:6, y:10});
    
    velocity = {x:1, y:0}; nextVelocity = {x:1, y:0}; score = 0; 
    p1ScoreEl.innerText = `${nameInput.value || 'Player'}: ${score}`;
    overlay.classList.add('hidden');
    food = { x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20) };
    
    if(localGameInterval) clearInterval(localGameInterval);
    localGameInterval = setInterval(localGameLoop, 120);
}

function localGameLoop() {
    // Greedy AI Fallback
    if (isAiMode) {
        const head = snakeQ.rear();
        if (head.x < food.x && velocity.x !== -1) nextVelocity = {x: 1, y: 0};
        else if (head.x > food.x && velocity.x !== 1) nextVelocity = {x: -1, y: 0};
        else if (head.y < food.y && velocity.y !== -1) nextVelocity = {x: 0, y: 1};
        else if (head.y > food.y && velocity.y !== 1) nextVelocity = {x: 0, y: -1};
    }
    
    velocity = {...nextVelocity};
    const head = snakeQ.rear();
    const newHead = { x: head.x + velocity.x, y: head.y + velocity.y };
    const snakeArr = snakeQ.toArray();

    // Death Check
    if (newHead.x < 0 || newHead.x >= 20 || newHead.y < 0 || newHead.y >= 20 || 
        snakeArr.some(s => s.x === newHead.x && s.y === newHead.y)) {
        clearInterval(localGameInterval);
        showOverlay("GAME OVER", `Final Score: ${score}`, "PLAY AGAIN");
        return;
    }

    snakeQ.enqueue(newHead);
    if (newHead.x === food.x && newHead.y === food.y) {
        score += 10; 
        p1ScoreEl.innerText = `${nameInput.value || 'Player'}: ${score}`;
        food = { x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20) };
    } else {
        snakeQ.dequeue(); 
    }
    renderSinglePlayer();
}

function renderSinglePlayer() {
    ctx.fillStyle = '#050b14'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ffdd00'; ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(food.x * GRID_SIZE + 10, food.y * GRID_SIZE + 10, 8, 0, Math.PI*2); ctx.fill();
    
    const snakeArr = snakeQ.toArray();
    snakeArr.forEach((seg, i) => {
        const isHead = i === snakeArr.length - 1;
        ctx.fillStyle = '#00e5ff'; ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = isHead ? 15 : 0;
        ctx.fillRect(seg.x * GRID_SIZE + 1, seg.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);
    });
    ctx.shadowBlur = 0; 
}

// --- MULTIPLAYER ARENA LOGIC ---
function startMultiplayer() {
    isMultiplayer = true;
    const myName = nameInput.value || "Player";
    
    mainMenu.classList.add('hidden');
    gameUI.classList.remove('hidden');
    aiBtn.classList.add('hidden');
    matchWinsEl.classList.remove('hidden');
    p2ScoreEl.classList.remove('hidden');
    
    if(!socket) {
        socket = io();
        socket.emit('joinGame', myName);

        socket.on('serverFull', () => {
            showOverlay("SERVER FULL", "Please wait for space.", "RETRY");
            socket.disconnect();
            socket = null;
        });

        socket.on('gameState', (arena) => {
            updateMultiplayerUI(arena);
            renderMultiplayer(arena);
        });

        socket.on('roundResult', (data) => {
            if (data.state === 'ROUND_OVER') {
                showOverlay(`${data.winnerName} WINS ROUND!`, "Get ready for the next round.", "NEXT ROUND");
            } else if (data.state === 'MATCH_OVER') {
                showOverlay(`${data.winnerName} WINS THE MATCH!`, "Best of 3 completed.", "PLAY AGAIN");
            }
        });

        socket.on('playerDisconnected', () => {
            showOverlay("OPPONENT LEFT", "The other player disconnected.", "BACK TO MENU");
            btnAction.classList.add('hidden'); 
        });
    }
}

function updateMultiplayerUI(arena) {
    if (arena.state === 'WAITING') {
        showOverlay("WAITING...", "Waiting for Player 2 to join.", "CANCEL");
        btnAction.classList.add('hidden');
    } else if (arena.state === 'COUNTDOWN') {
        showOverlay("GET READY!", "Round is starting...", "...");
        btnAction.classList.add('hidden');
        btnMenu.classList.add('hidden');
    } else if (arena.state === 'PLAYING') {
        overlay.classList.add('hidden');
    }

    modeIndicator.innerText = `ROUND ${arena.round}`;
    
    let pCount = 1;
    let winText = "WINS: ";
    for (let id in arena.players) {
        let p = arena.players[id];
        if (pCount === 1) {
            p1ScoreEl.innerText = `${p.name}: ${p.score}`;
            p1ScoreEl.style.color = p.color;
            winText += p.wins + " - ";
        } else {
            p2ScoreEl.innerText = `${p.name}: ${p.score}`;
            p2ScoreEl.style.color = p.color;
            winText += p.wins;
        }
        pCount++;
    }
    matchWinsEl.innerText = winText.endsWith("- ") ? winText + "0" : winText;
}

function renderMultiplayer(arena) {
    ctx.fillStyle = '#050b14'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (arena.state === 'WAITING') return;

    // Draw Food
    ctx.fillStyle = '#ffdd00'; ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(arena.food.x * GRID_SIZE + 10, arena.food.y * GRID_SIZE + 10, 8, 0, Math.PI*2); ctx.fill();

    // Draw Snakes
    for (let id in arena.players) {
        let p = arena.players[id];
        if (!p.isAlive) continue; 
        
        // Correctly extract the array from the socket payload
        let snakeBody = p.snakeQueue.items || p.snakeQueue;
        
        snakeBody.forEach((seg, i) => {
            const isHead = i === snakeBody.length - 1;
            ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = isHead ? 15 : 0;
            ctx.fillRect(seg.x * GRID_SIZE + 1, seg.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);
        });
    }
    ctx.shadowBlur = 0; 
}

// --- OVERLAY CONTROLLER ---
function showOverlay(title, subtext, actionBtnText) {
    overlay.classList.remove('hidden');
    overlayTitle.innerText = title;
    overlaySubtext.innerText = subtext;
    
    btnAction.innerText = actionBtnText;
    btnAction.classList.remove('hidden');
    btnMenu.classList.remove('hidden');

    btnAction.onclick = () => {
        if (isMultiplayer) {
            socket.emit('playerReady');
            showOverlay("WAITING...", "Waiting for opponent...", "...");
            btnAction.classList.add('hidden');
            btnMenu.classList.add('hidden');
        } else {
            resetLocalGame();
        }
    };
}

// --- CONTROLS & LISTENERS ---
function handleInput(dir) {
    if (isMultiplayer && socket) socket.emit('input', dir);
    else {
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
    if (e.key.toLowerCase() === 'q' && !isMultiplayer) {
        isAiMode = !isAiMode;
        aiBtn.innerText = `AI MODE: ${isAiMode ? 'ON' : 'OFF'}`;
        aiBtn.classList.toggle('active', isAiMode);
    }
});

document.querySelectorAll('.d-btn').forEach(btn => {
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(btn.dataset.dir); });
});

document.getElementById('btn-single').addEventListener('click', startSinglePlayer);
document.getElementById('btn-multi').addEventListener('click', startMultiplayer);

btnMenu.addEventListener('click', () => {
    gameUI.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    if(localGameInterval) clearInterval(localGameInterval);
    if(socket) {
        socket.disconnect();
        socket = null;
    }
});
