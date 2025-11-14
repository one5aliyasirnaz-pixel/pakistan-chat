const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Static files
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server running' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

// WebSocket
const wss = new WebSocket.Server({ server, path: '/ws' });
const rooms = {
    'main': { clients: new Map(), messages: [] }
};

wss.on('connection', (ws) => {
    let currentClient = null;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            if (message.type === 'join') {
                const clientId = Date.now().toString();
                currentClient = { id: clientId, username: message.username, ws };
                rooms.main.clients.set(clientId, currentClient);
                
                ws.send(JSON.stringify({
                    type: 'join-success',
                    clientId,
                    users: Array.from(rooms.main.clients.values()),
                    messages: rooms.main.messages.slice(-50)
                }));
            }
            else if (message.type === 'message' && currentClient) {
                const chatMessage = {
                    username: currentClient.username,
                    text: message.text,
                    timestamp: new Date().toISOString()
                };
                
                rooms.main.messages.push(chatMessage);
                
                // Broadcast to all
                rooms.main.clients.forEach(client => {
                    if (client.ws.readyState === WebSocket.OPEN) {
                        client.ws.send(JSON.stringify({
                            type: 'message',
                            message: chatMessage
                        }));
                    }
                });
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    ws.on('close', () => {
        if (currentClient) {
            rooms.main.clients.delete(currentClient.id);
        }
    });
});
