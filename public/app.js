class PakistanChat {
    constructor() {
        this.ws = null;
        this.clientId = null;
        this.username = null;
        this.roomId = 'Pakistan Room 60';
        this.peers = new Map();
        this.localStream = null;
        this.isMuted = true;
        this.isPushToTalkActive = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.initializeApp();
    }

    initializeApp() {
        this.bindEvents();
        this.showUsernameModal();
    }

    bindEvents() {
        document.getElementById('joinButton').addEventListener('click', () => this.joinChat());
        document.getElementById('usernameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinChat();
        });

        document.getElementById('sendButton').addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        document.getElementById('muteToggle').addEventListener('click', () => this.toggleMute());
        document.getElementById('pushToTalk').addEventListener('mousedown', () => this.startPushToTalk());
        document.getElementById('pushToTalk').addEventListener('mouseup', () => this.stopPushToTalk());

        document.addEventListener('keydown', (e) => {
            if (e.key === ' ' && e.target.id !== 'messageInput') {
                e.preventDefault();
                this.startPushToTalk();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === ' ' && e.target.id !== 'messageInput') {
                e.preventDefault();
                this.stopPushToTalk();
            }
        });
    }

    showUsernameModal() {
        document.getElementById('usernameModal').classList.remove('hidden');
        document.getElementById('usernameInput').focus();
    }

    hideUsernameModal() {
        document.getElementById('usernameModal').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
    }

    async joinChat() {
        const usernameInput = document.getElementById('usernameInput');
        const username = usernameInput.value.trim();
        
        if (!username) {
            alert('Please enter a username');
            return;
        }

        this.username = username;
        this.hideUsernameModal();
        await this.initializeAudio();
        this.connectWebSocket();
    }

    async initializeAudio() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                audio: true
            });
            this.updateMuteState(true);
        } catch (error) {
            document.getElementById('permissionBanner').classList.remove('hidden');
            this.localStream = null;
        }
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.updateConnectionStatus(true);
            
            this.ws.send(JSON.stringify({
                type: 'join',
                room: this.roomId,
                username: this.username
            }));
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };

        this.ws.onclose = () => {
            this.updateConnectionStatus(false);
        };
    }

    handleMessage(message) {
        switch (message.type) {
            case 'join-success':
                this.clientId = message.clientId;
                this.updateUserList(message.users);
                this.displayMessages(message.messages);
                break;
                
            case 'user-joined':
                this.addUser(message.clientId, message.username);
                break;
                
            case 'user-left':
                this.removeUser(message.clientId);
                break;
                
            case 'message':
                this.displayMessage(message.message);
                break;
        }
    }

    updateConnectionStatus(connected) {
        const indicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        
        if (connected) {
            indicator.className = 'status-indicator connected';
            statusText.textContent = 'Connected';
        } else {
            indicator.className = 'status-indicator';
            statusText.textContent = 'Disconnected';
        }
    }

    updateUserList(users) {
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = '';
        
        users.forEach(user => {
            if (user.id !== this.clientId) {
                this.addUserElement(user.id, user.username);
            }
        });
        
        this.addUserElement(this.clientId, this.username, true);
        this.updateUserCount();
    }

    addUserElement(clientId, username, isLocal = false) {
        const usersList = document.getElementById('usersList');
        const userElement = document.createElement('div');
        
        userElement.className = `user-item ${isLocal ? 'you' : ''}`;
        userElement.id = `user-${clientId}`;
        
        userElement.innerHTML = `
            <div class="user-avatar"></div>
            <span class="user-name">${username} ${isLocal ? '(You)' : ''}</span>
            <div class="audio-level">
                <div class="audio-level-fill" id="level-${clientId}"></div>
            </div>
        `;
        
        usersList.appendChild(userElement);
    }

    addUser(clientId, username) {
        this.addUserElement(clientId, username);
        this.updateUserCount();
    }

    removeUser(clientId) {
        const userElement = document.getElementById(`user-${clientId}`);
        if (userElement) {
            userElement.remove();
        }
        this.updateUserCount();
    }

    updateUserCount() {
        const userCount = document.querySelectorAll('.user-item').length;
        document.getElementById('userCount').textContent = userCount;
    }

    sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        
        if (!text || !this.ws) return;
        
        this.ws.send(JSON.stringify({
            type: 'message',
            text: text,
            username: this.username,
            timestamp: new Date().toISOString()
        }));

        input.value = '';
        input.focus();
    }

    displayMessages(messages) {
        const messagesContainer = document.getElementById('messages');
        messagesContainer.innerHTML = '';
        
        messages.forEach(message => {
            this.displayMessage(message);
        });
    }

    displayMessage(message) {
        const messagesContainer = document.getElementById('messages');
        const messageElement = document.createElement('div');
        
        const isOwnMessage = message.username === this.username;
        messageElement.className = `message ${isOwnMessage ? 'own' : 'other'}`;
        
        const timestamp = new Date(message.timestamp).toLocaleTimeString();
        
        messageElement.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <strong>${message.username}</strong>
                    <span>${timestamp}</span>
                </div>
                <div class="message-text">${message.text}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    toggleMute() {
        this.updateMuteState(!this.isMuted);
    }

    updateMuteState(muted) {
        this.isMuted = muted;
        
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !muted;
            });
        }
        
        const muteButton = document.getElementById('muteToggle');
        const muteText = document.getElementById('muteText');
        
        if (muted) {
            muteButton.classList.add('muted');
            muteText.textContent = 'Muted';
        } else {
            muteButton.classList.remove('muted');
            muteText.textContent = 'Unmuted';
        }
    }

    startPushToTalk() {
        if (this.isPushToTalkActive) return;
        
        this.isPushToTalkActive = true;
        document.getElementById('pushToTalk').classList.add('recording');
        this.updateMuteState(false);
    }

    stopPushToTalk() {
        if (!this.isPushToTalkActive) return;
        
        this.isPushToTalkActive = false;
        document.getElementById('pushToTalk').classList.remove('recording');
        this.updateMuteState(true);
    }
}

window.addEventListener('load', () => {
    new PakistanChat();
});
