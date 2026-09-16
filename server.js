const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// --- DSA: Queue for Snake Bodies ---
class Queue {
    constructor() { this.items = []; }
    enqueue(el) { this.items.push(el); }
    dequeue() { return this.items.shift(); }
    rear() { return this.items[this.items.length - 1]; }
    toArray() { return [...this.items]; }
}

const GRID = 20;
let arena = {
    state: 'WAITING', // WAITING, PLAYING, ROUND_OVER, MATCH_OVER
    players: {},
    food: { x: 10, y: 10 },
    round: 1
};

let readyCount = 0;

function resetPlayerSnakes() {
    let startY = 5;
    for (let id in arena.players) {
        let p = arena.players[id];
        p.snakeQueue = new Queue();
        p.snakeQueue.enqueue({x: 2, y: startY});
        p.snakeQueue.enqueue({x: 3, y: startY});
        p.snakeQueue.enqueue({x: 4, y: startY});
        p.velocity = {x: 1, y: 0};
        p.nextVelocity = {x: 1, y: 0};
        p.score = 0;
        p.isAlive = true;
        startY += 10; // Space out the starting positions
    }
}

function spawnFood() {
    arena.food.x = Math.floor(Math.random() * GRID);
    arena.food.y = Math.floor(Math.random() * GRID);
}

io.on('connection', (socket) => {
    socket.on('joinGame', (playerName) => {
        if (Object.keys(arena.players).length >= 2) {
            socket.emit('serverFull');
            return;
        }

        let isFirst = Object.keys(arena.players).length === 0;
        arena.players[socket.id] = {
            id: socket.id,
            name: playerName || (isFirst ? "Player 1" : "Player 2"),
            color: isFirst ? '#00e5ff' : '#ff0055',
            wins: 0,
            snakeQueue: new Queue(),
            velocity: {x: 1, y: 0},
            nextVelocity: {x: 1, y: 0},
            score: 0,
            isAlive: true
        };

        if (Object.keys(arena.players).length === 1) {
            arena.state = 'WAITING';
            io.emit('gameState', arena);
        } else if (Object.keys(arena.players).length === 2) {
            startNewRound();
        }
    });

    socket.on('input', (dir) => {
        if (arena.state !== 'PLAYING') return;
        let p = arena.players[socket.id];
        if (!p || !p.isAlive) return;
        if (dir === 'UP' && p.velocity.y === 0) p.nextVelocity = { x: 0, y: -1 };
        if (dir === 'DOWN' && p.velocity.y === 0) p.nextVelocity = { x: 0, y: 1 };
        if (dir === 'LEFT' && p.velocity.x === 0) p.nextVelocity = { x: -1, y: 0 };
        if (dir === 'RIGHT' && p.velocity.x === 0) p.nextVelocity = { x: 1, y: 0 };
    });

    socket.on('playerReady', () => {
        readyCount++;
        if (readyCount === Object.keys(arena.players).length) {
            if (arena.state === 'MATCH_OVER') {
                arena.round = 1;
                for (let id in arena.players) arena.players[id].wins = 0;
            } else {
                arena.round++;
            }
            startNewRound();
        }
    });

    socket.on('disconnect', () => {
        delete arena.players[socket.id];
        if (Object.keys(arena.players).length > 0) {
            arena.state = 'WAITING';
            arena.round = 1;
            for (let id in arena.players) arena.players[id].wins = 0;
            io.emit('playerDisconnected');
        }
    });
});

function startNewRound() {
    readyCount = 0;
    resetPlayerSnakes();
    spawnFood();
    arena.state = 'COUNTDOWN';
    io.emit('gameState', arena);
    
    setTimeout(() => {
        arena.state = 'PLAYING';
        io.emit('gameState', arena);
    }, 3000); // 3-second countdown
}

function handleRoundEnd(loserId) {
    arena.state = 'ROUND_OVER';
    let winnerName = "Nobody";
    
    for (let id in arena.players) {
        if (id !== loserId) {
            arena.players[id].wins++;
            winnerName = arena.players[id].name;
            if (arena.players[id].wins >= 2) {
                arena.state = 'MATCH_OVER'; 
            }
        }
    }
    
    io.emit('roundResult', { winnerName, state: arena.state });
}

// Game Loop
setInterval(() => {
    if (arena.state !== 'PLAYING') return;

    let crashedId = null;

    for (let id in arena.players) {
        let p = arena.players[id];
        if (!p.isAlive) continue;

        p.velocity = { ...p.nextVelocity };
        const head = p.snakeQueue.rear();
        const newHead = { x: head.x + p.velocity.x, y: head.y + p.velocity.y };

        // 1. Wall Collision
        if (newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID) {
            p.isAlive = false;
            crashedId = id;
            break;
        }

        // 2. Snake Collision
        for (let otherId in arena.players) {
            let otherSnake = arena.players[otherId].snakeQueue.toArray();
            if (otherSnake.some(s => s.x === newHead.x && s.y === newHead.y)) {
                p.isAlive = false;
                crashedId = id;
                break;
            }
        }
        if (crashedId) break;

        // Move
        p.snakeQueue.enqueue(newHead);
        
        // Food check
        if (newHead.x === arena.food.x && newHead.y === arena.food.y) {
            p.score += 10;
            spawnFood();
        } else {
            p.snakeQueue.dequeue();
        }
    }

    if (crashedId) {
        handleRoundEnd(crashedId);
    } else {
        io.emit('gameState', arena);
    }
}, 120);

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
