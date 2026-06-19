# Changelog

## 0.1.0 (2025-06-19)

### Added
- `createSocketStore` — primary factory for creating socket-integrated Zustand stores
- `createClientSocketStore` — React factory with `use()` compatibility
- `createServerSocketStore` — RSC/SSR emit-only variant
- `socketio` middleware — add Socket.IO to any existing Zustand store
- Full TypeScript generics for event payload typing
- High-throughput batching via RAF-based `BatchEngine`
- FPS throttling per event with glob pattern support (micromatch)
- All Socket.IO features: `emit`, `volatile.emit`, `compress()`, `timeout()`, `ack`
- Singleton-per-socket (multiple stores share same socket)
- User-provided socket support
- Zustand middleware chainable (devtools, persist, immer, etc.)
