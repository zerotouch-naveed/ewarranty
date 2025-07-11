const mongoose = require('mongoose');
const { Schema } = mongoose;

// 1. Company Schema (White Label Companies)
const companySchema = new Schema({
  companyId: {
    type: String,
    required: true,
    unique: true,
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
  keyAllocation: {
    totalKeys: {
      type: Number,
      default: 0
    },
    usedKeys: {
      type: Number,
      default: 0
    },
    remainingKeys: {
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
      default: 'USD'
    },
    customFields: [{
      fieldName: String,
      fieldType: String,
      isRequired: Boolean
    }]
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

// 2. User Schema (All types of users)
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
    enum: ['TSM', 'ASM', 'SALES_EXECUTIVE', 'SUPER_DISTRIBUTOR', 'DISTRIBUTOR', 'NATIONAL_DISTRIBUTOR', 'MINI_DISTRIBUTOR', 'RETAILER'],
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
  keyAllocation: {
    totalKeys: {
      type: Number,
      default: 0
    },
    usedKeys: {
      type: Number,
      default: 0
    },
    remainingKeys: {
      type: Number,
      default: 0
    }
  },
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

// 3. User Hierarchy Schema
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
  hierarchyPath: [{
    userId: {
      type: String,
      ref: 'User'
    },
    userType: {
      type: String,
      enum: ['TSM', 'ASM', 'SALES_EXECUTIVE', 'SUPER_DISTRIBUTOR', 'DISTRIBUTOR', 'NATIONAL_DISTRIBUTOR', 'MINI_DISTRIBUTOR', 'RETAILER']
    },
    level: Number,
    name: String
  }],
  directParent: {
    userId: {
      type: String,
      ref: 'User'
    },
    userType: String,
    name: String
  },
  allParents: [{
    userId: {
      type: String,
      ref: 'User'
    },
    userType: String,
    name: String,
    level: Number
  }],
  directChildren: [{
    userId: {
      type: String,
      ref: 'User'
    },
    userType: String,
    name: String
  }],
  allChildren: [{
    userId: {
      type: String,
      ref: 'User'
    },
    userType: String,
    name: String,
    level: Number
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 4. Key Management Schema
const keyManagementSchema = new Schema({
  keyId: {
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
  keyType: {
    type: String,
    enum: ['ALLOCATION', 'USAGE', 'REVOKE'],
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
  keyCount: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    default: null
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

// 5. Customer/Lead Schema (Extended Warranty)
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

// 6. Warranty Plans Schema
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

// 7. Claims Schema
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

// 8. Audit Log Schema
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
    enum: ['CREATE', 'UPDATE', 'DELETE', 'VIEW', 'LOGIN', 'LOGOUT', 'KEY_ALLOCATION', 'KEY_USAGE']
  },
  entityType: {
    type: String,
    required: true,
    enum: ['USER', 'CUSTOMER', 'COMPANY', 'CLAIM', 'KEY', 'PLAN']
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

// 9. Settings Schema
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
companySchema.index({ name: 1, isActive: 1 });
userSchema.index({ companyId: 1, userType: 1 });
userSchema.index({ parentUserId: 1, isActive: 1 });
userHierarchySchema.index({ 'hierarchyPath.userId': 1 });
customerSchema.index({ companyId: 1, retailerId: 1 });
customerSchema.index({ 'dates.createdDate': 1 });
keyManagementSchema.index({ companyId: 1, toUserId: 1 });
keyManagementSchema.index({ transactionDate: -1 });
claimSchema.index({ companyId: 1, customerId: 1 });
claimSchema.index({ claimStatus: 1, claimDate: -1 });
auditLogSchema.index({ companyId: 1, userId: 1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1, entityType: 1 });

// Pre-save middleware
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
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

// Virtual fields
userSchema.virtual('fullHierarchy').get(function() {
  return `${this.companyId}/${this.userType}/${this.userId}`;
});

customerSchema.virtual('warrantyStatus').get(function() {
  const now = new Date();
  return now <= this.warrantyDetails.expiryDate ? 'ACTIVE' : 'EXPIRED';
});

// Export models
const Company = mongoose.model('Company', companySchema);
const User = mongoose.model('User', userSchema);
const UserHierarchy = mongoose.model('UserHierarchy', userHierarchySchema);
const KeyManagement = mongoose.model('KeyManagement', keyManagementSchema);
const Customer = mongoose.model('Customer', customerSchema);
const WarrantyPlan = mongoose.model('WarrantyPlan', warrantyPlanSchema);
const Claim = mongoose.model('Claim', claimSchema);
const AuditLog = mongoose.model('AuditLog', auditLogSchema);
const Settings = mongoose.model('Settings', settingsSchema);

module.exports = {
  Company,
  User,
  UserHierarchy,
  KeyManagement,
  Customer,
  WarrantyPlan,
  Claim,
  AuditLog,
  Settings
};