class ChatManager {
    constructor(socketManager) {
        this.socketManager = socketManager;
    }
    
    init() {
        this.socketManager.on('chatMessage', (message) => {
            this.addMessage(message);
        });
        
        this.socketManager.on('chatUpdate', (messages) => {
            this.updateChat(messages);
        });
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');
        
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }
        
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }
    }
    
    sendMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput?.value.trim();
        
        if (message) {
            this.socketManager.send('chat-message', message);
            if (chatInput) chatInput.value = '';
        }
    }
    
    addMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageElement = this.createMessageElement(message);
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    updateChat(messages) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        chatMessages.innerHTML = '';
        messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            chatMessages.appendChild(messageElement);
        });
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    createMessageElement(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        messageElement.style.borderLeftColor = message.color;
        
        const time = new Date(message.timestamp).toLocaleTimeString();
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-user" style="color: ${message.color}">${message.userName}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${message.message}</div>
        `;
        
        return messageElement;
    }
}

export default ChatManager;