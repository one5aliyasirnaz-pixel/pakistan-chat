const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve HTML directly
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
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
            width: 90%; max-width: 800px; height: 90vh;
            background: white; border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            display: flex; flex-direction: column; overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #3665b3 0%, #2a5298 100%);
            color: white; padding: 15px 20px; text-align: center;
            border-bottom: 3px solid #1e3c72;
        }
        .main-content { display: flex; flex: 1; height: 100%; }
        .chat-area { flex: 1; display: flex; flex-direction: column; }
        .messages { 
            flex: 1; padding: 20px; overflow-y: auto; 
            background: #f9f9f9; 
        }
        .message {
            margin-bottom: 15px; padding: 10px 15px; border-radius: 10px;
            max-width: 70%;
        }
        .message.own {
            background: #3665b3; color: white; margin-left: auto;
        }
        .message.other {
            background: #e6f2ff; color: #333; margin-right: auto;
        }
        .message-header {
            display: flex; justify-content: space-between;
            font-size: 12px; margin-bottom: 5px;
        }
        .sidebar {
            width: 250px; background: #f0f8ff;
            border-left: 2px solid #d1e0ff; padding: 15px;
        }
        .user-item {
            padding: 8px 12px; margin-bottom: 5px;
            background: white; border-radius: 5px;
            border-left: 4px solid #3665b3;
        }
        .input-area {
            padding: 15px; background: #f0f8ff;
            border-top: 2px solid #d1e0ff; display: flex; gap: 10px;
        }
        .message-input {
            flex: 1; padding: 12px 15px;
            border: 2px solid #d1e0ff; border-radius: 25px;
            font-size: 14px; outline: none;
        }
        .send-btn {
            background: #4CAF50; color: white; border: none;
            padding: 12px 25px; border-radius: 25px;
            cursor: pointer; font-weight: bold;
        }
        .login-modal {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); display: flex;
            justify-content: center; align-items: center; z-index: 1000;
        }
        .login-box {
            background: white; padding: 30px; border-radius: 10px;
            text-align: center; width: 90%; max-width: 400px;
        }
        .login-box h2 { color: #3665b3; margin-bottom: 20px; }
        .username-input {
            width: 100%; padding: 12px 15px; margin-bottom: 15px;
            border: 2px solid #d1e0ff; border-radius: 5px; font-size: 16px;
        }
        .join-btn {
            width: 100%; padding: 12px; background: #3665b3;
            color: white; border: none; border-radius: 5px;
            font-size: 16px; cursor: pointer;
        }
        .hidden { display: none; }
    </style>
</head>
<body>
    <div id="loginModal" class="login-modal">
        <div class="login-box">
            <h2>🟢 Join Pakistan Room 60</h2>
            <input type="text" id="usernameInput" class="username-input" placeholder="Enter your name">
            <button id="joinBtn" class="join-btn">Join Chat Room</button>
        </div>
    </div>

    <div id="chatApp" class="chat-container hidden">
        <div class="header">
            <h1>Pakistan Room 60 -- Chat</h1>
        </div>
        <div class="main-content">
            <div class="chat-area">
                <div id="messagesContainer" class="messages"></div>
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
        class SimpleChat {
            constructor() {
                this.username = '';
                this.messages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
                this.users = new Set();
                this.init();
            }
            
            init() {
                this.bindEvents();
                this.loadMessages();
                this.updateUsers();
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
                setInterval(() => this.updateUsers(), 5000);
            }
            
            join() {
                const username = document.getElementById('usernameInput').value.trim();
                if (!username) return alert('Please enter your name');
                this.username = username;
                this.addUser(username);
                document.getElementById('loginModal').classList.add('hidden');
                document.getElementById('chatApp').classList.remove('hidden');
                this.addMessage('System', \`🟢 \${username} joined the chat\`);
            }
            
            sendMessage() {
                const input = document.getElementById('messageInput');
                const text = input.value.trim();
                if (!text) return;
                this.addMessage(this.username, text);
                input.value = '';
                setTimeout(() => {
                    const replies = ['Hello! 👋', 'Nice to chat!', 'Welcome!', 'Awesome chat! 🎉'];
                    this.addMessage('ChatBot', replies[Math.floor(Math.random() * replies.length)]);
                }, 1000 + Math.random() * 2000);
            }
            
            addMessage(sender, text) {
                const message = {
                    id: Date.now(), sender: sender, text: text,
                    timestamp: new Date().toLocaleTimeString(),
                    isOwn: sender === this.username
                };
                this.messages.push(message);
                if (this.messages.length > 100) this.messages = this.messages.slice(-100);
                localStorage.setItem('chatMessages', JSON.stringify(this.messages));
                this.displayMessage(message);
            }
            
            displayMessage(message) {
                const container = document.getElementById('messagesContainer');
                const messageDiv = document.createElement('div');
                messageDiv.className = \`message \${message.isOwn ? 'own' : 'other'}\`;
                messageDiv.innerHTML = \`
                    <div class="message-header">
                        <strong>\${message.sender}</strong>
                        <span>\${message.timestamp}</span>
                    </div>
                    <div>\${message.text}</div>
                \`;
                container.appendChild(messageDiv);
                container.scrollTop = container.scrollHeight;
            }
            
            loadMessages() {
                this.messages.forEach(msg => this.displayMessage(msg));
            }
            
            addUser(username) {
                this.users.add(username);
                this.updateUsersList();
                const userData = JSON.parse(localStorage.getItem('chatUsers') || '{}');
                userData[username] = Date.now();
                localStorage.setItem('chatUsers', JSON.stringify(userData));
            }
            
            updateUsers() {
                const userData = JSON.parse(localStorage.getItem('chatUsers') || '{}');
                const now = Date.now();
                const activeUsers = new Set();
                for (const [user, lastSeen] of Object.entries(userData)) {
                    if (now - lastSeen < 30000) {
                        activeUsers.add(user);
                        userData[user] = now;
                    }
                }
                localStorage.setItem('chatUsers', JSON.stringify(userData));
                this.users = activeUsers;
                this.updateUsersList();
            }
            
            updateUsersList() {
                const usersList = document.getElementById('usersList');
                usersList.innerHTML = '';
                this.users.forEach(user => {
                    const userDiv = document.createElement('div');
                    userDiv.className = 'user-item';
                    userDiv.textContent = user + (user === this.username ? ' (You)' : '');
                    usersList.appendChild(userDiv);
                });
            }
        }
        window.addEventListener('load', () => {
            new SimpleChat();
        });
    </script>
</body>
</html>
    `);
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Pakistan Chat is running' });
});

app.listen(PORT, () => {
    console.log('✅ Pakistan Chat Server running on port ' + PORT);
});
