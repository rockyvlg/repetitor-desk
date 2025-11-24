const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

let drawingData = [];
let usersCount = 0; // Добавляем счетчик пользователей

io.on('connection', (socket) => {
  console.log('Новый пользователь подключился. Всего пользователей:', usersCount);
  usersCount++;
  io.emit('users-count', usersCount);
  console.log('После подключения. Всего пользователей:', usersCount);
  
  // Отправляем текущий рисунок новому пользователю
  socket.emit('load-drawing', drawingData);

  socket.on('drawing', (data) => {
    drawingData.push(data);
    socket.broadcast.emit('drawing', data);
  });

  socket.on('clear-canvas', () => {
    drawingData = [];
    io.emit('clear-canvas');
  });

  socket.on('disconnect', () => {
    console.log('Пользователь отключился. Всего пользователей:', usersCount);
    usersCount--;
    io.emit('users-count', usersCount);
    console.log('После отключения. Всего пользователей:', usersCount);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});