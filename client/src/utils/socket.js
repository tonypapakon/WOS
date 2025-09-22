import { io } from 'socket.io-client';

const socketUrl = `${window.location.protocol}//${window.location.hostname}:5005`;

export const socket = io(socketUrl, {
  transports: ['websocket', 'polling'],
  timeout: 20000,
  forceNew: false,
  autoConnect: true
});

socket.on('connect', () => {
  console.log('Connected to server via Socket.IO');
  socket.emit('join_restaurant');
});

socket.on('connect_error', (error) => {
  console.error('Socket.IO connection error:', error);
});

socket.on('status', (data) => {
  console.log('Server status:', data.msg);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected from server:', reason);
});