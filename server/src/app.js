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
 */
import 'dotenv/config'; // loads .env into process.env — must be first
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import authRouter from './routes/auth.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL } });

// Parse incoming JSON request bodies (required before any route reads req.body)
app.use(express.json());

// Allow the Vite dev server (CLIENT_URL) to call the API without CORS errors
app.use(cors({ origin: process.env.CLIENT_URL }));

app.use('/api/auth', authRouter);

// Error handler must be registered after all routes
app.use(errorHandler);

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

export { app, httpServer, io };
