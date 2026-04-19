let io;

module.exports = {
    initialize: (server) => {
        io = server;
        
        io.on('connection', (socket) => {
            console.log('🔌 New client connected:', socket.id);
            
            // Unir usuario a su sala personal
            socket.on('register_user', (userId) => {
                socket.join(`user_${userId}`);
                console.log(`User ${userId} joined room user_${userId}`);
            });
            
            // Unir conductor a su sala
            socket.on('register_driver', (driverId) => {
                socket.join(`driver_${driverId}`);
                console.log(`Driver ${driverId} joined room driver_${driverId}`);
            });
            
            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });
        
        return io;
    },
    
    emitToUser: (userId, event, data) => {
        if (io) {
            io.to(`user_${userId}`).emit(event, data);
        }
    },
    
    emitToDriver: (driverId, event, data) => {
        if (io) {
            io.to(`driver_${driverId}`).emit(event, data);
        }
    },
    
    emitToAll: (event, data) => {
        if (io) {
            io.emit(event, data);
        }
    }
};