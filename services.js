const { User, UserHierarchy, KeyManagement, Customer, AuditLog } = require('./schemas');

// Hierarchy Management Service
class HierarchyService {
  
  // Create or update user hierarchy when a new user is created
  static async createUserHierarchy(userId, parentUserId = null, companyId) {
    try {
      const user = await User.findOne({ userId });
      if (!user) throw new Error('User not found');

      let hierarchyPath = [];
      let allParents = [];
      let directParent = null;

      // If user has a parent, build hierarchy path
      if (parentUserId) {
        const parentHierarchy = await UserHierarchy.findOne({ userId: parentUserId });
        const parent = await User.findOne({ userId: parentUserId });
        
        if (parent) {
          directParent = {
            userId: parent.userId,
            userType: parent.userType,
            name: parent.name
          };

          // Build hierarchy path from parent's path
          if (parentHierarchy) {
            hierarchyPath = [...parentHierarchy.hierarchyPath];
            allParents = [...parentHierarchy.allParents];
          }
          
          // Add current parent to the path
          hierarchyPath.push({
            userId: parent.userId,
            userType: parent.userType,
            level: hierarchyPath.length,
            name: parent.name
          });

          allParents.push({
            userId: parent.userId,
            userType: parent.userType,
            name: parent.name,
            level: hierarchyPath.length - 1
          });
        }
      }

      // Create or update user hierarchy
      const hierarchy = await UserHierarchy.findOneAndUpdate(
        { userId },
        {
          companyId,
          hierarchyPath,
          directParent,
          allParents,
          directChildren: [],
          allChildren: [],
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      // Update parent's children if parent exists
      if (parentUserId) {
        await this.updateParentChildren(parentUserId, userId);
      }

      return hierarchy;
    } catch (error) {
      throw new Error(`Error creating user hierarchy: ${error.message}`);
    }
  }

  // Update parent's children when a new child is added
  static async updateParentChildren(parentUserId, childUserId) {
    try {
      const child = await User.findOne({ userId: childUserId });
      const parentHierarchy = await UserHierarchy.findOne({ userId: parentUserId });
      
      if (!child || !parentHierarchy) return;

      // Add to direct children
      const directChildExists = parentHierarchy.directChildren.some(
        dc => dc.userId === childUserId
      );
      
      if (!directChildExists) {
        parentHierarchy.directChildren.push({
          userId: child.userId,
          userType: child.userType,
          name: child.name
        });
      }

      // Add to all children
      const allChildExists = parentHierarchy.allChildren.some(
        ac => ac.userId === childUserId
      );
      
      if (!allChildExists) {
        parentHierarchy.allChildren.push({
          userId: child.userId,
          userType: child.userType,
          name: child.name,
          level: parentHierarchy.hierarchyPath.length + 1
        });
      }

      await parentHierarchy.save();

      // Update all ancestors' allChildren
      for (const ancestor of parentHierarchy.allParents) {
        await UserHierarchy.updateOne(
          { userId: ancestor.userId },
          {
            $addToSet: {
              allChildren: {
                userId: child.userId,
                userType: child.userType,
                name: child.name,
                level: ancestor.level + 2
              }
            }
          }
        );
      }
    } catch (error) {
      throw new Error(`Error updating parent children: ${error.message}`);
    }
  }

  // Check if user has permission to view/edit another user's data
  static async checkUserPermission(requestingUserId, targetUserId) {
    try {
      const requestingUserHierarchy = await UserHierarchy.findOne({ userId: requestingUserId });
      const targetUserHierarchy = await UserHierarchy.findOne({ userId: targetUserId });
      
      if (!requestingUserHierarchy || !targetUserHierarchy) {
        return false;
      }

      // Check if requesting user is in target user's hierarchy path (is a parent)
      const isParent = targetUserHierarchy.hierarchyPath.some(
        parent => parent.userId === requestingUserId
      );

      // Check if target user is in requesting user's all children (is a child)
      const isChild = requestingUserHierarchy.allChildren.some(
        child => child.userId === targetUserId
      );

      return isParent || isChild || requestingUserId === targetUserId;
    } catch (error) {
      throw new Error(`Error checking user permission: ${error.message}`);
    }
  }

  // Get all users in a user's hierarchy (both up and down)
  static async getUserHierarchy(userId) {
    try {
      const hierarchy = await UserHierarchy.findOne({ userId });
      if (!hierarchy) return null;

      return {
        user: userId,
        parents: hierarchy.allParents,
        children: hierarchy.allChildren,
        directChildren: hierarchy.directChildren,
        hierarchyPath: hierarchy.hierarchyPath
      };
    } catch (error) {
      throw new Error(`Error getting user hierarchy: ${error.message}`);
    }
  }

  // Get all users that a specific user can manage
  static async getManageableUsers(userId) {
    try {
      const hierarchy = await UserHierarchy.findOne({ userId });
      if (!hierarchy) return [];

      const manageableUserIds = hierarchy.allChildren.map(child => child.userId);
      manageableUserIds.push(userId); // User can manage themselves

      return await User.find({ userId: { $in: manageableUserIds } });
    } catch (error) {
      throw new Error(`Error getting manageable users: ${error.message}`);
    }
  }
}

// Key Management Service
class KeyManagementService {
  
  // Allocate keys from parent to child
  static async allocateKeys(fromUserId, toUserId, keyCount, companyId) {
    try {
      // Check if fromUser has enough keys
      const fromUser = await User.findOne({ userId: fromUserId });
      if (!fromUser || fromUser.keyAllocation.remainingKeys < keyCount) {
        throw new Error('Insufficient keys to allocate');
      }

      // Check if users are in the same hierarchy
      const hasPermission = await HierarchyService.checkUserPermission(fromUserId, toUserId);
      if (!hasPermission) {
        throw new Error('No permission to allocate keys to this user');
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
        isActive: true
      });

      await keyRecord.save();

      // Create audit log
      await this.createAuditLog(fromUserId, 'KEY_ALLOCATION', 'KEY', keyRecord.keyId, null, {
        fromUserId,
        toUserId,
        keyCount
      }, companyId);

      return keyRecord;
    } catch (error) {
      throw new Error(`Error allocating keys: ${error.message}`);
    }
  }

  // Revoke keys from a user
  static async revokeKeys(fromUserId, targetUserId, keyCount, companyId) {
    try {
      // Check permissions
      const hasPermission = await HierarchyService.checkUserPermission(fromUserId, targetUserId);
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
        isActive: true
      });

      await keyRecord.save();

      // Create audit log
      await this.createAuditLog(fromUserId, 'KEY_REVOCATION', 'KEY', keyRecord.keyId, null, {
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
        isActive: true
      });

      await keyRecord.save();

      // Create audit log
      await this.createAuditLog(retailerId, 'KEY_USAGE', 'KEY', keyRecord.keyId, null, {
        retailerId,
        warrantyKey
      }, companyId);

      return warrantyKey;
    } catch (error) {
      throw new Error(`Error using key: ${error.message}`);
    }
  }

  // Get key allocation history for a user
  static async getKeyHistory(userId, companyId) {
    try {
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

  // Create audit log entry
  static async createAuditLog(userId, action, entityType, entityId, oldData, newData, companyId) {
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
        timestamp: new Date()
      });

      await auditLog.save();
      return auditLog;
    } catch (error) {
      console.error('Error creating audit log:', error);
    }
  }
}

// Customer Service
class CustomerService {
  
  // Create a new customer warranty
  static async createCustomer(customerData, retailerId, companyId) {
    try {
      // Check if retailer exists and is a retailer
      const retailer = await User.findOne({ userId: retailerId, userType: 'RETAILER' });
      if (!retailer) {
        throw new Error('Invalid retailer');
      }

      // Use a key to create warranty
      const warrantyKey = await KeyManagementService.useKey(retailerId, companyId);

      // Get retailer's hierarchy
      const retailerHierarchy = await HierarchyService.getUserHierarchy(retailerId);

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
          distributorChain: retailerHierarchy ? retailerHierarchy.parents : []
        }
      });

      await customer.save();

      // Create audit log
      await KeyManagementService.createAuditLog(
        retailerId,
        'CREATE',
        'CUSTOMER',
        customer.customerId,
        null,
        customer.toObject(),
        companyId
      );

      return customer;
    } catch (error) {
      throw new Error(`Error creating customer: ${error.message}`);
    }
  }

  // Get customers accessible to a user based on hierarchy
  static async getAccessibleCustomers(userId, companyId, filters = {}) {
    try {
      // Get user's hierarchy
      const hierarchy = await HierarchyService.getUserHierarchy(userId);
      if (!hierarchy) return [];

      // Get all users in hierarchy (children + self)
      const accessibleUserIds = hierarchy.children.map(child => child.userId);
      accessibleUserIds.push(userId);

      // Build query
      const query = {
        companyId,
        retailerId: { $in: accessibleUserIds },
        ...filters
      };

      const customers = await Customer.find(query).sort({ 'dates.createdDate': -1 });
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

      // Check if user has permission to access the retailer who created this customer
      return await HierarchyService.checkUserPermission(userId, customer.retailerId);
    } catch (error) {
      throw new Error(`Error checking customer access: ${error.message}`);
    }
  }

  // Update customer (only by main company, not whitelabel)
  static async updateCustomer(customerId, updateData, updatedBy, companyId) {
    try {
      const customer = await Customer.findOne({ customerId });
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Store old data for audit
      const oldData = customer.toObject();

      // Update customer
      const updatedCustomer = await Customer.findOneAndUpdate(
        { customerId },
        {
          ...updateData,
          'dates.lastModifiedDate': new Date()
        },
        { new: true }
      );

      // Create audit log
      await KeyManagementService.createAuditLog(
        updatedBy,
        'UPDATE',
        'CUSTOMER',
        customerId,
        oldData,
        updatedCustomer.toObject(),
        companyId
      );

      return updatedCustomer;
    } catch (error) {
      throw new Error(`Error updating customer: ${error.message}`);
    }
  }

  // Get customer statistics for a user
  static async getCustomerStats(userId, companyId) {
    try {
      const hierarchy = await HierarchyService.getUserHierarchy(userId);
      if (!hierarchy) return null;

      const accessibleUserIds = hierarchy.children.map(child => child.userId);
      accessibleUserIds.push(userId);

      const stats = await Customer.aggregate([
        {
          $match: {
            companyId,
            retailerId: { $in: accessibleUserIds }
          }
        },
        {
          $group: {
            _id: null,
            totalCustomers: { $sum: 1 },
            activeWarranties: {
              $sum: {
                $cond: [
                  { $gte: ['$warrantyDetails.expiryDate', new Date()] },
                  1,
                  0
                ]
              }
            },
            expiredWarranties: {
              $sum: {
                $cond: [
                  { $lt: ['$warrantyDetails.expiryDate', new Date()] },
                  1,
                  0
                ]
              }
            },
            totalPremium: { $sum: '$warrantyDetails.premiumAmount' }
          }
        }
      ]);

      return stats[0] || {
        totalCustomers: 0,
        activeWarranties: 0,
        expiredWarranties: 0,
        totalPremium: 0
      };
    } catch (error) {
      throw new Error(`Error getting customer stats: ${error.message}`);
    }
  }
}

// Validation Service
class ValidationService {
  
  // Validate user creation permissions
  static async validateUserCreation(creatingUserId, newUserType, companyId) {
    try {
      const creatingUser = await User.findOne({ userId: creatingUserId });
      if (!creatingUser) {
        throw new Error('Creating user not found');
      }

      // Retailers can only create customers, not other users
      if (creatingUser.userType === 'RETAILER') {
        throw new Error('Retailers can only create customers, not users');
      }

      // Define hierarchy levels
      const hierarchyLevels = {
        'TSM': 1,
        'ASM': 2,
        'SALES_EXECUTIVE': 3,
        'SUPER_DISTRIBUTOR': 4,
        'DISTRIBUTOR': 5,
        'NATIONAL_DISTRIBUTOR': 6,
        'MINI_DISTRIBUTOR': 7,
        'RETAILER': 8
      };

      const creatingUserLevel = hierarchyLevels[creatingUser.userType];
      const newUserLevel = hierarchyLevels[newUserType];

      // User can only create users at their level or below
      if (newUserLevel <= creatingUserLevel) {
        throw new Error('Cannot create user at higher or same hierarchy level');
      }

      return true;
    } catch (error) {
      throw new Error(`Validation error: ${error.message}`);
    }
  }

  // Validate unique fields
  static async validateUniqueFields(userData, excludeUserId = null) {
    try {
      const emailQuery = { email: userData.email };
      const phoneQuery = { phone: userData.phone };

      if (excludeUserId) {
        emailQuery.userId = { $ne: excludeUserId };
        phoneQuery.userId = { $ne: excludeUserId };
      }

      const existingEmailUser = await User.findOne(emailQuery);
      const existingPhoneUser = await User.findOne(phoneQuery);

      if (existingEmailUser) {
        throw new Error('Email already exists');
      }

      if (existingPhoneUser) {
        throw new Error('Phone number already exists');
      }

      return true;
    } catch (error) {
      throw new Error(`Validation error: ${error.message}`);
    }
  }

  // Validate customer data
  static async validateCustomerData(customerData, companyId) {
    try {
      // Check if IMEI1 is unique
      const existingIMEI = await Customer.findOne({
        'productDetails.imei1': customerData.productDetails.imei1,
        companyId
      });

      if (existingIMEI) {
        throw new Error('IMEI1 already exists');
      }

      // Check if invoice number is unique
      const existingInvoice = await Customer.findOne({
        'invoiceDetails.invoiceNumber': customerData.invoiceDetails.invoiceNumber,
        companyId
      });

      if (existingInvoice) {
        throw new Error('Invoice number already exists');
      }

      // Validate warranty dates
      const startDate = new Date(customerData.warrantyDetails.startDate);
      const expiryDate = new Date(customerData.warrantyDetails.expiryDate);

      if (expiryDate <= startDate) {
        throw new Error('Warranty expiry date must be after start date');
      }

      return true;
    } catch (error) {
      throw new Error(`Customer validation error: ${error.message}`);
    }
  }
}

// Export all services
module.exports = {
  HierarchyService,
  KeyManagementService,
  CustomerService,
  ValidationService
};