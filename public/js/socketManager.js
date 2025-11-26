class SocketManager {
    constructor() {
        this.socket = null;
        this.eventHandlers = new Map();
    }
    
    connect() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Подключено к серверу');
            this.emit('connected');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Отключено от сервера');
            this.emit('disconnected');
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('Ошибка подключения:', error);
            this.emit('connectionError', error);
        });
        
        // Автоматическая регистрация обработчиков событий
        this.registerDefaultHandlers();
    }
    
    registerDefaultHandlers() {
        const handlers = {
            'user-data': 'userData',
            'drawing': 'drawing',
            'redraw-canvas': 'redrawCanvas',
            'clear-canvas': 'clearCanvas', // ДОБАВЛЕНО: обработчик очистки
            'load-drawing': 'loadDrawing',
            'users-update': 'usersUpdate',
            'available-colors-update': 'availableColorsUpdate',
            'color-error': 'colorError',
            'screenshot-saved': 'screenshotSaved',
            'screenshot-error': 'screenshotError',
            'chat-message': 'chatMessage',
            'chat-update': 'chatUpdate',
            'canvas-switched': 'canvasSwitched'
        };
        
        Object.entries(handlers).forEach(([event, handler]) => {
            this.socket.on(event, (data) => {
                console.log(`Получено событие: ${event}`, data);
                this.emit(handler, data);
            });
        });
    }
    
   
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Ошибка в обработчике события ${event}:`, error);
                }
            });
        }
    }
    
    send(event, data) {
        if (this.socket && this.socket.connected) {
            console.log(`Отправка события: ${event}`, data || 'без данных');
            this.socket.emit(event, data);
        } else {
            console.warn('Сокет не подключен, невозможно отправить:', event);
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
    
    getSocketId() {
        return this.socket?.id;
    }
    
    isConnected() {
        return this.socket?.connected || false;
    }
}

export default SocketManager;