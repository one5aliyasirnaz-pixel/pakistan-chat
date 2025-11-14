const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Static files serving - Railway ke liye important
app.use(express.static(path.join(__dirname, 'public')));

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Handle all routes for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server, path: '/ws' });

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
                
                // Send join success
                ws.send(JSON.stringify({
                    type: 'join-success',
                    clientId,
                    users: Array.from(currentRoom.clients.values()).map(c => ({
                        id: c.id,
                        username: c.username
                    })),
                    messages: currentRoom.messages.slice(-50)
                }));
                
                // Broadcast to others
                broadcastToRoom(roomId, {
                    type: 'user-joined',
                    clientId,
                    username: currentClient.username
                }, clientId);
            }
            else if (message.type === 'signal' && currentClient) {
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
                const sanitizedText = message.text.toString().substring(0, 1000);
                const chatMessage = {
                    id: Date.now().toString(),
                    username: currentClient.username,
                    text: sanitizedText,
                    timestamp: new Date().toISOString()
                };
                
                currentRoom.messages.push(chatMessage);
                if (currentRoom.messages.length > 50) {
                    currentRoom.messages = currentRoom.messages.slice(-50);
                }
                
                broadcastToRoom('Pakistan Room 60', {
                    type: 'message',
                    message: chatMessage
                });
            }
        } catch (error) {
            console.error('Message processing error:', error);
        }
    });

    ws.on('close', () => {
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
