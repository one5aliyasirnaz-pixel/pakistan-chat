const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

// WebSocket server for real-time voice
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Map();

wss.on('connection', (ws) => {
    const clientId = Date.now().toString();
    clients.set(clientId, ws);
    
    console.log('New client connected:', clientId);
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            if (message.type === 'join') {
                // Broadcast user joined
                broadcast({
                    type: 'user-joined',
                    userId: clientId,
                    username: message.username
                }, clientId);
            }
            else if (message.type === 'audio') {
                // Broadcast audio to other users
                broadcast({
                    type: 'audio',
                    userId: clientId,
                    audioData: message.audioData,
                    username: message.username
                }, clientId);
            }
            else if (message.type === 'message') {
                // Broadcast text message
                broadcast({
                    type: 'message',
                    userId: clientId,
                    username: message.username,
                    text: message.text,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('WebSocket error:', error);
        }
    });
    
    ws.on('close', () => {
        clients.delete(clientId);
        console.log('Client disconnected:', clientId);
        
        // Broadcast user left
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
    res.json({ 
        status: 'OK', 
        message: 'Pakistan Chat with Voice is running',
        connectedClients: clients.size
    });
});

// Main chat application with Voice
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pakistan Room 60 - Voice Chat</title>
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
        }
        .header h1 { font-size: 24px; margin: 0; }
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
        }
        .message.own {
            background: linear-gradient(135deg, #3665b3 0%, #2a5298 100%);
            color: white; margin-left: auto; border-bottom-right-radius: 4px;
        }
        .message.other {
            background: white; color: #333; margin-right: auto; 
            border: 2px solid #e6f2ff; border-bottom-left-radius: 4px;
        }
        .message-header {
            display: flex; justify-content: space-between;
            font-size: 12px; margin-bottom: 5px; opacity: 0.8;
        }
        .voice-indicator {
            color: #4CAF50; font-weight: bold; font-size: 11px;
        }
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
        .user-speaking { border-left-color: #ff4444; background: #fff0f0; }
        .audio-level {
            width: 20px; height: 4px; background: #ccc; border-radius: 2px;
            overflow: hidden;
        }
        .audio-level-fill {
            height: 100%; background: #4CAF50; width: 0%;
            transition: width 0.1s;
        }
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
    </style>
</head>
<body>
    <div id="loginModal" class="login-modal">
        <div class="login-box">
            <h2>🎤 Join Pakistan Room 60 - Voice Chat</h2>
            <input type="text" id="usernameInput" class="username-input" placeholder="Enter your display name">
            <button id="joinBtn" class="join-btn">Join Voice Chat</button>
        </div>
    </div>

    <div id="chatApp" class="chat-container hidden">
        <div class="header">
            <h1>Pakistan Room 60 -- Voice Chat</h1>
            <div class="connection-status">
                <div id="statusDot" class="status-dot"></div>
                <span id="statusText">Connecting...</span>
            </div>
        </div>
        
        <div class="main-content">
            <div class="chat-area">
                <div id="messagesContainer" class="messages">
                    <div class="message other">
                        <div class="message-header">
                            <strong>System</strong>
                            <span>Welcome</span>
                        </div>
                        <div>🎤 Pakistan Room 60 Voice Chat Started!</div>
                    </div>
                </div>
                <div class="input-area">
                    <input type="text" id="messageInput" class="message-input" placeholder="Type your message here...">
                    <button id="sendBtn" class="send-btn">Send</button>
                </div>
            </div>
            
            <div class="sidebar">
                <div class="users-list">
                    <h3>🎤 Online Users</h3>
                    <div id="usersList"></div>
                </div>
                <div class="voice-controls">
                    <button id="muteBtn" class="voice-btn mute-btn">🎤 Unmuted</button>
                    <button id="pttBtn" class="voice-btn ptt-btn">🎙️ Push to Talk (Hold Space)</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        class PakistanVoiceChat {
            constructor() {
                this.username = '';
                this.ws = null;
                this.localStream = null;
                this.mediaRecorder = null;
                this.audioChunks = [];
                this.isMuted = false;
                this.isRecording = false;
                this.peers = new Map();
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
                    console.log('Microphone access granted');
                } catch (error) {
                    console.warn('Microphone access denied:', error);
                    alert('Microphone access is required for voice chat. Please allow microphone permissions.');
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
                pttBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    this.startVoice();
                });
                pttBtn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    this.stopVoice();
                });
                
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
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                };
            }
            
            handleMessage(message) {
                switch (message.type) {
                    case 'user-joined':
                        this.addUser(message.userId, message.username);
                        this.addSystemMessage(\`\${message.username} joined the chat\`);
                        break;
                        
                    case 'user-left':
                        this.removeUser(message.userId);
                        break;
                        
                    case 'message':
                        this.addMessage(message.username, message.text, message.timestamp, false);
                        break;
                        
                    case 'audio':
                        this.playAudio(message.audioData, message.userId, message.username);
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
            
            sendMessage() {
                const input = document.getElementById('messageInput');
                const text = input.value.trim();
                if (!text || !this.ws) return;
                
                this.ws.send(JSON.stringify({
                    type: 'message',
                    username: this.username,
                    text: text
                }));
                
                this.addMessage(this.username, text, new Date().toISOString(), true);
                input.value = '';
            }
            
            addMessage(sender, text, timestamp, isOwn) {
                const container = document.getElementById('messagesContainer');
                const messageDiv = document.createElement('div');
                
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
            
            addSystemMessage(text) {
                this.addMessage('System', text, new Date().toISOString(), false);
            }
            
            addUser(userId, username) {
                const usersList = document.getElementById('usersList');
                const userDiv = document.createElement('div');
                
                userDiv.className = 'user-item';
                userDiv.id = \`user-\${userId}\`;
                userDiv.innerHTML = \`
                    <span>\${username}\${username === this.username ? ' (You)' : ''}</span>
                    <div class="audio-level">
                        <div class="audio-level-fill" id="level-\${userId}"></div>
                    </div>
                \`;
                
                usersList.appendChild(userDiv);
            }
            
            removeUser(userId) {
                const userElement = document.getElementById(\`user-\${userId}\`);
                if (userElement) {
                    userElement.remove();
                }
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
                if (this.isRecording || this.isMuted || !this.ws) return;
                
                this.isRecording = true;
                document.getElementById('pttBtn').classList.add('recording');
                
                // Start recording audio
                this.startAudioRecording();
            }
            
            stopVoice() {
                if (!this.isRecording) return;
                
                this.isRecording = false;
                document.getElementById('pttBtn').classList.remove('recording');
                
                // Stop recording
                this.stopAudioRecording();
            }
            
            startAudioRecording() {
                if (!this.localStream) return;
                
                this.audioChunks = [];
                this.mediaRecorder = new MediaRecorder(this.localStream);
                
                this.mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        this.audioChunks.push(event.data);
                    }
                };
                
                this.mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    this.sendAudio(audioBlob);
                };
                
                this.mediaRecorder.start(100); // Collect data every 100ms
            }
            
            stopAudioRecording() {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                }
            }
            
            sendAudio(audioBlob) {
                const reader = new FileReader();
                reader.onload = () => {
                    const audioData = reader.result;
                    this.ws.send(JSON.stringify({
                        type: 'audio',
                        username: this.username,
                        audioData: audioData
                    }));
                };
                reader.readAsDataURL(audioBlob);
            }
            
            playAudio(audioData, userId, username) {
                const audio = new Audio(audioData);
                audio.play().catch(e => console.log('Audio play failed:', e));
                
                // Show speaking indicator
                this.showSpeakingIndicator(userId);
            }
            
            showSpeakingIndicator(userId) {
                const levelElement = document.getElementById(\`level-\${userId}\`);
                if (levelElement) {
                    levelElement.style.width = '100%';
                    setTimeout(() => {
                        levelElement.style.width = '0%';
                    }, 500);
                }
            }
        }
        
        window.addEventListener('load', () => {
            new PakistanVoiceChat();
        });
    </script>
</body>
</html>
    `);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Pakistan Voice Chat Server running on port ' + PORT);
});
