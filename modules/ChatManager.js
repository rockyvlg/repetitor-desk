class ChatManager {
    constructor() {
        this.messages = [];
        this.maxMessages = 100;
    }
    
    addMessage(userId, userName, userColor, message) {
        const chatMessage = {
            id: Date.now() + Math.random(),
            userId: userId,
            userName: userName,
            message: message.trim().substring(0, 500),
            timestamp: new Date(),
            color: userColor
        };
        
        this.messages.push(chatMessage);
        
        // Сохраняем только последние сообщения
        if (this.messages.length > this.maxMessages) {
            this.messages = this.messages.slice(-this.maxMessages);
        }
        
        return chatMessage;
    }
    
    updateUserMessages(userId, newName) {
        this.messages.forEach(msg => {
            if (msg.userId === userId) {
                msg.userName = newName;
            }
        });
    }
    
    // ДОБАВЛЕН НОВЫЙ МЕТОД ДЛЯ ОБНОВЛЕНИЯ ЦВЕТА
    updateUserColor(userId, newColor) {
        this.messages.forEach(msg => {
            if (msg.userId === userId) {
                msg.color = newColor;
            }
        });
    }
    
    getMessages() {
        return this.messages.slice(-50); // Последние 50 сообщений
    }
    
    getLastMessage() {
        return this.messages[this.messages.length - 1];
    }
    
    clearMessages() {
        this.messages = [];
    }
}

export default ChatManager;