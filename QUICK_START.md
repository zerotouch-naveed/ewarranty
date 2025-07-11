# 🚀 Quick Start Guide - Multi-Tenant White-Label System

This guide will help you quickly set up and start using the new multi-tenant white-label warranty management system with support employee permissions.

## 🏗️ New Architecture Overview

The system now supports:
- **Main Company**: Your primary company that manages white-label companies
- **White-Label Companies**: Independent companies with their own branding and users
- **Support Employees**: Staff with dynamic, configurable permissions (cannot handle keys)
- **Cross-Company Access**: Main company can work across all white-labels

## 📋 Prerequisites

### Install MongoDB

#### **Option 1: Using Docker (Recommended)**
```bash
# Start MongoDB with Docker
docker run -d -p 27017:27017 --name warranty-mongo mongo:6.0

# Or use the provided docker-compose
docker-compose up -d mongo
```

#### **Option 2: Install MongoDB Locally**

**Ubuntu/Debian:**
```bash
# Import MongoDB public GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Create list file
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Update package database
sudo apt-get update

# Install MongoDB
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

**macOS:**
```bash
# Install with Homebrew
brew tap mongodb/brew
brew install mongodb-community@6.0

# Start MongoDB
brew services start mongodb/brew/mongodb-community@6.0
```

**Windows:**
Download from [MongoDB Official Site](https://www.mongodb.com/try/download/community)

## 🚀 Start the New Multi-Tenant System

### Method 1: Complete Setup (Recommended)
```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Set up your environment variables
# Edit .env with your MongoDB URL and other settings

# Initialize the main company (one-time setup)
npm run setup-main-company

# Start development server
npm run dev
```

### Method 2: Docker Compose (Everything included)
```bash
# Start all services (app + MongoDB + Mongo Express)
docker-compose up

# Or run in background
docker-compose up -d
```

## � Initial System Setup

### Step 1: Create Main Company
The main company setup script will prompt you for:

```bash
npm run setup-main-company
```

**You'll be asked for:**
- Main company name
- Main company email
- Main owner name
- Main owner email
- Main owner password
- Initial key allocation (default: 10,000)

**Example Setup:**
```
🏢 Setting up Main Company
═══════════════════════════

Main Company Name: TechWarranty Solutions
Main Company Email: admin@techwarranty.com

👤 Main Owner Details
Main Owner Name: John Admin
Main Owner Email: john@techwarranty.com
Main Owner Password: [securely generated]

🔑 Initial key allocation: 10000

✅ Main company created successfully!
🔑 Main owner credentials:
   Email: john@techwarranty.com
   Password: [your-password]
   User Type: MAIN_OWNER
```

### Step 2: Create Your First White-Label Company
```bash
npm run create-whitelabel
```

**Interactive prompts for:**
- White-label company details
- Owner information
- Initial key allocation
- Support employee setup (optional)

## �🌐 Access the Application

Once running, you can access:

- **API Server**: http://localhost:3000
- **API Documentation**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/health
- **Mongo Express** (if using Docker): http://localhost:8081

## 🔧 Verify Installation

### Test the Health Endpoint
```bash
curl http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "connected",
  "uptime": 123.456,
  "companies": {
    "total": 1,
    "main": 1,
    "whitelabel": 0
  }
}
```

### Test Main Owner Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@techwarranty.com",
    "password": "your-main-owner-password"
  }'
```

## 👥 User Types Quick Reference

### Main Company Users
- **MAIN_OWNER**: Full system access, can create white-labels
- **MAIN_EMPLOYEE**: Can work across white-labels, manage operations
- **MAIN_SUPPORT_EMPLOYEE**: Dynamic permissions, assigned to white-labels, **cannot handle keys**

### White-Label Company Users  
- **WHITELABEL_OWNER**: Full access within their company
- **WHITELABEL_EMPLOYEE**: Standard employee within their company
- **WHITELABEL_SUPPORT_EMPLOYEE**: Dynamic permissions within company, **cannot handle keys**

### Legacy Sales Hierarchy
- **TSM**, **ASM**, **SALES_EXECUTIVE**
- **SUPER_DISTRIBUTOR**, **DISTRIBUTOR**, **NATIONAL_DISTRIBUTOR**, **MINI_DISTRIBUTOR**
- **RETAILER**

## 🔐 Support Employee Setup Example

### Create a Support Permission Set
```bash
curl -X POST http://localhost:3000/api/permissions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permissionName": "Customer Support Level 1",
    "description": "Basic customer support permissions",
    "permissions": {
      "canViewCustomers": true,
      "canCreateCustomers": true,
      "canEditCustomers": false,
      "canViewUsers": true,
      "canViewReports": true,
      "canTransferKeys": false,
      "canAllocateKeys": false,
      "canRevokeKeys": false
    }
  }'
```

### Register a Support Employee
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Support Agent",
    "email": "support@techwarranty.com",
    "phone": "+1-555-0199",
    "password": "support123",
    "userType": "MAIN_SUPPORT_EMPLOYEE",
    "companyId": "YOUR_COMPANY_ID"
  }'
```

### Assign Permissions and Company Access
```bash
# Assign permission set
curl -X POST http://localhost:3000/api/permissions/assign \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "SUPPORT_USER_ID",
    "permissionSetId": "PERMISSION_SET_ID"
  }'

# Assign to white-label company
curl -X POST http://localhost:3000/api/assignments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supportEmployeeId": "SUPPORT_USER_ID",
    "assignmentType": "COMPANY",
    "targetCompanyId": "WHITELABEL_COMPANY_ID",
    "accessScope": "LIMITED"
  }'
```

## � Key Management Example

### Allocate Keys (Only Non-Support Users)
```bash
curl -X POST http://localhost:3000/api/keys/allocate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "WHITELABEL_OWNER_ID",
    "keyCount": 1000
  }'
```

**Note:** Support employees will receive a 403 error if they try this operation.

### Create Customer on Behalf (Support Employees Can Do This)
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Authorization: Bearer SUPPORT_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "retailerId": "RETAILER_ID",
    "customerDetails": {
      "name": "John Customer",
      "email": "john@customer.com",
      "mobile": "+1-555-0123"
    },
    "productDetails": {
      "modelName": "iPhone 14",
      "imei1": "123456789012345",
      "brand": "Apple"
    },
    "invoiceDetails": {
      "invoiceNumber": "INV001",
      "invoiceAmount": 1200,
      "invoiceImage": "http://example.com/invoice.jpg",
      "invoiceDate": "2024-01-01"
    }
  }'
```

## �🐛 Troubleshooting

### Common Issues:

#### 1. **MongoDB Connection Error**
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution:** Ensure MongoDB is running
```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Or start MongoDB
sudo systemctl start mongod
```

#### 2. **Port Already in Use**
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution:** Change port in .env file
```env
PORT=3001
```

#### 3. **"Main company already exists"**
**Solution:** This is normal if you've already run setup. Use existing credentials or reset database.

#### 4. **Support Employee Key Operation Denied**
```
{
  "success": false,
  "error": "Support employees cannot perform key operations."
}
```
**This is expected behavior** - Support employees are restricted from key operations for security.

#### 5. **"No permission to access this resource"**
**Solution:** Ensure support employee is assigned to the target company/user.

## 📝 Environment Configuration

Create `.env` file with:
```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/multi_tenant_warranty
JWT_SECRET=your-very-secure-secret-key-change-this-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-also-change-this
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Main company setup (optional, will be prompted if not set)
MAIN_COMPANY_NAME=Your Company Name
MAIN_COMPANY_EMAIL=admin@yourcompany.com
MAIN_OWNER_NAME=Your Name
MAIN_OWNER_EMAIL=you@yourcompany.com
```

## 🎯 Next Steps

1. **Complete Setup**: Run `npm run setup-main-company` 
2. **Create White-Labels**: Use `npm run create-whitelabel` or API
3. **Set Up Support Staff**: Create support employees with proper permissions
4. **Test Permissions**: Verify support employees cannot perform key operations
5. **Create User Hierarchies**: Set up TSM → ASM → Sales → Distributors → Retailers
6. **Allocate Keys**: Distribute warranty keys through the hierarchy
7. **Test Customer Creation**: Have retailers (or support on behalf) create warranties

## 🔍 Key Security Verifications

### Verify Support Employee Restrictions
1. **Try key allocation as support employee** - Should fail with 403
2. **Try accessing unassigned company** - Should fail with 403  
3. **Try actions without permissions** - Should fail with 403
4. **Verify audit trail** - Check logs show "on behalf of" for support actions

### Test Multi-Tenant Isolation
1. **White-label A cannot see White-label B data**
2. **Main company can see all white-label data**
3. **Support employees only see assigned resources**

## 📞 Need Help?

- **Complete Architecture**: Check [NEW_SCHEMA_DOCUMENTATION.md](./NEW_SCHEMA_DOCUMENTATION.md)
- **API Reference**: Visit http://localhost:3000/docs
- **White-Label Setup**: Read [WHITELABEL_SETUP.md](./WHITELABEL_SETUP.md)
- **Issues**: Create an issue in the repository

## 🚦 Status Indicators

✅ **Working correctly if:**
- Main company setup completes successfully
- Support employees cannot allocate/transfer keys
- White-labels are isolated from each other
- Cross-company access works for main company users
- Audit trail shows proper attribution

❌ **Issues if:**
- Support employees can perform key operations
- White-labels can access each other's data
- Main company cannot access white-label data
- Permission assignments don't work

---

**Your multi-tenant white-label warranty system with secure support employee restrictions is now ready! 🚀**