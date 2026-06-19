import type {
  Socket,
  Manager,
  ManagerOptions,
  SocketOptions,
} from "socket.io-client";
import type { StoreApi, StateCreator } from "zustand/vanilla";

type Middleware<T> = (stateCreator: StateCreator<T>) => StateCreator<T>;

export interface SocketState {
  socket: Socket | null;
  connected: boolean;
  disconnected: boolean;
  connecting: boolean;
  status: "idle" | "connecting" | "connected" | "disconnected" | "error";
  error: Error | null;
  reconnectAttempt: number;
  lastConnectedAt: number | null;
  socketId: string | null;
}

export type EventMap = Record<string, unknown>;

export interface EventContext<T extends object = {}> {
  set: StoreApi<T>["setState"];
  get: StoreApi<T>["getState"];
  socket: Socket | null;
  connected: boolean;
}

export type EventBinding<T extends object = {}> = {
  [event: string]: (payload: any, ctx: EventContext<T>) => void;
};

export interface BatchConfig {
  fps?: number;
  interval?: number;
}

export type ThroughputConfig = Record<string, number>;

export interface CreateSocketStoreOptions<
  T extends object = {},
  EM extends EventMap = {}
> {
  socket?: Socket;
  url?: string;
  auth?: Record<string, unknown> | (() => Promise<Record<string, unknown>>);
  manager?: Manager;
  options?: Partial<SocketOptions & ManagerOptions>;
  store?: StateCreator<T>;
  events?: EventBinding<T>;
  throughput?: ThroughputConfig;
  batch?: BatchConfig;
  onConnect?: (socket: Socket) => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
  onReconnectAttempt?: (attempt: number) => void;
  onReconnect?: (attempt: number) => void;
}

export interface EmitModifiers {
  compress(enabled: boolean): EmitModifiers;
  timeout(ms: number): { emit(event: string, ...args: any[]): Promise<any> };
  volatile: { emit(event: string, ...args: any[]): boolean };
}

export interface EmitFn {
  <E extends string>(event: E, ...args: any[]): boolean;
  compress: (enabled: boolean) => EmitModifiers;
  timeout: (ms: number) => { emit: (event: string, ...args: any[]) => Promise<any> };
  volatile: { emit: (event: string, ...args: any[]) => boolean; withAck: (event: string, ...args: any[]) => Promise<any> };
}

export interface SocketStore<
  T extends object = {},
  EM extends EventMap = {}
> extends StoreApi<T & SocketState> {
  connect(): void;
  disconnect(): void;
  reconnect(): void;
  getSocket(): Socket | null;
  isConnected(): boolean;
  emit: EmitFn;
  on<E extends string>(event: E, handler: (payload: any, ctx: EventContext<T>) => void): () => void;
  once<E extends string>(event: E, handler: (payload: any, ctx: EventContext<T>) => void): void;
  off<E extends string>(event: E, handler?: Function): void;
  off(event: string): void;
  offAll(): void;
}

export interface ReactCompatibleStore<T extends object = {}> extends StoreApi<T> {
  getState(): T;
  getSnapshot(): T;
  getServerState?: () => T;
}

export type SocketMiddlewareConfig<
  T extends object = {},
  EM extends EventMap = {}
> = CreateSocketStoreOptions<T, EM>;

export type SocketMiddleware = <
  T extends object,
  EM extends EventMap = {},
  Mps extends [Middleware<any>] = [Middleware<any>]
>(
  config: SocketMiddlewareConfig<T, EM>
) => Middleware<T & SocketState>;

export type { Socket, Manager, ManagerOptions, SocketOptions };
