const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
}

app.use('/screenshots', express.static(screenshotsDir));

let drawingData = [];
let users = new Map();

// Доступные цвета (убираем использованные)
function getAvailableColors() {
    const allColors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F8C471', '#82E0AA', '#F1948A', '#D7BDE2', '#A3E4D7'
    ];
    
    const usedColors = Array.from(users.values()).map(user => user.color);
    return allColors.filter(color => !usedColors.includes(color));
}

function getRandomColor() {
    const availableColors = getAvailableColors();
    if (availableColors.length === 0) {
        // Если все цвета заняты, генерируем случайный
        return '#' + Math.floor(Math.random()*16777215).toString(16);
    }
    return availableColors[Math.floor(Math.random() * availableColors.length)];
}

async function createScreenshot() {
    const canvas = createCanvas(800, 500);
    const ctx = canvas.getContext('2d');
    
    // Белый фон
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 800, 500);
    
    // Рисуем ВСЕ данные, включая стертые (они уже удалены из drawingData)
    drawingData.forEach(data => {
        ctx.beginPath();
        ctx.moveTo(data.x1, data.y1);
        ctx.lineTo(data.x2, data.y2);
        ctx.strokeStyle = data.color;
        ctx.lineWidth = data.width;
        ctx.lineCap = 'round';
        ctx.stroke();
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

io.on('connection', (socket) => {
    console.log('Новый пользователь подключился:', socket.id);
    
    const userColor = getRandomColor();
    users.set(socket.id, {
        color: userColor,
        name: `Участник${Math.floor(Math.random() * 1000)}`,
        joinedAt: new Date()
    });
    
    // Отправляем данные пользователю
    socket.emit('user-data', {
        color: userColor,
        name: users.get(socket.id).name,
        availableColors: getAvailableColors()
    });
    
    updateUsersList();
    socket.emit('load-drawing', drawingData);

    // Обработка смены имени
    socket.on('change-name', (newName) => {
        const user = users.get(socket.id);
        if (user && newName && newName.trim().length > 0) {
            user.name = newName.trim().substring(0, 20); // Ограничиваем длину
            updateUsersList();
            console.log(`Пользователь ${socket.id} сменил имя на: ${user.name}`);
        }
    });

    // Обработка смены цвета
    socket.on('change-color', (newColor) => {
        const user = users.get(socket.id);
        if (user) {
            // Проверяем, не занят ли цвет другим пользователем
            const isColorTaken = Array.from(users.values())
                .some(u => u.color === newColor && u !== user);
            
            if (!isColorTaken) {
                user.color = newColor;
                
                // Обновляем цвет во всех существующих рисунках этого пользователя
                drawingData.forEach(data => {
                    if (data.userId === socket.id) {
                        data.color = newColor;
                    }
                });
                
                // Перерисовываем весь холст у всех клиентов
                io.emit('redraw-canvas', drawingData);
                updateUsersList();
                
                socket.emit('user-data', {
                    color: newColor,
                    name: user.name,
                    availableColors: getAvailableColors()
                });
            } else {
                socket.emit('color-error', 'Этот цвет уже занят другим участником');
            }
        }
    });

    socket.on('save-screenshot', async () => {
        try {
            const screenshot = await createScreenshot();
            io.emit('screenshot-saved', {
                ...screenshot,
                savedBy: socket.id
            });
            console.log('Скриншот сохранен:', screenshot.filename);
        } catch (error) {
            console.error('Ошибка при сохранении скриншота:', error);
            socket.emit('screenshot-error', 'Не удалось сохранить скриншот');
        }
    });

    socket.on('drawing', (data) => {
        const user = users.get(socket.id);
        if (user) {
            data.color = user.color;
            data.userId = socket.id;
            data.userName = user.name;
            data.isEraser = false;
            
            drawingData.push(data);
            socket.broadcast.emit('drawing', data);
        }
    });

    socket.on('erasing', (data) => {
        // При стирании УДАЛЯЕМ данные из drawingData
        // Находим и удаляем данные, которые попадают под область стирания
        const eraseThreshold = 10; // Радиус поиска для удаления
        
        drawingData = drawingData.filter(line => {
            // Проверяем, пересекается ли линия с областью стирания
            const distance = pointToLineDistance(
                data.x1, data.y1, data.x2, data.y2,
                (line.x1 + line.x2) / 2, (line.y1 + line.y2) / 2
            );
            return distance > eraseThreshold;
        });
        
        // Отправляем всем клиентам команду на перерисовку
        io.emit('redraw-canvas', drawingData);
    });

    socket.on('clear-canvas', () => {
        drawingData = [];
        io.emit('clear-canvas');
    });

    socket.on('disconnect', () => {
        console.log('Пользователь отключился:', socket.id);
        users.delete(socket.id);
        updateUsersList();
    });
});

// Вспомогательная функция для расчета расстояния от точки до линии
function pointToLineDistance(x1, y1, x2, y2, px, py) {
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

function updateUsersList() {
    const usersList = Array.from(users.entries()).map(([id, user]) => ({
        id,
        color: user.color,
        name: user.name
    }));
    io.emit('users-update', usersList);
    
    // Отправляем обновленные доступные цвета всем
    const availableColors = getAvailableColors();
    io.emit('available-colors-update', availableColors);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
