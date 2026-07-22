import express from 'express';
import cors from 'cors';

import { config } from './config/env.js';
import {
  connectToDatabase,
  disconnectFromDatabase,
  getDatabaseStatus,
} from './config/database.js';
import authRoutes from './routes/auth.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import ragRoutes from './routes/rag.routes.js';
import { attachSession } from './middleware/session.middleware.js';

const app = express();
let server = null;
let shuttingDown = false;
let keepAliveInterval = null;

app.use(
  cors({
    origin: config.dashboard.frontendUrl,
    credentials: true,
  })
);

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(attachSession);

app.use((req, res, next) => {
  console.log(`\n➡️ ${req.method} ${req.url}`);
  next();
});

/**
 * Health Check
 */
app.get('/health', (req, res) => {
  console.log('✅ Health check endpoint hit');

  return res.status(200).json({
    success: true,
    message: 'GitSense AI server is running',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: getDatabaseStatus(),
  });
});

/**
 * Webhook Routes
 */
app.use('/api/webhooks', webhookRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', dashboardRoutes);

/**
 * 404 Route
 */
app.use((req, res) => {
  console.log(`❌ Route Not Found: ${req.method} ${req.url}`);

  return res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

/**
 * Global Error Handler
 */
app.use((err, req, res, next) => {
  console.error('\n❌ GLOBAL SERVER ERROR');
  console.error(err);

  const status = err.status || (err.code === 'GITHUB_OAUTH_NOT_CONFIGURED' ? 503 : 500);

  return res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal Server Error' : err.message,
    code: err.code || 'INTERNAL_SERVER_ERROR',
  });
});

async function startServer() {
  try {
    if (config.mongo.uri) {
      await connectToDatabase();
    } else if (config.dashboard.demoMode) {
      console.warn(
        'MongoDB is not configured. Starting GitSense AI in dashboard demo mode.'
      );
    } else {
      await connectToDatabase();
    }

    server = app.listen(config.port, () => {
      console.log(
        `\n🚀 GitSense AI Server running on port ${config.port}`
      );

      console.log(
        `🌐 Health Check: http://localhost:${config.port}/health`
      );
    });
  } catch (error) {
    console.error('Unable to start GitSense AI because MongoDB startup failed.');
    console.error(error);
    process.exit(1);
  }
}

startServer();

async function shutdown(signal) {
  if (shuttingDown) return;

  shuttingDown = true;
  console.log(`Received ${signal}. Shutting down GitSense AI...`);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close(error => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    await disconnectFromDatabase();
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
    }
    console.log('GitSense AI shutdown complete.');
    process.exit(0);
  } catch (error) {
    console.error('GitSense AI shutdown failed.');
    console.error(error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

/**
 * Prevent process exit during development
 */
keepAliveInterval = setInterval(() => { }, 1000 * 60 * 60);
