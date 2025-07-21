# Multi-Tenant White-Label Warranty Management System

A comprehensive Node.js application built with Fastify and Mongoose for managing extended warranties with hierarchical user management, multi-tenant white-label architecture, and dynamic permission system for support employees.

## 🚀 Features

### Core Architecture
- **Multi-Tenant White-Label System**: Support for main company and unlimited white-label companies
- **Dynamic Support Employee Permissions**: Configurable permission sets for support staff
- **Strict Key Management Security**: Support employees cannot transfer, allocate, or revoke keys
- **Cross-Company Access Control**: Main company can manage all white-labels
- **Company Isolation**: White-label companies are isolated from each other
- **Comprehensive Audit Trail**: All actions tracked with proper attribution

### Company Types
- **Main Company**: Your primary company that creates and manages white-label companies
- **White-Label Companies**: Independent warranty providers with their own branding and hierarchy

### User Types & Hierarchy

#### Main Company Users
- **MAIN_OWNER**: Full system access, can create white-label companies
- **MAIN_EMPLOYEE**: Can work on behalf of white-label companies, manage cross-company operations
- **MAIN_SUPPORT_EMPLOYEE**: Dynamic permissions, can be assigned to white-label companies, **cannot handle keys**

#### White-Label Company Users
- **WHITELABEL_OWNER**: Full access within their company, can create other users
- **WHITELABEL_EMPLOYEE**: Standard employee access within their company
- **WHITELABEL_SUPPORT_EMPLOYEE**: Dynamic permissions within company only, **cannot handle keys**

#### Legacy Sales Hierarchy (Maintained for Compatibility)
- **TSM** (Territory Sales Manager)
- **ASM** (Area Sales Manager)  
- **Sales Executive**
- **Super Distributor**, **Distributor**, **National Distributor**, **Mini Distributor**
- **Retailer**

## 🔐 Support Employee Permission System

### Dynamic Permissions
Support employees have configurable permission sets instead of fixed roles:

- **Customer Management**: View, create, edit, delete customers
- **User Management**: View, create, edit, delete users in hierarchy
- **Company Data**: View company information, edit settings
- **Claims & Warranty**: View and process claims, manage warranty plans
- **Reports & Analytics**: View reports, export data
- **Cross-Company Access**: Main company support can access white-labels (if permitted)

### Key Operation Restrictions
**ALL support employees are strictly prohibited from:**
- ❌ Transferring keys between users
- ❌ Allocating keys to subordinates  
- ❌ Revoking keys from users
- ❌ Using keys directly (can create customers on behalf of retailers)

### Assignment System
Support employees must be assigned to specific resources:
- **Company Assignment**: Access to all users in a white-label company
- **User Assignment**: Access to specific users and their subordinates  
- **Hierarchy Assignment**: Access to users up to a certain hierarchy level

## 📁 Project Structure

```
├── app.js                             # Main application entry point
├── package.json                       # Dependencies and scripts
├── schemas.js                         # Enhanced Mongoose schemas with new user types
├── services.js                        # Business logic with support employee restrictions
├── NEW_SCHEMA_DOCUMENTATION.md        # Complete system architecture documentation
├── config/
│   └── database.js                    # MongoDB connection configuration
├── middleware/
│   ├── auth.js                       # Enhanced authentication with permission system
│   └── errorHandler.js               # Global error handling
├── routes/
│   ├── auth.js                       # Authentication routes
│   ├── companies.js                  # Main + white-label company management
│   ├── users.js                      # User management with new types
│   ├── wallet.js                       # Key management (restricted for support)
│   ├── customers.js                  # Customer/warranty routes
│   ├── warranty-plans.js             # Warranty plan routes
│   ├── claims.js                     # Claims management routes
│   └── dashboard.js                  # Dashboard statistics routes
├── utils/
│   └── validation.js                 # Input validation schemas
└── scripts/
    ├── setup-main-company.js         # Initialize main company
    ├── create-whitelabel.js          # Create white-label companies
    └── manage-permissions.js         # Support employee permission management
```

## 🗄️ Database Schema Overview

### Core Entities

1. **Company** - Main company and white-label companies with type distinction
2. **User** - All user types with enhanced permission system
3. **UserHierarchy** - Cross-company access and hierarchy relationships
4. **SupportPermission** - Dynamic permission sets for support employees
5. **SupportAssignment** - Tracks which support employees are assigned where
6. **Customer** - Extended warranty customers
7. **WarrantyPlan** - Available warranty plans
8. **WalletManagement** - Wallet Amount allocation with support employee restrictions
9. **Claim** - Warranty claims
10. **AuditLog** - Enhanced audit trail with on-behalf-of tracking
11. **Settings** - Company-specific settings

### New Collections for Multi-Tenant Support

#### SupportPermission
Defines what support employees can do:
```javascript
{
  permissionId: String,
  companyId: String,
  permissions: {
    canViewCustomers: Boolean,
    canCreateCustomers: Boolean,
    canEditCustomers: Boolean,
    // ... other permissions
    canTransferKeys: false,      // Always false, immutable
    canAllocateKeys: false,      // Always false, immutable  
    canRevokeKeys: false         // Always false, immutable
  }
}
```

#### SupportAssignment
Tracks support employee assignments:
```javascript
{
  assignmentId: String,
  supportEmployeeId: String,
  assignmentType: 'COMPANY' | 'USER' | 'HIERARCHY',
  targetCompanyId: String,
  accessScope: 'FULL' | 'LIMITED' | 'READ_ONLY'
}
```

## 🔧 Setup & Installation

### Prerequisites
- Node.js 16+ 
- MongoDB 4.4+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd multi-tenant-warranty-management
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

4. **Initialize Main Company**
   ```bash
   npm run setup-main-company
   ```

5. **Start MongoDB**
   ```bash
   # Local MongoDB
   mongod
   
   # Or using Docker
   docker run -d -p 27017:27017 --name warranty-mongo mongo:latest
   ```

6. **Start the application**
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

#### Company Management
- `POST /api/companies` - Create white-label company (Main company only)
- `GET /api/companies` - List accessible companies
- `GET /api/companies/:id` - Get company details
- `PUT /api/companies/:id` - Update company

#### Enhanced User Management
- `POST /api/auth/register` - Register new user (with new user types)
- `POST /api/auth/login` - User login
- `GET /api/users` - List users (hierarchy and assignment-based)
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user
- `GET /api/users/:id/hierarchy` - Get user hierarchy

#### Support Employee Management
- `POST /api/permissions` - Create permission set (Owners/Employees only)
- `POST /api/permissions/assign` - Assign permissions to support employee
- `POST /api/assignments` - Create support employee assignment
- `GET /api/assignments/user/:id` - Get user assignments

#### Key Management (Support Employee Restricted)
- `POST /api/keys/allocate` - Allocate keys (NOT allowed for support employees)
- `POST /api/keys/revoke` - Revoke keys (NOT allowed for support employees)
- `GET /api/keys/history` - Get key transaction history (view-only for support)

#### Customer Management
- `POST /api/customers` - Create customer warranty (support can create on behalf)
- `GET /api/customers` - List accessible customers (assignment-based for support)
- `GET /api/customers/:id` - Get customer details
- `PUT /api/customers/:id` - Update customer (if permitted)

## 🔐 Security Features

### Multi-Layer Key Operation Protection
- **Schema Level**: Support employees cannot have key permissions (immutable)
- **Middleware Level**: Key operations blocked for support employees
- **Service Level**: Business logic prevents support employee key operations
- **API Level**: Endpoints check user type before allowing key operations

### Enhanced Access Control
- **Company Isolation**: White-labels cannot access each other's data
- **Assignment-Based**: Support employees only access assigned resources
- **Hierarchy-Based**: Users can only access their subordinates
- **Cross-Company**: Main company can access all white-labels

### Security Features
- **JWT Authentication** with refresh tokens
- **Dynamic Permission System** for support employees
- **Input Validation** using Joi
- **Rate Limiting**
- **CORS Protection**
- **Helmet Security Headers**
- **Password Hashing** with bcrypt
- **Comprehensive Audit Trail** with attribution tracking

## 👥 Multi-Tenant Architecture

### Main Company Structure
```
MAIN_OWNER
├── MAIN_EMPLOYEE
│   ├── White-label Company A (full access)
│   ├── White-label Company B (full access)
│   └── MAIN_SUPPORT_EMPLOYEE (assigned to specific white-labels)
└── MAIN_SUPPORT_EMPLOYEE (assigned scope)
```

### White-Label Company Structure
```
WHITELABEL_OWNER
├── WHITELABEL_EMPLOYEE
│   ├── TSM/ASM/SALES_EXECUTIVE
│   │   └── Distributors/Retailers
│   └── WHITELABEL_SUPPORT_EMPLOYEE (company scope only)
└── WHITELABEL_SUPPORT_EMPLOYEE (company scope only)
```

### Permission Flow
1. **Main Company** creates white-label companies
2. **White-label Owners** manage their company users
3. **Support Employees** get assigned to specific companies/users
4. **Key Operations** restricted to owners and employees only
5. **Audit Trail** tracks all actions with proper attribution

## 🛠️ Development

### Adding Support for New User Types
1. Update user type enum in `schemas.js`
2. Add permission mappings in `middleware/auth.js`
3. Update validation in `services.js`
4. Add tests for new user type

### Creating New Permission Types
1. Add permission field to `SupportPermission` schema
2. Update middleware permission checking
3. Add to effective permissions in user schema
4. Update API documentation

### Cross-Company Feature Development
1. Consider company isolation requirements
2. Update hierarchy service for cross-company access
3. Add proper assignment validation
4. Test with main company and white-label scenarios

## 🚀 Deployment

### Environment Variables
Key environment variables for production:

```env
NODE_ENV=production
MONGODB_URI=mongodb://your-production-db
JWT_SECRET=your-super-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Main company setup
MAIN_COMPANY_NAME=Your Company Name
MAIN_COMPANY_EMAIL=admin@yourcompany.com
MAIN_OWNER_EMAIL=owner@yourcompany.com
```

### Docker Deployment
```bash
# Build image
docker build -t multi-tenant-warranty .

# Run container
docker run -p 3000:3000 --env-file .env multi-tenant-warranty
```

## 🎯 Usage Examples

### Creating a White-Label Company
```javascript
// Main company owner creates white-label
await CompanyService.createWhitelabelCompany({
  name: "TechCare Warranties",
  email: "admin@techcare.com",
  phone: "+1-555-0123"
}, mainOwnerUserId);
```

### Setting Up Support Employee
```javascript
// Create permission set
const permissionSet = await SupportPermissionService.createPermissionSet({
  permissionName: "Customer Support Level 1",
  permissions: {
    canViewCustomers: true,
    canCreateCustomers: true,
    canEditCustomers: false,
    canTransferKeys: false // Always false
  }
}, ownerId);

// Assign to support employee
await SupportPermissionService.assignPermissionToUser(
  supportEmployeeId, 
  permissionSet.permissionId, 
  ownerId
);

// Assign to white-label company
await SupportAssignmentService.createAssignment({
  supportEmployeeId,
  assignmentType: "COMPANY",
  targetCompanyId: whitelabelCompanyId
}, ownerId);
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow new architecture guidelines
4. Consider multi-tenant implications
5. Test with different user types
6. Submit a pull request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

## 📚 Documentation

- **[NEW_SCHEMA_DOCUMENTATION.md](./NEW_SCHEMA_DOCUMENTATION.md)** - Complete architecture documentation
- **[WHITELABEL_SETUP.md](./WHITELABEL_SETUP.md)** - White-label setup guide
- **[QUICK_START.md](./QUICK_START.md)** - Quick start guide
- **API Documentation**: http://localhost:3000/docs

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Review the comprehensive [NEW_SCHEMA_DOCUMENTATION.md](./NEW_SCHEMA_DOCUMENTATION.md)
- Check the API documentation at http://localhost:3000/docs
- Create an issue in the repository
- Contact the development team

---

**Built with ❤️ using Node.js, Fastify, MongoDB, and a robust multi-tenant architecture**