import { createSocketStore } from "./create-socket-store";
import type { CreateSocketStoreOptions, SocketStore } from "./types";

/**
 * Server/RSC variant.
 * - No event subscriptions (server emits, doesn't receive)
 * - No reconnection (server connections are long-lived)
 * - Connects immediately
 * - Returns store with emit() only (no on/once/off/offAll)
 */
export function createServerSocketStore<
  T extends object = {},
  EM extends Record<string, unknown> = {}
>(
  options: CreateSocketStoreOptions<T, EM>
): Omit<SocketStore<T, EM>, "on" | "once" | "off" | "offAll"> {
  const serverOptions: CreateSocketStoreOptions<T, EM> = {
    ...options,
    options: {
      ...options.options,
      reconnection: false,
    },
    events: undefined,
  };

  const store = createSocketStore<T, EM>(serverOptions as any);

  store.connect();

  return store as Omit<SocketStore<T, EM>, "on" | "once" | "off" | "offAll">;
}
