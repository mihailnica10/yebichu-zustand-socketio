# @yebichu/zustand-socketio

> Zero-provider, batteries-included Socket.IO integration for Zustand

`@yebichu/zustand-socketio` bridges Zustand state management with Socket.IO for seamless real-time applications. No providers, no context — just stores that are also socket connections. Works in React, React Native, Svelte, Vue, and vanilla JS.

## Features

- **Zero Provider** — No `<SocketProvider>` needed. Zustand stores are singletons.
- **TypeScript-first** — Full generic type inference for event payloads and emit arguments.
- **High-throughput batching** — RAF-based batching with per-event FPS caps for market data, sensors, or any high-frequency stream.
- **Wildcard throughput** — `throughput: { "market:*": 60 }` caps all matching events via glob patterns.
- **RSC compatible** — `createServerSocketStore` for SSR/RSC, `createClientSocketStore` for clients.
- **React 18/19 `use()`** — Auto-detected. Store works with `use(Store)` out of the box.
- **Middleware chainable** — Works with `devtools`, `persist`, `immer`, `subscribeWithSelector` in any order.
- **All Socket.IO features** — `emit`, `volatile.emit`, `compress().emit()`, `timeout().emit()`, acknowledgements.
- **Singleton-per-socket** — Multiple stores sharing the same URL share the same socket instance automatically.
- **User-provided socket** — Bring your own `Socket` instance for full control.
- **Event subscriptions** — `on`, `once`, `off`, `offAll` with automatic cleanup.
- **Auth refresh** — Function auth is called on every reconnect automatically.

## Install

```bash
npm install @yebichu/zustand-socketio
```

**Peer dependencies:** `zustand@>=4` and `socket.io-client@>=4`

## Quick Start

```typescript
import { createSocketStore } from "@yebichu/zustand-socketio";

const useChatStore = createSocketStore({
  url: "http://localhost:3000",
  store: (set) => ({
    messages: [],
    addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  }),
  events: {
    "chat:message": (payload, { set }) => {
      set((s) => ({ messages: [...s.messages, payload] }));
    },
  },
});

// In any component
function ChatRoom() {
  const messages = useChatStore((s) => s.messages);
  const connected = useChatStore((s) => s.connected);

  const send = () => {
    useChatStore.getState().emit("chat:send", { text: "hello" });
  };

  return (
    <div>
      <span>{messages.length} messages — {connected ? "🟢" : "🔴"}</span>
      <button onClick={send}>Send</button>
    </div>
  );
}
```

## API

### `createSocketStore(options)`

Primary factory. Returns a `SocketStore<T, EM>` which is both a Zustand `StoreApi` and a valid React hook.

```typescript
function createSocketStore<T extends object = {}, EM extends EventMap = {}>(
  options: CreateSocketStoreOptions<T, EM>
): SocketStore<T, EM>;
```

**Options:**

| Property | Type | Description |
|----------|------|-------------|
| `socket` | `Socket` | Provide your own Socket.IO socket instance. Takes precedence over `url`. |
| `url` | `string` | Socket.IO server URL (e.g. `"http://localhost:3000"`). |
| `auth` | `Record<string, unknown> \| (() => Promise<Record<string, unknown>>)` | Auth payload. If a function, called on every reconnect to refresh credentials. |
| `options` | `Partial<SocketOptions & ManagerOptions>` | socket.io-client connection options (transports, timeouts, reconnection, etc.). |
| `store` | `StateCreator<T>` | Your custom store state and actions using Zustand's standard pattern. |
| `events` | `EventBinding<T>` | Map of event names to handlers. Handlers receive `(payload, context)`. |
| `throughput` | `ThroughputConfig` | FPS caps per glob pattern (e.g. `{ "market:*": 60 }`). |
| `batch` | `BatchConfig` | Batching config: `{ fps?: number }` (RAF-based) or `{ interval?: number }` (ms). |
| `onConnect` | `(socket: Socket) => void` | Called after successful connection. |
| `onDisconnect` | `(reason: string) => void` | Called after disconnection. |
| `onError` | `(error: Error) => void` | Called on connection error. |
| `onReconnectAttempt` | `(attempt: number) => void` | Called before each reconnection attempt. |
| `onReconnect` | `(attempt: number) => void` | Called after successful reconnection. |

### `createClientSocketStore(options)`

React-specific factory that returns a **factory function** — the store is only created on first hook invocation. This prevents server-side connection attempts during SSR.

```typescript
function createClientSocketStore<T extends object = {}, EM extends EventMap = {}>(
  options: CreateSocketStoreOptions<T, EM>
): () => SocketStore<T, EM>;

// Usage — note the double invocation
const useChatStore = createClientSocketStore({
  url: "ws://localhost:3000",
  events: { "notification": (n, { set }) => set((s) => ({ list: [...s.list, n] })) },
  store: () => ({ list: [] as any[] }),
});

function Notifications() {
  // Store is created on first render
  const list = useChatStore((s) => s.list);
  return <div>{list.length} notifications</div>;
}
```

### `createServerSocketStore(options)`

Server/RSC variant. Connects immediately, emits only, and **disables reconnection** (servers have long-lived connections). Returns a store without `on`/`once`/`off`/`offAll` methods.

```typescript
function createServerSocketStore<T extends object = {}, EM extends EventMap = {}>(
  options: CreateSocketStoreOptions<T, EM>
): Omit<SocketStore<T, EM>, "on" | "once" | "off" | "offAll">;
```

### `socketio` middleware

Adds socket capabilities to any existing Zustand store as a middleware. Useful when you already have a store and want to add socket integration.

```typescript
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { socketio } from "@yebichu/zustand-socketio/middleware";

const useStore = create(
  devtools(
    socketio({
      url: "ws://localhost:3000",
      events: {
        "score:update": (delta, { set }) => {
          set((s) => ({ score: s.score + delta }));
        },
      },
    }),
    { name: "GameStore" }
  ),
  (set) => ({
    score: 0,
    addScore: (n) => set((s) => ({ score: s.score + n })),
  })
);
```

## Socket State

Every store automatically includes these properties alongside your custom state:

```typescript
interface SocketState {
  socket: Socket | null;           // Raw Socket.IO socket instance
  connected: boolean;               // True when actively connected
  disconnected: boolean;           // True when disconnected
  connecting: boolean;             // True during connection establishment
  status: "idle" | "connecting" | "connected" | "disconnected" | "error";
  error: Error | null;             // Last connection error, if any
  reconnectAttempt: number;        // Current reconnection attempt count
  lastConnectedAt: number | null;  // Unix timestamp of last successful connect
  socketId: string | null;         // Socket.IO session ID
}
```

## Typed Events

Use TypeScript generics to get full type inference for event payloads:

```typescript
interface ServerEvents {
  "chat:message": { id: string; text: string; user: string; timestamp: number };
  "chat:typing": { user: string };
  "user:joined": { userId: string; username: string };
}

interface ClientEvents {
  "chat:send": { text: string; channelId: string };
}

type ChatEvents = ServerEvents & ClientEvents;

interface ChatState {
  messages: ServerEvents["chat:message"][];
  typingUsers: string[];
}

const useChatStore = createSocketStore<ChatState, ChatEvents>({
  url: "http://localhost:3000",
  store: () => ({
    messages: [],
    typingUsers: [],
  }),
  events: {
    "chat:message": (payload, { set }) => {
      // payload is fully typed as { id: string; text: string; user: string; timestamp: number }
      set((s) => ({ messages: [...s.messages, payload] }));
    },
    "chat:typing": (payload, { set }) => {
      // payload is { user: string }
      set((s) => ({ typingUsers: [...s.typingUsers, payload.user] }));
    },
  },
});

// Typed emit — TypeScript errors if you get the payload wrong
useChatStore.getState().emit("chat:send", { text: "hello", channelId: "general" }); // ✓
useChatStore.getState().emit("chat:send", { text: "hello" }); // ✗ TS Error: channelId missing
```

## High-Throughput Batching

For high-frequency events like market data or sensor streams, batching prevents Zustand from being overwhelmed. Events are buffered and flushed at a controlled rate:

```typescript
interface MarketTick {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
}

interface OrderBook {
  symbol: string;
  bids: [number, number][];  // [price, size]
  asks: [number, number][];
}

const useMarketStore = createSocketStore({
  url: "wss://market-data.example.com",
  throughput: {
    "market:tick": 60,     // Tick events capped at 60fps
    "market:*": 30,        // All other market events at 30fps
    "orderbook:*": 15,    // Order books at 15fps
  },
  batch: { fps: 60 },      // Flush buffers at 60fps via requestAnimationFrame
  events: {
    "market:tick": (tick, { buffer }) => {
      // buffer(key, data) accumulates data — flushed on batch interval
      buffer("ticks", tick);
    },
    "market:orderbook": (ob, { buffer }) => {
      buffer("orderbooks", ob);
    },
  },
  store: () => ({
    ticks: [] as MarketTick[],
    orderbooks: new Map<string, OrderBook>(),
  }),
});
```

**Batch configuration options:**

```typescript
// RAF-based batching (default 60fps)
batch: { fps: 30 }

// Interval-based batching (every 100ms)
batch: { interval: 100 }

// Per-event throughput with glob patterns
throughput: {
  "high-freq:*": 120,   // 120fps for high-freq events
  "*": 30,               // 30fps for everything else
}
```

## Chainable Emit Modifiers

The `emit` function supports chained modifiers for Socket.IO's advanced emission features:

```typescript
const state = useStore.getState();

// Normal emit — returns boolean (queued or not)
state.emit("chat:message", { text: "hello" });

// Compressed emit — compresses the payload
state.emit.compress(true)("file:upload", { chunk: data });

// Acknowledgements — wait for server response with timeout
const response = await state.emit.timeout(5000)("game:move", { piece: "queen", to: "e4" });
// Rejects after 5 seconds if no ack

// Volatile emit — best-effort, may be dropped under load
state.emit.volatile.emit("telemetry:frame", { fps: 60, latency: 12 });

// Volatile with acknowledgement
const ack = await state.emit.volatile.withAck("telemetry:batch", { frames: [...] });
```

**Modifier chain:**

```typescript
emit
  .compress(true|false)  // → { emit, compress, timeout, volatile }
  .timeout(ms)            // → { emit } (returns Promise)
  .volatile               // → { emit, withAck }
```

## User-Provided Socket

Bring your own configured Socket.IO socket for full control over connection options, authentication, and lifecycle:

```typescript
import { io } from "socket.io-client";

const mySocket = io("http://localhost:3000", {
  transports: ["websocket"],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
});

const useStore = createSocketStore({
  socket: mySocket,
  events: {
    "notification": (n, { set }) => set((s) => ({ notifications: [...s.notifications, n] })),
    "user:status": (status, { set }) => set({ online: status.online }),
  },
  store: () => ({
    notifications: [] as any[],
    online: false,
  }),
});

// connect/disconnect are no-ops — you control lifecycle
mySocket.disconnect();

// Store still tracks connection state
const { connected, status } = useStore.getState();
```

## React 18/19 `use()`

`createSocketStore` returns a `ReactCompatibleStore` — it works with both the traditional hook pattern and React 18's `use()` API:

```typescript
const useStore = createSocketStore({
  url: "ws://localhost:3000",
  events: {
    "notification": (n, { set }) => set((s) => ({ list: [...s.list, n] })),
  },
  store: () => ({ list: [] as any[] }),
});

// Traditional hook (works in all React versions)
function ComponentA() {
  const list = useStore((s) => s.list);
  return <div>{list.length} items</div>;
}

// React 18/19 use() — store as a "thenable"
function ComponentB() {
  const { list, connected } = use(useStore);
  return <div>{connected ? "Online" : "Offline"}: {list.length} items</div>;
}
```

**Note:** Use `createClientSocketStore` for SSR/RSC to prevent connection attempts during server rendering.

## RSC / Server Usage

For Server Components and RSC, use `createServerSocketStore` which:

- Connects immediately on store creation
- Disables reconnection (server connections are long-lived)
- Provides `emit()` only — no event subscriptions (`on`/`once`/`off`/`offAll` are omitted)

```typescript
// app/actions.ts — Server Action
"use server";
import { createServerSocketStore } from "@yebichu/zustand-socketio";

const useServerStore = createServerSocketStore({
  url: process.env.SOCKET_URL!,
});

// Server can emit events with full type safety
async function broadcastUpdate(data: unknown) {
  const { emit } = useServerStore.getState();
  emit("server:broadcast", { data, timestamp: Date.now() });
}
```

**Client vs Server pattern:**

```typescript
// --- Client store (browser) ---
// file: stores/useChatStore.ts
import { createClientSocketStore } from "@yebichu/zustand-socketio";

export const useChatStore = createClientSocketStore({
  url: "ws://localhost:3000",
  events: {
    "chat:message": (msg, { set }) => set((s) => ({ messages: [...s.messages, msg] })),
  },
  store: () => ({ messages: [] as any[] }),
});

// --- Server store (RSC/SSR) ---
// file: lib/socket.ts
import { createServerSocketStore } from "@yebichu/zustand-socketio";

export const emitServerEvent = createServerSocketStore({
  url: process.env.SOCKET_URL!,
});
```

## With Zustand Middleware

`socketio` middleware chains seamlessly with all Zustand middleware:

```typescript
import { create } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { socketio } from "@yebichu/zustand-socketio/middleware";

interface GameState {
  score: number;
  players: Record<string, { x: number; y: number; health: number }>;
}

const useGameStore = create(
  devtools(
    persist(
      subscribeWithSelector(
        immer(
          socketio<GameState, { "player:move": any; "player:hit": any }>({
            url: "ws://game-server:3000",
            events: {
              "player:move": (data, { set }) => {
                set((s) => {
                  s.players[data.id] = { x: data.x, y: data.y, health: s.players[data.id]?.health ?? 100 };
                });
              },
              "player:hit": (data, { set }) => {
                set((s) => {
                  if (s.players[data.id]) {
                    s.players[data.id].health -= data.damage;
                  }
                });
              },
            },
          })
        )
      ),
      { name: "game-store", partialize: (s) => ({ score: s.score }) }
    ),
    { name: "GameStore" }
  ),
  (set) => ({
    score: 0,
    players: {},
  })
);

// Middleware order matters: socketio should be innermost, devtools outermost
// socketio → immer → subscribeWithSelector → persist → devtools
```

**Middleware chaining order:** `socketio` should typically be the innermost middleware (closest to the state creator), with others wrapping around it.

## Event Context

Event handlers receive a context object with helpers:

```typescript
events: {
  "chat:message": (payload, { set, get, socket, connected, buffer }) => {
    set((s) => ({ messages: [...s.messages, payload] }));  // Update state
    const { messages } = get();                            // Read state
    console.log(socket?.id);                               // Access raw socket
    console.log(connected);                                // Connection status
    buffer?.("pending", payload);                          // Add to batch buffer
  },
}
```

| Property | Type | Description |
|----------|------|-------------|
| `set` | `StoreApi["setState"]` | Update store state. |
| `get` | `StoreApi["getState"]` | Read current state. |
| `socket` | `Socket \| null` | Raw Socket.IO socket instance. |
| `connected` | `boolean` | Current connection status. |
| `buffer` | `(key: string, data: unknown) => void` | Add to batch buffer (only when `batch` config is set). |

## Store Methods

Beyond `emit` and event handlers, each store exposes connection management:

```typescript
const store = useSocketStore.getState();

store.connect();                         // Manually initiate connection
store.disconnect();                       // Manually disconnect
store.reconnect();                       // Force reconnection
store.getSocket();                       // Get raw Socket.IO socket
store.isConnected();                     // Quick boolean check

// Event subscriptions — return unsubscribe functions
const unsubMessage = store.on("chat:message", (payload, ctx) => { ... });
const unsubTyping = store.once("chat:typing", (payload, ctx) => { ... }); // One-time

// Unsubcribe
unsubMessage();
store.off("chat:message");                // Remove all handlers for event
store.offAll();                           // Remove all event handlers
```

## License

MIT
