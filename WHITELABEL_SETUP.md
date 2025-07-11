# 🏢 Whitelabel Company Registration Guide

This guide explains how to register and manage whitelabel companies in the Extended Warranty Management system.

## 📋 Overview

The system supports multi-tenant whitelabel architecture where:
- **Main Company**: The primary system administrator
- **Whitelabel Companies**: Independent warranty providers with their own branding
- **Hierarchical Users**: Each company has its own user hierarchy (TSM → ASM → Sales → Distributors → Retailers)

## 🚀 Initial Setup

### Step 1: Bootstrap the System

First, you need to initialize the system with the main company and super admin:

```bash
npm run bootstrap
```

This will:
- ✅ Create the main company
- ✅ Create a super administrator (TSM user)
- ✅ Set up initial key allocation
- ✅ Provide login credentials

**Default Credentials Created:**
- Email: `superadmin@maincompany.com`
- Password: `admin123`
- User Type: TSM (Territory Sales Manager)

### Step 2: Verify Setup

Check if the bootstrap was successful:

```bash
npm run list-companies
```

You should see the main company listed with admin details.

## 🏷️ Registering New Whitelabel Companies

### Interactive Registration

Run the interactive whitelabel registration script:

```bash
npm run register-whitelabel
```

The script will prompt you for:

1. **Company Information**:
   - Company Name
   - Company Email
   - Company Phone
   - Complete Address

2. **Key Allocation**:
   - Total warranty keys to allocate
   - Default: 1000 keys

3. **Admin User**:
   - Admin Name
   - Admin Email
   - Admin Phone
   - Admin Password (default: admin123)
   - User Type (TSM or ASM)

### Example Registration Flow

```
🚀 Whitelabel Company Registration
═══════════════════════════════════

📋 Enter Company Information:
────────────────────────────────

Company Name: TechCare Warranties
Company Email: admin@techcare.com
Company Phone: +1-555-0123

📍 Address Information:
Street Address: 456 Tech Street
City: San Francisco
State/Province: CA
Country: USA
ZIP/Postal Code: 94105

🔑 Key Allocation:
Total Keys to Allocate (default: 1000): 2000

👤 Admin User Information:
─────────────────────────────────

Admin Name: John Smith
Admin Email: john@techcare.com
Admin Phone: +1-555-0124
Admin Password (default: admin123): mypassword123

🏷️ Admin User Type:
   1. TSM (Territory Sales Manager)
   2. ASM (Area Sales Manager)
Select user type (1 or 2, default: 1): 1

📋 Registration Summary:
─────────────────────────
Company: TechCare Warranties
Email: admin@techcare.com
Admin: John Smith (TSM)
Admin Email: john@techcare.com
Total Keys: 2000

✅ Create this whitelabel company? (y/N): y
```

## 📊 Managing Companies

### List All Companies

View all registered companies and their details:

```bash
npm run list-companies
```

This shows:
- 🏢 Company details and status
- 🔑 Key allocation and usage
- 👤 Admin users for each company
- 📊 System summary statistics

### Company Structure

Each whitelabel company includes:

```json
{
  "companyId": "COMP_1234567890_abc123def",
  "name": "TechCare Warranties",
  "email": "admin@techcare.com",
  "phone": "+1-555-0123",
  "address": {
    "street": "456 Tech Street",
    "city": "San Francisco",
    "state": "CA",
    "country": "USA",
    "zipCode": "94105"
  },
  "keyAllocation": {
    "totalKeys": 2000,
    "usedKeys": 0,
    "remainingKeys": 2000
  },
  "isActive": true
}
```

## 👤 User Hierarchy Setup

After registering a whitelabel company, the admin can create the user hierarchy:

### 1. Login as Company Admin

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@techcare.com",
    "password": "mypassword123"
  }'
```

### 2. Create User Hierarchy

Using the JWT token from login, create users in hierarchy order:

```bash
# Create ASM under TSM
curl -X POST http://localhost:3000/api/auth/register \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@techcare.com",
    "phone": "+1-555-0125",
    "password": "password123",
    "userType": "ASM",
    "companyId": "COMP_1234567890_abc123def",
    "parentUserId": "USER_1234567890_xyz789abc"
  }'
```

Continue creating the hierarchy:
- `TSM` → `ASM` → `SALES_EXECUTIVE` → `SUPER_DISTRIBUTOR` → `DISTRIBUTOR` → `RETAILER`

### 3. Allocate Keys

Allocate warranty keys down the hierarchy:

```bash
curl -X POST http://localhost:3000/api/keys/allocate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "USER_1234567890_xyz789abc",
    "keyCount": 500
  }'
```

## 🔑 Key Management

### Key Allocation Flow

```
Main Company (10,000 keys)
└── Company A Admin (2,000 keys)
    ├── ASM (1,000 keys)
    │   ├── Sales Executive (500 keys)
    │   └── Super Distributor (300 keys)
    └── Distributor (200 keys)
        └── Retailer (50 keys)
```

### Key Operations

- **Allocate**: Transfer keys from parent to child user
- **Revoke**: Reclaim keys from child to parent user  
- **Use**: Consume a key to create customer warranty

## 🌐 API Endpoints for Whitelabels

### Company Management
- `POST /api/companies` - Create company (Admin only)
- `GET /api/companies/:id` - Get company details
- `PUT /api/companies/:id` - Update company (Admin only)

### User Management
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/users/hierarchy` - Get user hierarchy

### Key Management
- `POST /api/keys/allocate` - Allocate keys
- `POST /api/keys/revoke` - Revoke keys
- `GET /api/keys/history` - Key transaction history

### Customer Management
- `POST /api/customers` - Create customer warranty
- `GET /api/customers` - List accessible customers
- `PUT /api/customers/:id` - Update customer

## 🔐 Security & Permissions

### Access Control

1. **Company Isolation**: Users can only access their company's data
2. **Hierarchical Permissions**: Users can only manage their subordinates
3. **Admin Privileges**: TSM/ASM can create companies and manage all users
4. **Key Constraints**: Users cannot allocate more keys than they have

### Authentication

- JWT-based authentication
- Token expiration: 24 hours (configurable)
- Refresh token support
- Password hashing with bcrypt

## 🚨 Troubleshooting

### Common Issues

#### 1. "System not initialized"
```bash
# Run bootstrap first
npm run bootstrap
```

#### 2. "Company with this email already exists"
```bash
# Check existing companies
npm run list-companies
# Use different email or update existing company
```

#### 3. "No permission to create company"
```bash
# Ensure you're logged in as TSM or ASM user
# Check user type: TSM, ASM have admin privileges
```

#### 4. "Invalid company ID"
```bash
# Verify company exists and is active
npm run list-companies
```

### Database Issues

#### Reset System (Development Only)
```bash
# Connect to MongoDB
mongo warranty_management

# Drop all collections
db.companies.drop()
db.users.drop()
db.customers.drop()
db.keymanagements.drop()

# Re-run bootstrap
npm run bootstrap
```

## 📞 Support

For additional help:

1. Check the main [README.md](./README.md) for API documentation
2. Visit http://localhost:3000/docs for Swagger API reference
3. Review the [QUICK_START.md](./QUICK_START.md) for basic setup
4. Check application logs for error details

## 🎯 Best Practices

### Company Registration
- Use meaningful company names and emails
- Allocate appropriate key quantities based on expected volume
- Set up proper address information for reporting

### User Management
- Follow the hierarchical structure strictly
- Assign appropriate key allocations at each level
- Use descriptive user names and valid contact information

### Key Management
- Monitor key usage and allocation regularly
- Plan key distribution based on business requirements
- Set up alerts for low key counts

### Security
- Change default passwords immediately
- Use strong passwords for admin accounts
- Regularly audit user permissions and access
- Monitor login activities and suspicious behavior