require('dotenv').config();
const fastify = require('fastify')({
  logger: process.env.NODE_ENV === 'development' ? {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  } : {
    level: process.env.LOG_LEVEL || 'info'
  }
});

const mongoose = require('mongoose');
const path = require('path');

// Database connection
const connectDB = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/companies');
const userRoutes = require('./routes/users');
const keyRoutes = require('./routes/wallet');
const customerRoutes = require('./routes/customers');
const warrantyRoutes = require('./routes/warranty-plans');
const claimRoutes = require('./routes/claims');
const dashboardRoutes = require('./routes/dashboard');

// Global error handler
const { errorHandler } = require('./middleware/errorHandler');

// Start server
const start = async () => {
  try {
    // Connect to database
    await connectDB();

    // Register plugins
    await fastify.register(require('@fastify/helmet'), {
      contentSecurityPolicy: false
    });

    await fastify.register(require('@fastify/cors'), {
      origin: true // Allow all origins for development
    });

    await fastify.register(require('@fastify/rate-limit'), {
      max: 100,
      timeWindow: '1 minute'
    });

    await fastify.register(require('@fastify/multipart'), {
      limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
      }
    });

    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, 'uploads');
    const fs = require('fs');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    await fastify.register(require('@fastify/static'), {
      root: uploadsDir,
      prefix: '/uploads/'
    });

    // Swagger documentation
    await fastify.register(require('@fastify/swagger'), {
      swagger: {
        info: {
          title: 'Extended Warranty Management API',
          description: 'API for managing extended warranties with hierarchical user structure',
          version: '1.0.0'
        },
        host: 'localhost:3000',
        schemes: ['http', 'https'],
        consumes: ['application/json'],
        produces: ['application/json'],
        securityDefinitions: {
          Bearer: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header',
            description: 'Enter Bearer [token]'
          }
        }
      }
    });

    await fastify.register(require('@fastify/swagger-ui'), {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false
      }
    });

    // Register error handler
    fastify.setErrorHandler(errorHandler);

    // Health check route
    fastify.get('/health', async (request, reply) => {
      const dbState = mongoose.connection.readyState;
      const dbStatus = dbState === 1 ? 'connected' : 
                      dbState === 0 ? 'disconnected' : 
                      dbState === 2 ? 'connecting' : 'disconnecting';
      
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
      };

      // If database is not connected, add helpful information
      if (dbState !== 1) {
        health.message = 'API is running but database is not connected';
        health.documentation = 'http://localhost:3000/docs';
        health.setup_guide = 'Check QUICK_START.md for MongoDB installation';
      }
      
      return health;
    });

    // Register routes
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.register(companyRoutes, { prefix: '/api/companies' });
    await fastify.register(userRoutes, { prefix: '/api/users' });
    await fastify.register(keyRoutes, { prefix: '/api/wallet' });
    await fastify.register(customerRoutes, { prefix: '/api/customers' });
    await fastify.register(warrantyRoutes, { prefix: '/api/warranty-plans' });
    await fastify.register(claimRoutes, { prefix: '/api/claims' });
    await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });

    // Start the server
    const PORT = process.env.PORT || 3000;
    const HOST = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port: PORT, host: HOST });
    
    console.log(`
🚀 Server is running on http://${HOST}:${PORT}
📚 API Documentation: http://${HOST}:${PORT}/docs
🏥 Health Check: http://${HOST}:${PORT}/health
    `);

  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await fastify.close();
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await fastify.close();
  await mongoose.connection.close();
  process.exit(0);
});

start();