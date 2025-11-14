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
        document.getElementById('pushToTalk').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startPushToTalk();
        });
        document.getElementById('pushToTalk').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopPushToTalk();
        });

        // Keyboard shortcuts
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

        // Toolbar buttons
        document.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                alert('Feature coming soon: ' + e.target.title);
            });
        });

        // Emoji button
        document.querySelector('.emoji-btn').addEventListener('click', () => {
            alert('Emoticons coming soon!');
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
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                } 
            });
            this.updateMuteState(true);
        } catch (error) {
            console.warn('Microphone access denied:', error);
            document.getElementById('permissionBanner').classList.remove('hidden');
            this.localStream = null;
        }
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('✅ WebSocket connected');
            this.reconnectAttempts = 0;
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
            console.log('❌ WebSocket disconnected');
            this.updateConnectionStatus(false);
            this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
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
                this.createPeerConnection(message.clientId);
                break;
                
            case 'user-left':
                this.removeUser(message.clientId);
                break;
                
            case 'signal':
                this.handleSignal(message.from, message.payload);
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

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            
            setTimeout(() => {
                this.reconnectAttempts++;
                this.connectWebSocket();
            }, delay);
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
        
        // Add local user
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
        this.createPeerConnection(clientId);
        this.updateUserCount();
    }

    removeUser(clientId) {
        const userElement = document.getElementById(`user-${clientId}`);
        if (userElement) {
            userElement.remove();
        }
        
        const peer = this.peers.get(clientId);
        if (peer) {
            peer.connection.close();
            this.peers.delete(clientId);
        }
        this.updateUserCount();
    }

    updateUserCount() {
        const userCount = document.querySelectorAll('.user-item').length;
        document.getElementById('userCount').textContent = userCount;
    }

    createPeerConnection(remoteClientId) {
        if (!this.localStream) return;

        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        };

        const pc = new RTCPeerConnection(configuration);
        
        // Add local stream
        this.localStream.getTracks().forEach(track => {
            pc.addTrack(track, this.localStream);
        });

        // Handle incoming tracks
        pc.ontrack = (event) => {
            const audio = document.createElement('audio');
            audio.srcObject = event.streams[0];
            audio.autoplay = true;
            
            // Setup remote audio level monitoring
            this.setupRemoteAudioLevel(audio, remoteClientId);
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal(remoteClientId, {
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };

        this.peers.set(remoteClientId, { connection: pc, isMakingOffer: false });

        // Create offer
        this.createOffer(remoteClientId);
    }

    async createOffer(remoteClientId) {
        const peer = this.peers.get(remoteClientId);
        if (!peer || peer.isMakingOffer) return;

        try {
            peer.isMakingOffer = true;
            const offer = await peer.connection.createOffer();
            await peer.connection.setLocalDescription(offer);
            
            this.sendSignal(remoteClientId, {
                type: 'offer',
                sdp: offer.sdp
            });
        } catch (error) {
            console.error('Error creating offer:', error);
        } finally {
            peer.isMakingOffer = false;
        }
    }

    async handleSignal(from, payload) {
        const peer = this.peers.get(from);
        if (!peer) return;

        try {
            switch (payload.type) {
                case 'offer':
                    await peer.connection.setRemoteDescription({
                        type: 'offer',
                        sdp: payload.sdp
                    });
                    
                    const answer = await peer.connection.createAnswer();
                    await peer.connection.setLocalDescription(answer);
                    
                    this.sendSignal(from, {
                        type: 'answer',
                        sdp: answer.sdp
                    });
                    break;
                    
                case 'answer':
                    await peer.connection.setRemoteDescription({
                        type: 'answer',
                        sdp: payload.sdp
                    });
                    break;
                    
                case 'ice-candidate':
                    await peer.connection.addIceCandidate(payload.candidate);
                    break;
            }
        } catch (error) {
            console.error('Error handling signal:', error);
        }
    }

    sendSignal(to, payload) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'signal',
                to: to,
                payload: payload
            }));
        }
    }

    sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        
        if (!text) {
            alert('Please enter a message');
            return;
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            alert('Not connected to server');
            return;
        }
        
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

    setupRemoteAudioLevel(audioElement, clientId) {
        const updateLevel = () => {
            if (audioElement.readyState >= 2) {
                const levelElement = document.getElementById(`level-${clientId}`);
                if (levelElement) {
                    const width = audioElement.paused ? 0 : Math.random() * 100;
                    levelElement.style.width = `${width}%`;
                }
            }
            requestAnimationFrame(updateLevel);
        };
        updateLevel();
    }
}

// Initialize app when page loads
window.addEventListener('load', () => {
    new PakistanChat();
});
