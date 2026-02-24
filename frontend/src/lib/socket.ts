import io from 'socket.io-client';

type SocketInstance = ReturnType<typeof io>;
let socket: SocketInstance | null = null;

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'failed';
let connectionStatus: ConnectionStatus = 'disconnected';
let statusListeners: Array<(status: ConnectionStatus) => void> = [];

export function getConnectionStatus(): ConnectionStatus {
  return connectionStatus;
}

export function onConnectionStatusChange(
  listener: (status: ConnectionStatus) => void,
): () => void {
  statusListeners.push(listener);
  return () => {
    statusListeners = statusListeners.filter((l) => l !== listener);
  };
}

function setConnectionStatus(status: ConnectionStatus) {
  connectionStatus = status;
  statusListeners.forEach((l) => l(status));
}

/**
 * Socket.IO client espera a URL HTTP(S) do servidor, não ws:// ou wss://.
 * Converte para o formato correto.
 */
function getSocketServerUrl(): string {
  const url = process.env.NEXT_PUBLIC_WS_URL || 'http://192.168.10.156:4000';
  const trimmed = url.trim();
  if (trimmed.startsWith('ws://')) return 'http://' + trimmed.slice(5);
  if (trimmed.startsWith('wss://')) return 'https://' + trimmed.slice(6);
  return trimmed;
}

export function getSocket(): SocketInstance | null {
  return socket;
}

export function connectSocket(token: string): SocketInstance {
  if (socket?.connected) return socket;

  const serverUrl = getSocketServerUrl();

  socket = io(serverUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    forceNew: false,
    autoConnect: true,
  });

  // Conta falhas consecutivas de conexão para evitar toast em falhas transitórias
  let connectErrorCount = 0;

  socket.on('connect', () => {
    console.log('[Socket.IO] ✓ Conectado ao servidor WebSocket');
    connectErrorCount = 0;
    setConnectionStatus('connected');
  });

  socket.on('disconnect', (reason: string) => {
    console.log(`[Socket.IO] ✗ Desconectado: ${reason}`);
    if (reason === 'io server disconnect') {
      // Servidor forçou desconexão (ex: token inválido) — não reconecta automaticamente
      setConnectionStatus('failed');
    } else if (reason === 'io client disconnect') {
      // Desconexão intencional do cliente (ex: desmontagem, Fast Refresh) — não mostrar "Reconectando"
      setConnectionStatus('disconnected');
    } else {
      // Queda real de conexão (transport close/error) — avisar usuário
      setConnectionStatus('reconnecting');
    }
  });

  socket.on('connect_error', (error: Error) => {
    connectErrorCount++;
    console.warn(`[Socket.IO] ✗ Erro de conexão (${connectErrorCount}): ${error.message}`);
    // Só mostra "Reconectando" após 2 falhas consecutivas para evitar
    // toast falso durante ciclos rápidos de Fast Refresh
    if (connectErrorCount >= 2) {
      setConnectionStatus('reconnecting');
    }
  });

  socket.on('reconnect_attempt', (attempt: number) => {
    console.log(`[Socket.IO] → Tentando reconectar... (tentativa ${attempt})`);
    setConnectionStatus('reconnecting');
  });

  socket.on('reconnect', () => {
    console.log('[Socket.IO] ✓ Reconectado com sucesso');
    connectErrorCount = 0;
    setConnectionStatus('connected');
  });

  socket.on('reconnect_failed', () => {
    console.error('[Socket.IO] ✗ Reconexão esgotada — não foi possível conectar ao servidor');
    setConnectionStatus('failed');
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
