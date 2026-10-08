import { io, Socket } from 'socket.io-client';

// Shared socket instance
let socket: Socket | null = null;

export const initSocket = (token: string, baseUrl: string) => {
  if (socket) return socket;

  socket = io(baseUrl, {
    auth: {
      token,
    },
    transports: ['websocket'],
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('Connected to game server', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected from game server:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  return socket;
};

export const getSocket = (): Socket => {
  if (!socket) {
    throw new Error('Socket not initialized. Call initSocket first.');
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
