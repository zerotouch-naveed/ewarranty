# 🏢 Multi-Tenant White-Label Company Setup Guide

This comprehensive guide explains how to set up and manage white-label companies in the new multi-tenant Extended Warranty Management system with enhanced support employee permissions and strict key management security.

## 📋 System Architecture Overview

The new system supports a sophisticated multi-tenant architecture:

### Company Structure
- **Main Company**: Your primary company (only one exists)
  - Creates and manages all white-label companies
  - Has full cross-company access
  - Manages global settings and key distribution

- **White-Label Companies**: Independent warranty providers
  - Complete isolation from other white-labels
  - Own branding, users, and hierarchy
  - Independent key allocation and customer management

### User Hierarchy Structure
```
Main Company
├── MAIN_OWNER (Full system access)
├── MAIN_EMPLOYEE (Cross-company operations)
└── MAIN_SUPPORT_EMPLOYEE (Assigned scope, NO key operations)

White-Label Company
├── WHITELABEL_OWNER (Full company access)
├── WHITELABEL_EMPLOYEE (Company operations)
├── WHITELABEL_SUPPORT_EMPLOYEE (Limited scope, NO key operations)
└── Legacy Hierarchy (TSM → ASM → Sales → Distributors → Retailers)
```

## 🚀 Initial System Setup

### Step 1: Initialize Main Company

First-time setup creates your main company and primary owner:

```bash
npm run setup-main-company
```

**Interactive Setup Process:**
```
🏢 Multi-Tenant White-Label System Setup
═══════════════════════════════════════

Setting up Main Company...

📋 Main Company Information:
Company Name: TechWarranty Solutions
Company Email: admin@techwarranty.com
Company Phone: +1-555-0100

📍 Company Address:
Street: 123 Main Street
City: San Francisco
State: CA
Country: USA
ZIP Code: 94105

👤 Main Owner Account:
Owner Name: John Administrator
Owner Email: john@techwarranty.com
Owner Phone: +1-555-0101
Owner Password: [auto-generated secure password]

🔑 Initial Key Allocation: 10000

✅ Main company setup completed!

📊 System Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Company ID: MAIN_1735123456789_abc123def
Company Type: MAIN
Total Keys: 10,000
Owner ID: USER_1735123456789_xyz789abc
Owner Type: MAIN_OWNER

🔑 Login Credentials:
Email: john@techwarranty.com
Password: SecureP@ssw0rd123!
```

**What Gets Created:**
- ✅ Main company with `MAIN` type
- ✅ Main owner user with `MAIN_OWNER` type
- ✅ Initial key allocation (default: 10,000)
- ✅ Company hierarchy structure
- ✅ Audit trail initialization

### Step 2: Verify Main Company Setup

Check if the setup was successful:

```bash
# Test main owner login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@techwarranty.com",
    "password": "SecureP@ssw0rd123!"
  }'

# List companies (should show main company)
curl -X GET http://localhost:3000/api/companies \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🏷️ Creating White-Label Companies

### Method 1: Interactive Script (Recommended)

Use the interactive white-label creation script:

```bash
npm run create-whitelabel
```

**Interactive Process:**
```
🏢 White-Label Company Creation
═══════════════════════════════════

📋 Company Information:
Company Name: TechCare Warranties
Company Email: admin@techcare.com
Company Phone: +1-555-0200

📍 Company Address:
Street: 456 Tech Avenue
City: Austin
State: TX
Country: USA
ZIP Code: 78701

👤 White-Label Owner:
Owner Name: Sarah Johnson
Owner Email: sarah@techcare.com
Owner Phone: +1-555-0201
Owner Password: [auto-generated]

🔑 Key Allocation:
Keys to allocate: 2000

📋 Company Registration Summary:
Company: TechCare Warranties
Type: WHITELABEL
Owner: Sarah Johnson (WHITELABEL_OWNER)
Keys: 2000

✅ Create this white-label company? (y/N): y

✅ White-label company created successfully!

📊 Company Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Company ID: WL_1735123456789_def456ghi
Parent Company: MAIN_1735123456789_abc123def
Owner ID: USER_1735123456789_mno234pqr
```

### Method 2: API Creation

Create white-label companies programmatically:

```bash
# Login as main company user first
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@techwarranty.com",
    "password": "SecureP@ssw0rd123!"
  }'

# Create white-label company
curl -X POST http://localhost:3000/api/companies \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TechCare Warranties",
    "email": "admin@techcare.com",
    "phone": "+1-555-0200",
    "address": {
      "street": "456 Tech Avenue",
      "city": "Austin",
      "state": "TX",
      "country": "USA",
      "zipCode": "78701"
    },
    "keyAllocation": {
      "totalKeys": 2000
    },
    "ownerDetails": {
      "name": "Sarah Johnson",
      "email": "sarah@techcare.com",
      "phone": "+1-555-0201",
      "password": "owner123"
    }
  }'
```

## 🔐 Support Employee Management

### Creating Support Permission Sets

Support employees use dynamic permission sets instead of fixed roles:

```bash
# Create permission set for customer support
curl -X POST http://localhost:3000/api/permissions \
  -H "Authorization: Bearer OWNER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permissionName": "Customer Support Level 1",
    "description": "Basic customer support with limited access",
    "permissions": {
      "canViewCustomers": true,
      "canCreateCustomers": true,
      "canEditCustomers": false,
      "canDeleteCustomers": false,
      "canViewUsers": true,
      "canCreateUsers": false,
      "canEditUsers": false,
      "canDeleteUsers": false,
      "canViewCompanyData": true,
      "canEditCompanySettings": false,
      "canViewClaims": true,
      "canProcessClaims": true,
      "canViewWarrantyPlans": true,
      "canEditWarrantyPlans": false,
      "canViewReports": true,
      "canExportData": false,
      "canViewKeyHistory": true,
      "canAccessCrossCompany": false,
      "hierarchyLevelAccess": 0
    }
  }'

# Create advanced permission set
curl -X POST http://localhost:3000/api/permissions \
  -H "Authorization: Bearer OWNER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permissionName": "Senior Support Representative",
    "description": "Advanced support with broader access",
    "permissions": {
      "canViewCustomers": true,
      "canCreateCustomers": true,
      "canEditCustomers": true,
      "canDeleteCustomers": false,
      "canViewUsers": true,
      "canCreateUsers": true,
      "canEditUsers": true,
      "canDeleteUsers": false,
      "canViewCompanyData": true,
      "canEditCompanySettings": false,
      "canViewClaims": true,
      "canProcessClaims": true,
      "canViewWarrantyPlans": true,
      "canEditWarrantyPlans": true,
      "canViewReports": true,
      "canExportData": true,
      "canViewKeyHistory": true,
      "canAccessCrossCompany": true,
      "hierarchyLevelAccess": 2
    }
  }'
```

### Registering Support Employees

#### Main Company Support Employee
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Authorization: Bearer MAIN_OWNER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alex Support",
    "email": "alex@techwarranty.com",
    "phone": "+1-555-0150",
    "password": "support123",
    "userType": "MAIN_SUPPORT_EMPLOYEE",
    "companyId": "MAIN_1735123456789_abc123def"
  }'
```

#### White-Label Support Employee
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Authorization: Bearer WHITELABEL_OWNER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Support",
    "email": "maria@techcare.com",
    "phone": "+1-555-0250",
    "password": "support123",
    "userType": "WHITELABEL_SUPPORT_EMPLOYEE",
    "companyId": "WL_1735123456789_def456ghi"
  }'
```

### Assigning Permissions to Support Employees

```bash
# Assign permission set to support employee
curl -X POST http://localhost:3000/api/permissions/assign \
  -H "Authorization: Bearer OWNER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_SUPPORT_EMPLOYEE_ID",
    "permissionSetId": "PERM_1735123456789_abc123def"
  }'
```

### Creating Support Employee Assignments

Support employees must be assigned to specific resources:

#### Company Assignment (Access to entire white-label company)
```bash
curl -X POST http://localhost:3000/api/assignments \
  -H "Authorization: Bearer OWNER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supportEmployeeId": "USER_SUPPORT_EMPLOYEE_ID",
    "assignmentType": "COMPANY",
    "targetCompanyId": "WL_1735123456789_def456ghi",
    "accessScope": "LIMITED"
  }'
```

#### User Assignment (Access to specific user and subordinates)
```bash
curl -X POST http://localhost:3000/api/assignments \
  -H "Authorization: Bearer OWNER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supportEmployeeId": "USER_SUPPORT_EMPLOYEE_ID",
    "assignmentType": "USER",
    "targetUserId": "USER_RETAILER_ID",
    "accessScope": "FULL"
  }'
```

#### Hierarchy Assignment (Access to users up to certain level)
```bash
curl -X POST http://localhost:3000/api/assignments \
  -H "Authorization: Bearer OWNER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supportEmployeeId": "USER_SUPPORT_EMPLOYEE_ID",
    "assignmentType": "HIERARCHY",
    "targetHierarchyLevel": 3,
    "accessScope": "READ_ONLY"
  }'
```

## 👤 User Hierarchy Creation

### Creating White-Label User Hierarchy

After setting up a white-label company, create the user hierarchy:

#### 1. Login as White-Label Owner
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah@techcare.com",
    "password": "owner123"
  }'
```

#### 2. Create White-Label Employee
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Authorization: Bearer WHITELABEL_OWNER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mike Employee",
    "email": "mike@techcare.com",
    "phone": "+1-555-0202",
    "password": "employee123",
    "userType": "WHITELABEL_EMPLOYEE",
    "companyId": "WL_1735123456789_def456ghi",
    "parentUserId": "USER_1735123456789_mno234pqr"
  }'
```

#### 3. Create Legacy Sales Hierarchy
```bash
# Create TSM
curl -X POST http://localhost:3000/api/auth/register \
  -H "Authorization: Bearer WHITELABEL_OWNER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tom Sales Manager",
    "email": "tom@techcare.com",
    "phone": "+1-555-0203",
    "password": "tsm123",
    "userType": "TSM",
    "companyId": "WL_1735123456789_def456ghi",
    "parentUserId": "USER_WHITELABEL_EMPLOYEE_ID"
  }'

# Create ASM under TSM
curl -X POST http://localhost:3000/api/auth/register \
  -H "Authorization: Bearer TSM_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Anna Area Manager",
    "email": "anna@techcare.com",
    "phone": "+1-555-0204",
    "password": "asm123",
    "userType": "ASM",
    "companyId": "WL_1735123456789_def456ghi",
    "parentUserId": "USER_TSM_ID"
  }'

# Continue creating: SALES_EXECUTIVE → DISTRIBUTOR → RETAILER
```

## 🔑 Key Management & Distribution

### Key Allocation Rules

**Who Can Allocate Keys:**
- ✅ Main Company Owner/Employee → Any white-label
- ✅ White-label Owner/Employee → Within their company
- ✅ Legacy users (TSM, ASM, etc.) → Down their hierarchy
- ❌ **ALL Support Employees** → **CANNOT allocate keys**

### Key Distribution Example

#### 1. Main Company Allocates to White-Label
```bash
curl -X POST http://localhost:3000/api/keys/allocate \
  -H "Authorization: Bearer MAIN_OWNER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "USER_WHITELABEL_OWNER_ID",
    "keyCount": 2000
  }'
```

#### 2. White-Label Owner Distributes to TSM
```bash
curl -X POST http://localhost:3000/api/keys/allocate \
  -H "Authorization: Bearer WHITELABEL_OWNER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "USER_TSM_ID",
    "keyCount": 1000
  }'
```

#### 3. Continue Down Hierarchy
```bash
# TSM → ASM
curl -X POST http://localhost:3000/api/keys/allocate \
  -H "Authorization: Bearer TSM_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "USER_ASM_ID",
    "keyCount": 500
  }'

# ASM → Distributor → Retailer
# Continue allocation down the hierarchy
```

### Key Restriction Verification

Test that support employees cannot perform key operations:

```bash
# This should fail with 403 Forbidden
curl -X POST http://localhost:3000/api/keys/allocate \
  -H "Authorization: Bearer SUPPORT_EMPLOYEE_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "USER_RETAILER_ID",
    "keyCount": 10
  }'

# Expected response:
{
  "success": false,
  "error": "Support employees cannot perform key operations."
}
```

## 🛡️ Security & Access Control

### Company Isolation Testing

Verify white-labels cannot access each other's data:

```bash
# White-label A trying to access White-label B's customers
curl -X GET http://localhost:3000/api/customers \
  -H "Authorization: Bearer WHITELABEL_A_JWT_TOKEN" \
  -H "X-Company-ID: WL_COMPANY_B_ID"

# Should return 403 Forbidden
```

### Cross-Company Access (Main Company Only)

Main company users can access any white-label:

```bash
# Main company user accessing white-label data
curl -X GET http://localhost:3000/api/customers \
  -H "Authorization: Bearer MAIN_EMPLOYEE_JWT_TOKEN" \
  -H "X-Company-ID: WL_1735123456789_def456ghi"

# Should return white-label's customer data
```

### Support Employee Access Control

Test support employee access restrictions:

```bash
# Support employee accessing assigned company - Should work
curl -X GET http://localhost:3000/api/customers \
  -H "Authorization: Bearer SUPPORT_EMPLOYEE_JWT_TOKEN"

# Support employee accessing unassigned company - Should fail
curl -X GET http://localhost:3000/api/customers \
  -H "Authorization: Bearer SUPPORT_EMPLOYEE_JWT_TOKEN" \
  -H "X-Company-ID: UNASSIGNED_COMPANY_ID"
```

## 📊 Managing Companies & Users

### List All Companies
```bash
curl -X GET http://localhost:3000/api/companies \
  -H "Authorization: Bearer MAIN_OWNER_JWT_TOKEN"
```

### Get Company Details
```bash
curl -X GET http://localhost:3000/api/companies/WL_1735123456789_def456ghi \
  -H "Authorization: Bearer MAIN_OWNER_JWT_TOKEN"
```

### Update Company Information
```bash
curl -X PUT http://localhost:3000/api/companies/WL_1735123456789_def456ghi \
  -H "Authorization: Bearer MAIN_OWNER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TechCare Premium Warranties",
    "phone": "+1-555-0299"
  }'
```

### View User Hierarchy
```bash
curl -X GET http://localhost:3000/api/users/USER_ID/hierarchy \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Support Employee Assignments
```bash
curl -X GET http://localhost:3000/api/assignments/user/USER_SUPPORT_EMPLOYEE_ID \
  -H "Authorization: Bearer OWNER_JWT_TOKEN"
```

## 🚨 Troubleshooting

### Common Issues

#### 1. "Main company already exists"
**Solution:** Normal if you've run setup before. Use existing credentials or reset database for development.

#### 2. "Only main company users can create white-label companies"
**Solution:** Ensure you're logged in as `MAIN_OWNER` or `MAIN_EMPLOYEE`.

#### 3. Support employee can't access assigned resources
**Solutions:**
- Check permission assignment: `GET /api/permissions/user/SUPPORT_ID`
- Verify company assignment: `GET /api/assignments/user/SUPPORT_ID`
- Ensure user type is correct: `MAIN_SUPPORT_EMPLOYEE` or `WHITELABEL_SUPPORT_EMPLOYEE`

#### 4. "Support employees cannot perform key operations"
**This is expected behavior** - Support employees are strictly prohibited from key operations for security.

#### 5. White-label isolation not working
**Check:**
- Company IDs are correct
- User belongs to expected company
- No cross-company access being granted incorrectly

### Database Reset (Development Only)
```bash
# Connect to MongoDB
mongo multi_tenant_warranty

# Drop collections (DEVELOPMENT ONLY)
db.companies.drop()
db.users.drop()
db.userhierarchies.drop()
db.supportpermissions.drop()
db.supportassignments.drop()
db.customers.drop()
db.keymanagements.drop()

# Re-run setup
npm run setup-main-company
```

## 📈 Best Practices

### Company Management
- Use descriptive company names and emails
- Set appropriate key allocations based on expected volume
- Maintain proper address information for compliance
- Regular audit of company statuses and key usage

### User Management
- Follow strict hierarchy creation order
- Use strong passwords for all user accounts
- Assign appropriate user types based on responsibilities
- Regular review of user permissions and access

### Support Employee Management
- Create specific permission sets for different support levels
- Assign minimal required permissions (principle of least privilege)
- Regular review of support employee assignments
- Monitor support employee actions through audit logs

### Key Management
- Monitor key usage and allocation regularly
- Plan key distribution based on business requirements
- Set up alerts for low key counts
- Regular audit of key transactions

### Security
- Change all default passwords immediately
- Use environment variables for sensitive configuration
- Regular security audits of user permissions
- Monitor cross-company access patterns
- Review audit logs for unusual activity

## 📚 Advanced Configuration

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=mongodb://your-production-cluster
JWT_SECRET=your-very-secure-jwt-secret-key
JWT_REFRESH_SECRET=your-secure-refresh-secret-key

# Main company configuration
MAIN_COMPANY_NAME=Your Production Company Name
MAIN_COMPANY_EMAIL=admin@yourcompany.com
MAIN_OWNER_EMAIL=owner@yourcompany.com

# Security settings
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Monitoring and Alerts
- Set up MongoDB monitoring for performance
- Create alerts for unusual key allocation patterns
- Monitor support employee activity
- Track cross-company access patterns
- Alert on failed authorization attempts

## 📞 Support

For additional help:

1. **Complete Architecture**: Review [NEW_SCHEMA_DOCUMENTATION.md](./NEW_SCHEMA_DOCUMENTATION.md)
2. **API Reference**: http://localhost:3000/docs
3. **Quick Start**: [QUICK_START.md](./QUICK_START.md)
4. **Main Documentation**: [README.md](./README.md)
5. **Issues**: Create an issue in the repository

---

**Your multi-tenant white-label system with secure support employee management is now fully configured! 🚀**