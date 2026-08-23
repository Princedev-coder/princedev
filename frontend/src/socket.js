import { io } from 'socket.io-client';

let socket = null;

export function connectSocket() {
  const token = localStorage.getItem('hp_token');
  if (!token) return null;
  if (socket && socket.connected) return socket;
  socket = io('/', {
    auth: { token },
    transports: ['websocket'],
  });
  return socket;
}

export function getSocket() {
  if (!socket || !socket.connected) return connectSocket();
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default { connectSocket, getSocket, disconnectSocket };
