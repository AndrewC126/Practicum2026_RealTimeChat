// Express app + Socket.io server entry point (ADR-001)
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL } });

export { app, httpServer, io };
