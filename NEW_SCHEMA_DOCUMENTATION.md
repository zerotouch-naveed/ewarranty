# Multi-Tenant White-Label System - New Schema Documentation

## Overview

This document describes the completely redesigned schema and permission system for your multi-tenant white-label application. The new system supports:

- **Main Company** (your company) that creates and manages white-label companies
- **White-label Companies** with their own users and hierarchy
- **Support Employees** with dynamic, configurable permissions
- **Strict Key Management Restrictions** for support employees
- **Cross-company Access Control** for main company users
- **Hierarchical Permission System** with proper isolation

## Company Types

### 1. Main Company
- **Type**: `MAIN`
- **Purpose**: Your primary company that creates and manages white-label companies
- **Users**: Can create white-label companies and access all white-label data
- **Key Features**:
  - Only one main company can exist
  - Has full access to all white-label companies
  - Can assign support employees to any white-label
  - Manages global settings and configurations

### 2. White-label Companies
- **Type**: `WHITELABEL`
- **Purpose**: Companies created by the main company for their clients
- **Users**: Independent hierarchy with their own owners, employees, and support staff
- **Key Features**:
  - Created by main company users or existing white-label owners
  - Isolated from other white-labels (unless accessed by main company)
  - Can have their own retailers, distributors, and sales hierarchy
  - Can have their own support employees with limited permissions

## User Types

### Main Company Users
1. **MAIN_OWNER**
   - Full system access
   - Can create white-label companies
   - Can create other main company users
   - Can transfer keys and perform all operations

2. **MAIN_EMPLOYEE** 
   - Can work on behalf of white-label companies
   - Can create and manage white-label users
   - Can transfer keys and perform most operations
   - Cannot create other main company owners

3. **MAIN_SUPPORT_EMPLOYEE**
   - Dynamic permissions based on assigned permission sets
   - Can be assigned to specific white-label companies
   - **CANNOT transfer, allocate, or revoke keys**
   - Can only perform actions within assigned scope

### White-label Company Users
1. **WHITELABEL_OWNER**
   - Full access within their company
   - Can create other white-label users
   - Can manage their company settings
   - Can transfer keys within their hierarchy

2. **WHITELABEL_EMPLOYEE**
   - Standard employee access within their company
   - Can manage users and customers in their hierarchy
   - Can transfer keys within their hierarchy

3. **WHITELABEL_SUPPORT_EMPLOYEE**
   - Dynamic permissions based on assigned permission sets
   - Can only work within their company hierarchy
   - **CANNOT transfer, allocate, or revoke keys**
   - Limited to assigned users/customers

### Legacy User Types (Maintained for Compatibility)
- **TSM**, **ASM**, **SALES_EXECUTIVE**
- **SUPER_DISTRIBUTOR**, **DISTRIBUTOR**, **NATIONAL_DISTRIBUTOR**
- **MINI_DISTRIBUTOR**, **RETAILER**

## Support Employee Permission System

### Dynamic Permissions
Support employees have configurable permissions instead of fixed roles:

#### Customer/User Management
- `canViewCustomers`: View customer data
- `canCreateCustomers`: Create new customers (using retailer's keys)
- `canEditCustomers`: Modify customer information
- `canDeleteCustomers`: Remove customers
- `canViewUsers`: View user data in hierarchy
- `canCreateUsers`: Create new users in hierarchy
- `canEditUsers`: Modify user information
- `canDeleteUsers`: Remove users

#### Company Management
- `canViewCompanyData`: Access company information
- `canEditCompanySettings`: Modify company settings

#### Claims and Warranty
- `canViewClaims`: View warranty claims
- `canProcessClaims`: Process and update claims
- `canViewWarrantyPlans`: View available warranty plans
- `canEditWarrantyPlans`: Modify warranty plans

#### Reports and Data
- `canViewReports`: Access reporting data
- `canExportData`: Export data to files
- `canViewKeyHistory`: View key allocation history (read-only)

#### Cross-Company Access (Main Company Only)
- `canAccessCrossCompany`: Support employees can work across white-labels
- `hierarchyLevelAccess`: Defines how deep in hierarchy they can access

#### Key Operations (ALWAYS RESTRICTED)
- `canTransferKeys`: **ALWAYS FALSE** - Support employees cannot transfer keys
- `canAllocateKeys`: **ALWAYS FALSE** - Support employees cannot allocate keys  
- `canRevokeKeys`: **ALWAYS FALSE** - Support employees cannot revoke keys

### Assignment System
Support employees must be assigned to specific resources:

1. **Company Assignment**: Access to all users in a specific white-label company
2. **User Assignment**: Access to specific users and their subordinates
3. **Hierarchy Assignment**: Access to users up to a certain hierarchy level

## Key Management Restrictions

### Who Can Perform Key Operations
- ✅ **Main Company Owners & Employees**: Full key management
- ✅ **White-label Owners & Employees**: Within their hierarchy
- ✅ **Legacy Users (TSM, ASM, etc.)**: Within their hierarchy
- ❌ **ALL Support Employees**: Cannot perform ANY key operations

### Key Operations Restricted for Support Employees
1. **Transfer Keys**: Moving keys between users
2. **Allocate Keys**: Giving keys to subordinates
3. **Revoke Keys**: Taking keys back from users
4. **Use Keys**: Creating warranties (support can create on behalf of retailers)

### What Support Employees CAN Do
- View key history (if permitted)
- Create customers using retailer's keys (on behalf of retailer)
- View key allocation data for reporting
- Assist with key-related issues (but not perform operations)

## Hierarchy and Access Control

### Main Company Hierarchy
```
MAIN_OWNER
├── MAIN_EMPLOYEE
│   ├── White-label Companies (full access)
│   └── MAIN_SUPPORT_EMPLOYEE (assigned scope)
└── MAIN_SUPPORT_EMPLOYEE (assigned scope)
```

### White-label Company Hierarchy
```
WHITELABEL_OWNER
├── WHITELABEL_EMPLOYEE
│   ├── TSM/ASM/SALES_EXECUTIVE
│   │   └── Distributors/Retailers
│   └── WHITELABEL_SUPPORT_EMPLOYEE (company scope only)
└── WHITELABEL_SUPPORT_EMPLOYEE (company scope only)
```

## Database Schema Changes

### New Collections

#### 1. SupportPermission
Defines permission sets that can be assigned to support employees:
```javascript
{
  permissionId: String,
  companyId: String,
  permissionName: String,
  permissions: {
    canViewCustomers: Boolean,
    canCreateCustomers: Boolean,
    // ... other permissions
    canTransferKeys: false, // Always false, immutable
    canAllocateKeys: false, // Always false, immutable
    canRevokeKeys: false    // Always false, immutable
  }
}
```

#### 2. SupportAssignment
Tracks which support employees are assigned to which resources:
```javascript
{
  assignmentId: String,
  supportEmployeeId: String,
  assignedBy: String,
  assignmentType: 'COMPANY' | 'USER' | 'HIERARCHY',
  targetCompanyId: String,
  targetUserId: String,
  accessScope: 'FULL' | 'LIMITED' | 'READ_ONLY'
}
```

### Modified Collections

#### 1. Company
```javascript
{
  companyType: 'MAIN' | 'WHITELABEL',
  parentCompanyId: String, // null for main, set for white-labels
  createdBy: String        // who created this company
}
```

#### 2. User
```javascript
{
  userType: [
    'MAIN_OWNER', 'MAIN_EMPLOYEE', 'MAIN_SUPPORT_EMPLOYEE',
    'WHITELABEL_OWNER', 'WHITELABEL_EMPLOYEE', 'WHITELABEL_SUPPORT_EMPLOYEE',
    // ... legacy types
  ],
  supportPermissions: {
    permissionSetId: String,
    assignedBy: String,
    effectivePermissions: { /* copied from permission set */ }
  },
  assignedCompanies: [{ /* for support employees */ }]
}
```

#### 3. UserHierarchy
```javascript
{
  crossCompanyAccess: [{ 
    companyId: String,
    accessLevel: 'FULL' | 'LIMITED' | 'SUPPORT_ONLY'
  }]
}
```

#### 4. AuditLog
```javascript
{
  onBehalfOf: {
    userId: String,    // when support employee acts on behalf of someone
    userType: String,
    companyId: String
  }
}
```

## API Usage Examples

### Creating Permission Sets
```javascript
// Main company owner creates permission set for support employees
await SupportPermissionService.createPermissionSet({
  permissionName: "Customer Support Level 1",
  permissions: {
    canViewCustomers: true,
    canCreateCustomers: true,
    canEditCustomers: false,
    canViewUsers: true,
    canViewReports: true,
    canTransferKeys: false // Always false
  }
}, mainOwnerUserId);
```

### Assigning Support Employee
```javascript
// Assign support employee to a white-label company
await SupportAssignmentService.createAssignment({
  supportEmployeeId: "support_123",
  assignmentType: "COMPANY",
  targetCompanyId: "whitelabel_456",
  accessScope: "LIMITED"
}, assigningUserId);
```

### Permission Checking
```javascript
// Check if support employee can perform action
const canEdit = await HierarchyService.checkUserPermission(
  supportEmployeeId, 
  targetCustomerId, 
  'EDIT_CUSTOMERS'
);
```

## Migration Strategy

### Phase 1: Schema Migration
1. Add new fields to existing collections
2. Create new SupportPermission and SupportAssignment collections
3. Update indexes for performance

### Phase 2: Data Migration
1. Identify main company (convert existing company)
2. Mark all current users with appropriate new user types
3. Create default permission sets for existing support staff

### Phase 3: API Updates
1. Update authentication middleware
2. Modify existing endpoints to use new permission system
3. Add new endpoints for support management

### Phase 4: Testing and Rollout
1. Test all permission scenarios
2. Verify key operation restrictions
3. Validate cross-company access controls

## Security Features

### Key Operation Security
- **Immutable Restrictions**: Support employees can NEVER get key permissions
- **Pre-save Middleware**: Automatically prevents key permissions on support employees
- **API Layer Protection**: Multiple checks prevent key operations by support employees

### Access Control
- **Hierarchy-based**: Users can only access their subordinates
- **Assignment-based**: Support employees only access assigned resources
- **Company Isolation**: White-labels cannot access each other's data
- **Audit Trail**: All actions tracked with proper attribution

### Permission Inheritance
- **No Inheritance**: Support employees only get explicitly assigned permissions
- **Scope Limitation**: Permissions limited to assigned companies/users
- **Dynamic Updates**: Permission changes take effect immediately

## Benefits

### For Main Company
- Full control over all white-label operations
- Ability to provide support across all white-labels
- Centralized user management and key control
- Detailed audit trails for compliance

### For White-label Companies
- Independent user hierarchy within their company
- Ability to have their own support staff
- Isolated customer and user data
- Flexible permission management for their support employees

### For Support Employees
- Clear, defined permissions
- Cannot accidentally perform restricted operations
- Proper attribution in audit logs
- Scope-limited access prevents data breaches

This new system provides a robust, secure, and scalable foundation for your multi-tenant white-label application with proper separation of concerns and strict security controls around key management.