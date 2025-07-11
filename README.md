# Extended Warranty Management System

A comprehensive Node.js application built with Fastify and Mongoose for managing extended warranties with hierarchical user management and multi-tenant architecture.

## 🚀 Features

### Core Features
- **Multi-tenant Architecture**: Support for multiple white-label companies
- **Hierarchical User Management**: Complex user hierarchy with permission-based access
- **Extended Warranty Management**: Complete warranty lifecycle management
- **Key Distribution System**: Controlled key allocation and usage for warranty creation
- **Claims Management**: Full claims processing workflow
- **Audit Logging**: Comprehensive audit trail for all operations

### User Types & Hierarchy
- **TSM** (Territory Sales Manager)
- **ASM** (Area Sales Manager)  
- **Sales Executive**
- **Super Distributor**
- **Distributor**
- **National Distributor**
- **Mini Distributor**
- **Retailer**

## 📁 Project Structure

```
├── app.js                      # Main application entry point
├── package.json               # Dependencies and scripts
├── .env.example               # Environment variables template
├── config/
│   └── database.js            # MongoDB connection configuration
├── middleware/
│   ├── auth.js               # Authentication & authorization middleware
│   └── errorHandler.js       # Global error handling
├── routes/
│   ├── auth.js               # Authentication routes
│   ├── companies.js          # Company management routes
│   ├── users.js              # User management routes
│   ├── keys.js               # Key management routes
│   ├── customers.js          # Customer/warranty routes
│   ├── warranty-plans.js     # Warranty plan routes
│   ├── claims.js             # Claims management routes
│   └── dashboard.js          # Dashboard statistics routes
├── utils/
│   └── validation.js         # Input validation schemas
├── schemas.js                # Mongoose schemas/models
├── services.js               # Business logic services
└── controller.js             # Legacy controller (to be refactored)
```

## 🗄️ Database Schema Overview

### Core Entities

1. **Company** - White-label companies
2. **User** - All user types in the hierarchy
3. **UserHierarchy** - Tracks hierarchical relationships
4. **Customer** - Extended warranty customers
5. **WarrantyPlan** - Available warranty plans
6. **KeyManagement** - Key allocation and usage tracking
7. **Claim** - Warranty claims
8. **AuditLog** - System audit trail
9. **Settings** - Company-specific settings

## 🔧 Setup & Installation

### Prerequisites
- Node.js 16+ 
- MongoDB 4.4+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd extended-warranty-management
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB**
   ```bash
   # Local MongoDB
   mongod
   
   # Or using Docker
   docker run -d -p 27017:27017 --name warranty-mongo mongo:latest
   ```

5. **Start the application**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 🌐 API Documentation

Once the server is running, access the interactive API documentation at:
- **Swagger UI**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/health

### Authentication

All API endpoints (except auth) require a Bearer token:

```bash
Authorization: Bearer <your-jwt-token>
```

### Key API Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh-token` - Refresh access token
- `PUT /api/auth/change-password` - Change password

#### Companies
- `GET /api/companies` - List companies
- `POST /api/companies` - Create company
- `GET /api/companies/:id` - Get company details
- `PUT /api/companies/:id` - Update company

#### Users
- `GET /api/users` - List users (hierarchy-based)
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user
- `GET /api/users/:id/hierarchy` - Get user hierarchy

#### Key Management
- `POST /api/keys/allocate` - Allocate keys to user
- `GET /api/keys/history` - Get key transaction history

#### Customers
- `POST /api/customers` - Create customer warranty (retailers only)
- `GET /api/customers` - List accessible customers
- `GET /api/customers/:id` - Get customer details

## 🔐 Security Features

- **JWT Authentication** with refresh tokens
- **Role-based Access Control** (RBAC)
- **Hierarchical Permissions** 
- **Input Validation** using Joi
- **Rate Limiting**
- **CORS Protection**
- **Helmet Security Headers**
- **Password Hashing** with bcrypt

## 👥 User Hierarchy & Permissions

### Hierarchy Rules
- Users can only create users below their hierarchy level
- Users can only view/edit users in their hierarchy chain
- Retailers can only create customers, not other users
- Key allocation follows hierarchy permissions

### Key Management Flow
1. **Company** allocates keys to top-level users (TSM/ASM)
2. **Top-level users** distribute keys down the hierarchy
3. **Retailers** use keys to create customer warranties
4. **Key usage** is tracked and audited

## 🛠️ Development

### Code Structure
- **Routes**: Handle HTTP requests and responses
- **Services**: Business logic and data operations  
- **Middleware**: Authentication, validation, error handling
- **Schemas**: MongoDB models and validation
- **Utils**: Helper functions and utilities

### Adding New Features
1. Create/update Mongoose schemas in `schemas.js`
2. Add business logic to `services.js`
3. Create route handlers in `routes/`
4. Add validation schemas in `utils/validation.js`
5. Update API documentation

### Testing
```bash
npm test
```

## 📊 Monitoring & Logging

- **Winston** for structured logging
- **Audit logs** for all critical operations
- **Error tracking** with stack traces
- **Performance monitoring** ready

## 🚀 Deployment

### Environment Variables
Key environment variables for production:

```env
NODE_ENV=production
MONGODB_URI=mongodb://your-production-db
JWT_SECRET=your-super-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

### Docker Deployment
```bash
# Build image
docker build -t warranty-management .

# Run container
docker run -p 3000:3000 --env-file .env warranty-management
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the API documentation

---

**Built with ❤️ using Node.js, Fastify, and MongoDB**