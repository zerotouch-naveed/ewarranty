const mongoose = require('mongoose');
const { Schema } = mongoose;

// 1. Company Schema (Main Company + White Label Companies)
const companySchema = new Schema({
  companyId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  companyType: {
    type: String,
    required: true,
    enum: ['MAIN', 'WHITELABEL'],
    index: true
  },
  parentCompanyId: {
    type: String,
    ref: 'Company',
    default: null, // null for main company, set for white-labels
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  logo: {
    type: String, // URL to logo image
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  walletBalance: {
    totalAmount: {
      type: Number,
      default: 0
    },
    usedAmount: {
      type: Number,
      default: 0
    },
    remainingAmount: {
      type: Number,
      default: 0
    }
  },
  settings: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    currency: {
      type: String,
      default: 'INR'
    },
    customFields: [{
      fieldName: String,
      fieldType: String,
      isRequired: Boolean
    }]
  },
  createdBy: {
    type: String,
    ref: 'User',
    default: null // Main company won't have createdBy, white-labels will
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 2. Support Permission Schema (Defines what support employees can do)
const supportPermissionSchema = new Schema({
  permissionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  companyId: {
    type: String,
    required: true,
    ref: 'Company'
  },
  permissionName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: null
  },
  permissions: {
    // Customer/User related permissions
    canViewCustomers: {
      type: Boolean,
      default: false
    },
    canCreateCustomers: {
      type: Boolean,
      default: false
    },
    canEditCustomers: {
      type: Boolean,
      default: false
    },
    canDeleteCustomers: {
      type: Boolean,
      default: false
    },
    canViewUsers: {
      type: Boolean,
      default: false
    },
    canCreateUsers: {
      type: Boolean,
      default: false
    },
    canEditUsers: {
      type: Boolean,
      default: false
    },
    canDeleteUsers: {
      type: Boolean,
      default: false
    },
    
    // Company related permissions
    canViewCompanyData: {
      type: Boolean,
      default: false
    },
    canEditCompanySettings: {
      type: Boolean,
      default: false
    },
    
    // Claims and warranty permissions
    canViewClaims: {
      type: Boolean,
      default: false
    },
    canProcessClaims: {
      type: Boolean,
      default: false
    },
    canViewWarrantyPlans: {
      type: Boolean,
      default: false
    },
    canEditWarrantyPlans: {
      type: Boolean,
      default: false
    },
    
    // Reports and analytics
    canViewReports: {
      type: Boolean,
      default: false
    },
    canExportData: {
      type: Boolean,
      default: false
    },
    
    // Wallet related permissions (NEVER allowed for support employees)
    canTransferWallet: {
      type: Boolean,
      default: false,
      immutable: true
    },
    canAllocateWallet: {
      type: Boolean,
      default: false,
      immutable: true
    },
    canRevokeWallet: {
      type: Boolean,
      default: false,
      immutable: true
    },
    canViewWalletHistory: {
      type: Boolean,
      default: false
    },
    
    // Hierarchy limitations
    canAccessCrossCompany: {
      type: Boolean,
      default: false // Only main company support can access white-labels if true
    },
    hierarchyLevelAccess: {
      type: Number,
      default: 0 // 0 = only same level, 1 = one level down, etc.
    }
  },
  applicableUserTypes: [{
    type: String,
    enum: ['SUPPORT_EMPLOYEE']
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 3. User Schema (All types of users)
const userSchema = new Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  companyId: {
    type: String,
    required: true,
    ref: 'Company'
  },
  userType: {
    type: String,
    required: true,
    enum: [
      // Main company user types
      'MAIN_OWNER', 'MAIN_EMPLOYEE', 'MAIN_SUPPORT_EMPLOYEE',
      // White-label user types
      'WHITELABEL_OWNER', 'WHITELABEL_EMPLOYEE', 'WHITELABEL_SUPPORT_EMPLOYEE',
      // Legacy sales hierarchy (for retailers/distributors)
      'TSM', 'ASM', 'SALES_EXECUTIVE', 'SUPER_DISTRIBUTOR', 'DISTRIBUTOR', 
      'NATIONAL_DISTRIBUTOR', 'MINI_DISTRIBUTOR', 'RETAILER'
    ],
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },
  alternatePhone: {
    type: String,
    default: null
  },
  password: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  parentUserId: {
    type: String,
    ref: 'User',
    default: null,
    index: true
  },
  hierarchyLevel: {
    type: Number,
    required: true,
    default: 0
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  walletBalance: {
    totalAmount: {
      type: Number,
      default: 0
    },
    usedAmount: {
      type: Number,
      default: 0
    },
    remainingAmount: {
      type: Number,
      default: 0
    }
  },
  // NEW: E-warranty statistics tracking
  eWarrantyStats: {
    totalWarranties: {
      type: Number,
      default: 0
    },
    activeWarranties: {
      type: Number,
      default: 0
    },
    expiredWarranties: {
      type: Number,
      default: 0
    },
    claimedWarranties: {
      type: Number,
      default: 0
    },
    totalPremiumCollected: {
      type: Number,
      default: 0
    },
    lastWarrantyDate: {
      type: Date,
      default: null
    }
  },
  // Support employee specific permissions
  supportPermissions: {
    permissionSetId: {
      type: String,
      ref: 'SupportPermission',
      default: null // Only set for support employees
    },
    assignedBy: {
      type: String,
      ref: 'User',
      default: null
    },
    assignedAt: {
      type: Date,
      default: null
    },
    // Quick access permissions (duplicated from permission set for performance)
    effectivePermissions: {
      canViewCustomers: { type: Boolean, default: false },
      canCreateCustomers: { type: Boolean, default: false },
      canEditCustomers: { type: Boolean, default: false },
      canDeleteCustomers: { type: Boolean, default: false },
      canViewUsers: { type: Boolean, default: false },
      canCreateUsers: { type: Boolean, default: false },
      canEditUsers: { type: Boolean, default: false },
      canDeleteUsers: { type: Boolean, default: false },
      canViewCompanyData: { type: Boolean, default: false },
      canEditCompanySettings: { type: Boolean, default: false },
      canViewClaims: { type: Boolean, default: false },
      canProcessClaims: { type: Boolean, default: false },
      canViewWarrantyPlans: { type: Boolean, default: false },
      canEditWarrantyPlans: { type: Boolean, default: false },
      canViewReports: { type: Boolean, default: false },
      canExportData: { type: Boolean, default: false },
      canViewKeyHistory: { type: Boolean, default: false },
      canAccessCrossCompany: { type: Boolean, default: false },
      hierarchyLevelAccess: { type: Number, default: 0 }
    }
  },
  // Traditional permissions for non-support employees
  permissions: {
    canCreateUser: {
      type: Boolean,
      default: true
    },
    canEditUser: {
      type: Boolean,
      default: true
    },
    canViewReports: {
      type: Boolean,
      default: true
    },
    canManageKeys: {
      type: Boolean,
      default: true
    }
  },
  // Assignment tracking for support employees
  assignedCompanies: [{
    companyId: {
      type: String,
      ref: 'Company'
    },
    companyName: String,
    assignedAt: Date,
    assignedBy: {
      type: String,
      ref: 'User'
    }
  }],
  createdBy: {
    type: String,
    ref: 'User',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastLoginAt: {
    type: Date,
    default: null
  }
});

// 4. User Hierarchy Schema (Updated for new user types)
const userHierarchySchema = new Schema({
  userId: {
    type: String,
    required: true,
    ref: 'User',
    index: true
  },
  companyId: {
    type: String,
    required: true,
    ref: 'Company'
  },
  crossCompanyAccess: [{
    companyId: {
      type: String,
      ref: 'Company'
    },
    accessLevel: {
      type: String,
      enum: ['FULL', 'LIMITED', 'SUPPORT_ONLY'],
      default: 'LIMITED'
    }
  }],
  hierarchyPath: [{
    userId: {
      type: String,
      ref: 'User'
    },
    userType: String,
    name: String,
    level: Number
  }],
  directParent: {
    userId: { type: String, ref: 'User' },
    userType: String,
    name: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 5. Support Assignment Schema (Tracks which support employees are assigned to which companies/users)
const supportAssignmentSchema = new Schema({
  assignmentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  supportEmployeeId: {
    type: String,
    required: true,
    ref: 'User',
    index: true
  },
  assignedBy: {
    type: String,
    required: true,
    ref: 'User'
  },
  assignmentType: {
    type: String,
    required: true,
    enum: ['COMPANY', 'USER', 'HIERARCHY']
  },
  // What/who is assigned
  targetCompanyId: {
    type: String,
    ref: 'Company',
    default: null
  },
  targetUserId: {
    type: String,
    ref: 'User',
    default: null
  },
  targetHierarchyLevel: {
    type: Number,
    default: null
  },
  // Access scope
  accessScope: {
    type: String,
    enum: ['FULL', 'LIMITED', 'READ_ONLY'],
    default: 'LIMITED'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: null
  }
});

// NEW: Wallet Management Schema (replaces KeyManagement)
const walletManagementSchema = new Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  companyId: {
    type: String,
    required: true,
    ref: 'Company'
  },
  transactionType: {
    type: String,
    enum: ['SELF-ALLOCATION','ALLOCATION', 'WARRANTY_USAGE', 'REVOKE', 'REFUND'],
    required: true
  },
  fromUserId: {
    type: String,
    ref: 'User',
    default: null
  },
  toUserId: {
    type: String,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  // For warranty usage transactions
  warrantyKey: {
    type: String,
    default: null,
  },
  customerDetails: {
    customerId: {
      type: String,
      default: null
    },
    customerName: {
      type: String,
      default: null
    },
    productModel: {
      type: String,
      default: null
    },
    premiumAmount: {
      type: Number,
      default: null
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    default: null
  },
  // Support employee restriction
  isRestrictedOperation: {
    type: Boolean,
    default: true
  },
  transactionDate: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 7. Customer/Lead Schema (Updated with new hierarchy support)
const customerSchema = new Schema({
  customerId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  warrantyKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  companyId: {
    type: String,
    required: true,
    ref: 'Company'
  },
  retailerId: {
    type: String,
    required: true,
    ref: 'User'
  },
  status: {
    type: Number,
    enum: [0, 1], // 0: Not Active, 1: Active
    default: 1
  },
  customerDetails: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      default: null,
      lowercase: true
    },
    mobile: {
      type: String,
      required: true
    },
    alternateNumber: {
      type: String,
      default: null
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String
    }
  },
  productDetails: {
    modelName: {
      type: String,
      default: null
    },
    imei1: {
      type: String,
      required: true,
      unique: true
    },
    imei2: {
      type: String,
      default: null
    },
    brand: {
      type: String,
      default: null
    },
    category: {
      type: String,
      default: null
    },
    purchasePrice: {
      type: Number,
      default: null
    }
  },
  invoiceDetails: {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true
    },
    invoiceAmount: {
      type: Number,
      default: null
    },
    invoiceImage: {
      type: String, // URL to invoice image
      required: true
    },
    invoiceDate: {
      type: Date,
      required: true
    }
  },
  productImages: {
    frontImage: {
      type: String, // URL to front image
      required: true
    },
    backImage: {
      type: String, // URL to back image
      required: true
    },
    additionalImages: [{
      type: String
    }]
  },
  warrantyDetails: {
    planId: {
      type: String,
      default: null
    },
    planName: {
      type: String,
      default: null
    },
    warrantyPeriod: {
      type: Number, // in months
      default: null
    },
    startDate: {
      type: Date,
      required: true
    },
    expiryDate: {
      type: Date,
      required: true
    },
    premiumAmount: {
      type: Number,
      default: null
    }
  },
  paymentDetails: {
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
      default: 'PENDING'
    },
    paymentDate: {
      type: Date,
      default: null
    },
    paymentMethod: {
      type: String,
      default: null
    },
    orderId: {
      type: String,
      unique: true,
      required: true
    },
    paymentOrderId: {
      type: String,
      default: null
    },
    paymentId: {
      type: String,
      default: null
    },
    transactionId: {
      type: String,
      default: null
    }
  },
  hierarchy: {
    retailer: {
      userId: String,
      name: String,
      userType: String
    },
    distributorChain: [{
      userId: String,
      name: String,
      userType: String,
      level: Number
    }]
  },
  dates: {
    createdDate: {
      type: Date,
      default: Date.now
    },
    pickedDate: {
      type: Date,
      default: null
    },
    lastModifiedDate: {
      type: Date,
      default: Date.now
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    default: null
  }
});

// 8. Warranty Plans Schema (unchanged)
const warrantyPlanSchema = new Schema({
  planId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  companyId: {
    type: String,
    required: true,
    ref: 'Company'
  },
  planName: {
    type: String,
    required: true
  },
  planDescription: {
    type: String,
    default: null
  },
  duration: {
    type: Number, // in months
    required: true
  },
  premiumAmount: {
    type: Number,
    required: true
  },
  coverage: {
    accidentalDamage: {
      type: Boolean,
      default: false
    },
    liquidDamage: {
      type: Boolean,
      default: false
    },
    screenDamage: {
      type: Boolean,
      default: false
    },
    theft: {
      type: Boolean,
      default: false
    },
    other: [{
      coverageType: String,
      description: String
    }]
  },
  eligibleCategories: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 9. Claims Schema (unchanged)
const claimSchema = new Schema({
  claimId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  customerId: {
    type: String,
    required: true,
    ref: 'Customer'
  },
  warrantyKey: {
    type: String,
    required: true,
    ref: 'Customer'
  },
  companyId: {
    type: String,
    required: true,
    ref: 'Company'
  },
  claimType: {
    type: String,
    enum: ['ACCIDENTAL_DAMAGE', 'LIQUID_DAMAGE', 'SCREEN_DAMAGE', 'THEFT', 'OTHER'],
    required: true
  },
  claimStatus: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED'],
    default: 'PENDING'
  },
  claimDescription: {
    type: String,
    required: true
  },
  claimAmount: {
    type: Number,
    default: null
  },
  approvedAmount: {
    type: Number,
    default: null
  },
  damageImages: [{
    type: String // URLs to damage images
  }],
  repairDetails: {
    repairCenter: String,
    repairDate: Date,
    repairCost: Number,
    repairInvoice: String
  },
  claimDate: {
    type: Date,
    default: Date.now
  },
  approvalDate: {
    type: Date,
    default: null
  },
  completionDate: {
    type: Date,
    default: null
  },
  processedBy: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

// 10. Audit Log Schema (Updated with new actions and user types)
const auditLogSchema = new Schema({
  logId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  companyId: {
    type: String,
    required: true,
    ref: 'Company'
  },
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  action: {
    type: String,
    required: true,
    enum: [
      'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'LOGIN', 'LOGOUT', 
      'WALLET_ALLOCATION', 'WALLET_WARRANTY_USAGE', 'WALLET_REVOKE',
      'SUPPORT_ASSIGNMENT', 'PERMISSION_CHANGE', 'CROSS_COMPANY_ACCESS'
    ]
  },
  entityType: {
    type: String,
    required: true,
    enum: ['USER', 'CUSTOMER', 'COMPANY', 'CLAIM', 'KEY', 'PLAN', 'PERMISSION', 'ASSIGNMENT']
  },
  entityId: {
    type: String,
    required: true
  },
  oldData: {
    type: Schema.Types.Mixed,
    default: null
  },
  newData: {
    type: Schema.Types.Mixed,
    default: null
  },
  // Support employee actions tracking
  onBehalfOf: {
    userId: {
      type: String,
      ref: 'User',
      default: null
    },
    userType: String,
    companyId: String
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// 11. Settings Schema (unchanged)
const settingsSchema = new Schema({
  settingId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  companyId: {
    type: String,
    required: true,
    ref: 'Company'
  },
  settingType: {
    type: String,
    required: true,
    enum: ['GENERAL', 'EMAIL', 'SMS', 'PAYMENT', 'SECURITY']
  },
  settingKey: {
    type: String,
    required: true
  },
  settingValue: {
    type: Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Additional compound indexes for better query performance
companySchema.index({ companyType: 1, parentCompanyId: 1 });
companySchema.index({ name: 1, isActive: 1 });
userSchema.index({ companyId: 1, userType: 1 });
userSchema.index({ parentUserId: 1, isActive: 1 });
userSchema.index({ userType: 1, 'supportPermissions.permissionSetId': 1 });
userHierarchySchema.index({ 'hierarchyPath.userId': 1 });
userHierarchySchema.index({ 'crossCompanyAccess.companyId': 1 });
supportPermissionSchema.index({ companyId: 1, isActive: 1 });
supportAssignmentSchema.index({ supportEmployeeId: 1, isActive: 1 });
supportAssignmentSchema.index({ targetCompanyId: 1, targetUserId: 1 });
customerSchema.index({ companyId: 1, retailerId: 1 });
customerSchema.index({ 'dates.createdDate': 1 });
walletManagementSchema.index({ companyId: 1, toUserId: 1 });
walletManagementSchema.index({ transactionDate: -1 });
walletManagementSchema.index({ transactionType: 1 });
walletManagementSchema.index({ warrantyKey: 1 });
claimSchema.index({ companyId: 1, customerId: 1 });
claimSchema.index({ claimStatus: 1, claimDate: -1 });
auditLogSchema.index({ companyId: 1, userId: 1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1, entityType: 1 });
auditLogSchema.index({ 'onBehalfOf.userId': 1 });

// Pre-save middleware
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Ensure support employees can't have wallet permissions
  if (this.userType.includes('SUPPORT_EMPLOYEE')) {
    this.permissions.canManageWallet = false;
    if (this.supportPermissions.effectivePermissions) {
      this.supportPermissions.effectivePermissions.canTransferWallet = false;
      this.supportPermissions.effectivePermissions.canAllocateWallet = false;
      this.supportPermissions.effectivePermissions.canRevokeWallet = false;
    }
  }
  
  next();
});

customerSchema.pre('save', function(next) {
  this.dates.lastModifiedDate = Date.now();
  next();
});

companySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

supportPermissionSchema.pre('save', function(next) {
  // Ensure key permissions are always false for support permissions
  this.permissions.canTransferWallet = false;
  this.permissions.canAllocateWallet = false;
  this.permissions.canRevokeWallet = false;
  this.updatedAt = Date.now();
  next();
});

// Virtual fields
userSchema.virtual('fullHierarchy').get(function() {
  return `${this.companyId}/${this.userType}/${this.userId}`;
});

userSchema.virtual('isSupportEmployee').get(function() {
  return this.userType.includes('SUPPORT_EMPLOYEE');
});

userSchema.virtual('isMainCompanyUser').get(function() {
  return this.userType.startsWith('MAIN_');
});

userSchema.virtual('isWhitelabelUser').get(function() {
  return this.userType.startsWith('WHITELABEL_');
});

companySchema.virtual('isMainCompany').get(function() {
  return this.companyType === 'MAIN';
});

companySchema.virtual('isWhitelabel').get(function() {
  return this.companyType === 'WHITELABEL';
});

customerSchema.virtual('warrantyStatus').get(function() {
  const now = new Date();
  return now <= this.warrantyDetails.expiryDate ? 'ACTIVE' : 'EXPIRED';
});

// Export models
const Company = mongoose.model('Company', companySchema);
const User = mongoose.model('User', userSchema);
const UserHierarchy = mongoose.model('UserHierarchy', userHierarchySchema);
const SupportPermission = mongoose.model('SupportPermission', supportPermissionSchema);
const SupportAssignment = mongoose.model('SupportAssignment', supportAssignmentSchema);
const WalletManagement = mongoose.model('WalletManagement', walletManagementSchema);
const Customer = mongoose.model('Customer', customerSchema);
const WarrantyPlan = mongoose.model('WarrantyPlan', warrantyPlanSchema);
const Claim = mongoose.model('Claim', claimSchema);
const AuditLog = mongoose.model('AuditLog', auditLogSchema);
const Settings = mongoose.model('Settings', settingsSchema);

module.exports = {
  Company,
  User,
  UserHierarchy,
  SupportPermission,
  SupportAssignment,
  WalletManagement,
  Customer,
  WarrantyPlan,
  Claim,
  AuditLog,
  Settings
};