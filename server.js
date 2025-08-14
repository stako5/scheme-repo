import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import dotenv from 'dotenv';

import schemaRoutes from './routes/schemas.js';
import templateRoutes from './routes/templates.js';
import aiRoutes from './routes/ai.js';
import { initializeDatabase } from './database/init.js';
import { setupRateLimiting } from './middleware/rateLimiting.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: false
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 3000;

// Enhanced security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-eval'"], // Allow eval for Vite HMR in dev
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for development
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Requested-With', 'X-Content-Type-Options', 'X-Frame-Options', 'Cache-Control']
}));

app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false
    }
    return compression.filter(req, res)
  }
}));

app.use(morgan('combined'));
app.use(express.json({ 
  limit: '10mb',
  strict: true,
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 20
}));

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Rate limiting
setupRateLimiting(app);

// Serve static files from dist (Vite build output)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// API Routes (no authentication required)
app.use('/api/v1/schemas', schemaRoutes);
app.use('/api/v1/templates', templateRoutes);
app.use('/api/v1/ai', aiRoutes);

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Socket.IO connection handling (no authentication required)
io.on('connection', (socket) => {
  const clientId = socket.id;
  console.log(`Client ${clientId} connected`);

  // Join schema room for real-time collaboration
  socket.on('join_schema', (data) => {
    try {
      const { schemaId } = data;
      
      // Basic validation
      if (!schemaId || typeof schemaId !== 'string') {
        socket.emit('error', { message: 'Invalid schema ID' });
        return;
      }
      
      socket.join(`schema_${schemaId}`);
      socket.to(`schema_${schemaId}`).emit('user_joined', {
        clientId,
        timestamp: new Date().toISOString()
      });
      
      console.log(`Client ${clientId} joined schema ${schemaId}`);
    } catch (error) {
      console.error('Error joining schema:', error);
      socket.emit('error', { message: 'Failed to join schema' });
    }
  });

  // Handle schema updates
  socket.on('update_schema', (data) => {
    try {
      const { schemaId, changes } = data;
      
      // Basic validation
      if (!schemaId || !changes) {
        socket.emit('error', { message: 'Invalid update data' });
        return;
      }
      
      // Sanitize changes data
      const sanitizedChanges = {
        type: String(changes.type || '').slice(0, 50),
        ...changes
      };
      
      socket.to(`schema_${schemaId}`).emit('schema_updated', {
        clientId,
        changes: sanitizedChanges,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating schema:', error);
      socket.emit('error', { message: 'Failed to update schema' });
    }
  });

  // Handle cursor movement
  socket.on('cursor_moved', (data) => {
    try {
      const { schemaId, position } = data;
      
      // Validate position data
      if (!schemaId || !position || typeof position.x !== 'number' || typeof position.y !== 'number') {
        return; // Silently ignore invalid cursor data
      }
      
      // Bound position to reasonable limits
      const boundedPosition = {
        x: Math.max(0, Math.min(5000, position.x)),
        y: Math.max(0, Math.min(5000, position.y))
      };
      
      socket.to(`schema_${schemaId}`).emit('cursor_moved', {
        clientId,
        position: boundedPosition,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error handling cursor movement:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`Client ${clientId} disconnected: ${reason}`);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error(`Socket error for client ${clientId}:`, error);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Internal server error'
    },
    ...(isDevelopment && { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    res.status(404).json({
      success: false,
      error: {
        code: 'ENDPOINT_NOT_FOUND',
        message: 'API endpoint not found'
      },
      timestamp: new Date().toISOString()
    });
  } else {
    // In production, serve the React app for all non-API routes
    if (process.env.NODE_ENV === 'production') {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    } else {
      // In development, let Vite handle the routing
      res.status(404).send('Development server - use Vite dev server');
    }
  }
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
      console.log(`🌐 API Documentation: http://localhost:${PORT}/api/v1/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export { app, io };