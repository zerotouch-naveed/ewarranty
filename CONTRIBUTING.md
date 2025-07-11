# Contributing to Multi-Tenant White-Label Warranty Management System

Thank you for your interest in contributing to the Multi-Tenant White-Label Warranty Management System! This document provides guidelines and information for contributors working with our enhanced multi-tenant architecture.

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ 
- MongoDB 4.4+
- Git
- Understanding of multi-tenant architecture principles
- Familiarity with JWT authentication and role-based permissions

### Setup Development Environment

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/multi-tenant-warranty-management.git
   cd multi-tenant-warranty-management
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Configure your environment variables for multi-tenant setup
   ```

4. **Initialize Main Company**
   ```bash
   npm run setup-main-company
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## 🏗️ System Architecture Understanding

### Multi-Tenant Structure
Before contributing, understand our system architecture:

- **Main Company**: Your primary company managing all white-labels
- **White-Label Companies**: Independent companies with isolated data
- **Support Employees**: Users with dynamic permissions who **CANNOT** handle keys
- **Cross-Company Access**: Main company users can access all white-labels

### User Types
```
Main Company:
├── MAIN_OWNER (Full system access)
├── MAIN_EMPLOYEE (Cross-company operations)
└── MAIN_SUPPORT_EMPLOYEE (Assigned scope, NO key operations)

White-Label Company:
├── WHITELABEL_OWNER (Full company access)
├── WHITELABEL_EMPLOYEE (Company operations)
├── WHITELABEL_SUPPORT_EMPLOYEE (Limited scope, NO key operations)
└── Legacy Hierarchy (TSM → ASM → Sales → Distributors → Retailers)
```

### Key Security Principles
- **Support employees CANNOT perform ANY key operations**
- **Company isolation must be maintained**
- **All actions must be properly audited**
- **Permission changes require proper authorization**

## 📝 Development Guidelines

### Code Style
- Use ESLint configuration provided
- Follow existing multi-tenant patterns
- Always consider company isolation in data queries
- Include proper error handling for permission denied scenarios
- Add comprehensive comments for multi-tenant logic

### Multi-Tenant Development Rules

#### 1. **Company Isolation**
```javascript
// ❌ Bad - Can access any company data
const customers = await Customer.find({});

// ✅ Good - Company-scoped query
const customers = await Customer.find({ companyId: user.companyId });

// ✅ Better - Using service with permission check
const customers = await CustomerService.getAccessibleCustomers(userId, companyId);
```

#### 2. **Support Employee Restrictions**
```javascript
// ❌ Bad - No support employee check
async function allocateKeys(fromUserId, toUserId, keyCount) {
  // ... allocation logic
}

// ✅ Good - Support employee protection
async function allocateKeys(fromUserId, toUserId, keyCount) {
  const fromUser = await User.findOne({ userId: fromUserId });
  if (fromUser.userType.includes('SUPPORT_EMPLOYEE')) {
    throw new Error('Support employees cannot allocate keys');
  }
  // ... allocation logic
}
```

#### 3. **Permission Checking**
```javascript
// ❌ Bad - No permission check
app.get('/api/customers/:id', async (req, res) => {
  const customer = await Customer.findOne({ customerId: req.params.id });
  res.json(customer);
});

// ✅ Good - Proper permission middleware
app.get('/api/customers/:id', 
  authenticate,
  requirePermission('VIEW_CUSTOMERS'),
  ensureCompanyContext,
  async (req, res) => {
    const canAccess = await CustomerService.canAccessCustomer(req.user.userId, req.params.id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const customer = await Customer.findOne({ customerId: req.params.id });
    res.json(customer);
  }
);
```

### Commit Message Convention
Follow conventional commit format with multi-tenant context:
```
type(scope): description

Examples:
feat(auth): add support employee permission validation
fix(multi-tenant): resolve company isolation in customer queries  
feat(support): implement dynamic permission assignment
docs(schema): update multi-tenant architecture documentation
security(keys): strengthen key operation restrictions for support employees
```

### Branch Naming
- `feature/multi-tenant-description` for multi-tenant features
- `fix/company-isolation-issue` for isolation fixes
- `security/support-employee-restrictions` for security enhancements
- `docs/multi-tenant-guide` for documentation updates

## 🧪 Testing

### Test Categories

#### 1. **Multi-Tenant Isolation Tests**
```bash
# Test company isolation
npm run test:isolation

# Test cross-company access
npm run test:cross-company

# Test support employee restrictions  
npm run test:support-restrictions
```

#### 2. **Permission Tests**
```bash
# Test permission system
npm run test:permissions

# Test role-based access
npm run test:rbac

# Test support employee assignments
npm run test:assignments
```

#### 3. **Security Tests**
```bash
# Test key operation restrictions
npm run test:key-security

# Test support employee cannot escalate permissions
npm run test:permission-escalation

# Test audit trail integrity
npm run test:audit-trail
```

### Writing Tests for Multi-Tenant Features

```javascript
describe('Multi-Tenant Customer Service', () => {
  describe('Company Isolation', () => {
    it('should not allow white-label A to access white-label B customers', async () => {
      const whitelabelAUser = await createTestUser('WHITELABEL_OWNER', 'COMPANY_A');
      const whitelabelBCustomer = await createTestCustomer('COMPANY_B');
      
      const accessible = await CustomerService.canAccessCustomer(
        whitelabelAUser.userId, 
        whitelabelBCustomer.customerId
      );
      
      expect(accessible).toBe(false);
    });
  });

  describe('Support Employee Restrictions', () => {
    it('should prevent support employee from allocating keys', async () => {
      const supportEmployee = await createTestUser('MAIN_SUPPORT_EMPLOYEE');
      
      await expect(
        KeyManagementService.allocateKeys(
          supportEmployee.userId, 
          'TARGET_USER_ID', 
          100, 
          'COMPANY_ID'
        )
      ).rejects.toThrow('Support employees cannot allocate keys');
    });
  });
});
```

## 📋 Pull Request Process

### 1. **Create Feature Branch**
```bash
git checkout -b feature/your-multi-tenant-feature
```

### 2. **Development Checklist**
Before submitting, ensure:
- [ ] Company isolation is maintained
- [ ] Support employee restrictions are enforced
- [ ] Permission checks are implemented
- [ ] Audit logging is included
- [ ] Cross-company access is properly controlled
- [ ] Tests cover multi-tenant scenarios
- [ ] Documentation is updated

### 3. **Test Your Changes**
```bash
# Run all tests
npm test

# Run multi-tenant specific tests
npm run test:multi-tenant

# Run security tests
npm run test:security

# Lint code
npm run lint
```

### 4. **Security Verification**
Verify these security aspects:
- [ ] Support employees cannot perform key operations
- [ ] Company data isolation is maintained
- [ ] Permission escalation is not possible
- [ ] Audit trail is comprehensive
- [ ] Cross-company access is controlled

### 5. **Commit and Push**
```bash
git add .
git commit -m "feat(multi-tenant): your feature description"
git push origin feature/your-multi-tenant-feature
```

### 6. **Create Pull Request**
Include in your PR description:
- Clear description of changes
- Multi-tenant implications
- Security considerations
- Test coverage for new features
- Screenshots for UI changes
- References to related issues

## 🐛 Bug Reports

When reporting bugs in the multi-tenant system, include:
- Operating system and version
- Node.js version
- User type experiencing the issue
- Company context (main vs white-label)
- Clear steps to reproduce
- Expected vs actual behavior
- Whether issue affects company isolation
- Error messages and stack traces

### Bug Report Template
```markdown
**Bug Type**: [Company Isolation / Permission System / Support Employee / Key Management]

**User Context**:
- User Type: [MAIN_OWNER / WHITELABEL_EMPLOYEE / MAIN_SUPPORT_EMPLOYEE / etc.]
- Company Type: [MAIN / WHITELABEL]
- Company ID: [if relevant]

**Description**:
Brief description of the bug

**Steps to Reproduce**:
1. Login as [user type]
2. Navigate to [location]
3. Perform [action]
4. Observe [unexpected behavior]

**Expected Behavior**:
What should happen

**Actual Behavior**:
What actually happens

**Security Impact**:
Does this affect company isolation or permission restrictions?
```

## 💡 Feature Requests

For feature requests in the multi-tenant context:
- Specify which user types would benefit
- Consider multi-tenant implications
- Explain impact on company isolation
- Consider permission requirements
- Evaluate audit trail needs
- Think about cross-company scenarios

## 🏗️ Architecture Guidelines

### Adding New User Types
1. Update user type enum in `schemas.js`
2. Add permission mappings in `middleware/auth.js`
3. Update validation in `services.js`
4. Add hierarchy relationship logic
5. Create tests for new user type
6. Update documentation

### Creating New Permission Types
1. Add permission field to `SupportPermission` schema
2. Update middleware permission checking
3. Add to effective permissions in user schema
4. Update API documentation
5. Create tests for permission
6. Consider cross-company implications

### Adding Multi-Tenant Features
1. Consider company isolation requirements
2. Update hierarchy service for cross-company access
3. Add proper assignment validation for support employees
4. Implement audit logging
5. Test with main company and white-label scenarios
6. Document multi-tenant behavior

### Database Schema Changes
1. Update schemas in `schemas.js`
2. Consider migration requirements for existing data
3. Update related services with multi-tenant logic
4. Add proper indexes for performance
5. Test thoroughly with multiple companies
6. Document schema changes

### Adding API Endpoints
1. Create route file in `routes/`
2. Add business logic to appropriate service
3. Implement proper authentication middleware
4. Add permission checking middleware
5. Ensure company context validation
6. Add comprehensive error handling
7. Update API documentation
8. Add tests for all user types

## 🔒 Security Guidelines

### Multi-Tenant Security Checklist
- [ ] Company data isolation enforced
- [ ] Support employee key restrictions implemented
- [ ] Permission checks at all access points
- [ ] Audit logging for all sensitive operations
- [ ] Cross-company access properly controlled
- [ ] Input validation for all endpoints
- [ ] SQL injection prevention in queries
- [ ] JWT token validation and refresh

### Security Review Process
1. **Code Review**: All security-related changes need review
2. **Permission Testing**: Verify permission restrictions work
3. **Isolation Testing**: Ensure company data isolation
4. **Support Employee Testing**: Verify key operation restrictions
5. **Audit Trail Review**: Check logging completeness

## 📚 Documentation

### Required Documentation Updates
- Update README.md for major architectural changes
- Add JSDoc comments for multi-tenant functions
- Update API documentation with permission requirements
- Include multi-tenant examples in guides
- Document new user types and their capabilities
- Explain company isolation principles

### Documentation Standards
```javascript
/**
 * Allocates keys from one user to another with multi-tenant security checks
 * 
 * @param {string} fromUserId - User allocating keys (cannot be support employee)
 * @param {string} toUserId - User receiving keys
 * @param {number} keyCount - Number of keys to allocate
 * @param {string} companyId - Company context for operation
 * @returns {Promise<KeyManagement>} Key allocation record
 * @throws {Error} If fromUser is support employee or insufficient permissions
 * 
 * @security Support employees are strictly prohibited from key operations
 * @multiTenant Validates company context and hierarchy permissions
 * @audit Creates audit log entry with proper attribution
 */
async function allocateKeys(fromUserId, toUserId, keyCount, companyId) {
  // Implementation
}
```

## 🔍 Code Review Guidelines

### Multi-Tenant Code Review Checklist
- [ ] Company isolation properly implemented
- [ ] Support employee restrictions enforced
- [ ] Permission checks at appropriate levels
- [ ] Audit logging included for sensitive operations
- [ ] Error handling covers permission denied scenarios
- [ ] Tests cover multi-tenant scenarios
- [ ] Documentation updated for multi-tenant features

### Review Focus Areas
1. **Security**: Permission checks and isolation
2. **Multi-Tenancy**: Company context and data isolation
3. **Support Restrictions**: Key operation prevention
4. **Audit Trail**: Proper logging and attribution
5. **Performance**: Efficient queries with company scoping
6. **Error Handling**: Graceful permission denial

## 📞 Questions and Support

- **Architecture Questions**: Review [NEW_SCHEMA_DOCUMENTATION.md](./NEW_SCHEMA_DOCUMENTATION.md)
- **API Questions**: Check http://localhost:3000/docs
- **Multi-Tenant Issues**: Create an issue with "multi-tenant" label
- **Security Concerns**: Create an issue with "security" label
- **Permission System**: Review support employee documentation

## 🎯 Contribution Priorities

### High Priority
- Support employee permission enhancements
- Company isolation improvements
- Security hardening
- Performance optimizations for multi-tenant queries
- Comprehensive test coverage

### Medium Priority
- New user type additions
- Enhanced audit reporting
- Cross-company feature improvements
- Documentation enhancements

### Low Priority
- UI/UX improvements
- Additional convenience features
- Legacy system compatibility

Thank you for contributing to our secure multi-tenant white-label platform! 🙏

---

**Remember: Security and company isolation are paramount. When in doubt, err on the side of restriction rather than permission.**