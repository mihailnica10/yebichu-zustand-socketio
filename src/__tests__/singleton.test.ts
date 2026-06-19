import { describe, it, expect, beforeEach } from "vitest";
import { getSocketManager, releaseSocketManager } from "../utils/singleton";
import { SocketManager } from "../socket-manager";

// Note: These tests verify the singleton API without requiring a real socket connection.
// The actual socket-manager is not instantiated here since it would create real socket connections.

describe("singleton utils", () => {
  // Note: We can't easily test the actual singleton behavior without mocking SocketManager
  // since it creates real socket.io connections. These tests verify the API surface.

  it("getSocketManager is a function", () => {
    expect(typeof getSocketManager).toBe("function");
  });

  it("releaseSocketManager is a function", () => {
    expect(typeof releaseSocketManager).toBe("function");
  });
});
