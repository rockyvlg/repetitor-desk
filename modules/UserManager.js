class UserManager {
    constructor() {
        this.users = new Map();
    }
    
    getAvailableColors() {
        const allColors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
            '#F8C471', '#82E0AA', '#F1948A', '#D7BDE2', '#A3E4D7'
        ];
        
        const usedColors = Array.from(this.users.values()).map(user => user.color);
        return allColors.filter(color => !usedColors.includes(color));
    }
    
    getRandomColor() {
        const availableColors = this.getAvailableColors();
        if (availableColors.length === 0) {
            return '#' + Math.floor(Math.random()*16777215).toString(16);
        }
        return availableColors[Math.floor(Math.random() * availableColors.length)];
    }
    
    addUser(socketId) {
        const color = this.getRandomColor();
        const user = {
            color: color,
            name: `Участник${Math.floor(Math.random() * 1000)}`,
            joinedAt: new Date(),
            microphone: false
        };
        
        this.users.set(socketId, user);
        return user;
    }
    
    getUser(socketId) {
        return this.users.get(socketId);
    }
    
    removeUser(socketId) {
        this.users.delete(socketId);
    }
    
    changeUserName(socketId, newName) {
        const user = this.users.get(socketId);
        if (user && newName && newName.trim().length > 0) {
            user.name = newName.trim().substring(0, 20);
            console.log(`Пользователь ${socketId} сменил имя на: ${user.name}`);
            return true;
        }
        return false;
    }
    
    changeUserColor(socketId, newColor, io) {
        const user = this.users.get(socketId);
        if (user) {
            const isColorTaken = Array.from(this.users.values())
                .some(u => u.color === newColor && u !== user);
            
            if (!isColorTaken) {
                user.color = newColor;
                this.updateUsersList(io);
                return true;
            }
        }
        return false;
    }
    
    toggleMicrophone(socketId) {
        const user = this.users.get(socketId);
        if (user) {
            user.microphone = !user.microphone;
            return user.microphone;
        }
        return false;
    }
    
    updateUsersList(io) {
        const usersList = Array.from(this.users.entries()).map(([id, user]) => ({
            id,
            color: user.color,
            name: user.name,
            microphone: user.microphone
        }));
        
        io.emit('users-update', usersList);
        io.emit('available-colors-update', this.getAvailableColors());
    }
    
    getUsersCount() {
        return this.users.size;
    }
}

export default UserManager;