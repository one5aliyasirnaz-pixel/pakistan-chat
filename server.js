const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

// WebSocket server
const wss = new WebSocket.Server({ server });
const clients = new Map();

wss.on('connection', (ws) => {
    const clientId = Date.now().toString();
    clients.set(clientId, ws);
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            if (message.type === 'join') {
                broadcast({
                    type: 'user-joined',
                    userId: clientId,
                    username: message.username
                }, clientId);
            }
            else if (message.type === 'audio') {
                broadcast({
                    type: 'audio',
                    userId: clientId,
                    audioData: message.audioData,
                    username: message.username
                }, clientId);
            }
            else if (message.type === 'message') {
                // FIX: Exclude sender from broadcast to prevent duplicates
                broadcast({
                    type: 'message',
                    userId: clientId,
                    username: message.username,
                    text: message.text,
                    timestamp: new Date().toISOString()
                }, clientId);
            }
        } catch (error) {
            console.error('WebSocket error:', error);
        }
    });
    
    ws.on('close', () => {
        clients.delete(clientId);
        broadcast({
            type: 'user-left',
            userId: clientId
        });
    });
});

function broadcast(message, excludeClientId = null) {
    const data = JSON.stringify(message);
    clients.forEach((ws, clientId) => {
        if (clientId !== excludeClientId && ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    });
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server running' });
});

// Main chat application
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pakistan Room 60</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Tahoma', Arial; 
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: #333; height: 100vh; 
            display: flex; justify-content: center; align-items: center;
        }
        .chat-container {
            width: 95%; max-width: 1000px; height: 95vh;
            background: white; border-radius: 15px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.3);
            display: flex; flex-direction: column; overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #3665b3 0%, #2a5298 100%);
            color: white; padding: 20px; text-align: center;
            border-bottom: 4px solid #1e3c72;
        }
        .main-content { display: flex; flex: 1; }
        .chat-area { flex: 1; display: flex; flex-direction: column; }
        .messages { 
            flex: 1; padding: 20px; overflow-y: auto; 
            background: #f8fbff; 
        }
        .message {
            margin-bottom: 15px; padding: 12px 18px; 
            border-radius: 12px; max-width: 70%;
        }
        .message.own {
            background: #3665b3; color: white; margin-left: auto;
        }
        .message.other {
            background: #e6f2ff; color: #333; margin-right: auto;
        }
        .message-header {
            display: flex; justify-content: space-between;
            font-size: 12px; margin-bottom: 5px; opacity: 0.8;
        }
        .sidebar {
            width: 250px; background: #f0f8ff;
            border-left: 3px solid #d1e0ff; padding: 20px;
        }
        .input-area {
            padding: 20px; background: #f8fbff;
            border-top: 3px solid #e6f2ff; display: flex; gap: 12px;
        }
        .message-input {
            flex: 1; padding: 12px 20px;
            border: 2px solid #d1e0ff; border-radius: 25px;
            font-size: 16px; outline: none;
        }
        .send-btn {
            background: #4CAF50; color: white; border: none; 
            padding: 12px 25px; border-radius: 25px; 
            cursor: pointer; font-weight: bold;
        }
        .login-modal {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.9); display: flex;
            justify-content: center; align-items: center; z-index: 1000;
        }
        .login-box {
            background: white; padding: 40px; border-radius: 15px;
            text-align: center; width: 90%; max-width: 400px;
        }
        .login-box h2 { color: #3665b3; margin-bottom: 20px; }
        .username-input {
            width: 100%; padding: 12px 15px; margin-bottom: 20px;
            border: 2px solid #d1e0ff; border-radius: 8px; font-size: 16px;
        }
        .join-btn {
            width: 100%; padding: 12px; background: #3665b3;
            color: white; border: none; border-radius: 8px;
            font-size: 16px; cursor: pointer; font-weight: bold;
        }
        .hidden { display: none; }
    </style>
</head>
<body>
    <div id="loginModal" class="login-modal">
        <div class="login-box">
            <h2>🟢 Join Pakistan Room 60</h2>
            <input type="text" id="usernameInput" class="username-input" placeholder="Enter your name">
            <button id="joinBtn" class="join-btn">Join Chat</button>
        </div>
    </div>

    <div id="chatApp" class="chat-container hidden">
        <div class="header">
            <h1>Pakistan Room 60 -- Chat</h1>
        </div>
        
        <div class="main-content">
            <div class="chat-area">
                <div id="messagesContainer" class="messages">
                    <div class="message other">
                        <div class="message-header">
                            <strong>System</strong>
                            <span>Welcome</span>
                        </div>
                        <div>🚀 Pakistan Room 60 Chat Started!</div>
                    </div>
                </div>
                <div class="input-area">
                    <input type="text" id="messageInput" class="message-input" placeholder="Type your message...">
                    <button id="sendBtn" class="send-btn">Send</button>
                </div>
            </div>
            
            <div class="sidebar">
                <div class="users-list">
                    <h3>🟢 Online Users</h3>
                    <div id="usersList"></div>
                </div>
            </div>
        </div>
    </div>

    <script>
        class PakistanChat {
            constructor() {
                this.username = '';
                this.ws = null;
                this.init();
            }
            
            init() {
                this.bindEvents();
            }
            
            bindEvents() {
                document.getElementById('joinBtn').addEventListener('click', () => this.join());
                document.getElementById('usernameInput').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.join();
                });
                
                document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
                document.getElementById('messageInput').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.sendMessage();
                });
            }
            
            join() {
                const username = document.getElementById('usernameInput').value.trim();
                if (!username) return alert('Please enter your name');
                
                this.username = username;
                this.connectWebSocket();
                
                document.getElementById('loginModal').classList.add('hidden');
                document.getElementById('chatApp').classList.remove('hidden');
            }
            
            connectWebSocket() {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = \`\${protocol}//\${window.location.host}\`;
                
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    this.ws.send(JSON.stringify({
                        type: 'join',
                        username: this.username
                    }));
                };
                
                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleMessage(message);
                    } catch (error) {
                        console.error('WebSocket error:', error);
                    }
                };
            }
            
            handleMessage(message) {
                switch (message.type) {
                    case 'user-joined':
                        this.addUser(message.userId, message.username);
                        this.addMessage('System', \`\${message.username} joined\`);
                        break;
                        
                    case 'user-left':
                        this.removeUser(message.userId);
                        break;
                        
                    case 'message':
                        // FIX: Only show messages from other users
                        if (message.username !== this.username) {
                            this.addMessage(message.username, message.text, message.timestamp);
                        }
                        break;
                }
            }
            
            sendMessage() {
                const input = document.getElementById('messageInput');
                const text = input.value.trim();
                if (!text || !this.ws) return;
                
                // FIX: Show message immediately for sender
                this.addMessage(this.username, text, new Date().toISOString());
                
                this.ws.send(JSON.stringify({
                    type: 'message',
                    username: this.username,
                    text: text
                }));
                
                input.value = '';
            }
            
            addMessage(sender, text, timestamp) {
                const container = document.getElementById('messagesContainer');
                const messageDiv = document.createElement('div');
                
                const isOwn = sender === this.username;
                messageDiv.className = \`message \${isOwn ? 'own' : 'other'}\`;
                messageDiv.innerHTML = \`
                    <div class="message-header">
                        <strong>\${sender}</strong>
                        <span>\${new Date(timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div>\${text}</div>
                \`;
                
                container.appendChild(messageDiv);
                container.scrollTop = container.scrollHeight;
            }
            
            addUser(userId, username) {
                const usersList = document.getElementById('usersList');
                const userDiv = document.createElement('div');
                
                userDiv.className = 'user-item';
                userDiv.id = \`user-\${userId}\`;
                userDiv.textContent = username + (username === this.username ? ' (You)' : '');
                
                usersList.appendChild(userDiv);
            }
            
            removeUser(userId) {
                const userElement = document.getElementById(\`user-\${userId}\`);
                if (userElement) {
                    userElement.remove();
                }
            }
        }
        
        window.addEventListener('load', () => {
            new PakistanChat();
        });
    </script>
</body>
</html>
    `);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Pakistan Chat Server running on port ' + PORT);
});
