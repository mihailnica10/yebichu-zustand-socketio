import { createStore as createZustandStore, type StoreApi } from "zustand/vanilla";
import type {
  CreateSocketStoreOptions,
  SocketState,
  SocketStore,
  EventBinding,
  EmitFn,
} from "./types";
import { SocketManager } from "./socket-manager";
import { getSocketManager } from "./utils/singleton";
import { getThrottleFps } from "./utils/glob";
import { createThrottle } from "./utils/throttle";
import { BatchEngine } from "./utils/batch";

function buildInitialSocketState(): SocketState {
  return {
    socket: null,
    connected: false,
    disconnected: true,
    connecting: false,
    status: "idle",
    error: null,
    reconnectAttempt: 0,
    lastConnectedAt: null,
    socketId: null,
  };
}

export function createSocketStore<
  T extends object = {},
  EM extends Record<string, unknown> = {}
>(
  options: CreateSocketStoreOptions<T, EM>
): SocketStore<T, EM> {
  let userStateCreator: ((set: any, get: any) => T) | null = null;
  if (options.store) {
    userStateCreator = options.store as any;
  }

  const initialSocketState = buildInitialSocketState();

  const creator = (
    set: StoreApi<T & SocketState>["setState"],
    get: StoreApi<T & SocketState>["getState"]
  ): T & SocketState => {
    const userState = userStateCreator ? userStateCreator(set as any, get as any) : ({} as T);
    return {
      ...userState,
      ...initialSocketState,
    } as T & SocketState;
  };

  const store = createZustandStore<T & SocketState>(creator as any) as StoreApi<T & SocketState>;

  const managerKey = options.socket ?? options.url ?? "__default__";
  const manager = getSocketManager(managerKey as any, () => {
    if (options.socket) {
      return new SocketManager(options.socket, {
        auth: options.auth,
        options: options.options,
      });
    }
    return new SocketManager(options.url!, {
      auth: options.auth,
      options: options.options,
    });
  });

  const set = store.setState.bind(store);

  let batchEngine: BatchEngine | null = null;
  if (options.batch) {
    batchEngine = new BatchEngine(options.batch);
    batchEngine.onFlush((buffers) => {
      const updates: Record<string, unknown> = {};
      buffers.forEach((values, key) => {
        updates[key] = values;
      });
      set(updates as any);
    });
    batchEngine.start();
  }

  const syncSocketState = () => {
    const s = manager.state;
    const current = store.getState();
    const patch: Partial<SocketState> = {
      socket: manager.socketRef,
      ...s,
    };
    const hasChange =
      current.connected !== patch.connected ||
      current.status !== patch.status ||
      current.error !== patch.error ||
      current.reconnectAttempt !== patch.reconnectAttempt ||
      current.socketId !== patch.socketId ||
      current.disconnected !== patch.disconnected;

    if (hasChange) {
      store.setState(patch as any);
    }
  };

  (manager as any)._syncSocketState = syncSocketState;

  const makeCtx = () => ({
    set: store.setState.bind(store) as any,
    get: store.getState.bind(store) as any,
    socket: manager.socketRef,
    connected: manager.state.connected,
    buffer: batchEngine
      ? (key: string, data: unknown) => batchEngine!.bufferAdd(key, data)
      : undefined,
  });

  const throughput = options.throughput ?? {};

  if (options.events) {
    for (const [event, handler] of Object.entries(options.events)) {
      const fps = getThrottleFps(throughput, event);

      const adaptedHandler = (payload: any) => {
        const ctx = makeCtx();
        handler(payload, ctx as any);
      };

      if (fps === Infinity) {
        manager.on(event, adaptedHandler);
      } else {
        const throttled = createThrottle(adaptedHandler, fps);
        manager.on(event, throttled);
      }
    }
  }

  if (options.onConnect) {
    const orig = (manager as any)._onConnect;
    (manager as any)._onConnect = (socket: any) => {
      orig?.(socket);
      options.onConnect!(socket);
    };
  }
  if (options.onDisconnect) {
    const orig = (manager as any)._onDisconnect;
    (manager as any)._onDisconnect = (reason: string) => {
      orig?.(reason);
      options.onDisconnect!(reason);
    };
  }
  if (options.onError) {
    const orig = (manager as any)._onError;
    (manager as any)._onError = (error: Error) => {
      orig?.(error);
      options.onError!(error);
    };
  }
  if (options.onReconnectAttempt) {
    const orig = (manager as any)._onReconnectAttempt;
    (manager as any)._onReconnectAttempt = (attempt: number) => {
      orig?.(attempt);
      options.onReconnectAttempt!(attempt);
    };
  }
  if (options.onReconnect) {
    const orig = (manager as any)._onReconnect;
    (manager as any)._onReconnect = (attempt: number) => {
      orig?.(attempt);
      options.onReconnect!(attempt);
    };
  }

  if (!options.socket) {
    manager.connect();
  } else {
    syncSocketState();
  }

  const emitBase = ((...args: any[]) => {
    return manager.emit(args[0] as string, ...args.slice(1));
  }) as EmitFn;

  emitBase.compress = (enabled: boolean) => {
    const modifiers = manager.compress(enabled);
    return {
      emit: modifiers.emit,
      compress: (e2: boolean) => emitBase.compress(e2),
      timeout: (ms: number) => manager.timeout(ms),
      volatile: manager.volatile,
    };
  };

  emitBase.timeout = (ms: number) => manager.timeout(ms);
  emitBase.volatile = manager.volatile;

  const augmented = store as SocketStore<T, EM>;

  augmented.connect = () => manager.connect();
  augmented.disconnect = () => manager.disconnect();
  augmented.reconnect = () => manager.reconnect();
  augmented.getSocket = () => manager.socketRef;
  augmented.isConnected = () => manager.state.connected;
  augmented.emit = emitBase;

  augmented.on = <E extends string>(
    event: E,
    handler: (payload: any, ctx: any) => void
  ) => {
    const adapted = (payload: any) => handler(payload, makeCtx());
    return manager.on(event, adapted);
  };

  augmented.once = <E extends string>(
    event: E,
    handler: (payload: any, ctx: any) => void
  ) => {
    const adapted = (payload: any) => handler(payload, makeCtx());
    manager.once(event, adapted);
  };

  augmented.off = <E extends string>(event: E, handler?: Function) => {
    manager.off(event, handler);
  };

  augmented.offAll = () => manager.offAll();

  return augmented;
}

export { createSocketStore as createStore };
