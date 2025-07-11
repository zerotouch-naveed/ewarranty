#!/usr/bin/env node

console.log('⚠️  DEPRECATED: bootstrap.js');
console.log('═════════════════════════════');
console.log('This script is deprecated in the multi-tenant white-label system.');
console.log('Please use the new setup process instead:');
console.log('');
console.log('🚀 For new installations:');
console.log('   npm run setup-main-company');
console.log('');
console.log('🏷️ To create white-label companies:');
console.log('   npm run create-whitelabel');
console.log('');
console.log('📊 To view system overview:');
console.log('   npm run list-system');
console.log('');
console.log('📚 Documentation:');
console.log('   • Setup Guide: WHITELABEL_SETUP.md');
console.log('   • Architecture: NEW_SCHEMA_DOCUMENTATION.md');
console.log('   • Quick Start: QUICK_START.md');
console.log('');
console.log('❌ This script will not run and may cause data conflicts.');
process.exit(1);

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { Company, User } = require('../schemas');

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/warranty_management');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

// Create initial company and admin user
const bootstrap = async () => {
  try {
    console.log('🚀 Starting Bootstrap Process...\n');

    // Check if any companies exist
    const existingCompany = await Company.findOne();
    if (existingCompany) {
      console.log('⚠️  Companies already exist. Use the register-whitelabel script instead.');
      console.log('📋 Existing companies:');
      const companies = await Company.find({}, 'companyId name email isActive').limit(5);
      companies.forEach(company => {
        console.log(`   - ${company.name} (${company.companyId}) - ${company.isActive ? 'Active' : 'Inactive'}`);
      });
      return;
    }

    // Create first company (main company)
    const mainCompany = new Company({
      companyId: `COMP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: 'Main Company',
      email: 'admin@maincompany.com',
      phone: '+1234567890',
      address: {
        street: '123 Main Street',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        zipCode: '10001'
      },
      isActive: true,
      keyAllocation: {
        totalKeys: 10000,
        usedKeys: 0,
        remainingKeys: 10000
      },
      settings: {
        timezone: 'UTC',
        currency: 'USD'
      }
    });

    await mainCompany.save();
    console.log('✅ Created main company:', mainCompany.companyId);

    // Create super admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const superAdmin = new User({
      userId: `USER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyId: mainCompany.companyId,
      userType: 'TSM',
      name: 'Super Administrator',
      email: 'superadmin@maincompany.com',
      phone: '+1234567890',
      password: hashedPassword,
      isActive: true,
      parentUserId: null,
      hierarchyLevel: 0,
      keyAllocation: {
        totalKeys: 5000,
        usedKeys: 0,
        remainingKeys: 5000
      },
      permissions: {
        canCreateUser: true,
        canEditUser: true,
        canViewReports: true,
        canManageKeys: true
      }
    });

    await superAdmin.save();
    console.log('✅ Created super admin user:', superAdmin.userId);

    console.log('\n🎉 Bootstrap completed successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('   Email: superadmin@maincompany.com');
    console.log('   Password: admin123');
    console.log('   Company ID:', mainCompany.companyId);
    console.log('\n🌐 You can now:');
    console.log('   1. Login via POST /api/auth/login');
    console.log('   2. Create new whitelabel companies via POST /api/companies');
    console.log('   3. Register users for each company');

  } catch (error) {
    console.error('❌ Bootstrap failed:', error.message);
    process.exit(1);
  } finally {
    mongoose.connection.close();
  }
};

// Run bootstrap
const main = async () => {
  await connectDB();
  await bootstrap();
};

if (require.main === module) {
  main();
}

module.exports = { bootstrap };