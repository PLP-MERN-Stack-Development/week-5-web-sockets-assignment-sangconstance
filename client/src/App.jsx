import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSocket } from './socket/socket';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import LoadingSpinner from './components/LoadingSpinner';
import NotificationHandler from './components/NotificationHandler';
import './App.css';

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { socket, connect, disconnect, isConnected } = useSocket();

  // Check for existing auth token on initial load
  useEffect(() => {
    const token = localStorage.getItem('chat-token');
    if (token) {
      try {
        // In a real app, you would verify the token with your backend
        const userData = JSON.parse(atob(token.split('.')[1]));
        setAuthUser(userData);
        connect(token);
      } catch (error) {
        console.error('Invalid token:', error);
        localStorage.removeItem('chat-token');
      }
    }
    setIsLoading(false);
  }, [connect]);

  const handleLogin = (token, userData) => {
    localStorage.setItem('chat-token', token);
    setAuthUser(userData);
    connect(token);
  };

  const handleLogout = () => {
    localStorage.removeItem('chat-token');
    setAuthUser(null);
    disconnect();
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <BrowserRouter>
      <div className="app-container">
        <NotificationHandler socket={socket} />
        
        <Routes>
          <Route
            path="/"
            element={
              authUser ? (
                <Navigate to="/chat" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          
          <Route
            path="/login"
            element={
              authUser ? (
                <Navigate to="/chat" replace />
              ) : (
                <AuthPage onLogin={handleLogin} />
              )
            }
          />
          
          <Route
            path="/chat"
            element={
              authUser ? (
                <ChatPage 
                  user={authUser} 
                  onLogout={handleLogout} 
                  socket={socket} 
                  isConnected={isConnected}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;