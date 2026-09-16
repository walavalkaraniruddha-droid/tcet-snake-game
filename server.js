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
let food = { x: 10, y: 10 };
let players = {}; 
let colorToggle = false;

function spawnFood() {
    food.x = Math.floor(Math.random() * GRID);
    food.y = Math.floor(Math.random() * GRID);
}

io.on('connection', (socket) => {
    // 1. Create a new snake for this player
    let pQueue = new Queue();
    let startY = Math.floor(Math.random() * 15) + 2; 
    pQueue.enqueue({x: 2, y: startY});
    pQueue.enqueue({x: 3, y: startY});
    pQueue.enqueue({x: 4, y: startY});

    players[socket.id] = {
        id: socket.id,
        snakeQueue: pQueue,
        velocity: {x: 1, y: 0},
        nextVelocity: {x: 1, y: 0},
        score: 0,
        isAlive: true,
        color: colorToggle ? '#ff0055' : '#00e5ff' // Alternates Neon Pink and Cyan
    };
    colorToggle = !colorToggle;

    // 2. Listen for THIS player's controls
    socket.on('input', (dir) => {
        let p = players[socket.id];
        if (!p || !p.isAlive) return;
        if (dir === 'UP' && p.velocity.y === 0) p.nextVelocity = { x: 0, y: -1 };
        if (dir === 'DOWN' && p.velocity.y === 0) p.nextVelocity = { x: 0, y: 1 };
        if (dir === 'LEFT' && p.velocity.x === 0) p.nextVelocity = { x: -1, y: 0 };
        if (dir === 'RIGHT' && p.velocity.x === 0) p.nextVelocity = { x: 1, y: 0 };
    });

    // 3. Remove snake on disconnect
    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

// Multiplayer Game Loop
setInterval(() => {
    let clientPlayers = {}; 

    for (let id in players) {
        let p = players[id];
        if (!p.isAlive) continue;

        p.velocity = { ...p.nextVelocity };
        const head = p.snakeQueue.rear();
        const newHead = { x: head.x + p.velocity.x, y: head.y + p.velocity.y };

        // Wall Collision
        if (newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID) {
            p.isAlive = false;
            continue;
        }

        // Collision against ALL other snakes
        let crashed = false;
        for (let otherId in players) {
            let otherSnake = players[otherId].snakeQueue.toArray();
            if (otherSnake.some(s => s.x === newHead.x && s.y === newHead.y)) {
                crashed = true;
            }
        }
        
        if (crashed) {
            p.isAlive = false;
            continue;
        }

        p.snakeQueue.enqueue(newHead);
        
        if (newHead.x === food.x && newHead.y === food.y) {
            p.score += 10;
            spawnFood();
        } else {
            p.snakeQueue.dequeue();
        }

        clientPlayers[id] = {
            snake: p.snakeQueue.toArray(),
            color: p.color,
            score: p.score,
            isAlive: p.isAlive
        };
    }

    io.emit('gameState', { players: clientPlayers, food });
}, 120);

// Required for Render.com to assign a port
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
