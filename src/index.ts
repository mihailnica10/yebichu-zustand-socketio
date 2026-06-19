// Core factory
export { createSocketStore, createStore } from "./create-socket-store";

// React
export { createClientSocketStore, createReactCompatibleStore } from "./create-client-socket-store";

// Server / RSC
export { createServerSocketStore } from "./create-server-socket-store";

// Types
export type {
  SocketStore,
  SocketState,
  CreateSocketStoreOptions,
  EventBinding,
  EventMap,
  EventContext,
  EmitFn,
  EmitModifiers,
  BatchConfig,
  ThroughputConfig,
  SocketMiddleware,
  ReactCompatibleStore,
  Manager,
  Socket,
  ManagerOptions,
  SocketOptions,
} from "./types";
