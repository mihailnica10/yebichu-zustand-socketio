import type { StateCreator } from "zustand/vanilla";
import type { CreateSocketStoreOptions, SocketState } from "./types";
import { SocketManager } from "./socket-manager";
import { getSocketManager } from "./utils/singleton";
import { createThrottle } from "./utils/throttle";
import { getThrottleFps } from "./utils/glob";
import type { StoreApi } from "zustand/vanilla";

type Middleware<T> = (stateCreator: StateCreator<T>) => StateCreator<T>;

export function socketio<
  T extends object,
  EM extends Record<string, unknown> = {}
>(
  config: CreateSocketStoreOptions<T, EM>
) {
  return (
    stateCreator: StateCreator<T & SocketState>
  ): StateCreator<T & SocketState> => {
    return (set, get, api) => {
      const managerKey = config.socket ?? config.url ?? "__default__";
      const manager = getSocketManager(managerKey as any, () => {
        if (config.socket) {
          return new SocketManager(config.socket, { auth: config.auth, options: config.options });
        }
        return new SocketManager(config.url!, { auth: config.auth, options: config.options });
      });

      const syncSocketState = () => {
        const s = manager.state;
        const current = (api as StoreApi<T & SocketState>).getState();
        const patch: Partial<SocketState> = { socket: manager.socketRef, ...s };
        const hasChange =
          current.connected !== patch.connected ||
          current.status !== patch.status ||
          current.error !== patch.error ||
          current.reconnectAttempt !== patch.reconnectAttempt;
        if (hasChange) {
          (api as StoreApi<T & SocketState>).setState(patch as any);
        }
      };

      (manager as any)._syncSocketState = syncSocketState;

      const makeCtx = () => ({
        set: (api as StoreApi<T & SocketState>).setState.bind(api) as any,
        get: (api as StoreApi<T & SocketState>).getState.bind(api) as any,
        socket: manager.socketRef,
        connected: manager.state.connected,
      });

      const throughput = config.throughput ?? {};

      if (config.events) {
        for (const [event, handler] of Object.entries(config.events)) {
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

      if (!config.socket) {
        manager.connect();
      } else {
        syncSocketState();
      }

      const origApi = api as any;
      origApi.getSocket = () => manager.socketRef;
      origApi.isConnected = () => manager.state.connected;
      origApi.connect = () => manager.connect();
      origApi.disconnect = () => manager.disconnect();
      origApi.reconnect = () => manager.reconnect();

      origApi.emit = (...args: any[]) => manager.emit(args[0] as string, ...args.slice(1));
      origApi.emit.compress = (enabled: boolean) => manager.compress(enabled);
      origApi.emit.timeout = (ms: number) => manager.timeout(ms);
      origApi.emit.volatile = manager.volatile;

      origApi.on = <E extends string>(event: E, handler: any) => {
        const adapted = (payload: any) => handler(payload, makeCtx());
        return manager.on(event, adapted);
      };
      origApi.once = <E extends string>(event: E, handler: any) => {
        const adapted = (payload: any) => handler(payload, makeCtx());
        manager.once(event, adapted);
      };
      origApi.off = <E extends string>(event: E, handler?: Function) => {
        manager.off(event, handler);
      };
      origApi.offAll = () => manager.offAll();

      return stateCreator(set, get, api);
    };
  };
}
