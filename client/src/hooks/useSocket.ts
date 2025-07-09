import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { BACKEND_URL } from '../config';

export const useSocket = () => {
  const { token } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    // Create a unique ID for this tab
    const tabId = Math.random().toString(36).substring(7);

    // Only create a new socket if one doesn't exist
    if (!socketRef.current) {
      console.log('Initializing socket connection to:', BACKEND_URL);
      socketRef.current = io(BACKEND_URL, {
        transports: ['polling', 'websocket'],
        auth: {
          token,
          tabId // Add tab ID to auth
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 60000,
        forceNew: true,
        autoConnect: true
      });

      socketRef.current.on('connect', () => {
        console.log('Socket connected successfully');
        console.log('Socket ID:', socketRef.current?.id);
        console.log('Socket connected to:', BACKEND_URL);
        // Join a room specific to this tab
        socketRef.current?.emit('joinTab', { tabId });
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error.message);
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });

      socketRef.current.on('error', (error) => {
        console.error('Socket error:', error);
      });
    }

    // Cleanup function
    return () => {
      if (socketRef.current) {
        console.log('Cleaning up socket connection...');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [token]); // Only recreate socket if token changes

  return socketRef.current;
}; 