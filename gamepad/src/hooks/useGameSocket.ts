import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface PlayerInfo {
  id: string;
  color: string;
  name: string;
  index: number;
}

interface GameSocket {
  connected: boolean;
  player: PlayerInfo | null;
  error: string | null;
  sendInput: (key: 'left' | 'right' | 'jump', pressed: boolean) => void;
}

export function useGameSocket(address: string): GameSocket {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [player, setPlayer]       = useState<PlayerInfo | null>(null);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    const url    = address.startsWith('http') ? address : `http://${address}`;
    const socket = io(url, {
      transports: ['websocket'],
      reconnectionAttempts: 3,
      timeout: 8000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
      socket.emit('joinAsPlayer');
    });

    socket.on('playerAssigned', (info: PlayerInfo) => {
      setPlayer(info);
    });

    socket.on('gameFull', () => {
      setError('La sala está llena (máximo 4 jugadores).\nVolvé a intentar cuando haya un lugar libre.');
      socket.disconnect();
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setPlayer(null);
    });

    socket.on('connect_error', () => {
      setError(`No se pudo conectar a ${address}.\nVerificá que el juego esté corriendo y que estén en la misma red WiFi.`);
    });

    return () => { socket.disconnect(); };
  }, [address]);

  const sendInput = (key: 'left' | 'right' | 'jump', pressed: boolean) => {
    socketRef.current?.volatile.emit('input', { key, pressed });
  };

  return { connected, player, error, sendInput };
}
