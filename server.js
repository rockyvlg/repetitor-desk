import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { createCanvas } from 'canvas';
import { fileURLToPath } from 'url';

// ES modules аналог __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Импорт модулей
import UserManager from './modules/UserManager.js';
import CanvasManager from './modules/CanvasManager.js';
import ChatManager from './modules/ChatManager.js';

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const screenshotsDir = path.join(__dirname, 'public', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Модули сервера
const userManager = new UserManager();
const canvasManager = new CanvasManager();
const chatManager = new ChatManager();

io.on('connection', (socket) => {
    console.log('Новый пользователь подключился:', socket.id);
    
    // Регистрация пользователя
    const user = userManager.addUser(socket.id);
    
    // Отправка начальных данных
    socket.emit('user-data', {
        color: user.color,
        name: user.name,
        availableColors: userManager.getAvailableColors(),
        canvases: canvasManager.getCanvases(),
        currentCanvasId: canvasManager.getCurrentCanvasId(),
        chatMessages: chatManager.getMessages()
    });
    
    userManager.updateUsersList(io);
    canvasManager.sendCanvasData(socket);
    
    // Обработчики событий
    socket.on('change-name', (newName) => {
        userManager.changeUserName(socket.id, newName);
        chatManager.updateUserMessages(socket.id, userManager.getUser(socket.id)?.name);
        userManager.updateUsersList(io);
        io.emit('chat-update', chatManager.getMessages());
    });
    
    socket.on('change-color', (newColor) => {
        if (userManager.changeUserColor(socket.id, newColor, io)) {
            canvasManager.updateUserColor(socket.id, newColor);
            
            // ОБНОВЛЯЕМ ЦВЕТ В СООБЩЕНИЯХ ЧАТА
            chatManager.updateUserColor(socket.id, newColor);
            io.emit('chat-update', chatManager.getMessages());
            
            // ДОБАВЛЕНО: Принудительно перерисовываем текущий холст для всех пользователей
            const currentCanvas = canvasManager.getCurrentCanvas();
            io.emit('redraw-canvas', currentCanvas.drawingData);
            
            socket.emit('user-data', {
                color: newColor,
                name: userManager.getUser(socket.id)?.name,
                availableColors: userManager.getAvailableColors()
            });
        } else {
            socket.emit('color-error', 'Этот цвет уже занят другим участником');
        }
    });
    
    socket.on('chat-message', (message) => {
        const user = userManager.getUser(socket.id);
        if (user) {
            chatManager.addMessage(socket.id, user.name, user.color, message);
            io.emit('chat-message', chatManager.getLastMessage());
        }
    });
    
    socket.on('switch-canvas', (canvasId) => {
        canvasManager.switchCanvas(canvasId, io);
    });
    
    socket.on('save-screenshot', async () => {
        try {
            const screenshot = await canvasManager.createScreenshot(screenshotsDir);
            io.emit('screenshot-saved', {
                ...screenshot,
                savedBy: socket.id
            });
        } catch (error) {
            console.error('Ошибка при сохранении скриншота:', error);
            socket.emit('screenshot-error', 'Не удалось сохранить скриншот');
        }
    });
    
    socket.on('drawing', (data) => {
    const user = userManager.getUser(socket.id);
    if (user) {
        console.log('Received drawing from user:', user.name, data); // Для отладки
        canvasManager.addDrawing(socket.id, user.name, user.color, data, socket);
        
        // Немедленно рисуем у отправителя (локально уже нарисовано, но для надежности)
        socket.emit('drawing', data);
    }
    });
    
    socket.on('erasing', (data) => {
        canvasManager.eraseDrawing(data, io);
    });
    
    socket.on('clear-canvas', () => {
        canvasManager.clearCanvas(io);
    });
    
    socket.on('disconnect', () => {
        console.log('Пользователь отключился:', socket.id);
        userManager.removeUser(socket.id);
        userManager.updateUsersList(io);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});

export { app, server, io };