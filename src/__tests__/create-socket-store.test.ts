import { describe, it, expect, vi } from "vitest";
import { createSocketStore } from "../create-socket-store";

type TestChatState = {
  messages: string[];
  addMessage: (msg: string) => void;
};

// Mock socket.io-client
vi.mock("socket.io-client", () => {
  const mockSocket = {
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(() => true),
    connect: vi.fn(),
    disconnect: vi.fn(),
    id: "test-socket-id",
    connected: true,
    disconnected: false,
    compress: vi.fn(() => mockSocket),
    timeout: vi.fn(() => mockSocket),
    volatile: { emit: vi.fn(() => true) },
    io: { engine: {} },
  };
  return {
    io: vi.fn(() => mockSocket),
  };
});

describe("createSocketStore", () => {
  it("creates a store with socket state properties", () => {
    const store = createSocketStore({
      url: "http://localhost:3000",
    });

    // store is a StoreApi (object), not a function
    expect(typeof store).toBe("object");
    expect(typeof store.getState).toBe("function");
    expect(typeof store.setState).toBe("function");

    const state = store.getState();
    expect(state).toHaveProperty("socket");
    expect(state).toHaveProperty("connected");
    expect(state).toHaveProperty("disconnected");
    expect(state).toHaveProperty("status");
  });

  it("has emit, connect, disconnect on store API", () => {
    const store = createSocketStore({
      url: "http://localhost:3000",
    });

    // These methods are on the store (StoreApi), not on getState()
    expect(typeof store.emit).toBe("function");
    expect(typeof store.connect).toBe("function");
    expect(typeof store.disconnect).toBe("function");
    expect(typeof store.getSocket).toBe("function");
    expect(typeof store.on).toBe("function");
    expect(typeof store.off).toBe("function");
    expect(typeof store.offAll).toBe("function");
  });

  it("merges user state with socket state", () => {
    const store = createSocketStore<TestChatState>({
      url: "http://localhost:3000",
      store: (set) => ({
        messages: [] as string[],
        addMessage: (msg: string) => set((s) => ({ messages: [...s.messages, msg] })),
      }),
    });

    const state = store.getState();
    expect(state).toHaveProperty("messages");
    expect(state).toHaveProperty("addMessage");
  });

  it("can register and unregister event handlers", () => {
    const store = createSocketStore<TestChatState>({
      url: "http://localhost:3000",
      events: {
        "chat:message": (payload, ctx) => {
          ctx.set((s) => ({ messages: [...s.messages, payload] }));
        },
      },
      store: (set) => ({
        messages: [] as string[],
        addMessage: (msg: string) => set((s) => ({ messages: [...s.messages, msg] })),
      }),
    });

    const off = store.on("custom:event", vi.fn());
    expect(typeof off).toBe("function");

    off(); // unsubscribe
  });
});
