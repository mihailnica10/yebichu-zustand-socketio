import type { Socket } from "socket.io-client";
import type { SocketManager } from "../socket-manager";

const _singletons = new Map<string | Socket, { manager: SocketManager; refCount: number }>();

export function getSocketManager(key: string | Socket, factory: () => SocketManager): SocketManager {
  const existing = _singletons.get(key);
  if (existing) {
    existing.refCount++;
    return existing.manager;
  }
  const manager = factory();
  _singletons.set(key, { manager, refCount: 1 });
  return manager;
}

export function releaseSocketManager(key: string | Socket): void {
  const entry = _singletons.get(key);
  if (!entry) return;
  entry.refCount--;
  if (entry.refCount <= 0) {
    _singletons.delete(key);
  }
}