class CanvasManager {
    constructor(socketManager) {
        this.socketManager = socketManager;
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas?.getContext('2d');
        this.currentTool = 'brush';
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.lastX = 0;
        this.lastY = 0;
        this.canvases = [];
        this.currentCanvasId = 1;
        this.myStrokes = 0;
        this.userStrokes = {};
        this.currentColor = '#FF6B6B';
        
        // Для временного хранения данных фигуры
        this.tempShapeData = null;
        this.isDrawingShape = false;
        
        // ДЛЯ ИСПРАВЛЕНИЯ: храним локальную копию drawingData
        this.localDrawingData = [];
    }
    
    init() {
        if (!this.canvas || !this.ctx) {
            console.error('Canvas not found');
            return;
        }
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Белый фон по умолчанию
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.socketManager.on('drawing', (data) => this.handleDrawing(data));
        this.socketManager.on('redrawCanvas', (data) => this.redrawCanvas(data));
        this.socketManager.on('clearCanvas', () => this.clearCanvas());
        this.socketManager.on('loadDrawing', (data) => {
            this.localDrawingData = [...data]; // Сохраняем локальную копию
            this.loadDrawing(data);
        });
        this.socketManager.on('canvasSwitched', (data) => this.handleCanvasSwitch(data));
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        if (!this.canvas) return;
        
        // Обработчики мыши
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', (e) => this.stopDrawing(e));
        this.canvas.addEventListener('mouseout', (e) => this.stopDrawing(e));
        
        // Обработчики тач-устройств
        this.canvas.addEventListener('touchstart', (e) => this.startDrawing(e));
        this.canvas.addEventListener('touchmove', (e) => this.draw(e));
        this.canvas.addEventListener('touchend', (e) => this.stopDrawing(e));
        this.canvas.addEventListener('touchcancel', (e) => this.stopDrawing(e));
        
        // Предотвращаем скролл при касании canvas
        this.canvas.addEventListener('touchstart', (e) => e.preventDefault());
        this.canvas.addEventListener('touchmove', (e) => e.preventDefault());
    }
    
    resizeCanvas() {
        if (!this.canvas) return;
        
        const container = this.canvas.parentElement;
        if (container) {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
            this.redrawCurrentCanvas();
        }
    }
    
    getCoordinates(e) {
        if (!this.canvas) return { x: 0, y: 0 };
        
        const rect = this.canvas.getBoundingClientRect();
        let clientX, clientY;
        
        if (e.type.includes('touch')) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }
    
    startDrawing(e) {
        e.preventDefault();
        const coords = this.getCoordinates(e);
        this.startX = this.lastX = coords.x;
        this.startY = this.lastY = coords.y;
        this.isDrawing = true;
        
        if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
            this.isDrawingShape = false;
            // Для кисти и ластика сразу начинаем рисовать
            if (this.currentTool === 'brush') {
                this.drawPoint(this.startX, this.startY, this.currentColor, 5);
            }
        } else {
            // Для фигур сохраняем начальную точку
            this.isDrawingShape = true;
            this.tempShapeData = {
                type: this.currentTool,
                startX: this.startX,
                startY: this.startY
            };
        }
    }
    
    draw(e) {
        e.preventDefault();
        if (!this.isDrawing || !this.ctx) return;
        
        const coords = this.getCoordinates(e);
        const { x, y } = coords;
        
        if (this.currentTool === 'brush') {
            this.drawLine(this.lastX, this.lastY, x, y, this.currentColor, 5);
            this.socketManager.send('drawing', {
                type: 'freehand',
                x1: this.lastX, y1: this.lastY,
                x2: x, y2: y,
                width: 5,
                color: this.currentColor
            });
            [this.lastX, this.lastY] = [x, y];
        } else if (this.currentTool === 'eraser') {
            this.eraseLine(this.lastX, this.lastY, x, y, 20);
            this.socketManager.send('erasing', {
                x1: this.lastX, y1: this.lastY,
                x2: x, y2: y,
                width: 20
            });
            [this.lastX, this.lastY] = [x, y];
        } else if (this.isDrawingShape && this.tempShapeData) {
            // ПРОСТОЕ РЕШЕНИЕ: перерисовываем весь canvas и рисуем предпросмотр
            this.redrawCanvas(this.localDrawingData);
            this.drawShapePreview(this.tempShapeData.type, this.startX, this.startY, x, y);
        }
    }
    
    stopDrawing(e) {
        if (!this.isDrawing) return;
        
        // Если рисуем фигуру - отправляем её на сервер
        if (this.isDrawingShape && this.tempShapeData && this.currentTool !== 'brush' && this.currentTool !== 'eraser') {
            const coords = this.getCoordinates(e);
            const { x, y } = coords;
            
            this.sendShape(this.tempShapeData.type, this.startX, this.startY, x, y);
        }
        
        this.isDrawing = false;
        this.isDrawingShape = false;
        this.tempShapeData = null;
    }
    
     
    drawShapePreview(tool, startX, startY, currentX, currentY) {
        if (!this.ctx) return;
        
        // ВАЖНО: Сохраняем текущее состояние canvas
        this.ctx.save();
        
        // Очищаем только область предпросмотра (опционально - можно не очищать)
        // Вместо полной перерисовки просто рисуем поверх существующего
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = 5;
        this.ctx.setLineDash([5, 5]); // Пунктир для предпросмотра
        
        if (tool === 'rectangle') {
            const width = currentX - startX;
            const height = currentY - startY;
            this.ctx.strokeRect(startX, startY, width, height);
        } else if (tool === 'circle') {
            const radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
            this.ctx.beginPath();
            this.ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
            this.ctx.stroke();
        } else if (tool === 'line') {
            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(currentX, currentY);
            this.ctx.stroke();
        }
        
        this.ctx.setLineDash([]);
        this.ctx.restore(); // Восстанавливаем состояние
    }
    
    
    sendShape(tool, startX, startY, endX, endY) {
        let shapeData = { 
            type: tool, 
            color: this.currentColor, 
            lineWidth: 5 
        };
        
        if (tool === 'rectangle') {
            shapeData.x = Math.min(startX, endX);
            shapeData.y = Math.min(startY, endY);
            shapeData.width = Math.abs(endX - startX);
            shapeData.height = Math.abs(endY - startY);
        } else if (tool === 'circle') {
            shapeData.x = startX;
            shapeData.y = startY;
            shapeData.radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        } else if (tool === 'line') {
            shapeData.x1 = startX;
            shapeData.y1 = startY;
            shapeData.x2 = endX;
            shapeData.y2 = endY;
            shapeData.width = 5;
        }
        
        console.log('Sending shape:', shapeData);
        this.socketManager.send('drawing', shapeData);
        
        // Немедленно рисуем фигуру локально и добавляем в локальный массив
        this.drawShapeLocally(shapeData);
        this.localDrawingData.push(shapeData); // ДОБАВЛЯЕМ В ЛОКАЛЬНЫЙ МАССИВ
    }
    
    drawShapeLocally(shapeData) {
        if (!this.ctx) return;
        
        this.ctx.strokeStyle = shapeData.color;
        this.ctx.lineWidth = shapeData.lineWidth || 5;
        this.ctx.setLineDash([]); // Сплошная линия
        
        if (shapeData.type === 'rectangle') {
            this.ctx.strokeRect(shapeData.x, shapeData.y, shapeData.width, shapeData.height);
        } else if (shapeData.type === 'circle') {
            this.ctx.beginPath();
            this.ctx.arc(shapeData.x, shapeData.y, shapeData.radius, 0, 2 * Math.PI);
            this.ctx.stroke();
        } else if (shapeData.type === 'line') {
            this.ctx.beginPath();
            this.ctx.moveTo(shapeData.x1, shapeData.y1);
            this.ctx.lineTo(shapeData.x2, shapeData.y2);
            this.ctx.stroke();
        }
    }
    
    drawPoint(x, y, color, width = 5) {
        if (!this.ctx) return;
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, width/2, 0, 2 * Math.PI);
        this.ctx.fillStyle = color;
        this.ctx.fill();
    }
    
    drawLine(x1, y1, x2, y2, color, width = 5) {
        if (!this.ctx) return;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();
    }
    
    eraseLine(x1, y1, x2, y2, width = 20) {
        if (!this.ctx) return;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = width;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();
    }
    
    drawRectangle(x, y, width, height, color, lineWidth = 5) {
        if (!this.ctx) return;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.strokeRect(x, y, width, height);
    }
    
    drawCircle(x, y, radius, color, lineWidth = 5) {
        if (!this.ctx) return;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
        this.ctx.stroke();
    }
    
    redrawCanvas(drawingData) {
        if (!this.ctx) return;
        
        // Очищаем canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Перерисовываем все элементы
        if (drawingData && drawingData.length > 0) {
            drawingData.forEach(data => {
                this.drawShapePermanently(data);
            });
        }
    }
    
    drawShapePermanently(data) {
        if (!this.ctx) return;
        
        this.ctx.strokeStyle = data.color;
        this.ctx.lineWidth = data.lineWidth || data.width || 5;
        this.ctx.setLineDash([]);
        
        if (data.type === 'freehand') {
            this.drawLine(data.x1, data.y1, data.x2, data.y2, data.color, data.width);
        } else if (data.type === 'rectangle') {
            this.drawRectangle(data.x, data.y, data.width, data.height, data.color, data.lineWidth);
        } else if (data.type === 'circle') {
            this.drawCircle(data.x, data.y, data.radius, data.color, data.lineWidth);
        } else if (data.type === 'line') {
            this.drawLine(data.x1, data.y1, data.x2, data.y2, data.color, data.width);
        }
    }
    
    // ОБНОВЛЕННЫЙ МЕТОД ДЛЯ ПЕРЕРИСОВКИ ПРЕДПРОСМОТРА
    redrawCurrentCanvas() {
        // Теперь используем локальный массив вместо запроса к серверу
        this.redrawCanvas(this.localDrawingData);
    }
    
    clearCanvas() {
        if (!this.ctx) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.userStrokes = {};
    }
    
    loadDrawing(drawingData) {
        this.redrawCanvas(drawingData);
        
        this.userStrokes = {};
        if (drawingData) {
            drawingData.forEach(data => {
                if (!this.userStrokes[data.userId]) {
                    this.userStrokes[data.userId] = 0;
                }
                this.userStrokes[data.userId]++;
            });
        }
    }
    
    handleDrawing(data) {
        console.log('Received drawing:', data);
        this.drawShapePermanently(data);
        
        // ДОБАВЛЯЕМ В ЛОКАЛЬНЫЙ МАССИВ при получении от других пользователей
        this.localDrawingData.push(data);
        
        if (!this.userStrokes[data.userId]) {
            this.userStrokes[data.userId] = 0;
        }
        this.userStrokes[data.userId]++;
    }
    
    handleCanvasSwitch(data) {
        this.currentCanvasId = data.canvasId;
        this.canvases = data.canvases;
        this.updateCanvasDots();
        this.localDrawingData = [...data.drawingData]; // ОБНОВЛЯЕМ ЛОКАЛЬНЫЙ МАССИВ
        this.redrawCanvas(data.drawingData);
        
        // Сбрасываем счетчики штрихов для нового холста
        this.userStrokes = {};
    }
    
    updateCanvasDots() {
        const canvasDots = document.getElementById('canvasDots');
        if (!canvasDots) return;
        
        canvasDots.innerHTML = '';
        
        if (this.canvases && this.canvases.length > 0) {
            this.canvases.forEach(canvas => {
                const dot = document.createElement('div');
                dot.className = 'canvas-dot';
                if (canvas.id === this.currentCanvasId) {
                    dot.classList.add('active');
                }
                dot.addEventListener('click', () => {
                    this.socketManager.send('switch-canvas', canvas.id);
                });
                canvasDots.appendChild(dot);
            });
        }
    }
    
    setCurrentColor(color) {
        this.currentColor = color;
    }
    
    setCurrentTool(tool) {
        this.currentTool = tool;
    }
    
    // Метод для установки данных о холстах (вызывается из UserManager)
    setCanvases(canvases) {
        this.canvases = canvases;
        this.updateCanvasDots();
    }
    
    // Метод для установки текущего холста (вызывается из UserManager)
    setCurrentCanvasId(canvasId) {
        this.currentCanvasId = canvasId;
        this.updateCanvasDots();
    }
}

export default CanvasManager;