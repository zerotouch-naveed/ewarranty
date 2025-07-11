#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const readline = require('readline');
const { Company, User } = require('../schemas');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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

// Prompt user for input
const prompt = (question) => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone format
const isValidPhone = (phone) => {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
};

// Collect company information
const collectCompanyInfo = async () => {
  console.log('\n📋 Enter Company Information:');
  console.log('────────────────────────────────\n');

  const companyInfo = {};

  // Company name
  companyInfo.name = await prompt('Company Name: ');
  while (!companyInfo.name.trim()) {
    console.log('❌ Company name is required');
    companyInfo.name = await prompt('Company Name: ');
  }

  // Company email
  companyInfo.email = await prompt('Company Email: ');
  while (!isValidEmail(companyInfo.email)) {
    console.log('❌ Please enter a valid email address');
    companyInfo.email = await prompt('Company Email: ');
  }

  // Company phone
  companyInfo.phone = await prompt('Company Phone: ');
  while (!isValidPhone(companyInfo.phone)) {
    console.log('❌ Please enter a valid phone number');
    companyInfo.phone = await prompt('Company Phone: ');
  }

  // Address
  console.log('\n📍 Address Information:');
  companyInfo.address = {};
  companyInfo.address.street = await prompt('Street Address: ');
  companyInfo.address.city = await prompt('City: ');
  companyInfo.address.state = await prompt('State/Province: ');
  companyInfo.address.country = await prompt('Country: ');
  companyInfo.address.zipCode = await prompt('ZIP/Postal Code: ');

  // Key allocation
  console.log('\n🔑 Key Allocation:');
  const totalKeys = await prompt('Total Keys to Allocate (default: 1000): ');
  companyInfo.totalKeys = parseInt(totalKeys) || 1000;

  return companyInfo;
};

// Collect admin user information
const collectAdminInfo = async () => {
  console.log('\n👤 Admin User Information:');
  console.log('─────────────────────────────────\n');

  const adminInfo = {};

  // Admin name
  adminInfo.name = await prompt('Admin Name: ');
  while (!adminInfo.name.trim()) {
    console.log('❌ Admin name is required');
    adminInfo.name = await prompt('Admin Name: ');
  }

  // Admin email
  adminInfo.email = await prompt('Admin Email: ');
  while (!isValidEmail(adminInfo.email)) {
    console.log('❌ Please enter a valid email address');
    adminInfo.email = await prompt('Admin Email: ');
  }

  // Admin phone
  adminInfo.phone = await prompt('Admin Phone: ');
  while (!isValidPhone(adminInfo.phone)) {
    console.log('❌ Please enter a valid phone number');
    adminInfo.phone = await prompt('Admin Phone: ');
  }

  // Admin password
  adminInfo.password = await prompt('Admin Password (default: admin123): ');
  adminInfo.password = adminInfo.password.trim() || 'admin123';

  // User type
  console.log('\n🏷️  Admin User Type:');
  console.log('   1. TSM (Territory Sales Manager)');
  console.log('   2. ASM (Area Sales Manager)');
  const userTypeChoice = await prompt('Select user type (1 or 2, default: 1): ');
  adminInfo.userType = userTypeChoice === '2' ? 'ASM' : 'TSM';

  return adminInfo;
};

// Create whitelabel company and admin
const createWhitelabel = async () => {
  try {
    console.log('🚀 Whitelabel Company Registration');
    console.log('═══════════════════════════════════\n');

    // Check if system is initialized
    const existingCompany = await Company.findOne();
    if (!existingCompany) {
      console.log('❌ System not initialized. Run bootstrap script first:');
      console.log('   npm run bootstrap');
      return;
    }

    // Collect information
    const companyInfo = await collectCompanyInfo();
    const adminInfo = await collectAdminInfo();

    // Show summary
    console.log('\n📋 Registration Summary:');
    console.log('─────────────────────────');
    console.log(`Company: ${companyInfo.name}`);
    console.log(`Email: ${companyInfo.email}`);
    console.log(`Admin: ${adminInfo.name} (${adminInfo.userType})`);
    console.log(`Admin Email: ${adminInfo.email}`);
    console.log(`Total Keys: ${companyInfo.totalKeys}`);

    const confirm = await prompt('\n✅ Create this whitelabel company? (y/N): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ Registration cancelled');
      return;
    }

    // Check for duplicates
    const existingByEmail = await Company.findOne({ email: companyInfo.email });
    if (existingByEmail) {
      console.log('❌ Company with this email already exists');
      return;
    }

    const existingUserByEmail = await User.findOne({ email: adminInfo.email });
    if (existingUserByEmail) {
      console.log('❌ User with this email already exists');
      return;
    }

    // Create company
    const company = new Company({
      companyId: `COMP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: companyInfo.name,
      email: companyInfo.email,
      phone: companyInfo.phone,
      address: companyInfo.address,
      isActive: true,
      keyAllocation: {
        totalKeys: companyInfo.totalKeys,
        usedKeys: 0,
        remainingKeys: companyInfo.totalKeys
      },
      settings: {
        timezone: 'UTC',
        currency: 'USD'
      }
    });

    await company.save();
    console.log('\n✅ Company created:', company.companyId);

    // Create admin user
    const hashedPassword = await bcrypt.hash(adminInfo.password, 10);
    
    const admin = new User({
      userId: `USER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyId: company.companyId,
      userType: adminInfo.userType,
      name: adminInfo.name,
      email: adminInfo.email,
      phone: adminInfo.phone,
      password: hashedPassword,
      isActive: true,
      parentUserId: null,
      hierarchyLevel: 0,
      keyAllocation: {
        totalKeys: Math.floor(companyInfo.totalKeys * 0.5), // 50% to admin
        usedKeys: 0,
        remainingKeys: Math.floor(companyInfo.totalKeys * 0.5)
      },
      permissions: {
        canCreateUser: true,
        canEditUser: true,
        canViewReports: true,
        canManageKeys: true
      }
    });

    await admin.save();
    console.log('✅ Admin user created:', admin.userId);

    console.log('\n🎉 Whitelabel Registration Completed!');
    console.log('═══════════════════════════════════');
    console.log('\n📋 Company Details:');
    console.log(`   Company ID: ${company.companyId}`);
    console.log(`   Name: ${company.name}`);
    console.log(`   Email: ${company.email}`);
    console.log(`   Total Keys: ${company.keyAllocation.totalKeys}`);

    console.log('\n👤 Admin Login Credentials:');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: ${adminInfo.password}`);
    console.log(`   User Type: ${admin.userType}`);
    console.log(`   User ID: ${admin.userId}`);

    console.log('\n🌐 Next Steps:');
    console.log('   1. Admin can login via POST /api/auth/login');
    console.log('   2. Create user hierarchy via POST /api/auth/register');
    console.log('   3. Allocate keys via POST /api/keys/allocate');
    console.log('   4. Start creating customer warranties');

  } catch (error) {
    console.error('❌ Registration failed:', error.message);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await createWhitelabel();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
    mongoose.connection.close();
  }
};

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log('\n❌ Registration cancelled');
  rl.close();
  mongoose.connection.close();
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = { createWhitelabel };