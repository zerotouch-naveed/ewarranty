const { User, UserHierarchy, KeyManagement, Customer, AuditLog, Company, SupportPermission, SupportAssignment } = require('./schemas');

// Company Management Service
class CompanyService {
  
  // Create main company (only one should exist)
  static async createMainCompany(companyData, createdBy = null) {
    try {
      // Check if main company already exists
      const existingMainCompany = await Company.findOne({ companyType: 'MAIN' });
      if (existingMainCompany) {
        throw new Error('Main company already exists');
      }

      const company = new Company({
        companyId: `MAIN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        companyType: 'MAIN',
        parentCompanyId: null,
        ...companyData,
        createdBy
      });

      await company.save();

      // Create audit log
      if (createdBy) {
        await this.createAuditLog(createdBy, 'CREATE', 'COMPANY', company.companyId, null, company.toObject(), company.companyId);
      }

      return company;
    } catch (error) {
      throw new Error(`Error creating main company: ${error.message}`);
    }
  }

  // Create white-label company
  static async createWhitelabelCompany(companyData, createdBy, parentCompanyId = null) {
    try {
      // Get main company if parentCompanyId not provided
      if (!parentCompanyId) {
        const mainCompany = await Company.findOne({ companyType: 'MAIN' });
        if (!mainCompany) {
          throw new Error('Main company must exist before creating white-labels');
        }
        parentCompanyId = mainCompany.companyId;
      }

      // Verify creator has permission
      const creator = await User.findOne({ userId: createdBy });
      if (!creator || (!creator.userType.startsWith('MAIN_') && !creator.userType.startsWith('WHITELABEL_OWNER'))) {
        throw new Error('Only main company users or white-label owners can create white-label companies');
      }

      const company = new Company({
        companyId: `WL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        companyType: 'WHITELABEL',
        parentCompanyId,
        ...companyData,
        createdBy
      });

      await company.save();

      // Create audit log
      await this.createAuditLog(createdBy, 'CREATE', 'COMPANY', company.companyId, null, company.toObject(), creator.companyId);

      return company;
    } catch (error) {
      throw new Error(`Error creating white-label company: ${error.message}`);
    }
  }

  // Get companies accessible to a user
  static async getAccessibleCompanies(userId) {
    try {
      const user = await User.findOne({ userId });
      if (!user) throw new Error('User not found');

      let query = {};

      if (user.userType.startsWith('MAIN_')) {
        // Main company users can see all companies
        query = {};
      } else if (user.userType.startsWith('WHITELABEL_')) {
        // White-label users can only see their own company
        query = { companyId: user.companyId };
      } else {
        // Legacy users can only see their company
        query = { companyId: user.companyId };
      }

      return await Company.find(query).sort({ createdAt: -1 });
    } catch (error) {
      throw new Error(`Error getting accessible companies: ${error.message}`);
    }
  }

  // Create audit log entry
  static async createAuditLog(userId, action, entityType, entityId, oldData, newData, companyId, onBehalfOf = null) {
    try {
      const auditLog = new AuditLog({
        logId: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        companyId,
        userId,
        action,
        entityType,
        entityId,
        oldData,
        newData,
        onBehalfOf,
        timestamp: new Date()
      });

      await auditLog.save();
      return auditLog;
    } catch (error) {
      console.error('Error creating audit log:', error);
    }
  }
}

// Support Permission Service
class SupportPermissionService {
  
  // Create a permission set for support employees
  static async createPermissionSet(permissionData, createdBy) {
    try {
      const creator = await User.findOne({ userId: createdBy });
      if (!creator) throw new Error('Creator not found');

      // Only owners and employees can create permission sets
      if (!creator.userType.includes('OWNER') && !creator.userType.includes('EMPLOYEE')) {
        throw new Error('Only owners and employees can create permission sets');
      }

      const permission = new SupportPermission({
        permissionId: `PERM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        companyId: creator.companyId,
        ...permissionData,
        createdBy
      });

      await permission.save();

      // Create audit log
      await CompanyService.createAuditLog(
        createdBy,
        'CREATE',
        'PERMISSION',
        permission.permissionId,
        null,
        permission.toObject(),
        creator.companyId
      );

      return permission;
    } catch (error) {
      throw new Error(`Error creating permission set: ${error.message}`);
    }
  }

  // Assign permission set to a support employee
  static async assignPermissionToUser(userId, permissionSetId, assignedBy) {
    try {
      const user = await User.findOne({ userId });
      const assigner = await User.findOne({ userId: assignedBy });
      const permissionSet = await SupportPermission.findOne({ permissionId: permissionSetId });

      if (!user || !assigner || !permissionSet) {
        throw new Error('User, assigner, or permission set not found');
      }

      // Check if user is a support employee
      if (!user.userType.includes('SUPPORT_EMPLOYEE')) {
        throw new Error('Permissions can only be assigned to support employees');
      }

      // Check hierarchy permission
      const canAssign = await this.canAssignPermissions(assignedBy, userId);
      if (!canAssign) {
        throw new Error('No permission to assign permissions to this user');
      }

      // Update user with permission set
      user.supportPermissions.permissionSetId = permissionSetId;
      user.supportPermissions.assignedBy = assignedBy;
      user.supportPermissions.assignedAt = new Date();
      user.supportPermissions.effectivePermissions = permissionSet.permissions;

      await user.save();

      // Create audit log
      await CompanyService.createAuditLog(
        assignedBy,
        'PERMISSION_CHANGE',
        'USER',
        userId,
        null,
        { permissionSetId, assignedBy },
        assigner.companyId
      );

      return user;
    } catch (error) {
      throw new Error(`Error assigning permission: ${error.message}`);
    }
  }

  // Check if user can assign permissions to another user
  static async canAssignPermissions(assignerId, targetUserId) {
    try {
      const assigner = await User.findOne({ userId: assignerId });
      const target = await User.findOne({ userId: targetUserId });

      if (!assigner || !target) return false;

      // Owners and employees can assign permissions to support employees in their hierarchy
      if (assigner.userType.includes('OWNER') || assigner.userType.includes('EMPLOYEE')) {
        // Check if same company or if main company user assigning to white-label
        if (assigner.companyId === target.companyId) return true;
        
        if (assigner.userType.startsWith('MAIN_')) {
          const targetCompany = await Company.findOne({ companyId: target.companyId });
          const assignerCompany = await Company.findOne({ companyId: assigner.companyId });
          
          if (assignerCompany?.companyType === 'MAIN' && targetCompany?.companyType === 'WHITELABEL') {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  // Get permission sets for a company
  static async getPermissionSets(companyId, requestingUserId) {
    try {
      const requester = await User.findOne({ userId: requestingUserId });
      if (!requester) throw new Error('Requesting user not found');

      let query = { companyId, isActive: true };

      // Main company users can see all permission sets
      if (requester.userType.startsWith('MAIN_')) {
        query = { isActive: true };
      }

      return await SupportPermission.find(query).sort({ createdAt: -1 });
    } catch (error) {
      throw new Error(`Error getting permission sets: ${error.message}`);
    }
  }
}

// Support Assignment Service
class SupportAssignmentService {
  
  // Assign support employee to company/user/hierarchy
  static async createAssignment(assignmentData, assignedBy) {
    try {
      const assigner = await User.findOne({ userId: assignedBy });
      const supportEmployee = await User.findOne({ userId: assignmentData.supportEmployeeId });

      if (!assigner || !supportEmployee) {
        throw new Error('Assigner or support employee not found');
      }

      // Verify support employee
      if (!supportEmployee.userType.includes('SUPPORT_EMPLOYEE')) {
        throw new Error('Can only assign support employees');
      }

      // Check assignment permission
      const canAssign = await this.canCreateAssignment(assignedBy, assignmentData);
      if (!canAssign) {
        throw new Error('No permission to create this assignment');
      }

      const assignment = new SupportAssignment({
        assignmentId: `ASSIGN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...assignmentData,
        assignedBy
      });

      await assignment.save();

      // Update user's assigned companies if it's a company assignment
      if (assignmentData.assignmentType === 'COMPANY' && assignmentData.targetCompanyId) {
        const targetCompany = await Company.findOne({ companyId: assignmentData.targetCompanyId });
        if (targetCompany) {
          supportEmployee.assignedCompanies.push({
            companyId: assignmentData.targetCompanyId,
            companyName: targetCompany.name,
            assignedAt: new Date(),
            assignedBy
          });
          await supportEmployee.save();
        }
      }

      // Create audit log
      await CompanyService.createAuditLog(
        assignedBy,
        'SUPPORT_ASSIGNMENT',
        'ASSIGNMENT',
        assignment.assignmentId,
        null,
        assignment.toObject(),
        assigner.companyId
      );

      return assignment;
    } catch (error) {
      throw new Error(`Error creating assignment: ${error.message}`);
    }
  }

  // Check if user can create assignment
  static async canCreateAssignment(assignerId, assignmentData) {
    try {
      const assigner = await User.findOne({ userId: assignerId });
      if (!assigner) return false;

      // Only owners and employees can create assignments
      if (!assigner.userType.includes('OWNER') && !assigner.userType.includes('EMPLOYEE')) {
        return false;
      }

      // Main company users can assign to any white-label
      if (assigner.userType.startsWith('MAIN_')) {
        return true;
      }

      // White-label users can only assign within their company
      if (assigner.userType.startsWith('WHITELABEL_')) {
        if (assignmentData.targetCompanyId === assigner.companyId) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  // Get assignments for a support employee
  static async getUserAssignments(supportEmployeeId) {
    try {
      return await SupportAssignment.find({
        supportEmployeeId,
        isActive: true,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      }).sort({ assignedAt: -1 });
    } catch (error) {
      throw new Error(`Error getting user assignments: ${error.message}`);
    }
  }
}

// Enhanced Hierarchy Management Service
class HierarchyService {
  static async createUserHierarchy(userId, parentUserId = null, companyId) {
    try {
      const user = await User.findOne({ userId });
      if (!user) throw new Error('User not found');

      let hierarchyPath = [];
      let directParent = null;
      let crossCompanyAccess = [];

      // Cross-company access for MAIN users
      if (user.userType.startsWith('MAIN_')) {
        const whitelabelCompanies = await Company.find({ companyType: 'WHITELABEL' });
        crossCompanyAccess = whitelabelCompanies.map(company => ({
          companyId: company.companyId,
          accessLevel: user.userType.includes('SUPPORT_EMPLOYEE') ? 'SUPPORT_ONLY' : 'FULL'
        }));
      }

      if (parentUserId) {
        const parent = await User.findOne({ userId: parentUserId });
        const parentHierarchy = await UserHierarchy.findOne({ userId: parentUserId });

        if (parent) {
          directParent = {
            userId: parent.userId,
            userType: parent.userType,
            name: parent.name
          };

          if (parentHierarchy) {
            hierarchyPath = [...parentHierarchy.hierarchyPath];
          }

          hierarchyPath.push({
            userId: parent.userId,
            userType: parent.userType,
            name: parent.name,
            level: hierarchyPath.length
          });
        }
      }

      const hierarchy = await UserHierarchy.findOneAndUpdate(
        { userId },
        {
          companyId,
          crossCompanyAccess,
          hierarchyPath,
          directParent,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      return hierarchy;
    } catch (error) {
      throw new Error(`Error creating user hierarchy: ${error.message}`);
    }
  }

  static async isAncestor(ancestorUserId, targetUserId) {
    const targetHierarchy = await UserHierarchy.findOne({ userId: targetUserId });
    if (!targetHierarchy) return false;
    return targetHierarchy.hierarchyPath.some(p => p.userId === ancestorUserId);
  }

  static async checkUserPermission(requestingUserId, targetUserId, action = 'VIEW') {
    const requestingUser = await User.findOne({ userId: requestingUserId });
    const targetUser = await User.findOne({ userId: targetUserId });
    if (!requestingUser || !targetUser) return false;

    if (requestingUser.userType.includes('SUPPORT_EMPLOYEE')) {
      return this.checkSupportEmployeePermission(requestingUserId, targetUserId, action);
    }

    if (requestingUserId === targetUserId) return true;

    const sameCompany = requestingUser.companyId === targetUser.companyId;

    if (sameCompany) {
      return this.isAncestor(requestingUserId, targetUserId);
    }

    // Cross-company check for MAIN
    if (requestingUser.userType.startsWith('MAIN_')) {
      const targetCompany = await Company.findOne({ companyId: targetUser.companyId });
      return targetCompany?.companyType === 'WHITELABEL';
    }

    return false;
  }

  static async checkSupportEmployeePermission(supportUserId, targetUserId, action) {
    const supportUser = await User.findOne({ userId: supportUserId });
    const targetUser = await User.findOne({ userId: targetUserId });
    if (!supportUser || !targetUser) return false;

    const permissions = supportUser.supportPermissions?.effectivePermissions;
    if (!permissions) return false;

    const actionMap = {
      'VIEW': permissions.canViewUsers,
      'CREATE': permissions.canCreateUsers,
      'EDIT': permissions.canEditUsers,
      'DELETE': permissions.canDeleteUsers,
      'VIEW_CUSTOMERS': permissions.canViewCustomers,
      'CREATE_CUSTOMERS': permissions.canCreateCustomers,
      'EDIT_CUSTOMERS': permissions.canEditCustomers,
      'DELETE_CUSTOMERS': permissions.canDeleteCustomers
    };

    if (!actionMap[action]) return false;

    const assignments = await SupportAssignmentService.getUserAssignments(supportUserId);
    for (const assignment of assignments) {
      if (assignment.assignmentType === 'COMPANY' && assignment.targetCompanyId === targetUser.companyId) {
        return true;
      }
      if (assignment.assignmentType === 'USER' && assignment.targetUserId === targetUserId) {
        return true;
      }
      if (assignment.assignmentType === 'HIERARCHY') {
        const targetHierarchy = await UserHierarchy.findOne({ userId: targetUserId });
        if (targetHierarchy && targetHierarchy.hierarchyPath.length <= assignment.targetHierarchyLevel) {
          return true;
        }
      }
    }

    if (supportUser.userType === 'MAIN_SUPPORT_EMPLOYEE' && permissions.canAccessCrossCompany) {
      const targetCompany = await Company.findOne({ companyId: targetUser.companyId });
      return targetCompany?.companyType === 'WHITELABEL';
    }

    return false;
  }

  static async getManageableUsers(managerUserId) {
    const hierarchies = await UserHierarchy.find({ 'hierarchyPath.userId': managerUserId });
    console.log('hierarchies      ', hierarchies);
    
    const userIds = hierarchies.map(h => h.userId);
    const users = await User.find({ userId: { $in: userIds } });
    return users;
  }
}

// Enhanced Key Management Service (with support employee restrictions)
class KeyManagementService {
  
  // Allocate keys from parent to child (RESTRICTED for support employees)
  static async allocateKeys(fromUserId, toUserId, keyCount, companyId) {
    try {
      // Check if fromUser is a support employee (not allowed)
      const fromUser = await User.findOne({ userId: fromUserId });
      if (!fromUser) throw new Error('From user not found');
      
      if (fromUser.userType.includes('SUPPORT_EMPLOYEE')) {
        throw new Error('Support employees cannot allocate keys');
      }

      // Check if fromUser has enough keys
      if (fromUser.keyAllocation.remainingKeys < keyCount) {
        throw new Error('Insufficient keys to allocate');
      }

      // Check if users are in the same hierarchy
      const hasPermission = await HierarchyService.checkUserPermission(fromUserId, toUserId, 'EDIT');
      if (!hasPermission) {
        throw new Error('No permission to allocate keys to this user');
      }
      const targetUser = await User.findOne({ userId: toUserId });

      if (fromUser.userType.startsWith('MAIN_') || fromUser?.userType.startsWith('WHITELABEL_OWNER')){
        await Company.updateOne(
          {companyId: fromUser.companyId},
          {
            $inc: {
              'keyAllocation.usedKeys': keyCount,
              'keyAllocation.remainingKeys': -keyCount
            }
          }
        );
      }


      if (targetUser?.userType.startsWith('WHITELABEL_OWNER')){
        await Company.updateOne(
          {companyId: target.companyId},
          {
            $inc: {
              'keyAllocation.usedKeys': keyCount,
              'keyAllocation.remainingKeys': -keyCount
            }
          }
        );
      }
      // Update key counts
      await User.updateOne(
        { userId: fromUserId },
        {
          $inc: {
            'keyAllocation.usedKeys': keyCount,
            'keyAllocation.remainingKeys': -keyCount
          }
        }
      );

      await User.updateOne(
        { userId: toUserId },
        {
          $inc: {
            'keyAllocation.totalKeys': keyCount,
            'keyAllocation.remainingKeys': keyCount
          }
        }
      );

      // Create key management record
      const keyRecord = new KeyManagement({
        keyId: `KEY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        companyId,
        keyType: 'ALLOCATION',
        fromUserId,
        toUserId,
        keyCount,
        isActive: true,
        isRestrictedOperation: true
      });

      await keyRecord.save();

      // Create audit log
      await CompanyService.createAuditLog(fromUserId, 'KEY_ALLOCATION', 'KEY', keyRecord.keyId, null, {
        fromUserId,
        toUserId,
        keyCount
      }, companyId);

      return keyRecord;
    } catch (error) {
      throw new Error(`Error allocating keys: ${error.message}`);
    }
  }

  // Revoke keys from a user (RESTRICTED for support employees)
  static async revokeKeys(fromUserId, targetUserId, keyCount, companyId) {
    try {
      // Check if fromUser is a support employee (not allowed)
      const fromUser = await User.findOne({ userId: fromUserId });
      if (!fromUser) throw new Error('From user not found');
      
      if (fromUser.userType.includes('SUPPORT_EMPLOYEE')) {
        throw new Error('Support employees cannot revoke keys');
      }

      // Check permissions
      const hasPermission = await HierarchyService.checkUserPermission(fromUserId, targetUserId, 'EDIT');
      if (!hasPermission) {
        throw new Error('No permission to revoke keys from this user');
      }

      const targetUser = await User.findOne({ userId: targetUserId });
      if (!targetUser || targetUser.keyAllocation.remainingKeys < keyCount) {
        throw new Error('User does not have enough keys to revoke');
      }

      // Update key counts
      await User.updateOne(
        { userId: targetUserId },
        {
          $inc: {
            'keyAllocation.totalKeys': -keyCount,
            'keyAllocation.remainingKeys': -keyCount
          }
        }
      );

      await User.updateOne(
        { userId: fromUserId },
        {
          $inc: {
            'keyAllocation.usedKeys': -keyCount,
            'keyAllocation.remainingKeys': keyCount
          }
        }
      );

      // Create key management record
      const keyRecord = new KeyManagement({
        keyId: `KEY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        companyId,
        keyType: 'REVOKE',
        fromUserId,
        toUserId: targetUserId,
        keyCount,
        isActive: true,
        isRestrictedOperation: true
      });

      await keyRecord.save();

      // Create audit log
      await CompanyService.createAuditLog(fromUserId, 'KEY_REVOCATION', 'KEY', keyRecord.keyId, null, {
        fromUserId,
        targetUserId,
        keyCount
      }, companyId);

      return keyRecord;
    } catch (error) {
      throw new Error(`Error revoking keys: ${error.message}`);
    }
  }

  // Use a key to create a customer warranty
  static async useKey(retailerId, companyId) {
    try {
      const retailer = await User.findOne({ userId: retailerId });
      if (!retailer || retailer.keyAllocation.remainingKeys < 1) {
        throw new Error('No keys available to use');
      }

      // Support employees can't use keys directly
      if (retailer.userType.includes('SUPPORT_EMPLOYEE')) {
        throw new Error('Support employees cannot use keys directly');
      }

      // Generate unique warranty key
      const warrantyKey = `WK_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Update retailer's key count
      await User.updateOne(
        { userId: retailerId },
        {
          $inc: {
            'keyAllocation.usedKeys': 1,
            'keyAllocation.remainingKeys': -1
          }
        }
      );

      // Create key usage record
      const keyRecord = new KeyManagement({
        keyId: `KEY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        companyId,
        keyType: 'USAGE',
        fromUserId: null,
        toUserId: retailerId,
        keyCount: 1,
        isActive: true,
        isRestrictedOperation: true
      });

      await keyRecord.save();

      // Create audit log
      await CompanyService.createAuditLog(retailerId, 'KEY_USAGE', 'KEY', keyRecord.keyId, null, {
        retailerId,
        warrantyKey
      }, companyId);

      return warrantyKey;
    } catch (error) {
      throw new Error(`Error using key: ${error.message}`);
    }
  }

  // Get key allocation history for a user (support employees can view if permitted)
  static async getKeyHistory(userId, companyId, requestingUserId = null) {
    try {
      // If requesting user is specified, check permissions
      if (requestingUserId && requestingUserId !== userId) {
        const hasPermission = await HierarchyService.checkUserPermission(requestingUserId, userId, 'VIEW');
        if (!hasPermission) {
          throw new Error('No permission to view key history for this user');
        }

        // Additional check for support employees
        const requestingUser = await User.findOne({ userId: requestingUserId });
        if (requestingUser?.userType.includes('SUPPORT_EMPLOYEE')) {
          if (!requestingUser.supportPermissions.effectivePermissions.canViewKeyHistory) {
            throw new Error('Support employee does not have permission to view key history');
          }
        }
      }

      const history = await KeyManagement.find({
        $or: [
          { fromUserId: userId },
          { toUserId: userId }
        ],
        companyId
      }).sort({ transactionDate: -1 });

      return history;
    } catch (error) {
      throw new Error(`Error getting key history: ${error.message}`);
    }
  }
}

// Enhanced Customer Service (with support employee permission checks)
class CustomerService {
  
  // Create a new customer warranty (support employees can do this if permitted)
  static async createCustomer(customerData, retailerId, companyId, createdBy = null) {
    try {
      const actualCreator = createdBy || retailerId;
      const creator = await User.findOne({ userId: actualCreator });
      const retailer = await User.findOne({ userId: retailerId });

      if (!creator || !retailer) {
        throw new Error('Creator or retailer not found');
      }

      // Check if creator is a support employee and has permission
      if (creator.userType.includes('SUPPORT_EMPLOYEE')) {
        if (!creator.supportPermissions.effectivePermissions.canCreateCustomers) {
          throw new Error('Support employee does not have permission to create customers');
        }
        
        // Check if support employee can act on behalf of this retailer
        const hasPermission = await HierarchyService.checkUserPermission(actualCreator, retailerId, 'CREATE_CUSTOMERS');
        if (!hasPermission) {
          throw new Error('Support employee cannot create customers for this retailer');
        }
      }

      // Use a key to create warranty (retailer's key, not support employee's)
      const warrantyKey = await KeyManagementService.useKey(retailerId, companyId);

      // Get retailer's hierarchy
      const retailerHierarchy = await UserHierarchy.findOne({ userId: retailerId });
      if (!retailerHierarchy) throw new Error('Retailer hierarchy not found');

      let hierarchyPath = [];
      hierarchyPath = [...retailerHierarchy.hierarchyPath];

      // Create customer
      const customer = new Customer({
        customerId: `CUST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        warrantyKey,
        companyId,
        retailerId,
        customerDetails: customerData.customerDetails,
        productDetails: customerData.productDetails,
        invoiceDetails: customerData.invoiceDetails,
        productImages: customerData.productImages,
        warrantyDetails: customerData.warrantyDetails,
        paymentDetails: {
          ...customerData.paymentDetails,
          orderId: `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        },
        hierarchy: {
          retailer: {
            userId: retailer.userId,
            name: retailer.name,
            userType: retailer.userType
          },
          distributorChain: hierarchyPath
        }
      });

      await customer.save();

      // Create audit log with proper attribution
      const onBehalfOf = (creator.userType.includes('SUPPORT_EMPLOYEE') && actualCreator !== retailerId) 
        ? { userId: retailerId, userType: retailer.userType, companyId: retailer.companyId }
        : null;

      await CompanyService.createAuditLog(
        actualCreator,
        'CREATE',
        'CUSTOMER',
        customer.customerId,
        null,
        customer.toObject(),
        companyId,
        onBehalfOf
      );

      return customer;
    } catch (error) {
      throw new Error(`Error creating customer: ${error.message}`);
    }
  }

  // Get customers accessible to a user based on hierarchy and permissions
  static async getAccessibleCustomers(userId, companyId, userType, filters = {}) {
    try {
      const user = await User.findOne({ userId });
      if (!user) return [];
      let customers = []

      if(userType == "RETAILER"){
        customers = await Customer.find({retailerId: userId, companyId})
      }else{
          let hierarchy = null;
          let accessibleUserIds = [];

        // Support employees have different access logic
        if (user.userType.includes('SUPPORT_EMPLOYEE')) {
          if (!user.supportPermissions.effectivePermissions.canViewCustomers) {
            return [];
          }
          
          const manageableUsers = await HierarchyService.getSupportEmployeeManageableUsers(userId);
          accessibleUserIds = manageableUsers.map(u => u.userId);
        } else {
          // Regular hierarchy access
          hierarchy = await HierarchyService.getManageableUsers(userId);
          if (!hierarchy) return [];

          accessibleUserIds = hierarchy.map(child => child.userId);
          accessibleUserIds.push(userId);

          // Add cross-company access for main company users
          if (user.userType.startsWith('MAIN_')) {
            const whitelabelUsers = await User.find({
              companyId: { $in: hierarchy.crossCompanyAccess.map(access => access.companyId) }
            });
            accessibleUserIds.push(...whitelabelUsers.map(u => u.userId));
          }
        }

        // Build query
        const query = {
          retailerId: { $in: accessibleUserIds },
          ...filters
        };

        // Add company filter for non-main company users
        if (!user.userType.startsWith('MAIN_') || user.userType.includes('SUPPORT_EMPLOYEE')) {
          query.companyId = companyId;
        }
        customers = await Customer.find(query).sort({ 'dates.createdDate': -1 });
      }
      return customers;
    } catch (error) {
      throw new Error(`Error getting accessible customers: ${error.message}`);
    }
  }

  // Check if user can access a specific customer
  static async canAccessCustomer(userId, customerId) {
    try {
      const customer = await Customer.findOne({ customerId });
      if (!customer) return false;

      const user = await User.findOne({ userId });
      if (!user) return false;

      // Support employees need specific permission and assignment
      if (user.userType.includes('SUPPORT_EMPLOYEE')) {
        if (!user.supportPermissions.effectivePermissions.canViewCustomers) {
          return false;
        }
        return await HierarchyService.checkUserPermission(userId, customer.retailerId, 'VIEW_CUSTOMERS');
      }

      // Regular permission check
      return await HierarchyService.checkUserPermission(userId, customer.retailerId, 'VIEW');
    } catch (error) {
      return false;
    }
  }

  // Update customer (with support employee permission checks)
  static async updateCustomer(customerId, updateData, updatedBy, companyId) {
    try {
      const customer = await Customer.findOne({ customerId });
      const updater = await User.findOne({ userId: updatedBy });

      if (!customer || !updater) {
        throw new Error('Customer or updater not found');
      }

      // Check permissions
      const canAccess = await this.canAccessCustomer(updatedBy, customerId);
      if (!canAccess) {
        throw new Error('No permission to update this customer');
      }

      // Additional check for support employees
      if (updater.userType.includes('SUPPORT_EMPLOYEE')) {
        if (!updater.supportPermissions.effectivePermissions.canEditCustomers) {
          throw new Error('Support employee does not have permission to edit customers');
        }
      }

      const oldData = customer.toObject();
      
      // Update customer
      Object.assign(customer, updateData);
      customer.dates.lastModifiedDate = new Date();
      await customer.save();

      // Create audit log with proper attribution
      const onBehalfOf = (updater.userType.includes('SUPPORT_EMPLOYEE') && updatedBy !== customer.retailerId)
        ? { userId: customer.retailerId, userType: 'RETAILER', companyId: customer.companyId }
        : null;

      await CompanyService.createAuditLog(
        updatedBy,
        'UPDATE',
        'CUSTOMER',
        customerId,
        oldData,
        customer.toObject(),
        companyId,
        onBehalfOf
      );

      return customer;
    } catch (error) {
      throw new Error(`Error updating customer: ${error.message}`);
    }
  }

  // Get customer statistics (with support employee access control)
  static async getCustomerStats(userId, companyId, userType) {
    try {
      const accessibleCustomers = await this.getAccessibleCustomers(userId, companyId, userType);
      
      const stats = {
        totalCustomers: accessibleCustomers.length,
        activeWarranties: accessibleCustomers.filter(c => c.warrantyStatus === 'ACTIVE').length,
        pendingPayments: accessibleCustomers.filter(c => c.paymentDetails.paymentStatus === 'PENDING').length,
        completedPayments: accessibleCustomers.filter(c => c.paymentDetails.paymentStatus === 'PAID').length
      };

      return stats;
    } catch (error) {
      throw new Error(`Error getting customer stats: ${error.message}`);
    }
  }
}

// Enhanced Validation Service
class ValidationService {
  
  // Validate user creation with new user types and permissions
  static async validateUserCreation(creatingUserId, newUserData, companyId) {
    try {
      const creator = await User.findOne({ userId: creatingUserId });
      if (!creator) throw new Error('Creating user not found');

      const { userType: newUserType } = newUserData;

      // Support employees cannot create other users unless specifically permitted
      if (creator.userType.includes('SUPPORT_EMPLOYEE')) {
        if (!creator.supportPermissions.effectivePermissions.canCreateUsers) {
          throw new Error('Support employee does not have permission to create users');
        }
      }

      // Validate user type creation permissions
      const userTypeValidation = {
        'MAIN_OWNER': ['MAIN_OWNER'], // Only main owner can create another main owner
        'MAIN_EMPLOYEE': ['MAIN_OWNER', 'MAIN_EMPLOYEE'],
        'MAIN_SUPPORT_EMPLOYEE': ['MAIN_OWNER', 'MAIN_EMPLOYEE'],
        'WHITELABEL_OWNER': ['MAIN_OWNER', 'MAIN_EMPLOYEE', 'WHITELABEL_OWNER'],
        'WHITELABEL_EMPLOYEE': ['WHITELABEL_OWNER', 'WHITELABEL_EMPLOYEE'],
        'WHITELABEL_SUPPORT_EMPLOYEE': ['WHITELABEL_OWNER', 'WHITELABEL_EMPLOYEE'],
        // Legacy types
        'TSM': ['MAIN_OWNER', 'MAIN_EMPLOYEE', 'WHITELABEL_OWNER'],
        'ASM': ['TSM', 'MAIN_OWNER', 'MAIN_EMPLOYEE', 'WHITELABEL_OWNER'],
        'SALES_EXECUTIVE': ['ASM', 'TSM', 'MAIN_OWNER', 'MAIN_EMPLOYEE', 'WHITELABEL_OWNER'],
        'SUPER_DISTRIBUTOR': ['SALES_EXECUTIVE', 'ASM', 'TSM'],
        'DISTRIBUTOR': ['SUPER_DISTRIBUTOR', 'SALES_EXECUTIVE', 'ASM', 'TSM'],
        'NATIONAL_DISTRIBUTOR': ['DISTRIBUTOR', 'SUPER_DISTRIBUTOR', 'SALES_EXECUTIVE'],
        'MINI_DISTRIBUTOR': ['NATIONAL_DISTRIBUTOR', 'DISTRIBUTOR', 'SUPER_DISTRIBUTOR'],
        'RETAILER': ['MINI_DISTRIBUTOR', 'NATIONAL_DISTRIBUTOR', 'DISTRIBUTOR']
      };

      const allowedCreators = userTypeValidation[newUserType] || [];
      if (!allowedCreators.includes(creator.userType)) {
        throw new Error(`User type ${creator.userType} cannot create user type ${newUserType}`);
      }

      // Company validation
      if (newUserType.startsWith('MAIN_') && companyId !== creator.companyId) {
        throw new Error('Main company users can only be created in the main company');
      }

      if (newUserType.startsWith('WHITELABEL_') && !creator.userType.startsWith('MAIN_') && companyId !== creator.companyId) {
        throw new Error('White-label users can only be created in their own company unless created by main company user');
      }

      return true;
    } catch (error) {
      throw new Error(`User creation validation failed: ${error.message}`);
    }
  }

  // Validate unique fields
  static async validateUniqueFields(userData, excludeUserId = null) {
    try {
      const { email, phone, userId } = userData;

      // Check email uniqueness
      const emailExists = await User.findOne({ 
        email: email.toLowerCase(),
        userId: { $ne: excludeUserId }
      });
      if (emailExists) {
        throw new Error('Email already exists');
      }

      // Check userId uniqueness (if provided)
      if (userId) {
        const userIdExists = await User.findOne({ 
          userId,
          userId: { $ne: excludeUserId }
        });
        if (userIdExists) {
          throw new Error('User ID already exists');
        }
      }

      return true;
    } catch (error) {
      throw new Error(`Unique field validation failed: ${error.message}`);
    }
  }

  // Validate customer data (with support employee considerations)
  static async validateCustomerData(customerData, companyId, creatingUserId = null) {
    try {
      const { invoiceDetails, productDetails } = customerData;

      // Check invoice number uniqueness within company
      const invoiceExists = await Customer.findOne({
        'invoiceDetails.invoiceNumber': invoiceDetails.invoiceNumber,
        companyId
      });
      if (invoiceExists) {
        throw new Error('Invoice number already exists in this company');
      }

      // Check IMEI uniqueness globally
      const imeiExists = await Customer.findOne({
        'productDetails.imei1': productDetails.imei1
      });
      if (imeiExists) {
        throw new Error('IMEI already exists');
      }

      // If creator is support employee, validate they can create in this company
      if (creatingUserId) {
        const creator = await User.findOne({ userId: creatingUserId });
        if (creator?.userType.includes('SUPPORT_EMPLOYEE')) {
          const assignments = await SupportAssignmentService.getUserAssignments(creatingUserId);
          const canCreateInCompany = assignments.some(a => 
            a.assignmentType === 'COMPANY' && a.targetCompanyId === companyId
          );
          if (!canCreateInCompany) {
            throw new Error('Support employee not assigned to this company');
          }
        }
      }

      return true;
    } catch (error) {
      throw new Error(`Customer data validation failed: ${error.message}`);
    }
  }
}

module.exports = {
  CompanyService,
  SupportPermissionService,
  SupportAssignmentService,
  HierarchyService,
  KeyManagementService,
  CustomerService,
  ValidationService
};