import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

class CanvasManager {
    constructor() {
        this.canvases = [
            { id: 1, drawingData: [], name: 'Холст 1' },
            { id: 2, drawingData: [], name: 'Холст 2' },
            { id: 3, drawingData: [], name: 'Холст 3' }
        ];
        this.currentCanvasId = 1;
    }
    
    getCurrentCanvas() {
        return this.canvases.find(canvas => canvas.id === this.currentCanvasId);
    }
    
    getCanvases() {
        return this.canvases;
    }
    
    getCurrentCanvasId() {
        return this.currentCanvasId;
    }
    
    switchCanvas(canvasId, io) {
        if (this.canvases.some(canvas => canvas.id === canvasId)) {
            this.currentCanvasId = canvasId;
            const currentCanvas = this.getCurrentCanvas();
            io.emit('canvas-switched', {
                canvasId: canvasId,
                drawingData: currentCanvas.drawingData,
                canvases: this.canvases
            });
            return true;
        }
        return false;
    }
    
    sendCanvasData(socket) {
        const currentCanvas = this.getCurrentCanvas();
        socket.emit('load-drawing', currentCanvas.drawingData);
    }
    
    addDrawing(userId, userName, userColor, data, socket) {
        const currentCanvas = this.getCurrentCanvas();
        
        // Добавляем информацию о пользователе
        data.color = userColor;
        data.userId = userId;
        data.userName = userName;
        
        // Для фигур добавляем уникальный ID чтобы избежать перезаписи
        if (data.type && data.type !== 'freehand') {
            data.shapeId = `${userId}-${Date.now()}-${Math.random()}`;
        }
        
        currentCanvas.drawingData.push(data);
        socket.broadcast.emit('drawing', data);
    }
    
    updateUserColor(userId, newColor) {
        // Обновляем цвет во ВСЕХ холстах
        let updated = false;
        this.canvases.forEach(canvas => {
            canvas.drawingData.forEach(data => {
                if (data.userId === userId) {
                    data.color = newColor;
                    updated = true;
                }
            });
        });
        return updated;
    }
    
    eraseDrawing(data, io) {
        const eraseThreshold = 10;
        const currentCanvas = this.getCurrentCanvas();
        
        currentCanvas.drawingData = currentCanvas.drawingData.filter(line => {
            if (line.type !== 'freehand') return true;
            
            const distance = this.pointToLineDistance(
                data.x1, data.y1, data.x2, data.y2,
                (line.x1 + line.x2) / 2, (line.y1 + line.y2) / 2
            );
            return distance > eraseThreshold;
        });
        
        io.emit('redraw-canvas', currentCanvas.drawingData);
    }
    
    clearCanvas(io) {
        const currentCanvas = this.getCurrentCanvas();
        currentCanvas.drawingData = [];
        io.emit('clear-canvas');
    }
    
    async createScreenshot(screenshotsDir) {
        const currentCanvas = this.getCurrentCanvas();
        const canvas = createCanvas(800, 500);
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 800, 500);
        
        currentCanvas.drawingData.forEach(data => {
            if (data.type === 'freehand') {
                ctx.beginPath();
                ctx.moveTo(data.x1, data.y1);
                ctx.lineTo(data.x2, data.y2);
                ctx.strokeStyle = data.color;
                ctx.lineWidth = data.width;
                ctx.lineCap = 'round';
                ctx.stroke();
            } else if (data.type === 'rectangle') {
                ctx.strokeStyle = data.color;
                ctx.lineWidth = data.width || 5;
                ctx.strokeRect(data.x, data.y, data.width, data.height);
            } else if (data.type === 'circle') {
                ctx.strokeStyle = data.color;
                ctx.lineWidth = data.lineWidth || 5;
                ctx.beginPath();
                ctx.arc(data.x + data.radius, data.y + data.radius, data.radius, 0, 2 * Math.PI);
                ctx.stroke();
            } else if (data.type === 'line') {
                ctx.strokeStyle = data.color;
                ctx.lineWidth = data.width || 5;
                ctx.beginPath();
                ctx.moveTo(data.x1, data.y1);
                ctx.lineTo(data.x2, data.y2);
                ctx.stroke();
            }
        });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `drawing-${timestamp}.png`;
        const filepath = path.join(screenshotsDir, filename);
        
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(filepath, buffer);
        
        return {
            filename: filename,
            url: `/screenshots/${filename}`,
            timestamp: new Date(),
            size: buffer.length
        };
    }
    
    pointToLineDistance(x1, y1, x2, y2, px, py) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

export default CanvasManager;