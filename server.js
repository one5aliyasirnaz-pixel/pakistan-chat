const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Static files
app.use(express.static('public'));

// Basic route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Pakistan Chat Server running on port ${PORT}`);
});

// WebSocket setup
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
                const roomId = 'Pakistan Room 60';
                currentRoom = rooms[roomId];
                const clientId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                
                currentClient = {
                    id: clientId,
                    username: message.username.substring(0, 50),
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
                
                // Broadcast user joined
                broadcastToRoom(roomId, {
                    type: 'user-joined',
                    clientId,
                    username: currentClient.username
                }, clientId);
            }
            else if (message.type === 'message' && currentClient && currentRoom) {
                const chatMessage = {
                    id: Date.now().toString(),
                    username: currentClient.username,
                    text: message.text.toString().substring(0, 1000),
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
            console.error('Message error:', error);
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
