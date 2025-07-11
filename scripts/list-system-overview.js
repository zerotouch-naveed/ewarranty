#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const { Company, User, UserHierarchy, SupportPermission, SupportAssignment } = require('../schemas');

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

// Format large numbers
const formatNumber = (num) => {
  return num.toLocaleString();
};

// Get user type display name
const getUserTypeDisplay = (userType) => {
  const typeMap = {
    'MAIN_OWNER': '👑 Main Owner',
    'MAIN_EMPLOYEE': '🏢 Main Employee',
    'MAIN_SUPPORT_EMPLOYEE': '🛠️ Main Support',
    'WHITELABEL_OWNER': '👤 WL Owner',
    'WHITELABEL_EMPLOYEE': '👥 WL Employee',
    'WHITELABEL_SUPPORT_EMPLOYEE': '🔧 WL Support',
    'TSM': '📊 TSM (Legacy)',
    'ASM': '📈 ASM (Legacy)',
    'RSM': '🎯 RSM (Legacy)',
    'MANAGER': '👔 Manager (Legacy)',
    'EMPLOYEE': '👷 Employee (Legacy)'
  };
  return typeMap[userType] || userType;
};

// Display system overview
const displaySystemOverview = async () => {
  try {
    console.log('🌐 Multi-Tenant White-Label System Overview');
    console.log('═══════════════════════════════════════════════\n');

    // Get main company
    const mainCompany = await Company.findOne({ companyType: 'MAIN' });
    if (!mainCompany) {
      console.log('❌ No main company found. Run setup-main-company script first:');
      console.log('   npm run setup-main-company');
      return;
    }

    // Get all companies
    const allCompanies = await Company.find({}).sort({ companyType: 1, createdAt: 1 });
    const whitelabelCompanies = allCompanies.filter(c => c.companyType === 'WHITELABEL');

    console.log('🏢 MAIN COMPANY');
    console.log('═══════════════════════════════════════════════');
    console.log(`Name: ${mainCompany.name}`);
    console.log(`Company ID: ${mainCompany.companyId}`);
    console.log(`Email: ${mainCompany.email}`);
    console.log(`Phone: ${mainCompany.phone}`);
    console.log(`Status: ${mainCompany.isActive ? '🟢 Active' : '🔴 Inactive'}`);
    console.log(`Created: ${mainCompany.createdAt.toLocaleDateString()}`);

    // Main company address
    if (mainCompany.address && mainCompany.address.city) {
      console.log('📍 Address:');
      console.log(`   ${mainCompany.address.street || ''}`);
      console.log(`   ${mainCompany.address.city}, ${mainCompany.address.state} ${mainCompany.address.zipCode}`);
      console.log(`   ${mainCompany.address.country}`);
    }

    // Main company key allocation
    console.log('🔑 Key Allocation:');
    console.log(`   Total: ${formatNumber(mainCompany.keyAllocation.totalKeys)}`);
    console.log(`   Used: ${formatNumber(mainCompany.keyAllocation.usedKeys)}`);
    console.log(`   Available: ${formatNumber(mainCompany.keyAllocation.remainingKeys)}`);
    console.log(`   Utilization: ${((mainCompany.keyAllocation.usedKeys / mainCompany.keyAllocation.totalKeys) * 100).toFixed(1)}%`);

    // Main company users
    const mainUsers = await User.find({
      companyId: mainCompany.companyId,
      isActive: true
    }).select('userId name email userType keyAllocation').sort({ userType: 1, createdAt: 1 });

    if (mainUsers.length > 0) {
      console.log('\n👥 Main Company Users:');
      for (const user of mainUsers) {
        console.log(`   ${getUserTypeDisplay(user.userType)}: ${user.name}`);
        console.log(`      Email: ${user.email}`);
        console.log(`      User ID: ${user.userId}`);
        console.log(`      Keys: ${formatNumber(user.keyAllocation.remainingKeys)}/${formatNumber(user.keyAllocation.totalKeys)}`);
      }
    }

    // Support permission sets
    const supportPermissions = await SupportPermission.find({}).sort({ name: 1 });
    if (supportPermissions.length > 0) {
      console.log('\n🛠️ Support Permission Sets:');
      for (const perm of supportPermissions) {
        console.log(`   • ${perm.name}`);
        console.log(`     Description: ${perm.description}`);
        console.log(`     Permissions: ${Object.keys(perm.permissions).filter(k => perm.permissions[k]).length} enabled`);
        console.log(`     Created: ${perm.createdAt.toLocaleDateString()}`);
      }
    }

    // Support assignments
    const supportAssignments = await SupportAssignment.find({})
      .populate('supportEmployeeId', 'name email userType')
      .populate('targetCompanyId', 'name companyId companyType')
      .sort({ assignmentType: 1, createdAt: -1 });

    if (supportAssignments.length > 0) {
      console.log('\n🔧 Active Support Assignments:');
      for (const assignment of supportAssignments) {
        console.log(`   • ${assignment.supportEmployeeId.name} (${getUserTypeDisplay(assignment.supportEmployeeId.userType)})`);
        console.log(`     Assigned to: ${assignment.targetCompanyId.name} (${assignment.assignmentType})`);
        console.log(`     Email: ${assignment.supportEmployeeId.email}`);
        console.log(`     Assigned: ${assignment.createdAt.toLocaleDateString()}`);
      }
    }

    console.log('\n\n🏷️ WHITE-LABEL COMPANIES');
    console.log('═══════════════════════════════════════════════');

    if (whitelabelCompanies.length === 0) {
      console.log('❌ No white-label companies found.');
      console.log('💡 Create one with: npm run create-whitelabel');
      return;
    }

    for (let i = 0; i < whitelabelCompanies.length; i++) {
      const company = whitelabelCompanies[i];
      console.log(`\n${i + 1}. ${company.name}`);
      console.log('   ─────────────────────────────────');
      console.log(`   Company ID: ${company.companyId}`);
      console.log(`   Type: WHITELABEL`);
      console.log(`   Parent: ${mainCompany.name}`);
      console.log(`   Email: ${company.email}`);
      console.log(`   Phone: ${company.phone}`);
      console.log(`   Status: ${company.isActive ? '🟢 Active' : '🔴 Inactive'}`);
      console.log(`   Created: ${company.createdAt.toLocaleDateString()}`);
      
      if (company.createdBy) {
        const creator = await User.findOne({ userId: company.createdBy });
        if (creator) {
          console.log(`   Created By: ${creator.name} (${getUserTypeDisplay(creator.userType)})`);
        }
      }

      // Address
      if (company.address && company.address.city) {
        console.log('   📍 Address:');
        console.log(`      ${company.address.street || ''}`);
        console.log(`      ${company.address.city}, ${company.address.state} ${company.address.zipCode}`);
        console.log(`      ${company.address.country}`);
      }

      // Key allocation
      console.log('   🔑 Key Allocation:');
      console.log(`      Total: ${formatNumber(company.keyAllocation.totalKeys)}`);
      console.log(`      Used: ${formatNumber(company.keyAllocation.usedKeys)}`);
      console.log(`      Remaining: ${formatNumber(company.keyAllocation.remainingKeys)}`);
      console.log(`      Utilization: ${((company.keyAllocation.usedKeys / company.keyAllocation.totalKeys) * 100).toFixed(1)}%`);

      // Branding
      if (company.branding && (company.branding.logo || company.branding.primaryColor)) {
        console.log('   🎨 Branding:');
        if (company.branding.logo) console.log(`      Logo: ${company.branding.logo}`);
        if (company.branding.primaryColor) console.log(`      Primary Color: ${company.branding.primaryColor}`);
        if (company.branding.secondaryColor) console.log(`      Secondary Color: ${company.branding.secondaryColor}`);
      }

      // Find users for this company
      const companyUsers = await User.find({
        companyId: company.companyId,
        isActive: true
      }).select('userId name email userType keyAllocation createdBy').sort({ userType: 1, hierarchyLevel: 1 });

      if (companyUsers.length > 0) {
        console.log('   👥 Users:');
        for (const user of companyUsers) {
          console.log(`      ${getUserTypeDisplay(user.userType)}: ${user.name}`);
          console.log(`         Email: ${user.email}`);
          console.log(`         User ID: ${user.userId}`);
          console.log(`         Keys: ${formatNumber(user.keyAllocation.remainingKeys)}/${formatNumber(user.keyAllocation.totalKeys)}`);
          
          if (user.createdBy) {
            const creator = await User.findOne({ userId: user.createdBy });
            if (creator) {
              console.log(`         Created By: ${creator.name}`);
            }
          }
        }
      } else {
        console.log('   ⚠️  No users found');
      }

      // Find support assignments for this company
      const companySupport = await SupportAssignment.find({
        targetCompanyId: company._id
      }).populate('supportEmployeeId', 'name email userType');

      if (companySupport.length > 0) {
        console.log('   🛠️ Assigned Support:');
        for (const support of companySupport) {
          console.log(`      ${support.supportEmployeeId.name} (${getUserTypeDisplay(support.supportEmployeeId.userType)})`);
          console.log(`         Email: ${support.supportEmployeeId.email}`);
          console.log(`         Type: ${support.assignmentType}`);
        }
      }
    }

    // System summary
    console.log('\n\n📊 SYSTEM SUMMARY');
    console.log('═══════════════════════════════════════════════');
    
    const totalCompanies = allCompanies.length;
    const activeCompanies = allCompanies.filter(c => c.isActive).length;
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalKeys = allCompanies.reduce((sum, c) => sum + c.keyAllocation.totalKeys, 0);
    const usedKeys = allCompanies.reduce((sum, c) => sum + c.keyAllocation.usedKeys, 0);
    const remainingKeys = allCompanies.reduce((sum, c) => sum + c.keyAllocation.remainingKeys, 0);
    
    // User type counts
    const userTypeCounts = {};
    const allUsers = await User.find({ isActive: true }).select('userType');
    for (const user of allUsers) {
      userTypeCounts[user.userType] = (userTypeCounts[user.userType] || 0) + 1;
    }

    console.log(`Total Companies: ${totalCompanies}`);
    console.log(`├─ Main Company: 1`);
    console.log(`└─ White-Label Companies: ${whitelabelCompanies.length}`);
    console.log(`Active Companies: ${activeCompanies}`);
    console.log(`Total Users: ${totalUsers}`);

    console.log('\n👥 User Distribution:');
    Object.entries(userTypeCounts).forEach(([type, count]) => {
      console.log(`   ${getUserTypeDisplay(type)}: ${count}`);
    });

    console.log('\n🔑 Key Distribution:');
    console.log(`Total Keys: ${formatNumber(totalKeys)}`);
    console.log(`Used Keys: ${formatNumber(usedKeys)}`);
    console.log(`Available Keys: ${formatNumber(remainingKeys)}`);
    console.log(`System Utilization: ${totalKeys > 0 ? ((usedKeys / totalKeys) * 100).toFixed(1) : 0}%`);

    console.log('\n🛠️ Support Infrastructure:');
    console.log(`Permission Sets: ${supportPermissions.length}`);
    console.log(`Active Assignments: ${supportAssignments.length}`);
    const supportEmployees = await User.countDocuments({ 
      userType: { $in: ['MAIN_SUPPORT_EMPLOYEE', 'WHITELABEL_SUPPORT_EMPLOYEE'] },
      isActive: true 
    });
    console.log(`Support Employees: ${supportEmployees}`);

    console.log('\n🚀 Management Commands:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('• Create white-label: npm run create-whitelabel');
    console.log('• Manage permissions: npm run manage-permissions');
    console.log('• Assign support: npm run assign-support');
    console.log('• System overview: npm run list-system');
    console.log('• API server: npm run dev');

  } catch (error) {
    console.error('❌ Error displaying system overview:', error.message);
    console.error('Stack trace:', error.stack);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await displaySystemOverview();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    mongoose.connection.close();
  }
};

if (require.main === module) {
  main();
}

module.exports = { displaySystemOverview };