import { io } from 'socket.io-client';
import { useEffect, useState, useCallback } from 'react';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  auth: (cb) => {
    const token = localStorage.getItem('chat-token');
    cb({ token });
  }
});

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const connect = useCallback((token) => {
    if (token) {
      localStorage.setItem('chat-token', token);
      socket.auth = { token };
    }
    socket.connect();
  }, []);

  const disconnect = useCallback(() => {
    socket.disconnect();
    localStorage.removeItem('chat-token');
  }, []);

  const joinRoom = useCallback((room) => {
    socket.emit('join_room', room);
    setCurrentRoom(room);
  }, []);

  const sendMessage = useCallback((message) => {
    socket.emit('send_message', { message, room: currentRoom });
  }, [currentRoom]);

  const setTyping = useCallback((isTyping) => {
    socket.emit('typing', { isTyping, room: currentRoom });
  }, [currentRoom]);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onInitialData = (data) => {
      setRooms(data.rooms);
      setUsers(data.users);
      setMessages(data.messages);
    };
    const onReceiveMessage = (message) => {
      setMessages(prev => [...prev, message]);
    };
    const onUserConnected = (user) => {
      setUsers(prev => [...prev.filter(u => u.id !== user.id), user]);
    };
    const onUserDisconnected = (user) => {
      setUsers(prev => prev.map(u => u.id === user.id ? user : u));
    };
    const onTypingUsers = (users) => {
      setTypingUsers(users);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('initial_data', onInitialData);
    socket.on('receive_message', onReceiveMessage);
    socket.on('user_connected', onUserConnected);
    socket.on('user_disconnected', onUserDisconnected);
    socket.on('typing_users', onTypingUsers);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('initial_data', onInitialData);
      socket.off('receive_message', onReceiveMessage);
      socket.off('user_connected', onUserConnected);
      socket.off('user_disconnected', onUserDisconnected);
      socket.off('typing_users', onTypingUsers);
    };
  }, []);

  return {
    socket,
    isConnected,
    connect,
    disconnect,
    currentRoom,
    joinRoom,
    messages,
    sendMessage,
    users,
    typingUsers,
    setTyping,
    rooms,
    notifications
  };
};