#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const { Company, User, UserHierarchy, SupportPermission, SupportAssignment, Customer, Warranty } = require('../schemas');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connect to database
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/multi_tenant_warranty';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

// Prompt user for input
const prompt = (question) => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

// Clean up orphaned user hierarchies
const cleanupOrphanedHierarchies = async () => {
  console.log('\n🧹 Cleaning Orphaned User Hierarchies');
  console.log('═══════════════════════════════════════');

  const hierarchies = await UserHierarchy.find({});
  let orphanedCount = 0;

  for (const hierarchy of hierarchies) {
    // Check if user exists
    const userExists = await User.findOne({ userId: hierarchy.userId });
    if (!userExists) {
      await UserHierarchy.findByIdAndDelete(hierarchy._id);
      console.log(`🗑️ Removed orphaned hierarchy for user: ${hierarchy.userId}`);
      orphanedCount++;
    }

    // Check if parent user exists (if parentUserId is set)
    if (hierarchy.parentUserId) {
      const parentExists = await User.findOne({ userId: hierarchy.parentUserId });
      if (!parentExists) {
        await UserHierarchy.findByIdAndUpdate(hierarchy._id, {
          parentUserId: null,
          updatedAt: new Date()
        });
        console.log(`🔧 Fixed orphaned parent reference for user: ${hierarchy.userId}`);
      }
    }
  }

  console.log(`✅ Cleaned ${orphanedCount} orphaned hierarchies`);
};

// Clean up orphaned support assignments
const cleanupOrphanedAssignments = async () => {
  console.log('\n🧹 Cleaning Orphaned Support Assignments');
  console.log('═══════════════════════════════════════');

  const assignments = await SupportAssignment.find({});
  let orphanedCount = 0;

  for (const assignment of assignments) {
    let shouldDelete = false;

    // Check if support employee exists
    const supportEmployeeExists = await User.findById(assignment.supportEmployeeId);
    if (!supportEmployeeExists) {
      shouldDelete = true;
      console.log(`🗑️ Support employee not found for assignment: ${assignment.assignmentId}`);
    }

    // Check target references
    if (assignment.targetCompanyId) {
      const companyExists = await Company.findById(assignment.targetCompanyId);
      if (!companyExists) {
        shouldDelete = true;
        console.log(`🗑️ Target company not found for assignment: ${assignment.assignmentId}`);
      }
    }

    if (assignment.targetUserId) {
      const userExists = await User.findById(assignment.targetUserId);
      if (!userExists) {
        shouldDelete = true;
        console.log(`🗑️ Target user not found for assignment: ${assignment.assignmentId}`);
      }
    }

    if (shouldDelete) {
      await SupportAssignment.findByIdAndDelete(assignment._id);
      orphanedCount++;
    }
  }

  console.log(`✅ Cleaned ${orphanedCount} orphaned assignments`);
};

// Clean up unused permission sets
const cleanupUnusedPermissionSets = async () => {
  console.log('\n🧹 Checking Unused Permission Sets');
  console.log('═══════════════════════════════════════');

  const permissionSets = await SupportPermission.find({});
  let unusedCount = 0;

  for (const permSet of permissionSets) {
    // Check if any users are using this permission set
    const usageCount = await User.countDocuments({
      'supportPermissions.permissionSetId': permSet.permissionSetId,
      isActive: true
    });

    if (usageCount === 0) {
      console.log(`⚠️  Unused permission set: "${permSet.name}" (${permSet.permissionSetId})`);
      unusedCount++;
    } else {
      console.log(`✅ Permission set "${permSet.name}" used by ${usageCount} users`);
    }
  }

  if (unusedCount > 0) {
    console.log(`\n💡 Found ${unusedCount} unused permission sets. Consider removing them manually.`);
  } else {
    console.log(`\n✅ All permission sets are in use`);
  }
};

// Fix inconsistent key allocations
const fixKeyAllocations = async () => {
  console.log('\n🔧 Fixing Key Allocation Inconsistencies');
  console.log('═══════════════════════════════════════');

  const companies = await Company.find({});
  let fixedCount = 0;

  for (const company of companies) {
    const calculated = company.keyAllocation.totalKeys - company.keyAllocation.usedKeys;
    
    if (company.keyAllocation.remainingKeys !== calculated) {
      console.log(`🔧 Fixing key allocation for: ${company.name}`);
      console.log(`   Current remaining: ${company.keyAllocation.remainingKeys}`);
      console.log(`   Calculated remaining: ${calculated}`);
      
      await Company.findByIdAndUpdate(company._id, {
        'keyAllocation.remainingKeys': calculated,
        updatedAt: new Date()
      });
      
      fixedCount++;
    }
  }

  // Check user key allocations
  const users = await User.find({});
  for (const user of users) {
    const calculated = user.keyAllocation.totalKeys - user.keyAllocation.usedKeys;
    
    if (user.keyAllocation.remainingKeys !== calculated) {
      console.log(`🔧 Fixing key allocation for user: ${user.name}`);
      console.log(`   Current remaining: ${user.keyAllocation.remainingKeys}`);
      console.log(`   Calculated remaining: ${calculated}`);
      
      await User.findByIdAndUpdate(user._id, {
        'keyAllocation.remainingKeys': calculated,
        updatedAt: new Date()
      });
      
      fixedCount++;
    }
  }

  console.log(`✅ Fixed ${fixedCount} key allocation inconsistencies`);
};

// Validate data integrity
const validateDataIntegrity = async () => {
  console.log('\n🔍 Validating Data Integrity');
  console.log('═══════════════════════════════');

  let issues = 0;

  // Check for companies without companyType
  const companiesWithoutType = await Company.countDocuments({ 
    $or: [
      { companyType: { $exists: false } },
      { companyType: null }
    ]
  });
  if (companiesWithoutType > 0) {
    console.log(`⚠️  ${companiesWithoutType} companies missing companyType`);
    issues++;
  }

  // Check for users with old user types
  const oldUserTypes = ['TSM', 'ASM', 'RSM', 'MANAGER', 'EMPLOYEE'];
  const usersWithOldTypes = await User.countDocuments({ 
    userType: { $in: oldUserTypes }
  });
  if (usersWithOldTypes > 0) {
    console.log(`⚠️  ${usersWithOldTypes} users have legacy user types`);
    issues++;
  }

  // Check for users without support permissions structure
  const usersWithoutSupportPerms = await User.countDocuments({
    supportPermissions: { $exists: false }
  });
  if (usersWithoutSupportPerms > 0) {
    console.log(`⚠️  ${usersWithoutSupportPerms} users missing supportPermissions structure`);
    issues++;
  }

  // Check for white-label companies without parent
  const whitelabelWithoutParent = await Company.countDocuments({
    companyType: 'WHITELABEL',
    $or: [
      { parentCompanyId: { $exists: false } },
      { parentCompanyId: null }
    ]
  });
  if (whitelabelWithoutParent > 0) {
    console.log(`⚠️  ${whitelabelWithoutParent} white-label companies missing parentCompanyId`);
    issues++;
  }

  // Check for main companies with parent
  const mainWithParent = await Company.countDocuments({
    companyType: 'MAIN',
    parentCompanyId: { $ne: null }
  });
  if (mainWithParent > 0) {
    console.log(`⚠️  ${mainWithParent} main companies have parentCompanyId set`);
    issues++;
  }

  // Check for support employees with key permissions
  const supportWithKeyPerms = await User.countDocuments({
    userType: { $in: ['MAIN_SUPPORT_EMPLOYEE', 'WHITELABEL_SUPPORT_EMPLOYEE'] },
    $or: [
      { 'permissions.canManageKeys': true },
      { 'permissions.canAllocateKeys': true },
      { 'permissions.canTransferKeys': true },
      { 'permissions.canRevokeKeys': true }
    ]
  });
  if (supportWithKeyPerms > 0) {
    console.log(`🚨 SECURITY ISSUE: ${supportWithKeyPerms} support employees have key permissions!`);
    issues++;
  }

  if (issues === 0) {
    console.log('✅ No data integrity issues found');
  } else {
    console.log(`\n⚠️  Found ${issues} potential data integrity issues`);
    console.log('💡 Consider running the migration script or fixing manually');
  }

  return issues;
};

// Generate system statistics
const generateStatistics = async () => {
  console.log('\n📊 System Statistics');
  console.log('═══════════════════════════════');

  // Company statistics
  const totalCompanies = await Company.countDocuments({});
  const activeCompanies = await Company.countDocuments({ isActive: true });
  const mainCompanies = await Company.countDocuments({ companyType: 'MAIN' });
  const whitelabelCompanies = await Company.countDocuments({ companyType: 'WHITELABEL' });

  console.log('\n🏢 Companies:');
  console.log(`   Total: ${totalCompanies}`);
  console.log(`   Active: ${activeCompanies}`);
  console.log(`   Main: ${mainCompanies}`);
  console.log(`   White-Label: ${whitelabelCompanies}`);

  // User statistics
  const totalUsers = await User.countDocuments({});
  const activeUsers = await User.countDocuments({ isActive: true });
  const userTypeStats = await User.aggregate([
    { $group: { _id: '$userType', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  console.log('\n👥 Users:');
  console.log(`   Total: ${totalUsers}`);
  console.log(`   Active: ${activeUsers}`);
  console.log('   By Type:');
  for (const stat of userTypeStats) {
    console.log(`      ${stat._id}: ${stat.count}`);
  }

  // Key statistics
  const keyStats = await Company.aggregate([
    {
      $group: {
        _id: null,
        totalKeys: { $sum: '$keyAllocation.totalKeys' },
        usedKeys: { $sum: '$keyAllocation.usedKeys' },
        remainingKeys: { $sum: '$keyAllocation.remainingKeys' }
      }
    }
  ]);

  if (keyStats.length > 0) {
    const stats = keyStats[0];
    console.log('\n🔑 Key Allocation:');
    console.log(`   Total Keys: ${stats.totalKeys.toLocaleString()}`);
    console.log(`   Used Keys: ${stats.usedKeys.toLocaleString()}`);
    console.log(`   Available Keys: ${stats.remainingKeys.toLocaleString()}`);
    console.log(`   Utilization: ${((stats.usedKeys / stats.totalKeys) * 100).toFixed(1)}%`);
  }

  // Support infrastructure
  const permissionSets = await SupportPermission.countDocuments({});
  const supportAssignments = await SupportAssignment.countDocuments({});
  const supportEmployees = await User.countDocuments({
    userType: { $in: ['MAIN_SUPPORT_EMPLOYEE', 'WHITELABEL_SUPPORT_EMPLOYEE'] },
    isActive: true
  });

  console.log('\n🛠️ Support Infrastructure:');
  console.log(`   Permission Sets: ${permissionSets}`);
  console.log(`   Support Assignments: ${supportAssignments}`);
  console.log(`   Support Employees: ${supportEmployees}`);

  // Additional collections (if they exist)
  try {
    const customers = await Customer.countDocuments({});
    const warranties = await Warranty.countDocuments({});
    console.log('\n📋 Business Data:');
    console.log(`   Customers: ${customers}`);
    console.log(`   Warranties: ${warranties}`);
  } catch (error) {
    console.log('\n📋 Business Data: Not available (collections may not exist)');
  }
};

// Main menu
const showMenu = async () => {
  while (true) {
    console.log('\n🛠️ System Maintenance');
    console.log('═══════════════════════');
    console.log('1. Clean orphaned user hierarchies');
    console.log('2. Clean orphaned support assignments');
    console.log('3. Check unused permission sets');
    console.log('4. Fix key allocation inconsistencies');
    console.log('5. Validate data integrity');
    console.log('6. Generate system statistics');
    console.log('7. Run all maintenance tasks');
    console.log('0. Exit');

    const choice = await prompt('\nSelect option (0-7): ');

    switch (choice) {
      case '1':
        await cleanupOrphanedHierarchies();
        break;
      case '2':
        await cleanupOrphanedAssignments();
        break;
      case '3':
        await cleanupUnusedPermissionSets();
        break;
      case '4':
        await fixKeyAllocations();
        break;
      case '5':
        await validateDataIntegrity();
        break;
      case '6':
        await generateStatistics();
        break;
      case '7':
        console.log('\n🔄 Running All Maintenance Tasks');
        console.log('═══════════════════════════════════');
        await cleanupOrphanedHierarchies();
        await cleanupOrphanedAssignments();
        await cleanupUnusedPermissionSets();
        await fixKeyAllocations();
        const issues = await validateDataIntegrity();
        await generateStatistics();
        
        console.log('\n🎉 All Maintenance Tasks Completed!');
        if (issues > 0) {
          console.log(`⚠️  ${issues} integrity issues found - review and fix manually`);
        } else {
          console.log('✅ System is healthy');
        }
        break;
      case '0':
        console.log('\n👋 Goodbye!');
        return;
      default:
        console.log('❌ Invalid option. Please try again.');
    }
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    
    console.log('🚀 Multi-Tenant System Maintenance Tool');
    console.log('═══════════════════════════════════════');
    console.log('Perform maintenance tasks and health checks on your system.');
    console.log('⚠️  Always backup your database before running maintenance tasks.');
    
    await showMenu();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
    mongoose.connection.close();
  }
};

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log('\n❌ Maintenance cancelled');
  rl.close();
  mongoose.connection.close();
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = { main };