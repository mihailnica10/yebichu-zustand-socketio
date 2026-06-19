import { createSocketStore } from "./create-socket-store";
import type { CreateSocketStoreOptions, SocketStore } from "./types";

const storeCache = new WeakMap<object, SocketStore<any, any>>();

export function createClientSocketStore<
  T extends object = {},
  EM extends Record<string, unknown> = {}
>(
  options: CreateSocketStoreOptions<T, EM>
): () => SocketStore<T, EM> {
  const cacheKey = options.socket ?? options.url ?? options;
  let store = storeCache.get(cacheKey as object);
  if (!store) {
    store = createSocketStore<T, EM>(options);
    storeCache.set(cacheKey as object, store);
  }
  return () => store as SocketStore<T, EM>;
}

export function createReactCompatibleStore<
  T extends object = {},
  EM extends Record<string, unknown> = {}
>(
  options: CreateSocketStoreOptions<T, EM>
) {
  return createSocketStore<T, EM>(options);
}
