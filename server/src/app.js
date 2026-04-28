/**
 * Express + Socket.io Server Entry Point (ADR-001)
 *
 * Why do we need THREE objects (app, httpServer, io)?
 *
 *   Express (app):
 *     Handles all HTTP requests: REST API routes, middleware, error handling.
 *     On its own, Express knows nothing about WebSockets.
 *
 *   Node http.Server (httpServer):
 *     The raw HTTP server that wraps Express. Socket.io needs access to this
 *     raw server to "upgrade" incoming HTTP connections to WebSocket connections.
 *     createServer(app) makes Express the request handler for the HTTP server.
 *
 *   Socket.io Server (io):
 *     Attaches to the httpServer and intercepts upgrade requests (the WebSocket
 *     handshake). Once upgraded, Socket.io manages the persistent connection.
 *
 *   Listening once:
 *     Call httpServer.listen(PORT) — NOT app.listen() — because we need both
 *     the HTTP (Express) and WebSocket (Socket.io) traffic on the same port.
 *
 * CORS configuration:
 *   The Socket.io Server's `cors` option must match the client origin. During
 *   dev this is http://localhost:5173 (set in .env as CLIENT_URL). In
 *   production replace this with the deployed client URL.
 *
 * What still needs to be wired up in this file:
 *   1. express.json()         — parse JSON request bodies
 *   2. cors middleware        — allow the client to call the API (REST)
 *   3. Route registration:
 *        app.use('/api/auth',     authRouter)
 *        app.use('/api/rooms',    roomsRouter)
 *        app.use('/api/rooms',    messagesRouter)
 *   4. Error handler (must be last):
 *        app.use(errorHandler)
 *   5. Socket initialization:
 *        initSocket(io)
 *   6. Server listen:
 *        httpServer.listen(process.env.PORT, () => console.log(`Listening on ${PORT}`))
 */
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL } });

export { app, httpServer, io };
