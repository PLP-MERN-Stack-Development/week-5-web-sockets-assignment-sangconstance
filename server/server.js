require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);

// Enhanced configuration
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-strong-secret-here';

// Socket.io with advanced configuration
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes recovery window
    skipMiddlewares: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// Data stores
const users = new Map(); // socket.id -> userData
const messages = {
  general: [],
  random: [],
  support: []
};
const typingUsers = new Map(); // socket.id -> username

// JWT authentication middleware
const authenticate = (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error'));
    socket.user = decoded;
    next();
  });
};

io.use(authenticate);

// Socket.io events
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  // Add user to storage
  users.set(socket.id, {
    id: socket.id,
    username: socket.user.username,
    avatar: socket.user.avatar,
    status: 'online',
    currentRoom: 'general'
  });

  // Join default room
  socket.join('general');

  // Send initial data
  socket.emit('initial_data', {
    users: Array.from(users.values()),
    messages: messages.general.slice(-100),
    rooms: Object.keys(messages)
  });

  // Notify others
  socket.broadcast.emit('user_connected', users.get(socket.id));

  // Message handling
  socket.on('send_message', ({ message, room }) => {
    if (!message?.trim() || !messages[room]) return;

    const user = users.get(socket.id);
    const msg = {
      id: Date.now(),
      sender: user.username,
      senderId: socket.id,
      message: message.trim(),
      room,
      timestamp: new Date().toISOString(),
      reactions: {}
    };

    messages[room].push(msg);
    if (messages[room].length > 500) messages[room].shift();

    io.to(room).emit('receive_message', msg);
  });

  // Typing indicator
  socket.on('typing', ({ isTyping, room }) => {
    const user = users.get(socket.id);
    if (!user) return;

    if (isTyping) {
      typingUsers.set(socket.id, user.username);
    } else {
      typingUsers.delete(socket.id);
    }
    io.to(room).emit('typing_users', Array.from(typingUsers.values()));
  });

  // Room management
  socket.on('join_room', (room) => {
    if (!messages[room]) return;

    const user = users.get(socket.id);
    socket.leave(user.currentRoom);
    socket.join(room);
    user.currentRoom = room;
    users.set(socket.id, user);

    socket.emit('room_messages', messages[room].slice(-100));
    io.emit('user_list_update', Array.from(users.values()));
  });

  // Disconnection handling
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      user.status = 'offline';
      user.lastSeen = new Date().toISOString();
      io.emit('user_disconnected', user);
      
      // Cleanup after delay
      setTimeout(() => {
        if (!io.sockets.sockets.get(socket.id)) {
          users.delete(socket.id);
          typingUsers.delete(socket.id);
          io.emit('user_list_update', Array.from(users.values()));
        }
      }, 30000);
    }
  });
});

// HTTP Routes
app.post('/api/auth', (req, res) => {
  const { username, avatar } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

  const token = jwt.sign({ username, avatar }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, username, avatar });
});

app.get('/api/rooms', (req, res) => {
  res.json(Object.keys(messages));
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});