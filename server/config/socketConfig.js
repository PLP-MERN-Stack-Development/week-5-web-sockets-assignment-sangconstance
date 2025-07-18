export const configureSocket = (io) => {
    const users = {};
    const messages = {};
    const typingUsers = {};
    const rooms = ['general', 'random', 'help'];
  
    rooms.forEach(room => {
      messages[room] = [];
    });
  
    io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);
  
      // Your existing socket.io logic here
    });
  };