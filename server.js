const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname)); // Serve your HTML/CSS/JS files

// --- DSA: Server-Side Queue ---
class Queue {
    constructor() { this.items = []; }
    enqueue(el) { this.items.push(el); }
    dequeue() { return this.items.shift(); }
    rear() { return this.items[this.items.length - 1]; }
    toArray() { return [...this.items]; }
    clear() { this.items = []; }
}

const GRID = 20;
let snakeQueue = new Queue();
let food = { x: 5, y: 5 };
let velocity = { x: 1, y: 0 };
let nextVelocity = { x: 1, y: 0 };
let score = 0;
let aiMode = false;
let isGameOver = false;

// Initialize Game State
function initGame() {
    snakeQueue.clear();
    snakeQueue.enqueue({ x: 4, y: 10 });
    snakeQueue.enqueue({ x: 5, y: 10 });
    snakeQueue.enqueue({ x: 6, y: 10 });
    velocity = { x: 1, y: 0 };
    nextVelocity = { x: 1, y: 0 };
    score = 0;
    aiMode = false;
    isGameOver = false;
    spawnFood();
}

function spawnFood() {
    let valid = false;
    while (!valid) {
        food.x = Math.floor(Math.random() * GRID);
        food.y = Math.floor(Math.random() * GRID);
        valid = !snakeQueue.toArray().some(s => s.x === food.x && s.y === food.y);
    }
}

// Server-Side BFS AI
function runBFS() {
    const head = snakeQueue.rear();
    const visited = Array.from({ length: GRID }, () => Array(GRID).fill(false));
    snakeQueue.toArray().forEach(s => { if(s.x >= 0 && s.x < GRID && s.y >= 0 && s.y < GRID) visited[s.x][s.y] = true; });

    const bfsQueue = new Queue();
    bfsQueue.enqueue({ x: head.x, y: head.y, path: [] });
    visited[head.x][head.y] = true;

    const dirs = [
        { x: 0, y: -1, name: 'UP' }, { x: 0, y: 1, name: 'DOWN' },
        { x: -1, y: 0, name: 'LEFT' }, { x: 1, y: 0, name: 'RIGHT' }
    ];

    while (bfsQueue.items.length > 0) {
        const { x, y, path } = bfsQueue.dequeue();
        if (x === food.x && y === food.y && path.length > 0) return path[0];

        for (const d of dirs) {
            const nx = x + d.x, ny = y + d.y;
            if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID && !visited[nx][ny]) {
                visited[nx][ny] = true;
                bfsQueue.enqueue({ x: nx, y: ny, path: [...path, d] });
            }
        }
    }
    return { x: 0, y: -1 };
}

// Global Game Loop
setInterval(() => {
    if (isGameOver) return;

    if (aiMode) {
        const move = runBFS();
        nextVelocity = { x: move.x, y: move.y };
    }

    velocity = { ...nextVelocity };
    const head = snakeQueue.rear();
    const newHead = { x: head.x + velocity.x, y: head.y + velocity.y };

    if (newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID || 
        snakeQueue.toArray().some(s => s.x === newHead.x && s.y === newHead.y)) {
        isGameOver = true;
    } else {
        snakeQueue.enqueue(newHead);
        if (newHead.x === food.x && newHead.y === food.y) {
            score += 10;
            spawnFood();
        } else {
            snakeQueue.dequeue();
        }
    }

    // Broadcast state to all connected devices
    io.emit('gameState', {
        snake: snakeQueue.toArray(),
        food: food,
        score: score,
        aiMode: aiMode,
        isGameOver: isGameOver
    });
}, 120);

// Client Connections
io.on('connection', (socket) => {
    console.log('New device connected:', socket.id);

    socket.on('input', (dir) => {
        if (aiMode) return;
        if (dir === 'UP' && velocity.y === 0) nextVelocity = { x: 0, y: -1 };
        if (dir === 'DOWN' && velocity.y === 0) nextVelocity = { x: 0, y: 1 };
        if (dir === 'LEFT' && velocity.x === 0) nextVelocity = { x: -1, y: 0 };
        if (dir === 'RIGHT' && velocity.x === 0) nextVelocity = { x: 1, y: 0 };
    });

    socket.on('toggleAI', () => { aiMode = !aiMode; });
    socket.on('restart', () => { if (isGameOver) initGame(); });
});

initGame();
server.listen(8000, () => {
    console.log('High-End WebSocket Server running on port 8000');
});