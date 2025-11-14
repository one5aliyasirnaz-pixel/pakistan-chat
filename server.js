const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Serve static files from public folder
app.use(express.static('public'));

// Handle root route - serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
    console.log(`🚀 Pakistan Chat Room running on http://localhost:${PORT}`);
});

// WebSocket server for signaling
const wss = new WebSocket.Server({ server, path: '/ws' });

// Rooms storage
const rooms = {
    'Pakistan Room 60': {
        clients: new Map(),
        messages: []
    }
};

function broadcastToRoom(roomId, message, excludeClientId = null) {
    const room = rooms[roomId];
    if (!room) return;

    const data = JSON.stringify(message);
    room.clients.forEach((client, clientId) => {
        if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(data);
        }
    });
}

wss.on('connection', (ws) => {
    console.log('🔗 New user connected');
    let currentClient = null;
    let currentRoom = null;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            if (message.type === 'join') {
                const { room: roomId = 'Pakistan Room 60', username } = message;
                
                if (!rooms[roomId]) {
                    rooms[roomId] = { clients: new Map(), messages: [] };
                }
                
                currentRoom = rooms[roomId];
                const clientId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                
                currentClient = {
                    id: clientId,
                    username: username.substring(0, 50),
                    ws
                };
                
                currentRoom.clients.set(clientId, currentClient);
                
                console.log(`✅ ${username} joined ${roomId}`);
                
                // Send join success with client list and recent messages
                ws.send(JSON.stringify({
                    type: 'join-success',
                    clientId,
                    users: Array.from(currentRoom.clients.values()).map(c => ({
                        id: c.id,
                        username: c.username
                    })),
                    messages: currentRoom.messages.slice(-50)
                }));
                
                // Broadcast user joined to others
                broadcastToRoom(roomId, {
                    type: 'user-joined',
                    clientId,
                    username: currentClient.username
                }, clientId);
            }
            else if (message.type === 'signal' && currentClient) {
                // Forward WebRTC signaling messages
                const targetClient = currentRoom.clients.get(message.to);
                if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
                    targetClient.ws.send(JSON.stringify({
                        type: 'signal',
                        from: currentClient.id,
                        payload: message.payload
                    }));
                }
            }
            else if (message.type === 'message' && currentClient && currentRoom) {
                // Sanitize and store message
                const sanitizedText = message.text.toString().substring(0, 1000);
                const chatMessage = {
                    id: Date.now().toString(),
                    username: currentClient.username,
                    text: sanitizedText,
                    timestamp: new Date().toISOString()
                };
                
                console.log(`💬 ${currentClient.username}: ${sanitizedText}`);
                
                currentRoom.messages.push(chatMessage);
                // Keep only last 50 messages
                if (currentRoom.messages.length > 50) {
                    currentRoom.messages = currentRoom.messages.slice(-50);
                }
                
                // Broadcast message to all in room
                broadcastToRoom('Pakistan Room 60', {
                    type: 'message',
                    message: chatMessage
                });
            }
        } catch (error) {
            console.error('❌ Message processing error:', error);
        }
    });

    ws.on('close', () => {
        console.log('🔌 User disconnected');
        if (currentClient && currentRoom) {
            currentRoom.clients.delete(currentClient.id);
            broadcastToRoom('Pakistan Room 60', {
                type: 'user-left',
                clientId: currentClient.id,
                username: currentClient.username
            });
        }
    });
});