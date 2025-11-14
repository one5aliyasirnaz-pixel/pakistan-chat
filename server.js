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
const adminUsers = new Map([
    ['one5ali', 'baadshahone51'] // username: password
]);
const vipUsers = new Set();

wss.on('connection', (ws) => {
    const clientId = Date.now().toString();
    let currentUsername = '';
    let isAuthenticated = false;
    
    clients.set(clientId, { ws, username: '', isAdmin: false, isVIP: false, isAuthenticated: false });
    
    console.log('New client connected:', clientId);
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            if (message.type === 'join') {
                currentUsername = message.username;
                const password = message.password;
                
                // Check if admin login
                const isAdmin = adminUsers.has(message.username) && adminUsers.get(message.username) === password;
                const isVIP = vipUsers.has(message.username) || isAdmin;
                
                const isAuthenticated = true; // Basic users don't need password
                
                clients.set(clientId, { 
                    ws, 
                    username: message.username, 
                    isAdmin: isAdmin,
                    isVIP: isVIP,
                    isAuthenticated: isAuthenticated
                });
                
                // Send user role info
                ws.send(JSON.stringify({
                    type: 'user-role',
                    isAdmin: isAdmin,
                    isVIP: isVIP,
                    username: message.username
                }));
                
                // Broadcast user joined
                broadcast({
                    type: 'user-joined',
                    userId: clientId,
                    username: message.username,
                    isAdmin: isAdmin,
                    isVIP: isVIP
                }, clientId);
                
                // Send welcome message
                ws.send(JSON.stringify({
                    type: 'system',
                    message: `Welcome to Bollywood2 Chat Room! ${isAdmin ? 'You are logged in as ADMIN' : isVIP ? 'You are VIP user' : 'Enjoy chatting!'}`
                }));
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
                const client = clients.get(clientId);
                if (!client || !client.isAuthenticated) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: '❌ Please join the chat first!'
                    }));
                    return;
                }
                
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
                
                // ✅ FIX: Broadcast message to everyone including sender
                broadcast({
                    type: 'message',
                    userId: clientId,
                    username: client.username,
                    text: message.text,
                    timestamp: new Date().toISOString(),
                    isAdmin: client.isAdmin,
                    isVIP: client.isVIP
                }); // Remove clientId exclusion so sender also sees message
            }
        } catch (error) {
            console.error('WebSocket error:', error);
        }
    });
    
    ws.on('close', () => {
        clients.delete(clientId);
        console.log('Client disconnected:', clientId);
        
        if (currentUsername) {
            broadcast({
                type: 'user-left',
                userId: clientId,
                username: currentUsername
            });
        }
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
    if (!client || !client.isAuthenticated) return;
    
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();
    const targetUser = parts[1];
    
    // Check if user has permission for ANY commands
    if (!client.isAdmin && !client.isVIP) {
        client.ws.send(JSON.stringify({
            type: 'error',
            message: '❌ You do not have permission to use commands!'
        }));
        return;
    }
    
    switch(cmd) {
        case '/kick':
        case '/ban':
            // Only admin can kick/ban
            if (!client.isAdmin) {
                client.ws.send(JSON.stringify({
                    type: 'error',
                    message: '❌ Only admin can ' + cmd.substring(1) + ' users!'
                }));
                return;
            }
            if (cmd === '/kick') kickUser(targetUser, client.username);
            else banUser(targetUser, client.username);
            break;
            
        case '/vip':
        case '/unvip':
            // Only admin can assign/remove VIP
            if (!client.isAdmin) {
                client.ws.send(JSON.stringify({
                    type: 'error',
                    message: '❌ Only admin can manage VIP users!'
                }));
                return;
            }
            if (cmd === '/vip') makeVIP(targetUser, client.username);
            else removeVIP(targetUser, client.username);
            break;
            
        case '/users':
            listUsers(client.ws);
            break;
            
        case '/help':
            showHelp(client.ws, client.isAdmin, client.isVIP);
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
                isVIP: true,
                username: client.username
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
                isVIP: false,
                username: client.username
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
    kickUser(targetUsername, adminUsername); // For now, just kick
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

function showHelp(ws, isAdmin, isVIP) {
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
    } else if (isVIP) {
        helpText += `
⭐ VIP Commands:
/users - Show online users
/help - Show this help message
`;
    }
    
    ws.send(JSON.stringify({
        type: 'help',
        message: helpText
    }));
}

// ✅ FIX: Broadcast function - remove exclusion so sender sees their own messages
function broadcast(message, excludeClientId = null) {
    const data = JSON.stringify(message);
    clients.forEach((client, clientId) => {
        if (client.ws.readyState === WebSocket.OPEN) {
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

// Main chat application with Yahoo Classic Design
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bollywood2 - Chat</title>
    <style>
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
            font-family: 'Tahoma', 'Arial', sans-serif;
            font-size: 12px;
        }
        
        body {
            background: #c0c0c0;
            padding: 4px;
            height: 100vh;
            overflow: hidden;
        }
        
        /* Main Window */
        .yahoo-window {
            width: 100%;
            height: 100%;
            background: #ece9d8;
            border: 2px solid;
            border-top-color: #ffffff;
            border-left-color: #ffffff;
            border-right-color: #808080;
            border-bottom-color: #808080;
            display: flex;
            flex-direction: column;
        }
        
        /* Title Bar */
        .title-bar {
            background: linear-gradient(to right, #000080, #1084d0);
            color: white;
            padding: 2px 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 18px;
            font-weight: bold;
        }
        
        .window-controls {
            display: flex;
            gap: 2px;
        }
        
        .window-control {
            width: 16px;
            height: 14px;
            background: #c0c0c0;
            border: 1px solid;
            border-top-color: #ffffff;
            border-left-color: #ffffff;
            border-right-color: #808080;
            border-bottom-color: #808080;
            text-align: center;
            line-height: 12px;
            font-size: 10px;
            cursor: pointer;
        }
        
        /* Menu Bar */
        .menu-bar {
            background: #ece9d8;
            border-bottom: 1px solid #808080;
            padding: 2px 4px;
            display: flex;
            gap: 15px;
            font-size: 11px;
        }
        
        .menu-item {
            cursor: pointer;
        }
        
        .menu-item:hover {
            background: #000080;
            color: white;
        }
        
        /* Toolbar */
        .toolbar {
            background: #ece9d8;
            padding: 4px;
            border-bottom: 1px solid #808080;
            display: flex;
            gap: 8px;
            align-items: center;
        }
        
        .toolbar-button {
            background: #ece9d8;
            border: 1px solid;
            border-top-color: #ffffff;
            border-left-color: #ffffff;
            border-right-color: #808080;
            border-bottom-color: #808080;
            padding: 3px 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
        }
        
        .toolbar-button:active {
            border-top-color: #808080;
            border-left-color: #808080;
            border-right-color: #ffffff;
            border-bottom-color: #ffffff;
        }
        
        /* Main Content */
        .main-content {
            display: flex;
            flex: 1;
            background: white;
        }
        
        /* Chat Area */
        .chat-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            border-right: 1px solid #808080;
        }
        
        .messages-container {
            flex: 1;
            padding: 4px;
            overflow-y: auto;
            background: white;
            border: 1px solid #808080;
            margin: 4px;
            font-family: 'Tahoma', sans-serif;
            font-size: 11px;
        }
        
        .message-line {
            margin-bottom: 2px;
            line-height: 1.3;
        }
        
        .username {
            font-weight: bold;
            cursor: pointer;
        }
        
        .username.green { color: #008000; }
        .username.blue { color: #0000ff; }
        .username.red { color: #ff0000; }
        .username.purple { color: #800080; }
        .username.orange { color: #ff6600; }
        
        /* User List */
        .user-list {
            width: 180px;
            background: white;
            display: flex;
            flex-direction: column;
        }
        
        .user-list-header {
            background: #ffcf00;
            padding: 4px 8px;
            font-weight: bold;
            border-bottom: 1px solid #808080;
        }
        
        .users-container {
            flex: 1;
            overflow-y: auto;
            padding: 4px;
        }
        
        .user-item {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 2px 4px;
            cursor: pointer;
        }
        
        .user-item:hover {
            background: #000080;
            color: white;
        }
        
        .user-icon {
            width: 16px;
            height: 16px;
            background: #ffcf00;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
        }
        
        /* Voice Controls */
        .voice-controls {
            background: #ece9d8;
            padding: 8px;
            border-top: 1px solid #808080;
        }
        
        .voice-section {
            background: white;
            border: 1px solid #808080;
            padding: 8px;
        }
        
        .hands-free {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-bottom: 8px;
        }
        
        .talk-button {
            background: #00ff00;
            border: 2px solid #008000;
            padding: 6px 20px;
            font-weight: bold;
            cursor: pointer;
            margin-bottom: 8px;
            text-align: center;
        }
        
        .audio-bars {
            display: flex;
            gap: 20px;
            margin-bottom: 8px;
            justify-content: center;
        }
        
        .audio-bar {
            width: 8px;
            height: 20px;
            background: #c0c0c0;
            border: 1px solid #808080;
        }
        
        .mute-control {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .mute-slider {
            flex: 1;
            height: 12px;
            background: #c0c0c0;
            border: 1px solid #808080;
            position: relative;
        }
        
        .mute-slider::after {
            content: '';
            position: absolute;
            right: 2px;
            top: 2px;
            width: 8px;
            height: 8px;
            background: #000080;
        }
        
        /* Input Area */
        .input-area {
            background: #ece9d8;
            padding: 8px;
            border-top: 1px solid #808080;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .smiley-button {
            background: #ece9d8;
            border: 1px solid;
            border-top-color: #ffffff;
            border-left-color: #ffffff;
            border-right-color: #808080;
            border-bottom-color: #808080;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 14px;
        }
        
        .message-input {
            flex: 1;
            height: 22px;
            border: 1px solid #808080;
            padding: 2px 4px;
            background: white;
        }
        
        .send-button {
            background: #ece9d8;
            border: 1px solid;
            border-top-color: #ffffff;
            border-left-color: #ffffff;
            border-right-color: #808080;
            border-bottom-color: #808080;
            padding: 4px 12px;
            cursor: pointer;
            font-weight: bold;
        }
        
        .send-button:active {
            border-top-color: #808080;
            border-left-color: #808080;
            border-right-color: #ffffff;
            border-bottom-color: #ffffff;
        }
        
        /* Advertisement */
        .advertisement {
            background: #ece9d8;
            padding: 4px;
            border-top: 1px solid #808080;
            text-align: center;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            font-style: italic;
        }
        
        /* Login Modal */
        .login-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        
        .login-window {
            background: #ece9d8;
            border: 2px solid;
            border-top-color: #ffffff;
            border-left-color: #ffffff;
            border-right-color: #808080;
            border-bottom-color: #808080;
            padding: 20px;
            width: 300px;
        }
        
        .login-title {
            background: linear-gradient(to right, #000080, #1084d0);
            color: white;
            padding: 4px 8px;
            margin: -20px -20px 15px -20px;
            font-weight: bold;
        }
        
        .login-input {
            width: 100%;
            padding: 4px;
            margin-bottom: 8px;
            border: 1px solid #808080;
        }
        
        .login-button {
            background: #ece9d8;
            border: 1px solid;
            border-top-color: #ffffff;
            border-left-color: #ffffff;
            border-right-color: #808080;
            border-bottom-color: #808080;
            padding: 6px 20px;
            cursor: pointer;
            margin-top: 10px;
            width: 100%;
        }
        
        .hidden {
            display: none;
        }
        
        /* Scrollbars */
        ::-webkit-scrollbar {
            width: 16px;
        }
        
        ::-webkit-scrollbar-track {
            background: #c0c0c0;
            border: 1px solid #808080;
        }
        
        ::-webkit-scrollbar-thumb {
            background: #c0c0c0;
            border: 1px solid;
            border-top-color: #ffffff;
            border-left-color: #ffffff;
            border-right-color: #808080;
            border-bottom-color: #808080;
        }
        
        /* Checkbox */
        input[type="checkbox"] {
            width: 13px;
            height: 13px;
            appearance: none;
            background: white;
            border: 1px solid #808080;
            position: relative;
        }
        
        input[type="checkbox"]:checked::after {
            content: '✓';
            position: absolute;
            top: -1px;
            left: 2px;
            font-size: 10px;
            color: black;
        }
    </style>
</head>
<body>
    <!-- Login Modal -->
    <div id="loginModal" class="login-modal">
        <div class="login-window">
            <div class="login-title">Yahoo! Chat Login</div>
            <div style="margin-bottom: 10px;">Enter your Yahoo! ID and password:</div>
            <input type="text" id="usernameInput" class="login-input" placeholder="Yahoo! ID">
            <input type="password" id="passwordInput" class="login-input" placeholder="Password">
            <div style="font-size: 11px; color: #666; margin-bottom: 10px;">
                Admin: one5ali / baadshahone51
            </div>
            <button id="joinBtn" class="login-button">Login</button>
        </div>
    </div>

    <!-- Yahoo Chat Window -->
    <div id="chatApp" class="yahoo-window hidden">
        <!-- Title Bar -->
        <div class="title-bar">
            <div>Bollywood2: – Chat</div>
            <div class="window-controls">
                <div class="window-control">_</div>
                <div class="window-control">□</div>
                <div class="window-control">×</div>
            </div>
        </div>
        
        <!-- Menu Bar -->
        <div class="menu-bar">
            <div class="menu-item">Chat</div>
            <div class="menu-item">Edit</div>
            <div class="menu-item">View</div>
            <div class="menu-item">Actions</div>
            <div class="menu-item">Help</div>
        </div>
        
        <!-- Toolbar -->
        <div class="toolbar">
            <div class="toolbar-button">📹 Webcam</div>
            <div class="toolbar-button">🎤 Voice</div>
            <div class="toolbar-button">📁 Send File</div>
            <div class="toolbar-button">💬 Chat</div>
        </div>
        
        <!-- Main Content -->
        <div class="main-content">
            <!-- Chat Area -->
            <div class="chat-area">
                <div id="messagesContainer" class="messages-container">
                    <div class="message-line">
                        <span class="username green">Room:</span> Welcome to Bollywood2 Chat Room! Type /help for commands.
                    </div>
                    <div class="message-line">
                        <span class="username blue">Moderator:</span> Please follow chat rules and be respectful.
                    </div>
                    <div class="message-line">
                        <span class="username red">HotGirl23:</span> hey everyone! 😊
                    </div>
                    <div class="message-line">
                        <span class="username purple">CoolDude45:</span> whats up people?
                    </div>
                    <div class="message-line">
                        <span class="username orange">ChatMaster:</span> anyone here from Mumbai?
                    </div>
                </div>
                
                <!-- Voice Controls -->
                <div class="voice-controls">
                    <div class="voice-section">
                        <div class="hands-free">
                            <input type="checkbox" id="handsFree">
                            <label for="handsFree">Hands Free</label>
                        </div>
                        <div class="talk-button">Talk</div>
                        <div class="audio-bars">
                            <div class="audio-bar"></div>
                            <div class="audio-bar"></div>
                            <div class="audio-bar"></div>
                            <div class="audio-bar"></div>
                            <div class="audio-bar"></div>
                            <div class="audio-bar"></div>
                            <div class="audio-bar"></div>
                            <div class="audio-bar"></div>
                        </div>
                        <div class="mute-control">
                            <span>Mute:</span>
                            <div class="mute-slider"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- User List -->
            <div class="user-list">
                <div class="user-list-header">In Room (6)</div>
                <div class="users-container">
                    <div class="user-item">
                        <div class="user-icon">F</div>
                        <div>HotGirl23</div>
                    </div>
                    <div class="user-item">
                        <div class="user-icon">M</div>
                        <div>CoolDude45</div>
                    </div>
                    <div class="user-item">
                        <div class="user-icon">M</div>
                        <div>ChatMaster</div>
                    </div>
                    <div class="user-item">
                        <div class="user-icon">F</div>
                        <div>BollywoodFan</div>
                    </div>
                    <div class="user-item">
                        <div class="user-icon">M</div>
                        <div>MumbaiBoy</div>
                    </div>
                    <div class="user-item">
                        <div class="user-icon">F</div>
                        <div>DelhiGirl</div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Input Area -->
        <div class="input-area">
            <div class="smiley-button">☺</div>
            <input type="text" id="messageInput" class="message-input" placeholder="Type your message here...">
            <button id="sendBtn" class="send-button">Send</button>
        </div>
        
        <!-- Advertisement -->
        <div class="advertisement">
            Advertisement Space - Yahoo! Messenger - Download Now!
        </div>
    </div>

    <script>
        class YahooChat {
            constructor() {
                this.username = '';
                this.ws = null;
                this.isAdmin = false;
                this.isVIP = false;
                this.userColors = ['green', 'blue', 'red', 'purple', 'orange'];
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
                document.getElementById('passwordInput').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.join();
                });
                
                document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
                document.getElementById('messageInput').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.sendMessage();
                });
                
                // Window controls
                document.querySelectorAll('.window-control').forEach((control, index) => {
                    control.addEventListener('click', () => {
                        if (index === 2) { // Close button
                            if (confirm('Are you sure you want to close Yahoo! Chat?')) {
                                window.close();
                            }
                        }
                    });
                });
            }
            
            join() {
                const username = document.getElementById('usernameInput').value.trim();
                const password = document.getElementById('passwordInput').value;
                
                if (!username) return alert('Please enter your username');
                
                this.username = username;
                this.connectWebSocket(username, password);
                
                document.getElementById('loginModal').classList.add('hidden');
                document.getElementById('chatApp').classList.remove('hidden');
                
                // Add join message
                this.addMessage('System', `${username} has joined the room`, 'green');
            }
            
            connectWebSocket(username, password) {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = \`\${protocol}//\${window.location.host}\`;
                
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    this.ws.send(JSON.stringify({
                        type: 'join',
                        username: username,
                        password: password
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
                    setTimeout(() => this.connectWebSocket(username, password), 3000);
                };
            }
            
            handleMessage(message) {
                switch (message.type) {
                    case 'user-role':
                        this.isAdmin = message.isAdmin;
                        this.isVIP = message.isVIP;
                        break;
                        
                    case 'user-joined':
                        this.addMessage('System', \`\${message.username} has joined the room\`, 'green');
                        this.addUser(message.username);
                        break;
                        
                    case 'user-left':
                        this.addMessage('System', \`\${message.username} has left the room\`, 'green');
                        this.removeUser(message.username);
                        break;
                        
                    case 'message':
                        const color = this.getUserColor(message.username);
                        this.addMessage(message.username, message.text, color);
                        break;
                        
                    case 'system':
                        this.addMessage('System', message.message, 'green');
                        break;
                        
                    case 'warning':
                        this.addMessage('System', message.message, 'red');
                        break;
                }
            }
            
            addMessage(sender, text, color = 'blue') {
                const container = document.getElementById('messagesContainer');
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message-line';
                
                messageDiv.innerHTML = \`
                    <span class="username \${color}">\${sender}:</span> \${text}
                \`;
                
                container.appendChild(messageDiv);
                container.scrollTop = container.scrollHeight;
            }
            
            addUser(username) {
                const container = document.querySelector('.users-container');
                const userDiv = document.createElement('div');
                userDiv.className = 'user-item';
                
                const initial = username.charAt(0).toUpperCase();
                userDiv.innerHTML = \`
                    <div class="user-icon">\${initial}</div>
                    <div>\${username}</div>
                \`;
                
                container.appendChild(userDiv);
            }
            
            removeUser(username) {
                const users = document.querySelectorAll('.user-item');
                users.forEach(user => {
                    if (user.textContent.includes(username)) {
                        user.remove();
                    }
                });
            }
            
            getUserColor(username) {
                let hash = 0;
                for (let i = 0; i < username.length; i++) {
                    hash = username.charCodeAt(i) + ((hash << 5) - hash);
                }
                return this.userColors[Math.abs(hash) % this.userColors.length];
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
        }
        
        // Initialize chat when page loads
        window.addEventListener('load', () => {
            window.yahooChat = new YahooChat();
        });
    </script>
</body>
</html>
    `);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Yahoo Classic Chat Server running on port ' + PORT);
    console.log('🔐 Admin Login: one5ali / baadshahone51');
});
