class UserManager {
    constructor(socketManager) {
        this.socketManager = socketManager;
        this.currentColor = '#FF6B6B';
        this.myUserId = null;
        this.availableColors = [];
        this.allColors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
            '#F8C471', '#82E0AA', '#F1948A', '#D7BDE2', '#A3E4D7'
        ];
        this.userStrokes = {};
        this.canvases = [];
        this.currentCanvasId = 1;
    }
    
    init() {
        this.socketManager.on('connected', () => {
            this.myUserId = this.socketManager.getSocketId();
        });
        
        this.socketManager.on('userData', (data) => {
            this.handleUserData(data);
        });
        
        this.socketManager.on('usersUpdate', (data) => {
            this.updateUsersList(data);
        });
        
        this.socketManager.on('availableColorsUpdate', (data) => {
            this.updateColorPalette(data);
        });
        
        this.socketManager.on('colorError', (message) => {
            this.showNotification(message, 'error');
        });
        
        this.socketManager.on('canvasSwitched', (data) => {
            if (data.canvases) {
                this.setCanvases(data.canvases);
                this.currentCanvasId = data.canvasId;
                // Обновляем доты после получения данных о холстах
                if (window.app && window.app.canvasManager) {
                    window.app.canvasManager.setCanvases(data.canvases);
                    window.app.canvasManager.setCurrentCanvasId(data.canvasId);
                }
            }
        });

        // ДОБАВЛЕНО: Обработчик перерисовки при смене цвета
        this.socketManager.on('redrawCanvas', (data) => {
            if (window.app && window.app.canvasManager) {
                window.app.canvasManager.redrawCanvas(data);
            }
        });
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        const nameInput = document.getElementById('nameInput');
        
        if (nameInput) {
            nameInput.addEventListener('change', () => {
                if (nameInput.value.trim()) {
                    this.socketManager.send('change-name', nameInput.value);
                }
            });
        }
        
        // Навигация по холстам
        const prevCanvasBtn = document.getElementById('prevCanvas');
        const nextCanvasBtn = document.getElementById('nextCanvas');
        
        if (prevCanvasBtn) {
            prevCanvasBtn.addEventListener('click', () => {
                this.switchToPrevCanvas();
            });
        }
        
        if (nextCanvasBtn) {
            nextCanvasBtn.addEventListener('click', () => {
                this.switchToNextCanvas();
            });
        }
    }
    
    handleUserData(data) {
        this.currentColor = data.color;
        this.availableColors = data.availableColors;
        
        if (data.canvases) {
            this.setCanvases(data.canvases);
        }
        if (data.currentCanvasId) {
            this.currentCanvasId = data.currentCanvasId;
        }
        
        const nameInput = document.getElementById('nameInput');
        const myInfo = document.getElementById('myInfo');
        const myColorText = document.getElementById('myColorText');
        
        if (nameInput) nameInput.value = data.name;
        if (myInfo) myInfo.style.borderLeftColor = this.currentColor;
        if (myColorText) {
            myColorText.textContent = this.currentColor;
            myColorText.style.color = this.currentColor;
        }
        
        this.updateColorPalette(this.availableColors);
        
        // Обновляем доты после получения данных пользователя
        if (window.app && window.app.canvasManager) {
            window.app.canvasManager.setCanvases(this.canvases);
            window.app.canvasManager.setCurrentCanvasId(this.currentCanvasId);
            window.app.canvasManager.setCurrentColor(this.currentColor);
        }
    }
    
    updateUsersList(usersList) {
        const usersCount = document.getElementById('usersCount');
        const userList = document.getElementById('userList');
        
        if (usersCount) usersCount.textContent = usersList.length;
        
        if (userList) {
            userList.innerHTML = '';
            usersList.forEach(user => {
                const userItem = this.createUserItem(user);
                userList.appendChild(userItem);
            });
        }
    }
    
    createUserItem(user) {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.style.borderLeftColor = user.color;
        userItem.setAttribute('data-user-id', user.id);
        
        if (user.id === this.myUserId) {
            userItem.classList.add('user-you');
        }
        
        userItem.innerHTML = `
            <div class="user-color" style="background: ${user.color}"></div>
            <div style="flex: 1;">
                <strong>${user.name}</strong>
                <div style="font-size: 12px; color: #666;">${user.color}</div>
            </div>
        `;
        
        return userItem;
    }
    
    updateColorPalette(colors) {
        this.availableColors = colors;
        const colorPalette = document.getElementById('colorPalette');
        
        if (!colorPalette) return;
        
        colorPalette.innerHTML = '';
        
        this.allColors.forEach(color => {
            const colorOption = document.createElement('div');
            colorOption.className = 'color-option';
            colorOption.style.background = color;
            colorOption.setAttribute('data-color', color);
            
            if (color === this.currentColor) {
                colorOption.classList.add('active');
            }
            
            if (this.availableColors.includes(color)) {
                colorOption.classList.add('available');
                colorOption.title = 'Доступен';
            } else {
                colorOption.classList.add('taken');
                colorOption.title = 'Занят другим участником';
            }
            
            if (this.availableColors.includes(color) || color === this.currentColor) {
                colorOption.addEventListener('click', () => {
                    if (color !== this.currentColor) {
                        this.socketManager.send('change-color', color);
                    }
                });
            }
            
            colorPalette.appendChild(colorOption);
        });
    }
    
    switchToPrevCanvas() {
        if (this.canvases.length === 0) return;
        
        const currentIndex = this.canvases.findIndex(c => c.id === this.currentCanvasId);
        const prevIndex = (currentIndex - 1 + this.canvases.length) % this.canvases.length;
        this.socketManager.send('switch-canvas', this.canvases[prevIndex].id);
    }
    
    switchToNextCanvas() {
        if (this.canvases.length === 0) return;
        
        const currentIndex = this.canvases.findIndex(c => c.id === this.currentCanvasId);
        const nextIndex = (currentIndex + 1) % this.canvases.length;
        this.socketManager.send('switch-canvas', this.canvases[nextIndex].id);
    }
    
    setCanvases(canvases) {
        this.canvases = canvases;
    }
    
    highlightUser(userId) {
        const userElement = document.querySelector(`[data-user-id="${userId}"]`);
        if (userElement) {
            userElement.classList.add('highlight-user');
            setTimeout(() => {
                userElement.classList.remove('highlight-user');
            }, 2000);
        }
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
    
    getCurrentColor() {
        return this.currentColor;
    }
    
    getMyUserId() {
        return this.myUserId;
    }
}

export default UserManager;