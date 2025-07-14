const jwt = require('jsonwebtoken');
const { User, Company, SupportPermission } = require('../schemas');
const { HierarchyService, SupportAssignmentService } = require('../services');

// Authentication middleware
const authenticate = async (request, reply) => {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ 
        success: false,
        error: 'Access denied. No token provided or invalid format.' 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return reply.code(401).send({ 
        success: false,
        error: 'Access denied. No token provided.' 
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findOne({ 
        userId: decoded.userId,
        isActive: true 
      }).select('-password');
      
      if (!user) {
        return reply.code(401).send({ 
          success: false,
          error: 'Invalid token or user not found.' 
        });
      }

      // Add user to request object with additional company context
      const company = await Company.findOne({ companyId: user.companyId });
      request.user = {
        ...user.toObject(),
        company: company || null,
        isMainCompanyUser: user.userType.startsWith('MAIN_'),
        isWhitelabelUser: user.userType.startsWith('WHITELABEL_'),
        isSupportEmployee: user.userType.includes('SUPPORT_EMPLOYEE'),
        isOwner: user.userType.includes('OWNER'),
        isEmployee: user.userType.includes('EMPLOYEE')
      };
      
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return reply.code(401).send({ 
          success: false,
          error: 'Token expired. Please login again.' 
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return reply.code(401).send({ 
          success: false,
          error: 'Invalid token.' 
        });
      } else {
        throw jwtError;
      }
    }
    
  } catch (error) {
    request.log.error('Authentication error:', error);
    return reply.code(500).send({ 
      success: false,
      error: 'Internal server error during authentication.' 
    });
  }
};

// Authorization middleware for specific user types
const authorize = (...userTypes) => {
  return async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ 
        success: false,
        error: 'Authentication required.' 
      });
    }

    if (!userTypes.includes(request.user.userType)) {
      return reply.code(403).send({ 
        success: false,
        error: `Access denied. Required user type: ${userTypes.join(' or ')}` 
      });
    }
  };
};

// Enhanced authorization for user categories (owners, employees, support)
const authorizeUserCategory = (...categories) => {
  return async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ 
        success: false,
        error: 'Authentication required.' 
      });
    }

    const userMatchesCategory = categories.some(category => {
      switch (category) {
        case 'OWNER':
          return request.user.userType.includes('OWNER');
        case 'EMPLOYEE':
          return request.user.userType.includes('EMPLOYEE');
        case 'SUPPORT_EMPLOYEE':
          return request.user.userType.includes('SUPPORT_EMPLOYEE');
        case 'MAIN_COMPANY':
          return request.user.userType.startsWith('MAIN_');
        case 'WHITELABEL':
          return request.user.userType.startsWith('WHITELABEL_');
        case 'LEGACY':
          return !request.user.userType.includes('MAIN_') && !request.user.userType.includes('WHITELABEL_');
        default:
          return false;
      }
    });

    if (!userMatchesCategory) {
      return reply.code(403).send({ 
        success: false,
        error: `Access denied. Required user category: ${categories.join(' or ')}` 
      });
    }
  };
};

// Company context middleware - ensures user belongs to the same company or has cross-company access
const ensureCompanyContext = async (request, reply) => {
  const { companyId } = request.params;
  
  if (!companyId || !request.user) return;

  // Main company users have access to all white-label companies
  if (request.user.isMainCompanyUser) {
    if (companyId !== request.user.companyId) {
      // Verify it's a white-label company
      const targetCompany = await Company.findOne({ companyId });
      if (!targetCompany || targetCompany.companyType !== 'WHITELABEL') {
        return reply.code(403).send({ 
          success: false,
          error: 'Access denied. Invalid company context.' 
        });
      }
    }
    return; // Allow access
  }

  // Support employees need specific assignments
  if (request.user.isSupportEmployee) {
    // Check if support employee is assigned to this company
    const assignments = await SupportAssignmentService.getUserAssignments(request.user.userId);
    const hasAssignment = assignments.some(assignment => 
      assignment.assignmentType === 'COMPANY' && assignment.targetCompanyId === companyId
    );

    if (!hasAssignment && companyId !== request.user.companyId) {
      return reply.code(403).send({ 
        success: false,
        error: 'Access denied. Support employee not assigned to this company.' 
      });
    }
    return; // Allow access
  }

  // Other users can only access their own company
  if (companyId !== request.user.companyId) {
    return reply.code(403).send({ 
      success: false,
      error: 'Access denied. You can only access your company resources.' 
    });
  }
};

// Permission-based authorization for specific actions
const requirePermission = (action) => {
  return async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ 
        success: false,
        error: 'Authentication required.' 
      });
    }

    // Support employees use dynamic permissions
    if (request.user.isSupportEmployee) {
      const permissions = request.user.supportPermissions?.effectivePermissions;
      if (!permissions) {
        return reply.code(403).send({ 
          success: false,
          error: 'Support employee has no permissions assigned.' 
        });
      }

      // Map actions to permission fields
      const permissionMap = {
        'VIEW_CUSTOMERS': permissions.canViewCustomers,
        'CREATE_CUSTOMERS': permissions.canCreateCustomers,
        'EDIT_CUSTOMERS': permissions.canEditCustomers,
        'DELETE_CUSTOMERS': permissions.canDeleteCustomers,
        'VIEW_USERS': permissions.canViewUsers,
        'CREATE_USERS': permissions.canCreateUsers,
        'EDIT_USERS': permissions.canEditUsers,
        'DELETE_USERS': permissions.canDeleteUsers,
        'VIEW_COMPANY_DATA': permissions.canViewCompanyData,
        'EDIT_COMPANY_SETTINGS': permissions.canEditCompanySettings,
        'VIEW_CLAIMS': permissions.canViewClaims,
        'PROCESS_CLAIMS': permissions.canProcessClaims,
        'VIEW_WARRANTY_PLANS': permissions.canViewWarrantyPlans,
        'EDIT_WARRANTY_PLANS': permissions.canEditWarrantyPlans,
        'VIEW_REPORTS': permissions.canViewReports,
        'EXPORT_DATA': permissions.canExportData,
        'VIEW_KEY_HISTORY': permissions.canViewKeyHistory,
        // Key operations are NEVER allowed for support employees
        'TRANSFER_KEYS': false,
        'ALLOCATE_KEYS': false,
        'REVOKE_KEYS': false,
        'USE_KEYS': false
      };

      if (!permissionMap[action]) {
        return reply.code(403).send({ 
          success: false,
          error: `Support employee does not have permission for action: ${action}` 
        });
      }
    } else {
      // Regular users use traditional permissions
      const permissions = request.user.permissions;
      
      // Map actions to traditional permission fields
      const permissionMap = {
        'CREATE_USERS': permissions.canCreateUser,
        'EDIT_USERS': permissions.canEditUser,
        'VIEW_REPORTS': permissions.canViewReports,
        'MANAGE_KEYS': permissions.canManageKeys,
        'TRANSFER_KEYS': permissions.canManageKeys,
        'ALLOCATE_KEYS': permissions.canManageKeys,
        'REVOKE_KEYS': permissions.canManageKeys,
        'USE_KEYS': permissions.canManageKeys
      };

      // Default permissions for actions not in traditional system
      const defaultPermissions = {
        'VIEW_CUSTOMERS': true,
        'CREATE_CUSTOMERS': true,
        'EDIT_CUSTOMERS': true,
        'DELETE_CUSTOMERS': request.user.isOwner || request.user.isEmployee,
        'VIEW_USERS': true,
        'VIEW_COMPANY_DATA': true,
        'EDIT_COMPANY_SETTINGS': request.user.isOwner || request.user.isEmployee,
        'VIEW_CLAIMS': true,
        'PROCESS_CLAIMS': true,
        'VIEW_WARRANTY_PLANS': true,
        'EDIT_WARRANTY_PLANS': request.user.isOwner || request.user.isEmployee,
        'EXPORT_DATA': true,
        'VIEW_KEY_HISTORY': permissions.canManageKeys
      };

      const hasPermission = permissionMap[action] !== undefined 
        ? permissionMap[action] 
        : defaultPermissions[action] || false;

      if (!hasPermission) {
        return reply.code(403).send({ 
          success: false,
          error: `Access denied. Required permission: ${action}` 
        });
      }
    }
  };
};

// Hierarchy-based authorization
const requireHierarchyAccess = (targetUserParam = 'targetUserId') => {
  return async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ 
        success: false,
        error: 'Authentication required.' 
      });
    }

    const targetUserId = request.params[targetUserParam] || request.body[targetUserParam];
    if (!targetUserId) {
      return reply.code(400).send({ 
        success: false,
        error: 'Target user ID required.' 
      });
    }

    const hasPermission = await HierarchyService.checkUserPermission(
      request.user.userId, 
      targetUserId,
      'VIEW'
    );

    if (!hasPermission) {
      return reply.code(403).send({ 
        success: false,
        error: 'Access denied. User not in your hierarchy or assigned scope.' 
      });
    }
  };
};

// Key operation restrictions (support employees cannot perform key operations)
const restrictKeyOperations = async (request, reply) => {
  if (!request.user) {
    return reply.code(401).send({ 
      success: false,
      error: 'Authentication required.' 
    });
  }

  if (request.user.isSupportEmployee) {
    return reply.code(403).send({ 
      success: false,
      error: 'Support employees cannot perform key operations.' 
    });
  }
};

// Main company only middleware
const requireMainCompany = async (request, reply) => {
  if (!request.user || !request.user.isMainCompanyUser) {
    return reply.code(403).send({ 
      success: false,
      error: 'Access denied. Main company privileges required.' 
    });
  }
};

// White-label company creation authorization
const requireWhitelabelCreationRights = async (request, reply) => {
  if (!request.user) {
    return reply.code(401).send({ 
      success: false,
      error: 'Authentication required.' 
    });
  }

  // Only main company users or white-label owners can create white-labels
  if (!request.user.isMainCompanyUser && !request.user.userType.includes('WHITELABEL_OWNER')) {
    return reply.code(403).send({ 
      success: false,
      error: 'Access denied. Only main company users or white-label owners can create white-label companies.' 
    });
  }
};

// Owner/Employee middleware (excludes support employees)
const requireOwnerOrEmployee = async (request, reply) => {
  if (!request.user || request.user.isSupportEmployee) {
    return reply.code(403).send({ 
      success: false,
      error: 'Access denied. Owner or employee privileges required.' 
    });
  }
};

// Legacy middleware functions (maintained for backward compatibility)
const requireSuperAdmin = async (request, reply) => {
  // Map to main company owner for backward compatibility
  if (!request.user || request.user.userType !== 'MAIN_OWNER') {
    return reply.code(403).send({ 
      success: false,
      error: 'Access denied. Super admin privileges required.' 
    });
  }
};

const requireAdmin = async (request, reply) => {
  // Only owners can perform admin actions (e.g., add companies)
  if (!request.user || !request.user.isOwner || !request.user.userType.includes('Main_OWNER')) {
    return reply.code(403).send({ 
      success: false,
      error: 'Access denied. Owner privileges required.' 
    });
  }
};

const requireRetailer = async (request, reply) => {
  if (!request.user || request.user.userType !== 'RETAILER') {
    return reply.code(403).send({ 
      success: false,
      error: 'Access denied. Retailer privileges required.' 
    });
  }
};

// Support employee assignment validation
const validateSupportEmployeeAssignment = (targetParam = 'companyId') => {
  return async (request, reply) => {
    if (!request.user || !request.user.isSupportEmployee) {
      return; // Not a support employee, skip validation
    }

    const targetId = request.params[targetParam] || request.body[targetParam];
    if (!targetId) {
      return reply.code(400).send({ 
        success: false,
        error: 'Target parameter required for support employee validation.' 
      });
    }

    const assignments = await SupportAssignmentService.getUserAssignments(request.user.userId);
    
    let hasValidAssignment = false;
    
    for (const assignment of assignments) {
      if (assignment.assignmentType === 'COMPANY' && assignment.targetCompanyId === targetId) {
        hasValidAssignment = true;
        break;
      }
      if (assignment.assignmentType === 'USER' && assignment.targetUserId === targetId) {
        hasValidAssignment = true;
        break;
      }
    }

    if (!hasValidAssignment) {
      return reply.code(403).send({ 
        success: false,
        error: 'Support employee not assigned to this resource.' 
      });
    }
  };
};

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
};

// Generate refresh token
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  });
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

module.exports = {
  // Core authentication
  authenticate,
  authorize,
  authorizeUserCategory,
  
  // Company and context
  ensureCompanyContext,
  requireMainCompany,
  requireWhitelabelCreationRights,
  requireOwnerOrEmployee,
  
  // Permission-based authorization
  requirePermission,
  requireHierarchyAccess,
  restrictKeyOperations,
  validateSupportEmployeeAssignment,
  
  // Legacy compatibility
  requireSuperAdmin,
  requireAdmin,
  requireRetailer,
  
  // Token management
  generateToken,
  generateRefreshToken,
  verifyRefreshToken
};