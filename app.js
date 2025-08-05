require("dotenv").config();
const fastify = require("fastify")({
  logger:
    process.env.NODE_ENV === "development"
      ? {
          level: process.env.LOG_LEVEL || "info",
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
            },
          },
        }
      : {
          level: process.env.LOG_LEVEL || "info",
        },
});

const mongoose = require("mongoose");
const path = require("path");
const axios = require('axios')
const crypto = require('crypto')

// Database connection
const connectDB = require("./config/database");

// Import routes
const authRoutes = require("./routes/auth");
const companyRoutes = require("./routes/companies");
const userRoutes = require("./routes/users");
const keyRoutes = require("./routes/wallet");
const customerRoutes = require("./routes/customers");
const warrantyRoutes = require("./routes/warranty-plans");
const claimRoutes = require("./routes/claims");
const dashboardRoutes = require("./routes/dashboard");
const brandRoutes = require("./routes/brands");
const categoriesRoutes = require("./routes/categories");


// Global error handler
const { errorHandler } = require("./middleware/errorHandler");

const start = async () => {
  try {
    // Connect to database
    await connectDB();

    // Register plugins
    await fastify.register(require("@fastify/helmet"), {
      contentSecurityPolicy: false,
    });

    await fastify.register(require("@fastify/cors"), {
      origin: true, // You can also restrict to ngrok URL here
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    });

    // Only add rate limiting in non-serverless environments
    if (!process.env.VERCEL && !process.env.LAMBDA_TASK_ROOT) {
      await fastify.register(require("@fastify/rate-limit"), {
        max: 100,
        timeWindow: "1 minute",
      });

      await fastify.register(require("@fastify/multipart"), {
        limits: {
          fileSize: 10 * 1024 * 1024, // 10MB
        },
      });

      // Ensure uploads directory exists
      const uploadsDir = path.join(__dirname, "uploads");
      const fs = require("fs");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      await fastify.register(require("@fastify/static"), {
        root: path.join(process.cwd(), "public"),
        prefix: "/public/",
      });
    }
    // Swagger documentation
    await fastify.register(require("@fastify/swagger"), {
      swagger: {
        info: {
          title: "E-Warranty API",
          version: "1.0.0",
          description: "API for E-Warranty Management System",
        },
        host:
          process.env.VERCEL || process.env.LAMBDA_TASK_ROOT
            ? "ewarranty.vercel.app"
            : `localhost:${process.env.PORT || 3000}`,
        schemes:
          process.env.VERCEL || process.env.LAMBDA_TASK_ROOT
            ? ["https"]
            : ["http"],
        consumes: ["application/json"],
        produces: ["application/json"],
        securityDefinitions: {
          Bearer: {
            type: "apiKey",
            name: "Authorization",
            in: "header",
            description: "Enter: Bearer {token}",
          },
        },
      },
    });

    await fastify.register(require("@fastify/swagger-ui"), {
      routePrefix: "/docs",
      uiConfig: {
        docExpansion: "list",
        deepLinking: false,
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
      // Remove the hardcoded URL - let Swagger UI auto-discover
      exposeRoute: true,
    });
    // Register error handler
    fastify.setErrorHandler(errorHandler);

  const { WebhookLog, TransferLog } = require("./schemas");


    fastify.post('/webhook/razorpay', async (request, reply) => {
    const secret = 'your_webhook_secret';

    const signature = request.headers['x-razorpay-signature'];
    const body = JSON.stringify(request.body);

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      fastify.log.warn('Invalid webhook signature');
      return reply.code(400).send({ status: 'invalid signature' });
    }

    const event = request.body.event;
    const payload = request.body.payload;

    if (event === 'subscription.charged') {
      const payment = payload.payment.entity;
      const subscription = payload.subscription.entity;

      const paymentId = payment.id;
      const subscriptionId = subscription.id;
      const amount = payment.amount; // in paise
      const method = payment.method;
      const notes = subscription.notes;
      const retailerAccountId = notes.retailer_account_id;

      await WebhookLog.create({
        event,
        paymentId,
        subscriptionId,
        amount,
        method,
        notes,
        fullPayload: request.body,
      });

      const fee = 3000;
      const netAmount = amount - fee;

      fastify.log.info(`Payment ${paymentId} processed. Gross: ${amount}, Fee: ${fee}, Net: ${netAmount}`);

      await transferToRetailer(paymentId, retailerAccountId, netAmount);
    }

    return reply.code(200).send({ status: 'ok' });
  });


    async function transferToRetailer(paymentId, accountId, amount) {
      try{

      const response = await axios.post(
        `https://api.razorpay.com/v1/payments/${paymentId}/transfers`,
        {
          "transfers": [
            {
              "account": accountId,
              "amount": amount,
              "currency": "INR",
              "notes": {
                  "name": "Mohammad Fawwaz Khatri",
                  "accountId": accountId
              },
              "linked_account_notes": [
                  "accountId"
              ],
              "on_hold": false
            }
          ]
        },
        {
          auth: {
            username: process.env.razorpayUsername,
            password: process.env.razorpayPassword,
          },
        }
      )
        await TransferLog.create({
          paymentId,
          accountId,
          amount,
          response: response.data,
          success: true
        });
    }catch (error) {
      // if it’s a Razorpay error, it will have a response.data.error
      console.error('Transfer error payload:', error.response?.data);
      throw error;
    }
}

    // Health check route
    fastify.get("/health", async (request, reply) => {
      const dbState = mongoose.connection.readyState;
      const dbStatus =
        dbState === 1
          ? "connected"
          : dbState === 0
          ? "disconnected"
          : dbState === 2
          ? "connecting"
          : "disconnecting";

      const health = {
        status: "ok",
        timestamp: new Date().toISOString(),
        database: dbStatus,
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || "development",
        version: "1.0.0",
        platform:
          process.env.VERCEL || process.env.LAMBDA_TASK_ROOT
            ? "vercel"
            : "local",
      };

      if (dbState !== 1) {
        health.message = "API is running but database is not connected";
        if (!process.env.VERCEL && !process.env.LAMBDA_TASK_ROOT) {
          health.documentation = `${request.protocol}://${request.hostname}:${
            process.env.PORT || 3000
          }/docs`;
          health.setup_guide = "Check QUICK_START.md for MongoDB installation";
        }
      }

      return health;
    });

    // Register routes
    await fastify.register(authRoutes, { prefix: "/api/auth" });
    await fastify.register(companyRoutes, { prefix: "/api/companies" });
    await fastify.register(userRoutes, { prefix: "/api/users" });
    await fastify.register(keyRoutes, { prefix: "/api/wallet" });
    await fastify.register(customerRoutes, { prefix: "/api/customers" });
    await fastify.register(warrantyRoutes, { prefix: "/api/warranty-plans" });
    await fastify.register(claimRoutes, { prefix: "/api/claims" });
    await fastify.register(dashboardRoutes, { prefix: "/api/dashboard" });
    await fastify.register(brandRoutes, { prefix: "/api/brands" });
    await fastify.register(categoriesRoutes, { prefix: "/api/categories" });

    // For Vercel serverless deployment
    if (process.env.VERCEL || process.env.LAMBDA_TASK_ROOT) {
      return fastify;
    }

    // For local development - start the server
    const PORT = process.env.PORT || 3000;
    const HOST = process.env.HOST || "0.0.0.0";

    await fastify.listen({ port: PORT, host: HOST });

    console.log(`
🚀 Server is running on http://${HOST}:${PORT}
📚 API Documentation: http://${HOST}:${PORT}/docs
🏥 Health Check: http://${HOST}:${PORT}/health
🌐 CORS: Enabled for all origins
    `);

    return fastify;
  } catch (error) {
    fastify.log.error(error);
    if (process.env.VERCEL || process.env.LAMBDA_TASK_ROOT) {
      throw error; // Let the serverless handler catch this
    } else {
      process.exit(1);
    }
  }
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
  if (!process.env.VERCEL && !process.env.LAMBDA_TASK_ROOT) {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  if (!process.env.VERCEL && !process.env.LAMBDA_TASK_ROOT) {
    process.exit(1);
  }
});

// Graceful shutdown (only for local development)
if (!process.env.VERCEL && !process.env.LAMBDA_TASK_ROOT) {
  process.on("SIGTERM", async () => {
    console.log("SIGTERM received, shutting down gracefully");
    await fastify.close();
    await mongoose.connection.close();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("SIGINT received, shutting down gracefully");
    await fastify.close();
    await mongoose.connection.close();
    process.exit(0);
  });
}

let app;

// Initialize app once for serverless
const initApp = async () => {
  if (!app) {
    app = await start();
    await app.ready();
  }
  return app;
};

// Export for Vercel serverless
module.exports = async (req, res) => {
  try {
    // For Vercel deployment
    if (process.env.VERCEL || process.env.LAMBDA_TASK_ROOT) {
      const fastifyApp = await initApp();
      fastifyApp.server.emit("request", req, res);
    } else {
      // This shouldn't be reached in serverless, but just in case
      res.statusCode = 500;
      res.end("Serverless handler called in non-serverless environment");
    }
  } catch (error) {
    console.error("Serverless error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Internal Server Error",
        message: "Failed to initialize application",
      })
    );
  }
};

// Start server for local development
if (
  !process.env.VERCEL &&
  !process.env.LAMBDA_TASK_ROOT &&
  require.main === module
) {
  start();
}
