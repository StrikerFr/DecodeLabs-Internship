# Technical Architecture Guide - DecodeBot

This document details the architectural decisions, data flow, and runtime mechanics of DecodeBot.

---

## 1. System Overview

DecodeBot is structured as a single-page application built on top of **TanStack Start**, a full-stack React framework. The core system comprises three logical layers: the **Client UI Layer**, the **Server/Middleware Layer**, and the **External Services Layer**.

```
    +-------------------------------------------------------+
    |                     CLIENT LAYER                      |
    |                                                       |
    |  +------------------+           +------------------+  |
    |  |  UI (React 19)   | <=======> | 3D Scene (R3F)   |  |
    |  +--------+---------+           +--------+---------+  |
    +-----------|------------------------------|------------+
                | (Invoke Server Fn)           | (HTTP POST Stream)
                ▼                              ▼
    +-----------|------------------------------|------------+
    |           │         SERVER LAYER         │            |
    |           ▼                              ▼            |
    |  +──────────────────+           +──────────────────+  |
    |  | aiChat Server Fn |           | /api/tts Route   |  |
    |  +--------+---------+           +--------+---------+  |
    +-----------|------------------------------|------------+
                | (Auth Header + Payload)      | (xi-api-key)
                ▼                              ▼
    +-----------|------------------------------|------------+
    |           ▼    EXTERNAL SERVICES LAYER   ▼            |
    |  +──────────────────+           +──────────────────+  |
    |  |    Groq Cloud    |           |    ElevenLabs    |  |
    |  | (Llama 3.3 LLM)  |           |     (TTS API)    |  |
    |  +------------------+           +------------------+  |
    +-------------------------------------------------------+
```

---

## 2. Server-Client Boundaries

A key requirement of production-grade modern web applications is the secure containment of authentication secrets. DecodeBot enforces strict security policies through the following mechanisms:

### A. Server Functions (`createServerFn`)

The AI Chat reasoning pipeline runs via a server function defined in [ai-chat.functions.ts](file:///c:/Users/anand/Downloads/decodebot-main/Project1%20-%20DecodeBot/src/lib/ai-chat.functions.ts).

- **Execution Scope**: Although called from the client component like a standard asynchronous function, the handler runs entirely on the server.
- **Dependency Isolation**: Vite's bundler automatically tree-shakes server-only dependencies and strips implementation logic from the client bundle.
- **Credential Safety**: The Groq API key is read directly from `process.env` at request execution time on the server, ensuring credentials are never transmitted to the client browser.

### B. Local API Route Proxy (`/api/tts`)

The voice synthesis pipeline fetches audio streams using a custom file-based route handler in [tts.ts](file:///c:/Users/anand/Downloads/decodebot-main/Project1%20-%20DecodeBot/src/routes/api/tts.ts).

- **CORS Bypass**: ElevenLabs endpoints restrict direct browser requests to protect API tokens. The local `/api/tts` endpoint acts as a proxy, appending the `xi-api-key` header on the server.
- **Streaming Response**: The server forwards the raw audio stream (`audio/mpeg`) back to the client as a readable binary stream, preventing high memory overhead on the node runtime.

---

## 3. Visual Rendering & R3F Performance

The 3D Scene visualizer in [Scene3D.tsx](file:///c:/Users/anand/Downloads/decodebot-main/Project1%20-%20DecodeBot/src/components/Scene3D.tsx) implements optimal rendering practices to maintain a smooth 60FPS:

### A. Framerate Coupling via `useFrame`

Rather than updating mesh transformations via React state hooks (which forces full component reconciliations and triggers garbage collection overhead), DecodeBot uses the `@react-three/fiber` `useFrame` hook:

- **Ref-based Mutations**: Rotations and scaling offsets are applied directly to raw Three.js objects via React refs (`group.current.rotation.y += dt * 0.22`), bypassing React's virtual DOM entirely.
- **Delta-Time Normalization**: Rotation increments are multiplied by the render delta-time (`dt`), guaranteeing uniform animation speeds across devices with varying refresh rates (e.g., 60Hz, 120Hz).

### B. Geometry & Material Memoization

To avoid rebuilding webGL buffers on component updates, geometry descriptors are instantiated statically or memoized via React's `useMemo` hook (e.g., the randomized coordinates array in the particle field generator).

---

## 4. State Management Lifecycle

1. **Booting Phase**: The system displays the `Landing` display, initializing the ambient Three.js scene.
2. **Mode Switching**: The `mode` state ("rule" | "ai") switches the visual meshes, changes input placeholders, and displays the contextual status pipeline.
3. **Synthesis Synchrony**: When a response is generated in AI mode:
   - The audio player plays the synthesized stream.
   - The `speaking` state becomes active, launching an animation frame tick loop.
   - The tick loop reads the player's active state, randomly perturbing `voiceIntensity` to simulate real-time mouth movement/waveform animation in the `AIOrb`.
