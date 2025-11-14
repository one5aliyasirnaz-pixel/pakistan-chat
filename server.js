const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

// WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients and admin/VIP users
const clients = new Map();
const adminUsers = new Set(['admin']); // Default admin username
const vipUsers = new Set();

wss.on('connection', (ws) => {
    const clientId = Date.now().toString();
    let currentUsername = '';
    
    clients.set(clientId, { ws, username: '', isAdmin: false, isVIP: false });
    
    console.log('New client connected:', clientId);
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            if (message.type === 'join') {
                currentUsername = message.username;
                const isAdmin = adminUsers.has(message.username);
                const isVIP = vipUsers.has(message.username);
                
                clients.set(clientId, { 
                    ws, 
                    username: message.username, 
                    isAdmin: isAdmin,
                    isVIP: isVIP 
                });
                
                // Send user role info
                ws.send(JSON.stringify({
                    type: 'user-role',
                    isAdmin: isAdmin,
                    isVIP: isVIP
                }));
                
                // Broadcast user joined
                broadcast({
                    type: 'user-joined',
                    userId: clientId,
                    username: message.username,
                    isAdmin: isAdmin,
                    isVIP: isVIP
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
                // Check for bad words
                if (containsBadWords(message.text)) {
                    ws.send(JSON.stringify({
                        type: 'warning',
                        message: '⚠️ Please avoid using inappropriate language!'
                    }));
                    return;
                }
                
                // Check for admin commands
                if (message.text.startsWith('/')) {
                    handleCommand(message.text, clientId);
                    return;
                }
                
                broadcast({
                    type: 'message',
                    userId: clientId,
                    username: message.username,
                    text: message.text,
                    timestamp: new Date().toISOString(),
                    isAdmin: clients.get(clientId).isAdmin,
                    isVIP: clients.get(clientId).isVIP
                }, clientId);
            }
        } catch (error) {
            console.error('WebSocket error:', error);
        }
    });
    
    ws.on('close', () => {
        clients.delete(clientId);
        console.log('Client disconnected:', clientId);
        
        broadcast({
            type: 'user-left',
            userId: clientId,
            username: currentUsername
        });
    });
});

// Bad words filter
function containsBadWords(text) {
    const badWords = ['gali', 'badword', 'abuse', 'fuck', 'shit', 'asshole'];
    return badWords.some(word => text.toLowerCase().includes(word));
}

// Admin command handler
function handleCommand(command, clientId) {
    const client = clients.get(clientId);
    if (!client) return;
    
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();
    const targetUser = parts[1];
    
    // Only admin can use commands
    if (!client.isAdmin && !client.isVIP) {
        client.ws.send(JSON.stringify({
            type: 'error',
            message: '❌ You do not have permission to use commands!'
        }));
        return;
    }
    
    switch(cmd) {
        case '/kick':
            if (!client.isAdmin) {
                client.ws.send(JSON.stringify({
                    type: 'error',
                    message: '❌ Only admin can kick users!'
                }));
                return;
            }
            kickUser(targetUser, client.username);
            break;
            
        case '/vip':
            if (!client.isAdmin) {
                client.ws.send(JSON.stringify({
                    type: 'error',
                    message: '❌ Only admin can assign VIP!'
                }));
                return;
            }
            makeVIP(targetUser, client.username);
            break;
            
        case '/unvip':
            if (!client.isAdmin) {
                client.ws.send(JSON.stringify({
                    type: 'error',
                    message: '❌ Only admin can remove VIP!'
                }));
                return;
            }
            removeVIP(targetUser, client.username);
            break;
            
        case '/ban':
            if (!client.isAdmin) {
                client.ws.send(JSON.stringify({
                    type: 'error',
                    message: '❌ Only admin can ban users!'
                }));
                return;
            }
            banUser(targetUser, client.username);
            break;
            
        case '/users':
            listUsers(client.ws);
            break;
            
        case '/help':
            showHelp(client.ws, client.isAdmin);
            break;
            
        default:
            client.ws.send(JSON.stringify({
                type: 'error',
                message: '❌ Unknown command! Type /help for available commands.'
            }));
    }
}

function kickUser(targetUsername, adminUsername) {
    let kicked = false;
    clients.forEach((client, clientId) => {
        if (client.username === targetUsername) {
            client.ws.send(JSON.stringify({
                type: 'kicked',
                message: `🚫 You were kicked by admin ${adminUsername}`
            }));
            client.ws.close();
            clients.delete(clientId);
            kicked = true;
        }
    });
    
    if (kicked) {
        broadcast({
            type: 'system',
            message: `🚫 ${targetUsername} was kicked by admin ${adminUsername}`
        });
    }
}

function makeVIP(targetUsername, adminUsername) {
    vipUsers.add(targetUsername);
    
    // Update existing user if online
    clients.forEach((client, clientId) => {
        if (client.username === targetUsername) {
            client.isVIP = true;
            client.ws.send(JSON.stringify({
                type: 'user-role',
                isAdmin: client.isAdmin,
                isVIP: true
            }));
        }
    });
    
    broadcast({
        type: 'system',
        message: `⭐ ${targetUsername} is now a VIP user (by ${adminUsername})`
    });
}

function removeVIP(targetUsername, adminUsername) {
    vipUsers.delete(targetUsername);
    
    // Update existing user if online
    clients.forEach((client, clientId) => {
        if (client.username === targetUsername) {
            client.isVIP = false;
            client.ws.send(JSON.stringify({
                type: 'user-role',
                isAdmin: client.isAdmin,
                isVIP: false
            }));
        }
    });
    
    broadcast({
        type: 'system',
        message: `❌ VIP removed from ${targetUsername} (by ${adminUsername})`
    });
}

function banUser(targetUsername, adminUsername) {
    // Implement ban logic here
    broadcast({
        type: 'system',
        message: `🚫 ${targetUsername} was banned by admin ${adminUsername}`
    });
}

function listUsers(ws) {
    const userList = Array.from(clients.values()).map(client => ({
        username: client.username,
        isAdmin: client.isAdmin,
        isVIP: client.isVIP
    }));
    
    ws.send(JSON.stringify({
        type: 'user-list',
        users: userList
    }));
}

function showHelp(ws, isAdmin) {
    let helpText = `
📋 Available Commands:
/help - Show this help message
/users - Show online users

`;
    
    if (isAdmin) {
        helpText += `
🔧 Admin Commands:
/kick [username] - Kick a user
/vip [username] - Make user VIP
/unvip [username] - Remove VIP
/ban [username] - Ban a user
`;
    }
    
    ws.send(JSON.stringify({
        type: 'help',
        message: helpText
    }));
}

function broadcast(message, excludeClientId = null) {
    const data = JSON.stringify(message);
    clients.forEach((client, clientId) => {
        if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(data);
        }
    });
}

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Pakistan Chat with Admin Controls',
        onlineUsers: clients.size
    });
});

// Main chat application with Admin Controls
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pakistan Room 60 - Admin Chat</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Tahoma', Arial; 
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: #333; height: 100vh; 
            display: flex; justify-content: center; align-items: center;
        }
        .chat-container {
            width: 95%; max-width: 1200px; height: 95vh;
            background: white; border-radius: 15px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.3);
            display: flex; flex-direction: column; overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #3665b3 0%, #2a5298 100%);
            color: white; padding: 20px; text-align: center;
            border-bottom: 4px solid #1e3c72;
            position: relative;
        }
        .header h1 { font-size: 24px; margin: 0; }
        .user-badges {
            position: absolute; right: 20px; top: 50%; transform: translateY(-50%);
            display: flex; gap: 10px;
        }
        .badge {
            padding: 4px 8px; border-radius: 12px; font-size: 12px;
            font-weight: bold;
        }
        .badge.admin { background: #ff4444; color: white; }
        .badge.vip { background: gold; color: black; }
        .connection-status {
            display: flex; align-items: center; justify-content: center;
            gap: 10px; margin-top: 5px; font-size: 14px;
        }
        .status-dot {
            width: 10px; height: 10px; border-radius: 50%;
            background: #ff4444;
        }
        .status-dot.connected { background: #4CAF50; }
        .main-content { display: flex; flex: 1; }
        .chat-area { flex: 1; display: flex; flex-direction: column; }
        .messages { 
            flex: 1; padding: 20px; overflow-y: auto; 
            background: #f8fbff; 
        }
        .message {
            margin-bottom: 15px; padding: 12px 18px; 
            border-radius: 12px; max-width: 70%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            position: relative;
        }
        .message.own {
            background: linear-gradient(135deg, #3665b3 0%, #2a5298 100%);
            color: white; margin-left: auto; border-bottom-right-radius: 4px;
        }
        .message.other {
            background: white; color: #333; margin-right: auto; 
            border: 2px solid #e6f2ff; border-bottom-left-radius: 4px;
        }
        .message.system {
            background: #fff3cd; color: #856404; margin: 10px auto;
            border: 1px solid #ffeaa7; text-align: center; max-width: 90%;
        }
        .message.warning {
            background: #f8d7da; color: #721c24; margin: 10px auto;
            border: 1px solid #f5c6cb; text-align: center; max-width: 90%;
        }
        .message-header {
            display: flex; justify-content: space-between;
            font-size: 12px; margin-bottom: 5px; opacity: 0.8;
        }
        .user-badge-small {
            display: inline-block; padding: 2px 6px; margin-left: 5px;
            border-radius: 8px; font-size: 10px; font-weight: bold;
        }
        .admin-badge { background: #ff4444; color: white; }
        .vip-badge { background: gold; color: black; }
        .sidebar {
            width: 300px; background: #f0f8ff;
            border-left: 3px solid #d1e0ff; padding: 20px;
            display: flex; flex-direction: column;
        }
        .users-list { flex: 1; }
        .users-list h3 { 
            color: #3665b3; margin-bottom: 15px; 
            border-bottom: 2px solid #3665b3; padding-bottom: 10px;
        }
        .user-item {
            padding: 10px 15px; margin-bottom: 8px;
            background: white; border-radius: 8px;
            border-left: 4px solid #4CAF50; 
            display: flex; justify-content: space-between; align-items: center;
        }
        .user-item.admin { border-left-color: #ff4444; background: #ffe6e6; }
        .user-item.vip { border-left-color: gold; background: #fff9e6; }
        .voice-controls {
            margin-top: 20px; padding-top: 20px;
            border-top: 2px solid #d1e0ff;
        }
        .voice-btn {
            width: 100%; padding: 12px; margin-bottom: 10px;
            border: none; border-radius: 8px; font-size: 16px;
            cursor: pointer; font-weight: bold; transition: all 0.3s;
        }
        .mute-btn { 
            background: #4CAF50; color: white;
        }
        .mute-btn.muted { background: #ff4444; }
        .ptt-btn { 
            background: #3665b3; color: white;
        }
        .ptt-btn.recording { background: #ff4444; }
        .admin-panel {
            margin-top: 15px; padding: 15px;
            background: #fff3cd; border: 2px solid #ffeaa7;
            border-radius: 8px;
        }
        .admin-panel h4 { color: #856404; margin-bottom: 10px; }
        .admin-input {
            width: 100%; padding: 8px; margin-bottom: 8px;
            border: 1px solid #ccc; border-radius: 4px; font-size: 14px;
        }
        .admin-btn {
            padding: 6px 12px; margin: 2px; border: none; border-radius: 4px;
            cursor: pointer; font-size: 12px;
        }
        .kick-btn { background: #ff4444; color: white; }
        .vip-btn { background: gold; color: black; }
        .input-area {
            padding: 20px; background: #f8fbff;
            border-top: 3px solid #e6f2ff; display: flex; gap: 12px;
        }
        .message-input {
            flex: 1; padding: 12px 20px;
            border: 2px solid #d1e0ff; border-radius: 25px;
            font-size: 16px; outline: none;
        }
        .message-input:focus { border-color: #3665b3; }
        .send-btn {
            background: #4CAF50; color: white; border: none; 
            padding: 12px 25px; border-radius: 25px; 
            cursor: pointer; font-weight: bold; font-size: 16px;
        }
        .login-modal {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.9); display: flex;
            justify-content: center; align-items: center; z-index: 1000;
        }
        .login-box {
            background: white; padding: 40px; border-radius: 15px;
            text-align: center; width: 90%; max-width: 400px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
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
        .command-hint {
            font-size: 12px; color: #666; margin-top: 5px;
        }
    </style>
</head>
<body>
    <div id="loginModal" class="login-modal">
        <div class="login-box">
            <h2>🛡️ Join Pakistan Room 60</h2>
            <p style="color: #666; margin-bottom: 15px;">Admin: "admin" | VIP: Can use some commands</p>
            <input type="text" id="usernameInput" class="username-input" placeholder="Enter your username">
            <button id="joinBtn" class="join-btn">Join Secure Chat</button>
        </div>
    </div>

    <div id="chatApp" class="chat-container hidden">
        <div class="header">
            <h1>Pakistan Room 60 -- Secure Chat</h1>
            <div class="user-badges" id="userBadges"></div>
            <div class="connection-status">
                <div id="statusDot" class="status-dot"></div>
                <span id="statusText">Connecting...</span>
            </div>
        </div>
        
        <div class="main-content">
            <div class="chat-area">
                <div id="messagesContainer" class="messages">
                    <div class="message system">
                        <div>🛡️ Secure Chat Started! Type /help for commands</div>
                    </div>
                </div>
                <div class="input-area">
                    <div style="flex: 1;">
                        <input type="text" id="messageInput" class="message-input" placeholder="Type message or /command">
                        <div class="command-hint">Commands: /help, /users, /kick, /vip, /ban</div>
                    </div>
                    <button id="sendBtn" class="send-btn">Send</button>
                </div>
            </div>
            
            <div class="sidebar">
                <div class="users-list">
                    <h3>👥 Online Users</h3>
                    <div id="usersList"></div>
                </div>
                
                <div id="adminPanel" class="admin-panel hidden">
                    <h4>🔧 Admin Controls</h4>
                    <input type="text" id="targetUser" class="admin-input" placeholder="Username">
                    <div>
                        <button class="admin-btn kick-btn" onclick="adminCommand('kick')">Kick</button>
                        <button class="admin-btn vip-btn" onclick="adminCommand('vip')">Make VIP</button>
                        <button class="admin-btn" onclick="adminCommand('unvip')" style="background: #ccc;">UnVIP</button>
                        <button class="admin-btn kick-btn" onclick="adminCommand('ban')">Ban</button>
                    </div>
                </div>
                
                <div class="voice-controls">
                    <button id="muteBtn" class="voice-btn mute-btn">🎤 Unmuted</button>
                    <button id="pttBtn" class="voice-btn ptt-btn">🎙️ Push to Talk (Space)</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        class PakistanAdminChat {
            constructor() {
                this.username = '';
                this.ws = null;
                this.isAdmin = false;
                this.isVIP = false;
                this.localStream = null;
                this.isMuted = false;
                this.isRecording = false;
                this.init();
            }
            
            async init() {
                await this.setupAudio();
                this.bindEvents();
            }
            
            async setupAudio() {
                try {
                    this.localStream = await navigator.mediaDevices.getUserMedia({ 
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        } 
                    });
                } catch (error) {
                    console.warn('Microphone access denied:', error);
                }
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
                
                document.getElementById('muteBtn').addEventListener('click', () => this.toggleMute());
                
                const pttBtn = document.getElementById('pttBtn');
                pttBtn.addEventListener('mousedown', () => this.startVoice());
                pttBtn.addEventListener('mouseup', () => this.stopVoice());
                
                document.addEventListener('keydown', (e) => {
                    if (e.key === ' ' && e.target.id !== 'messageInput') {
                        e.preventDefault();
                        this.startVoice();
                    }
                });
                
                document.addEventListener('keyup', (e) => {
                    if (e.key === ' ' && e.target.id !== 'messageInput') {
                        e.preventDefault();
                        this.stopVoice();
                    }
                });
            }
            
            join() {
                const username = document.getElementById('usernameInput').value.trim();
                if (!username) return alert('Please enter your username');
                
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
                    this.updateConnectionStatus(true);
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
                        console.error('WebSocket message error:', error);
                    }
                };
                
                this.ws.onclose = () => {
                    this.updateConnectionStatus(false);
                    setTimeout(() => this.connectWebSocket(), 3000);
                };
            }
            
            handleMessage(message) {
                switch (message.type) {
                    case 'user-role':
                        this.isAdmin = message.isAdmin;
                        this.isVIP = message.isVIP;
                        this.updateUserBadges();
                        if (this.isAdmin || this.isVIP) {
                            document.getElementById('adminPanel').classList.remove('hidden');
                        }
                        break;
                        
                    case 'user-joined':
                        this.addUser(message.userId, message.username, message.isAdmin, message.isVIP);
                        this.addSystemMessage(\`\${message.username} joined the chat\`);
                        break;
                        
                    case 'user-left':
                        this.removeUser(message.userId);
                        if (message.username) {
                            this.addSystemMessage(\`\${message.username} left the chat\`);
                        }
                        break;
                        
                    case 'message':
                        this.addMessage(
                            message.username, 
                            message.text, 
                            message.timestamp, 
                            false,
                            message.isAdmin,
                            message.isVIP
                        );
                        break;
                        
                    case 'system':
                        this.addSystemMessage(message.message);
                        break;
                        
                    case 'warning':
                        this.addWarningMessage(message.message);
                        break;
                        
                    case 'error':
                        this.addSystemMessage(\`❌ \${message.message}\`);
                        break;
                        
                    case 'kicked':
                        alert(message.message);
                        this.ws.close();
                        break;
                        
                    case 'user-list':
                        this.showUserList(message.users);
                        break;
                        
                    case 'help':
                        this.addSystemMessage(message.message);
                        break;
                }
            }
            
            updateConnectionStatus(connected) {
                const dot = document.getElementById('statusDot');
                const text = document.getElementById('statusText');
                
                if (connected) {
                    dot.className = 'status-dot connected';
                    text.textContent = 'Connected';
                } else {
                    dot.className = 'status-dot';
                    text.textContent = 'Disconnected';
                }
            }
            
            updateUserBadges() {
                const badgesContainer = document.getElementById('userBadges');
                badgesContainer.innerHTML = '';
                
                if (this.isAdmin) {
                    const adminBadge = document.createElement('div');
                    adminBadge.className = 'badge admin';
                    adminBadge.textContent = 'ADMIN';
                    badgesContainer.appendChild(adminBadge);
                }
                
                if (this.isVIP) {
                    const vipBadge = document.createElement('div');
                    vipBadge.className = 'badge vip';
                    vipBadge.textContent = 'VIP';
                    badgesContainer.appendChild(vipBadge);
                }
            }
            
            sendMessage() {
                const input = document.getElementById('messageInput');
                const text = input.value.trim();
                if (!text || !this.ws) return;
                
                this.ws.send(JSON.stringify({
                    type: 'message',
                    username: this.username,
                    text: text
                }));
                
                input.value = '';
            }
            
            addMessage(sender, text, timestamp, isOwn, isAdmin = false, isVIP = false) {
                const container = document.getElementById('messagesContainer');
                const messageDiv = document.createElement('div');
                
                messageDiv.className = \`message \${isOwn ? 'own' : 'other'}\`;
                
                let badges = '';
                if (isAdmin) badges += '<span class="user-badge-small admin-badge">ADMIN</span>';
                if (isVIP) badges += '<span class="user-badge-small vip-badge">VIP</span>';
                
                messageDiv.innerHTML = \`
                    <div class="message-header">
                        <strong>\${sender}\${badges}</strong>
                        <span>\${new Date(timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div>\${text}</div>
                \`;
                
                container.appendChild(messageDiv);
                container.scrollTop = container.scrollHeight;
            }
            
            addSystemMessage(text) {
                const container = document.getElementById('messagesContainer');
                const messageDiv = document.createElement('div');
                
                messageDiv.className = 'message system';
                messageDiv.innerHTML = \`<div>\${text}</div>\`;
                
                container.appendChild(messageDiv);
                container.scrollTop = container.scrollHeight;
            }
            
            addWarningMessage(text) {
                const container = document.getElementById('messagesContainer');
                const messageDiv = document.createElement('div');
                
                messageDiv.className = 'message warning';
                messageDiv.innerHTML = \`<div>\${text}</div>\`;
                
                container.appendChild(messageDiv);
                container.scrollTop = container.scrollHeight;
            }
            
            addUser(userId, username, isAdmin, isVIP) {
                const usersList = document.getElementById('usersList');
                const userDiv = document.createElement('div');
                
                userDiv.className = 'user-item' + (isAdmin ? ' admin' : '') + (isVIP ? ' vip' : '');
                userDiv.id = \`user-\${userId}\`;
                userDiv.innerHTML = \`
                    <span>\${username}\${username === this.username ? ' (You)' : ''}</span>
                    <div>\${isAdmin ? '🛡️' : ''}\${isVIP ? '⭐' : ''}</div>
                \`;
                
                usersList.appendChild(userDiv);
            }
            
            removeUser(userId) {
                const userElement = document.getElementById(\`user-\${userId}\`);
                if (userElement) {
                    userElement.remove();
                }
            }
            
            showUserList(users) {
                this.addSystemMessage('👥 Online Users: ' + users.map(u => 
                    \`\${u.username}\${u.isAdmin ? ' (Admin)' : ''}\${u.isVIP ? ' (VIP)' : ''}\`
                ).join(', '));
            }
            
            toggleMute() {
                this.isMuted = !this.isMuted;
                const btn = document.getElementById('muteBtn');
                
                if (this.isMuted) {
                    btn.textContent = '🎤 Muted';
                    btn.classList.add('muted');
                } else {
                    btn.textContent = '🎤 Unmuted';
                    btn.classList.remove('muted');
                }
            }
            
            startVoice() {
                if (this.isRecording || this.isMuted || !this.ws || !this.localStream) return;
                this.isRecording = true;
                document.getElementById('pttBtn').classList.add('recording');
                // Voice recording logic here
            }
            
            stopVoice() {
                if (!this.isRecording) return;
                this.isRecording = false;
                document.getElementById('pttBtn').classList.remove('recording');
                // Stop voice recording logic here
            }
        }
        
        function adminCommand(command) {
            const targetUser = document.getElementById('targetUser').value.trim();
            if (!targetUser) return alert('Please enter a username');
            
            const chat = window.chatInstance;
            if (chat && chat.ws) {
                chat.ws.send(JSON.stringify({
                    type: 'message',
                    username: chat.username,
                    text: \`/\${command} \${targetUser}\`
                }));
            }
            
            document.getElementById('targetUser').value = '';
        }
        
        window.addEventListener('load', () => {
            window.chatInstance = new PakistanAdminChat();
        });
    </script>
</body>
</html>
    `);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Pakistan Admin Chat Server running on port ' + PORT);
});
