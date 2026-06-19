import { io, type Socket, type Manager, type SocketOptions, type ManagerOptions } from "socket.io-client";
import type { SocketState } from "./types";

export interface SocketManagerHooks {
  auth?: Record<string, unknown> | (() => Promise<Record<string, unknown>>);
  options?: Partial<SocketOptions & ManagerOptions>;
  onConnect$?: (socket: Socket) => void;
  onDisconnect$?: (reason: string) => void;
  onError$?: (error: Error) => void;
  onReconnectAttempt$?: (attempt: number) => void;
  onReconnect$?: (attempt: number) => void;
}

export class SocketManager {
  private socket: Socket | null = null;
  private userProvidedSocket = false;
  private manager: Manager | null = null;
  private listeners = new Map<string, Set<Function>>();
  private _connecting = false;
  private _connected = false;
  private _disconnected = true;
  private _error: Error | null = null;
  private _reconnectAttempt = 0;
  private _lastConnectedAt: number | null = null;
  private _socketId: string | null = null;
  private auth: Record<string, unknown> | (() => Promise<Record<string, unknown>>) | undefined;
  private options: Partial<SocketOptions & ManagerOptions> | undefined;
  private onConnect$?: (socket: Socket) => void;
  private onDisconnect$?: (reason: string) => void;
  private onError$?: (error: Error) => void;
  private onReconnectAttempt$?: (attempt: number) => void;
  private onReconnect$?: (attempt: number) => void;

  constructor(socket: Socket, hooks?: SocketManagerHooks);
  constructor(url: string, hooks?: SocketManagerHooks);
  constructor(urlOrSocket: string | Socket, hooks?: SocketManagerHooks) {
    this.auth = hooks?.auth;
    this.options = hooks?.options;
    this.onConnect$ = hooks?.onConnect$;
    this.onDisconnect$ = hooks?.onDisconnect$;
    this.onError$ = hooks?.onError$;
    this.onReconnectAttempt$ = hooks?.onReconnectAttempt$;
    this.onReconnect$ = hooks?.onReconnect$;

    if (typeof urlOrSocket === "string") {
      this.socket = io(urlOrSocket, {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        timeout: 20000,
        transports: ["polling", "websocket"],
        ...(hooks?.auth ? { auth: hooks.auth } : {}),
        ...this.options,
      } as SocketOptions);
    } else {
      this.socket = urlOrSocket;
      this.userProvidedSocket = true;
    }

    this.wireInternalEvents();
  }

  private wireInternalEvents(): void {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      this._connecting = false;
      this._connected = true;
      this._disconnected = false;
      this._error = null;
      this._lastConnectedAt = Date.now();
      this._socketId = this.socket?.id ?? null;
      this.onConnect$?.(this.socket!);
      (this as any)._syncSocketState?.();
    });

    this.socket.on("disconnect", (reason: string) => {
      this._connected = false;
      this._disconnected = true;
      this.onDisconnect$?.(reason);
      (this as any)._syncSocketState?.();
    });

    this.socket.on("connect_error", (err: Error) => {
      this._error = err;
      this._connecting = false;
      this.onError$?.(err);
      (this as any)._syncSocketState?.();
    });

    this.socket.on("reconnect_attempt", (attempt: number) => {
      this._reconnectAttempt = attempt;
      this._connecting = true;
      this.onReconnectAttempt$?.(attempt);
      (this as any)._syncSocketState?.();
    });

    this.socket.on("reconnect", (attempt: number) => {
      this._reconnectAttempt = 0;
      this._error = null;
      this.onReconnect$?.(attempt);
      (this as any)._syncSocketState?.();
    });

    this.socket.on("reconnect_failed", () => {
      this._error = new Error("Reconnection failed");
      (this as any)._syncSocketState?.();
    });
  }

  connect(): void {
    if (!this.socket || this.userProvidedSocket) return;
    if (this._connected) return;
    this._connecting = true;
    this.socket.connect();
    this.refreshAuth();
  }

  disconnect(): void {
    if (!this.socket || this.userProvidedSocket) return;
    this.socket.disconnect();
  }

  reconnect(): void {
    if (!this.socket || this.userProvidedSocket) return;
    this.socket.connect();
  }

  private async refreshAuth(): Promise<void> {
    if (!this.socket) return;
    if (typeof this.auth === "function") {
      try {
        const fresh = await this.auth();
        this.socket.auth = fresh;
      } catch {
        // auth refresh failed — continue
      }
    }
  }

  // ── Listeners ──────────────────────────────────────────────

  on(event: string, handler: Function): () => void {
    if (!this.socket) return () => {};
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    this.socket.on(event, handler as (...args: any[]) => void);
    return () => this.off(event, handler);
  }

  once(event: string, handler: Function): void {
    if (!this.socket) return;
    const wrapped = ((...args: any[]) => {
      handler(...args);
      this.off(event, wrapped);
    }) as (...args: any[]) => void;
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(wrapped);
    this.socket.on(event, wrapped);
  }

  off(event?: string, handler?: Function): void {
    if (!this.socket) return;
    if (event === undefined) {
      this.offAll();
      return;
    }
    if (handler === undefined) {
      const handlers = this.listeners.get(event);
      if (handlers) {
        for (const h of handlers) {
          this.socket.off(event, h as (...args: any[]) => void);
        }
        handlers.clear();
      }
      return;
    }
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      this.socket.off(event, handler as (...args: any[]) => void);
    }
  }

  offAll(): void {
    if (!this.socket) return;
    for (const [event, handlers] of this.listeners) {
      for (const handler of handlers) {
        this.socket.off(event, handler as (...args: any[]) => void);
      }
      handlers.clear();
    }
    this.listeners.clear();
  }

  // ── Emit ────────────────────────────────────────────────────

  emit(event: string, ...args: any[]): boolean {
    const result = this.socket?.emit(event, ...args);
    return result ? true : false;
  }

  compress(enabled: boolean): { emit: (event: string, ...args: any[]) => boolean } {
    const socket = this.socket;
    return {
      emit: (event, ...args) => {
        const compressed = socket?.compress(enabled);
        const result = compressed ? compressed.emit(event, ...args) : false;
        return result ? true : false;
      },
    };
  }

  timeout(ms: number): { emit: (event: string, ...args: any[]) => Promise<any> } {
    const socket = this.socket;
    return {
      emit: (event, ...args) =>
        socket
          ? new Promise((resolve, reject) => {
              const timeoutId = setTimeout(() => reject(new Error(`Ack timeout: ${ms}ms`)), ms);
              socket.timeout(ms).emit(event, ...args, (res: any) => {
                clearTimeout(timeoutId);
                resolve(res);
              });
            })
          : Promise.reject(new Error("Socket not available")),
    };
  }

  get volatile() {
    const socket = this.socket;
    return {
      emit: (event: string, ...args: any[]) => {
        const result = socket?.volatile.emit(event, ...args);
        return result ? true : false;
      },
      withAck: (event: string, ...args: any[]) =>
        new Promise<any>((resolve, reject) => {
          if (!socket) return reject(new Error("Socket not available"));
          const timeoutId = setTimeout(() => reject(new Error("Volatile ack timeout")), 10000);
          socket.volatile.emit(event, ...args, (res: any) => {
            clearTimeout(timeoutId);
            resolve(res);
          });
        }),
    };
  }

  // ── State ──────────────────────────────────────────────────

  get socketRef(): Socket | null {
    return this.socket;
  }

  get state(): Pick<SocketState, "connected" | "disconnected" | "connecting" | "status" | "error" | "reconnectAttempt" | "lastConnectedAt" | "socketId"> {
    let status: SocketState["status"] = "idle";
    if (this._connected) status = "connected";
    else if (this._connecting) status = "connecting";
    else if (this._disconnected) status = "disconnected";
    else if (this._error) status = "error";

    return {
      connected: this._connected,
      disconnected: this._disconnected,
      connecting: this._connecting,
      status,
      error: this._error,
      reconnectAttempt: this._reconnectAttempt,
      lastConnectedAt: this._lastConnectedAt,
      socketId: this._socketId,
    };
  }

  get managerRef(): Manager | null {
    return this.socket?.io ?? null;
  }

  destroy(): void {
    this.offAll();
    if (!this.userProvidedSocket) {
      this.socket?.disconnect();
    }
    this.socket = null;
  }
}
