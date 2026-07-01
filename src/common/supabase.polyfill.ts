import WebSocket from 'ws';

if (!(globalThis as any).WebSocket) {
  (globalThis as any).WebSocket = WebSocket;
}