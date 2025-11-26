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
    
    switchCanvas(canvasId, socket) {
        if (this.canvases.some(canvas => canvas.id === canvasId)) {
            this.currentCanvasId = canvasId;
            const currentCanvas = this.getCurrentCanvas();
            
            // Отправляем данные только запросившему пользователю
            socket.emit('canvas-switched', {
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
    
    eraseDrawing(data, socket) {
        const eraseThreshold = 15; // Увеличим порог для лучшего стирания
        const currentCanvas = this.getCurrentCanvas();
        let needsRedraw = false;
        
        // Стираем линии (freehand)
        currentCanvas.drawingData = currentCanvas.drawingData.filter(line => {
            if (line.type === 'freehand') {
                const distance = this.pointToLineDistance(
                    data.x1, data.y1, data.x2, data.y2,
                    (line.x1 + line.x2) / 2, (line.y1 + line.y2) / 2
                );
                return distance > eraseThreshold;
            }
            return true; // Сохраняем все фигуры
        });
        
        // Стираем фигуры (прямоугольники, круги, линии)
        const shapesToRemove = [];
        
        currentCanvas.drawingData.forEach((shape, index) => {
            if (shape.type !== 'freehand') {
                // Проверяем, пересекается ли ластик с фигурой
                if (this.isShapeIntersecting(shape, data)) {
                    shapesToRemove.push(index);
                    needsRedraw = true;
                }
            }
        });
        
        // Удаляем фигуры в обратном порядке
        shapesToRemove.reverse().forEach(index => {
            currentCanvas.drawingData.splice(index, 1);
        });
        
        if (needsRedraw) {
            socket.emit('redraw-canvas', currentCanvas.drawingData);
            socket.broadcast.emit('redraw-canvas', currentCanvas.drawingData);
        }
    }
    
    isShapeIntersecting(shape, eraser) {
        const eraserRadius = eraser.width / 2;
        
        if (shape.type === 'rectangle') {
            // Проверяем пересечение линии ластика с прямоугольником
            return this.lineIntersectsRect(
                eraser.x1, eraser.y1, eraser.x2, eraser.y2,
                shape.x, shape.y, shape.width, shape.height,
                eraserRadius
            );
        } else if (shape.type === 'circle') {
            // Проверяем пересечение линии ластика с кругом
            return this.lineIntersectsCircle(
                eraser.x1, eraser.y1, eraser.x2, eraser.y2,
                shape.x, shape.y, shape.radius,
                eraserRadius
            );
        } else if (shape.type === 'line') {
            // Проверяем пересечение двух линий
            return this.linesIntersect(
                eraser.x1, eraser.y1, eraser.x2, eraser.y2,
                shape.x1, shape.y1, shape.x2, shape.y2,
                eraserRadius
            );
        }
        
        return false;
    }
    
    lineIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh, threshold) {
        // Проверяем пересечение со всеми сторонами прямоугольника
        const sides = [
            [rx, ry, rx + rw, ry], // верх
            [rx + rw, ry, rx + rw, ry + rh], // право
            [rx, ry + rh, rx + rw, ry + rh], // низ
            [rx, ry, rx, ry + rh] // лево
        ];
        
        return sides.some(side => 
            this.linesIntersect(x1, y1, x2, y2, side[0], side[1], side[2], side[3], threshold)
        );
    }
    
    lineIntersectsCircle(x1, y1, x2, y2, cx, cy, radius, threshold) {
        // Учитываем толщину ластика
        const totalRadius = radius + threshold;
        
        // Вектор линии
        const dx = x2 - x1;
        const dy = y2 - y1;
        
        // Вектор от начала линии до центра круга
        const fx = x1 - cx;
        const fy = y1 - cy;
        
        // Квадратное уравнение для нахождения пересечений
        const a = dx * dx + dy * dy;
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - totalRadius * totalRadius;
        
        const discriminant = b * b - 4 * a * c;
        
        if (discriminant < 0) {
            return false;
        }
        
        const sqrtDiscriminant = Math.sqrt(discriminant);
        const t1 = (-b - sqrtDiscriminant) / (2 * a);
        const t2 = (-b + sqrtDiscriminant) / (2 * a);
        
        // Проверяем, есть ли пересечение в пределах отрезка
        return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
    }
    
    linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4, threshold) {
        // Вычисляем направляющие векторы
        const dx1 = x2 - x1;
        const dy1 = y2 - y1;
        const dx2 = x4 - x3;
        const dy2 = y4 - y3;
        
        // Определитель
        const det = dx1 * dy2 - dx2 * dy1;
        
        if (Math.abs(det) < 1e-10) {
            // Линии параллельны
            return false;
        }
        
        // Параметры пересечения
        const t = ((x3 - x1) * dy2 - (y3 - y1) * dx2) / det;
        const u = -((x3 - x1) * dy1 - (y3 - y1) * dx1) / det;
        
        // Проверяем, что пересечение в пределах обоих отрезков
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return true;
        }
        
        return false;
    }
    
    clearCanvas(socket) {
        const currentCanvas = this.getCurrentCanvas();
        console.log('Очистка холста:', {
            canvasId: this.currentCanvasId,
            elementsBefore: currentCanvas.drawingData.length
        });
        
        // Полностью очищаем массив drawingData
        currentCanvas.drawingData = [];
        
        // Отправляем событие очистки всем клиентам
        socket.emit('clear-canvas', { canvasId: this.currentCanvasId });
        socket.broadcast.emit('clear-canvas', { canvasId: this.currentCanvasId });
        
        console.log('Холст очищен, элементов осталось:', currentCanvas.drawingData.length);
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