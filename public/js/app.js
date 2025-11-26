import SocketManager from './socketManager.js';
import CanvasManager from './canvasManager.js';
import UserManager from './userManager.js';
import ChatManager from './chatManager.js';
import ToolManager from './toolManager.js';

class App {
    constructor() {
        this.socketManager = new SocketManager();
        this.canvasManager = new CanvasManager(this.socketManager);
        this.userManager = new UserManager(this.socketManager);
        this.chatManager = new ChatManager(this.socketManager);
        this.toolManager = new ToolManager(this.socketManager, this.canvasManager);
        
        this.init();
    }
    
    init() {
        // Инициализация модулей
        this.socketManager.connect();
        this.canvasManager.init();
        this.userManager.init();
        this.chatManager.init();
        this.toolManager.init();
        
        // Связывание модулей между собой
        this.setupModuleConnections();
        
        console.log('🚀 Приложение инициализировано');
    }
    
    setupModuleConnections() {
        // Когда userManager получает данные о холстах, передаем их в canvasManager
        this.socketManager.on('userData', (data) => {
            if (data.canvases && this.canvasManager) {
                this.canvasManager.setCanvases(data.canvases);
                this.canvasManager.setCurrentCanvasId(data.currentCanvasId);
            }
        });
        
        // Когда canvasManager получает данные о рисовании, обновляем счетчики в userManager
        this.socketManager.on('drawing', (data) => {
            if (this.userManager) {
                this.userManager.highlightUser(data.userId);
            }
        });
        
        // Когда userManager меняет цвет, обновляем canvasManager
        this.socketManager.on('userData', (data) => {
            if (this.canvasManager) {
                this.canvasManager.setCurrentColor(data.color);
            }
        });
        
        // Обработка скриншотов
        this.socketManager.on('screenshotSaved', (screenshot) => {
            this.handleScreenshotSaved(screenshot);
        });
        
        this.socketManager.on('screenshotError', (message) => {
            this.handleScreenshotError(message);
        });
        
        // Обработка переключения холстов
        this.socketManager.on('canvasSwitched', (data) => {
            if (this.canvasManager) {
                this.canvasManager.setCanvases(data.canvases);
                this.canvasManager.setCurrentCanvasId(data.canvasId);
            }
        });
    }
    
    handleScreenshotSaved(screenshot) {
        if (screenshot.message) {
            this.showNotification(screenshot.message, 'info');
        } else {
            this.addScreenshotToList(screenshot);
            const userName = screenshot.savedBy === this.userManager.getMyUserId() ? 'Вы' : 'Кто-то';
            this.showNotification(`${userName} сохранили скриншот!`);
        }
    }
    
    handleScreenshotError(message) {
        this.showNotification(message, 'error');
    }
    
    addScreenshotToList(screenshot) {
        const screenshotsList = document.getElementById('screenshotsList');
        if (!screenshotsList) return;
        
        // Убираем сообщение "Скриншотов пока нет"
        if (screenshotsList.querySelector('p')) {
            screenshotsList.innerHTML = '';
        }
        
        const screenshotElement = document.createElement('div');
        screenshotElement.className = 'screenshot-item';
        
        screenshotElement.innerHTML = `
            <div class="screenshot-info">
                <strong>${new Date(screenshot.timestamp).toLocaleString()}</strong>
                <br>
                <small>${(screenshot.size / 1024).toFixed(1)} KB</small>
            </div>
            <div class="screenshot-actions">
                <a href="${screenshot.url}" download="${screenshot.filename}" class="screenshot-btn">
                    📥 Скачать
                </a>
                <a href="${screenshot.url}" target="_blank" class="screenshot-btn">
                    👀 Открыть
                </a>
            </div>
        `;
        
        screenshotsList.insertBefore(screenshotElement, screenshotsList.firstChild);
    }
    
    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = 'notification';
        if (type) notification.classList.add(type);
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}

// Запуск приложения
const app = new App();

// Глобальный экземпляр для отладки
window.app = app;

export default App;