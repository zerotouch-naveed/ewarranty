#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const { Company, User, UserHierarchy, SupportPermission } = require('../schemas');
const { CompanyService, SupportPermissionService } = require('../services');

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

// Check if already migrated
const checkIfMigrated = async () => {
  const mainCompany = await Company.findOne({ companyType: 'MAIN' });
  const whitelabelCompany = await Company.findOne({ companyType: 'WHITELABEL' });
  
  return {
    hasMainCompany: !!mainCompany,
    hasWhitelabelCompany: !!whitelabelCompany,
    isAlreadyMigrated: !!mainCompany || !!whitelabelCompany
  };
};

// Analyze existing data
const analyzeExistingData = async () => {
  console.log('\n🔍 Analyzing Existing Data');
  console.log('═══════════════════════════════');

  const companies = await Company.find({});
  const users = await User.find({});
  const hierarchies = await UserHierarchy.find({});

  console.log(`Found ${companies.length} companies`);
  console.log(`Found ${users.length} users`);
  console.log(`Found ${hierarchies.length} user hierarchies`);

  if (companies.length === 0) {
    console.log('\n❌ No existing data found. This appears to be a fresh installation.');
    console.log('💡 Use: npm run setup-main-company');
    return null;
  }

  // Categorize users
  const userTypes = {};
  for (const user of users) {
    userTypes[user.userType] = (userTypes[user.userType] || 0) + 1;
  }

  console.log('\n📊 User Distribution:');
  Object.entries(userTypes).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });

  // Check for legacy structure
  const hasLegacyStructure = companies.some(c => !c.companyType) || 
                            users.some(u => !['MAIN_OWNER', 'MAIN_EMPLOYEE', 'MAIN_SUPPORT_EMPLOYEE', 
                                            'WHITELABEL_OWNER', 'WHITELABEL_EMPLOYEE', 'WHITELABEL_SUPPORT_EMPLOYEE'].includes(u.userType));

  return {
    companies,
    users,
    hierarchies,
    userTypes,
    hasLegacyStructure
  };
};

// Backup existing data
const backupData = async () => {
  console.log('\n💾 Creating Backup');
  console.log('═══════════════════');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `backup_${timestamp}`;

  try {
    // This would ideally create a MongoDB dump, but for now we'll just log the backup info
    console.log(`📦 Backup would be created at: ${backupPath}`);
    console.log('⚠️  In a production environment, ensure you have a complete database backup!');
    
    return backupPath;
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    throw error;
  }
};

// Convert existing company to main company
const convertToMainCompany = async (existingCompany) => {
  console.log(`\n🏢 Converting "${existingCompany.name}" to Main Company`);
  
  await Company.findByIdAndUpdate(existingCompany._id, {
    companyType: 'MAIN',
    parentCompanyId: null,
    createdBy: null,
    updatedAt: new Date()
  });

  console.log('✅ Company converted to Main Company');
  return await Company.findById(existingCompany._id);
};

// Convert existing users to new user types
const convertUsers = async (users, mainCompanyId) => {
  console.log('\n👥 Converting Users to New Types');
  console.log('═══════════════════════════════════');

  const userMapping = {
    'TSM': 'MAIN_EMPLOYEE',
    'ASM': 'MAIN_EMPLOYEE', 
    'RSM': 'MAIN_EMPLOYEE',
    'MANAGER': 'MAIN_EMPLOYEE',
    'EMPLOYEE': 'MAIN_EMPLOYEE'
  };

  let convertedCount = 0;
  let ownerAssigned = false;

  for (const user of users) {
    let newUserType = user.userType;
    let needsUpdate = false;

    // Convert legacy types
    if (userMapping[user.userType]) {
      newUserType = userMapping[user.userType];
      needsUpdate = true;
    }

    // Assign first high-level user as main owner
    if (!ownerAssigned && ['TSM', 'ASM'].includes(user.userType) && user.hierarchyLevel === 0) {
      newUserType = 'MAIN_OWNER';
      needsUpdate = true;
      ownerAssigned = true;
      console.log(`👑 Assigned "${user.name}" as Main Owner`);
    }

    // Add support permissions structure for all users
    const supportPermissions = {
      permissionSetId: null,
      assignedBy: null,
      assignedAt: null,
      effectivePermissions: {}
    };

    if (needsUpdate) {
      await User.findByIdAndUpdate(user._id, {
        userType: newUserType,
        supportPermissions,
        assignedCompanies: [],
        createdBy: ownerAssigned && newUserType === 'MAIN_OWNER' ? null : user.parentUserId,
        updatedAt: new Date()
      });

      console.log(`✅ Converted "${user.name}": ${user.userType} → ${newUserType}`);
      convertedCount++;
    }
  }

  // If no owner was assigned, convert the first user to owner
  if (!ownerAssigned && users.length > 0) {
    const firstUser = users[0];
    await User.findByIdAndUpdate(firstUser._id, {
      userType: 'MAIN_OWNER',
      supportPermissions: {
        permissionSetId: null,
        assignedBy: null,
        assignedAt: null,
        effectivePermissions: {}
      },
      assignedCompanies: [],
      createdBy: null,
      updatedAt: new Date()
    });

    console.log(`👑 Assigned "${firstUser.name}" as Main Owner (fallback)`);
    convertedCount++;
  }

  console.log(`\n✅ Converted ${convertedCount} users`);
};

// Create default permission sets
const createDefaultPermissions = async () => {
  console.log('\n🛠️ Creating Default Support Permission Sets');
  console.log('═══════════════════════════════════════════');

  const defaults = [
    {
      name: 'Customer Support',
      description: 'Basic customer support permissions',
      permissions: {
        canViewCustomer: true,
        canEditCustomer: true,
        canCreateWarranty: true,
        canViewWarranty: true,
        canCreateTicket: true,
        canEditTicket: true,
        canViewTicket: true,
        canViewReports: true
      }
    },
    {
      name: 'Technical Support',
      description: 'Advanced technical support permissions',
      permissions: {
        canViewCustomer: true,
        canEditCustomer: true,
        canCreateWarranty: true,
        canEditWarranty: true,
        canViewWarranty: true,
        canCreateTicket: true,
        canEditTicket: true,
        canViewTicket: true,
        canViewReports: true,
        canViewAnalytics: true,
        canViewAuditLog: true,
        canExportData: true
      }
    }
  ];

  let created = 0;
  for (const defaultSet of defaults) {
    try {
      await SupportPermissionService.createPermissionSet(defaultSet);
      console.log(`✅ Created "${defaultSet.name}"`);
      created++;
    } catch (error) {
      console.log(`⚠️  Skipped "${defaultSet.name}" - may already exist`);
    }
  }

  console.log(`\n✅ Created ${created} permission sets`);
};

// Main migration process
const runMigration = async () => {
  try {
    console.log('🚀 Multi-Tenant Migration Tool');
    console.log('════════════════════════════════');
    console.log('This tool will migrate your existing warranty system to the new');
    console.log('multi-tenant white-label architecture.\n');

    // Check if already migrated
    const migrationStatus = await checkIfMigrated();
    if (migrationStatus.isAlreadyMigrated) {
      console.log('✅ System appears to already be migrated to multi-tenant architecture.');
      console.log(`   Main Company: ${migrationStatus.hasMainCompany ? 'Found' : 'Not Found'}`);
      console.log(`   White-Label Companies: ${migrationStatus.hasWhitelabelCompany ? 'Found' : 'Not Found'}`);
      console.log('\n💡 If you need to create additional white-label companies:');
      console.log('   npm run create-whitelabel');
      return;
    }

    // Analyze existing data
    const dataAnalysis = await analyzeExistingData();
    if (!dataAnalysis) return;

    if (!dataAnalysis.hasLegacyStructure) {
      console.log('\n✅ Data structure appears to already be compatible.');
      console.log('💡 You may just need to run: npm run setup-main-company');
      return;
    }

    console.log('\n⚠️  IMPORTANT WARNINGS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('• This migration will modify your existing data');
    console.log('• User types will be converted to new format');
    console.log('• Company structure will be updated');
    console.log('• Support permission system will be added');
    console.log('• Always backup your database before migration');

    const proceed = await prompt('\n⚠️  Continue with migration? (y/N): ');
    if (proceed.toLowerCase() !== 'y') {
      console.log('❌ Migration cancelled');
      return;
    }

    console.log('\n🔄 Starting Migration Process...');

    // Step 1: Backup
    await backupData();

    // Step 2: Convert first company to main company
    const mainCompany = await convertToMainCompany(dataAnalysis.companies[0]);

    // Step 3: Convert users
    await convertUsers(dataAnalysis.users, mainCompany.companyId);

    // Step 4: Create default permission sets
    await createDefaultPermissions();

    // Step 5: Update other companies to white-label (if any)
    if (dataAnalysis.companies.length > 1) {
      console.log('\n🏷️ Converting Additional Companies to White-Label');
      console.log('═══════════════════════════════════════════════════');
      
      for (let i = 1; i < dataAnalysis.companies.length; i++) {
        const company = dataAnalysis.companies[i];
        await Company.findByIdAndUpdate(company._id, {
          companyType: 'WHITELABEL',
          parentCompanyId: mainCompany.companyId,
          createdBy: null, // Would need to determine from business logic
          updatedAt: new Date()
        });
        console.log(`✅ Converted "${company.name}" to White-Label`);
      }
    }

    // Success message
    console.log('\n🎉 Migration Completed Successfully!');
    console.log('════════════════════════════════════');
    
    console.log('\n📊 Migration Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`• Main Company: ${mainCompany.name}`);
    console.log(`• Companies Migrated: ${dataAnalysis.companies.length}`);
    console.log(`• Users Migrated: ${dataAnalysis.users.length}`);
    console.log(`• White-Label Companies: ${dataAnalysis.companies.length - 1}`);

    console.log('\n🚀 Next Steps:');
    console.log('━━━━━━━━━━━━━━━━');
    console.log('1. Review system: npm run list-system');
    console.log('2. Create permission sets: npm run manage-permissions');
    console.log('3. Assign support employees: npm run assign-support');
    console.log('4. Create new white-labels: npm run create-whitelabel');
    console.log('5. Test API functionality');

    console.log('\n📚 Documentation:');
    console.log('━━━━━━━━━━━━━━━━━━');
    console.log('• Setup Guide: WHITELABEL_SETUP.md');
    console.log('• Architecture: NEW_SCHEMA_DOCUMENTATION.md');
    console.log('• Quick Start: QUICK_START.md');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    console.log('\n🔄 Recovery Options:');
    console.log('• Restore from backup if available');
    console.log('• Contact support for assistance');
    console.log('• Review error logs for specific issues');
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await runMigration();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
    mongoose.connection.close();
  }
};

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log('\n❌ Migration cancelled');
  rl.close();
  mongoose.connection.close();
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = { runMigration };