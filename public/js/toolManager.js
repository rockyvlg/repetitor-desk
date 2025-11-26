class ToolManager {
    constructor(socketManager, canvasManager) {
        this.socketManager = socketManager;
        this.canvasManager = canvasManager;
        this.currentTool = 'brush';
    }
    
    init() {
        this.initEventListeners();
        this.setTool('brush');
    }
    
    initEventListeners() {
        const clearBtn = document.getElementById('clearBtn');
        const brushBtn = document.getElementById('brushBtn');
        const eraserBtn = document.getElementById('eraserBtn');
        const saveBtn = document.getElementById('saveBtn');
        const toolButtons = document.querySelectorAll('.tool-btn');
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                console.log('Кнопка очистки нажата');
                // ПРАВИЛЬНО: отправляем без данных
                this.socketManager.send('clear-canvas');
            });
        }
        
        if (brushBtn) {
            brushBtn.addEventListener('click', () => {
                this.setTool('brush');
            });
        }
        
        if (eraserBtn) {
            eraserBtn.addEventListener('click', () => {
                this.setTool('eraser');
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveScreenshot();
            });
        }
        
        toolButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setTool(e.target.dataset.tool);
            });
        });
        
        // Обновленные обработчики навигации
        const prevCanvasBtn = document.getElementById('prevCanvas');
        const nextCanvasBtn = document.getElementById('nextCanvas');
        
        if (prevCanvasBtn) {
            prevCanvasBtn.addEventListener('click', () => {
                if (window.app && window.app.userManager) {
                    window.app.userManager.switchToPrevCanvas();
                }
            });
        }
        
        if (nextCanvasBtn) {
            nextCanvasBtn.addEventListener('click', () => {
                if (window.app && window.app.userManager) {
                    window.app.userManager.switchToNextCanvas();
                }
            });
        }
    }
    
    setTool(tool) {
        this.currentTool = tool;
        this.updateToolButtons();
        this.updateMainButtons();
        
        if (this.canvasManager) {
            this.canvasManager.setCurrentTool(tool);
        }
        
        console.log('Tool set to:', tool); // Для отладки
    }
    
    updateToolButtons() {
        const toolButtons = document.querySelectorAll('.tool-btn');
        toolButtons.forEach(btn => {
            if (btn.dataset.tool === this.currentTool) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    updateMainButtons() {
        const brushBtn = document.getElementById('brushBtn');
        const eraserBtn = document.getElementById('eraserBtn');
        
        if (brushBtn && eraserBtn) {
            if (this.currentTool === 'brush') {
                brushBtn.classList.add('brush-active');
                eraserBtn.classList.remove('eraser-active');
            } else if (this.currentTool === 'eraser') {
                eraserBtn.classList.add('eraser-active');
                brushBtn.classList.remove('brush-active');
            } else {
                brushBtn.classList.remove('brush-active');
                eraserBtn.classList.remove('eraser-active');
            }
        }
    }
    
    saveScreenshot() {
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = '💾 Сохраняем...';
            
            this.socketManager.send('save-screenshot');
            
            setTimeout(() => {
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 Сохранить скриншот текущего холста';
            }, 2000);
        }
    }
    
    getCurrentTool() {
        return this.currentTool;
    }
}

export default ToolManager;