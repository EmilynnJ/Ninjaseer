import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'SoulSeer API is running' });
});

// Import routes
import readersRoutes from './routes/readers.routes.js';
import sessionsRoutes from './routes/sessions.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import streamsRoutes from './routes/streams.routes.js';
import adminRoutes from './routes/admin.routes.js';
import shopRoutes from './routes/shop.routes.js';
import communityRoutes from './routes/community.routes.js';

// API Routes
app.get('/api', (req, res) => {
  res.json({ 
    message: 'SoulSeer API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      readers: '/api/readers',
      sessions: '/api/sessions',
      payments: '/api/payments',
      shop: '/api/shop',
      streams: '/api/streams',
      messages: '/api/messages',
      admin: '/api/admin'
    }
  });
});

// Mount routes
app.use('/api/readers', readersRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/streams', streamsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/community', communityRoutes);

// WebRTC Signaling Server
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join reading room
  socket.on('join-reading', ({ roomId, userId, role }) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', { userId, role });
    console.log(`User ${userId} joined room ${roomId} as ${role}`);
  });

  // WebRTC signaling
  socket.on('offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('offer', offer);
  });

  socket.on('answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('answer', answer);
  });

  socket.on('ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice-candidate', candidate);
  });

  // Chat messages
  socket.on('chat-message', ({ roomId, message, userId, timestamp }) => {
    io.to(roomId).emit('chat-message', { message, userId, timestamp });
  });

  // Session control
  socket.on('end-session', ({ roomId }) => {
    io.to(roomId).emit('session-ended');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`🚀 SoulSeer API server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
});

export { app, io };