#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const readline = require('readline');
const { Company, User, UserHierarchy } = require('../schemas');
const { CompanyService, HierarchyService } = require('../services');

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

// Generate secure password
const generateSecurePassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Collect main company information
const collectMainCompanyInfo = async () => {
  console.log('🏢 Main Company Information Setup');
  console.log('═══════════════════════════════════');
  console.log('Setting up your primary company that will manage all white-label companies.\n');

  const companyInfo = {};

  // Company name
  companyInfo.name = process.env.MAIN_COMPANY_NAME || await prompt('Main Company Name: ');
  while (!companyInfo.name.trim()) {
    console.log('❌ Main company name is required');
    companyInfo.name = await prompt('Main Company Name: ');
  }

  // Company email
  companyInfo.email = process.env.MAIN_COMPANY_EMAIL || await prompt('Main Company Email: ');
  while (!isValidEmail(companyInfo.email)) {
    console.log('❌ Please enter a valid email address');
    companyInfo.email = await prompt('Main Company Email: ');
  }

  // Company phone
  companyInfo.phone = await prompt('Main Company Phone: ');
  while (!isValidPhone(companyInfo.phone)) {
    console.log('❌ Please enter a valid phone number');
    companyInfo.phone = await prompt('Main Company Phone: ');
  }

  // Address
  console.log('\n📍 Main Company Address:');
  companyInfo.address = {};
  companyInfo.address.street = await prompt('Street Address: ');
  companyInfo.address.city = await prompt('City: ');
  companyInfo.address.state = await prompt('State/Province: ');
  companyInfo.address.country = await prompt('Country: ');
  companyInfo.address.zipCode = await prompt('ZIP/Postal Code: ');

  // Key allocation
  console.log('\n🔑 Initial Key Allocation:');
  const totalKeys = await prompt('Total warranty keys for system (default: 10000): ');
  companyInfo.totalKeys = parseInt(totalKeys) || 10000;

  return companyInfo;
};

// Collect main owner information
const collectMainOwnerInfo = async () => {
  console.log('\n👤 Main Owner Account Setup');
  console.log('═══════════════════════════════');
  console.log('Creating the primary owner account with full system access.\n');

  const ownerInfo = {};

  // Owner name
  ownerInfo.name = process.env.MAIN_OWNER_NAME || await prompt('Main Owner Name: ');
  while (!ownerInfo.name.trim()) {
    console.log('❌ Main owner name is required');
    ownerInfo.name = await prompt('Main Owner Name: ');
  }

  // Owner email
  ownerInfo.email = process.env.MAIN_OWNER_EMAIL || await prompt('Main Owner Email: ');
  while (!isValidEmail(ownerInfo.email)) {
    console.log('❌ Please enter a valid email address');
    ownerInfo.email = await prompt('Main Owner Email: ');
  }

  // Owner phone
  ownerInfo.phone = await prompt('Main Owner Phone: ');
  while (!isValidPhone(ownerInfo.phone)) {
    console.log('❌ Please enter a valid phone number');
    ownerInfo.phone = await prompt('Main Owner Phone: ');
  }

  // Generate secure password
  ownerInfo.password = generateSecurePassword();

  return ownerInfo;
};

// Set up main company
const setupMainCompany = async () => {
  try {
    console.log('🚀 Multi-Tenant White-Label System Setup');
    console.log('═══════════════════════════════════════\n');

    // Check if main company already exists
    const existingMainCompany = await Company.findOne({ companyType: 'MAIN' });
    if (existingMainCompany) {
      console.log('⚠️  Main company already exists!');
      console.log('📋 Existing main company details:');
      console.log(`   Company ID: ${existingMainCompany.companyId}`);
      console.log(`   Name: ${existingMainCompany.name}`);
      console.log(`   Email: ${existingMainCompany.email}`);
      console.log(`   Created: ${existingMainCompany.createdAt.toLocaleDateString()}`);
      
      // Find main owner
      const mainOwner = await User.findOne({ 
        companyId: existingMainCompany.companyId,
        userType: 'MAIN_OWNER'
      });
      
      if (mainOwner) {
        console.log('\n👤 Main Owner:');
        console.log(`   Name: ${mainOwner.name}`);
        console.log(`   Email: ${mainOwner.email}`);
        console.log(`   User ID: ${mainOwner.userId}`);
      }

      console.log('\n💡 To create white-label companies, run:');
      console.log('   npm run create-whitelabel');
      
      return;
    }

    // Collect information
    const companyInfo = await collectMainCompanyInfo();
    const ownerInfo = await collectMainOwnerInfo();

    // Show summary
    console.log('\n📋 Setup Summary:');
    console.log('═══════════════════');
    console.log(`Main Company: ${companyInfo.name}`);
    console.log(`Company Email: ${companyInfo.email}`);
    console.log(`Owner Name: ${ownerInfo.name}`);
    console.log(`Owner Email: ${ownerInfo.email}`);
    console.log(`Total Keys: ${companyInfo.totalKeys.toLocaleString()}`);
    console.log(`Address: ${companyInfo.address.city}, ${companyInfo.address.state}, ${companyInfo.address.country}`);

    const confirm = await prompt('\n✅ Create main company with these details? (y/N): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ Setup cancelled');
      return;
    }

    console.log('\n🔄 Creating main company and owner account...');

    // Check for email conflicts
    const existingCompanyByEmail = await Company.findOne({ email: companyInfo.email });
    if (existingCompanyByEmail) {
      throw new Error('Company with this email already exists');
    }

    const existingUserByEmail = await User.findOne({ email: ownerInfo.email });
    if (existingUserByEmail) {
      throw new Error('User with this email already exists');
    }

    // Create main company using service
    const mainCompany = await CompanyService.createMainCompany({
      name: companyInfo.name,
      email: companyInfo.email,
      phone: companyInfo.phone,
      address: companyInfo.address,
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

    console.log('✅ Main company created:', mainCompany.companyId);

    // Create main owner user
    const hashedPassword = await bcrypt.hash(ownerInfo.password, 12);
    
    const mainOwner = new User({
      userId: `USER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyId: mainCompany.companyId,
      userType: 'MAIN_OWNER',
      name: ownerInfo.name,
      email: ownerInfo.email,
      phone: ownerInfo.phone,
      password: hashedPassword,
      isActive: true,
      parentUserId: null,
      hierarchyLevel: 0,
      keyAllocation: {
        totalKeys: companyInfo.totalKeys,
        usedKeys: 0,
        remainingKeys: companyInfo.totalKeys
      },
      permissions: {
        canCreateUser: true,
        canEditUser: true,
        canViewReports: true,
        canManageKeys: true
      },
      // Support permissions are null for owners/employees
      supportPermissions: {
        permissionSetId: null,
        assignedBy: null,
        assignedAt: null,
        effectivePermissions: {}
      },
      assignedCompanies: [],
      createdBy: null // Main owner is not created by anyone
    });

    await mainOwner.save();
    console.log('✅ Main owner user created:', mainOwner.userId);

    // Create user hierarchy
    await HierarchyService.createUserHierarchy(mainOwner.userId, null, mainCompany.companyId);
    console.log('✅ User hierarchy initialized');

    // Success output
    console.log('\n🎉 Main Company Setup Completed Successfully!');
    console.log('═══════════════════════════════════════════');
    
    console.log('\n📊 System Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Company ID: ${mainCompany.companyId}`);
    console.log(`Company Type: MAIN`);
    console.log(`Total Keys: ${companyInfo.totalKeys.toLocaleString()}`);
    console.log(`Owner ID: ${mainOwner.userId}`);
    console.log(`Owner Type: MAIN_OWNER`);
    console.log(`Created: ${new Date().toLocaleDateString()}`);

    console.log('\n🔑 Main Owner Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email: ${ownerInfo.email}`);
    console.log(`Password: ${ownerInfo.password}`);
    console.log(`User Type: MAIN_OWNER`);

    console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('• Store the password securely');
    console.log('• Change the password after first login');
    console.log('• The main owner has full system access');
    console.log('• Support employees will NOT be able to transfer keys');

    console.log('\n🚀 Next Steps:');
    console.log('━━━━━━━━━━━━━━━━');
    console.log('1. Login via API: POST /api/auth/login');
    console.log('2. Create white-label companies: npm run create-whitelabel');
    console.log('3. Set up support employees: npm run manage-permissions');
    console.log('4. Start API server: npm run dev');
    console.log('5. Access API docs: http://localhost:3000/docs');

    console.log('\n📚 Documentation:');
    console.log('━━━━━━━━━━━━━━━━━━');
    console.log('• Complete Guide: NEW_SCHEMA_DOCUMENTATION.md');
    console.log('• Setup Guide: WHITELABEL_SETUP.md');
    console.log('• Quick Start: QUICK_START.md');

  } catch (error) {
    console.error('❌ Main company setup failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await setupMainCompany();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
    mongoose.connection.close();
  }
};

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log('\n❌ Setup cancelled');
  rl.close();
  mongoose.connection.close();
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = { setupMainCompany };