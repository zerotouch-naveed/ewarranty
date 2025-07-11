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
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Collect white-label company information
const collectWhitelabelInfo = async () => {
  console.log('🏢 White-Label Company Information');
  console.log('═══════════════════════════════════');
  console.log('Creating a new white-label company under your main company.\n');

  const companyInfo = {};

  // Company name
  companyInfo.name = await prompt('White-Label Company Name: ');
  while (!companyInfo.name.trim()) {
    console.log('❌ Company name is required');
    companyInfo.name = await prompt('White-Label Company Name: ');
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
  console.log('\n📍 Company Address:');
  companyInfo.address = {};
  companyInfo.address.street = await prompt('Street Address: ');
  companyInfo.address.city = await prompt('City: ');
  companyInfo.address.state = await prompt('State/Province: ');
  companyInfo.address.country = await prompt('Country: ');
  companyInfo.address.zipCode = await prompt('ZIP/Postal Code: ');

  // Key allocation
  console.log('\n🔑 Key Allocation:');
  const totalKeys = await prompt('Total Keys to Allocate (default: 5000): ');
  companyInfo.totalKeys = parseInt(totalKeys) || 5000;

  // Brand customization
  console.log('\n🎨 Brand Customization (optional):');
  companyInfo.branding = {};
  companyInfo.branding.logo = await prompt('Logo URL (optional): ');
  companyInfo.branding.primaryColor = await prompt('Primary Color (hex, optional): ');
  companyInfo.branding.secondaryColor = await prompt('Secondary Color (hex, optional): ');

  return companyInfo;
};

// Collect white-label owner information
const collectOwnerInfo = async () => {
  console.log('\n👤 White-Label Owner Information');
  console.log('═══════════════════════════════════');
  console.log('Creating the owner account for this white-label company.\n');

  const ownerInfo = {};

  // Owner name
  ownerInfo.name = await prompt('Owner Name: ');
  while (!ownerInfo.name.trim()) {
    console.log('❌ Owner name is required');
    ownerInfo.name = await prompt('Owner Name: ');
  }

  // Owner email
  ownerInfo.email = await prompt('Owner Email: ');
  while (!isValidEmail(ownerInfo.email)) {
    console.log('❌ Please enter a valid email address');
    ownerInfo.email = await prompt('Owner Email: ');
  }

  // Owner phone
  ownerInfo.phone = await prompt('Owner Phone: ');
  while (!isValidPhone(ownerInfo.phone)) {
    console.log('❌ Please enter a valid phone number');
    ownerInfo.phone = await prompt('Owner Phone: ');
  }

  // Auto-generate secure password
  ownerInfo.password = generateSecurePassword();

  return ownerInfo;
};

// Get main company context
const getMainCompanyContext = async () => {
  const mainCompany = await Company.findOne({ companyType: 'MAIN' });
  if (!mainCompany) {
    throw new Error('Main company not found. Please run setup-main-company script first.');
  }

  const mainOwner = await User.findOne({ 
    companyId: mainCompany.companyId,
    userType: 'MAIN_OWNER'
  });

  if (!mainOwner) {
    throw new Error('Main owner not found. Please run setup-main-company script first.');
  }

  return { mainCompany, mainOwner };
};

// Create white-label company
const createWhitelabel = async () => {
  try {
    console.log('🚀 White-Label Company Creation');
    console.log('═══════════════════════════════════\n');

    // Get main company context
    const { mainCompany, mainOwner } = await getMainCompanyContext();
    
    console.log(`🏢 Main Company: ${mainCompany.name}`);
    console.log(`👤 Created By: ${mainOwner.name} (${mainOwner.email})\n`);

    // Check main company key availability
    if (mainCompany.keyAllocation.remainingKeys <= 0) {
      console.log('❌ Main company has no remaining keys to allocate');
      console.log(`   Used: ${mainCompany.keyAllocation.usedKeys}`);
      console.log(`   Total: ${mainCompany.keyAllocation.totalKeys}`);
      return;
    }

    // Collect information
    const companyInfo = await collectWhitelabelInfo();
    
    // Check if requested keys are available
    if (companyInfo.totalKeys > mainCompany.keyAllocation.remainingKeys) {
      console.log(`❌ Not enough keys available. Main company has ${mainCompany.keyAllocation.remainingKeys} keys remaining.`);
      const useAvailable = await prompt(`Use all available ${mainCompany.keyAllocation.remainingKeys} keys? (y/N): `);
      if (useAvailable.toLowerCase() !== 'y') {
        console.log('❌ Creation cancelled');
        return;
      }
      companyInfo.totalKeys = mainCompany.keyAllocation.remainingKeys;
    }

    const ownerInfo = await collectOwnerInfo();

    // Show summary
    console.log('\n📋 Creation Summary:');
    console.log('════════════════════');
    console.log(`White-Label Company: ${companyInfo.name}`);
    console.log(`Company Email: ${companyInfo.email}`);
    console.log(`Owner: ${ownerInfo.name}`);
    console.log(`Owner Email: ${ownerInfo.email}`);
    console.log(`Keys Allocated: ${companyInfo.totalKeys.toLocaleString()}`);
    console.log(`Location: ${companyInfo.address.city}, ${companyInfo.address.state}, ${companyInfo.address.country}`);
    console.log(`Parent Company: ${mainCompany.name}`);
    console.log(`Created By: ${mainOwner.name}`);

    const confirm = await prompt('\n✅ Create white-label company with these details? (y/N): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ Creation cancelled');
      return;
    }

    console.log('\n🔄 Creating white-label company...');

    // Check for duplicates
    const existingByEmail = await Company.findOne({ email: companyInfo.email });
    if (existingByEmail) {
      throw new Error('Company with this email already exists');
    }

    const existingUserByEmail = await User.findOne({ email: ownerInfo.email });
    if (existingUserByEmail) {
      throw new Error('User with this email already exists');
    }

    // Create white-label company using service
    const whitelabelCompany = await CompanyService.createWhitelabelCompany({
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
      },
      branding: companyInfo.branding
    }, mainCompany.companyId, mainOwner.userId);

    console.log('✅ White-label company created:', whitelabelCompany.companyId);

    // Update main company key allocation
    await Company.findByIdAndUpdate(mainCompany._id, {
      $inc: {
        'keyAllocation.usedKeys': companyInfo.totalKeys,
        'keyAllocation.remainingKeys': -companyInfo.totalKeys
      }
    });

    console.log('✅ Main company key allocation updated');

    // Create white-label owner
    const hashedPassword = await bcrypt.hash(ownerInfo.password, 12);
    
    const whitelabelOwner = new User({
      userId: `USER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyId: whitelabelCompany.companyId,
      userType: 'WHITELABEL_OWNER',
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
      supportPermissions: {
        permissionSetId: null,
        assignedBy: null,
        assignedAt: null,
        effectivePermissions: {}
      },
      assignedCompanies: [],
      createdBy: mainOwner.userId
    });

    await whitelabelOwner.save();
    console.log('✅ White-label owner created:', whitelabelOwner.userId);

    // Create user hierarchy
    await HierarchyService.createUserHierarchy(whitelabelOwner.userId, null, whitelabelCompany.companyId);
    console.log('✅ User hierarchy initialized');

    // Success output
    console.log('\n🎉 White-Label Company Created Successfully!');
    console.log('═══════════════════════════════════════════');
    
    console.log('\n📊 Company Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Company ID: ${whitelabelCompany.companyId}`);
    console.log(`Company Type: WHITELABEL`);
    console.log(`Parent Company: ${mainCompany.name} (${mainCompany.companyId})`);
    console.log(`Keys Allocated: ${companyInfo.totalKeys.toLocaleString()}`);
    console.log(`Owner ID: ${whitelabelOwner.userId}`);
    console.log(`Owner Type: WHITELABEL_OWNER`);
    console.log(`Created: ${new Date().toLocaleDateString()}`);
    console.log(`Created By: ${mainOwner.name} (${mainOwner.userId})`);

    console.log('\n🔑 Owner Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email: ${ownerInfo.email}`);
    console.log(`Password: ${ownerInfo.password}`);
    console.log(`User Type: WHITELABEL_OWNER`);

    console.log('\n📊 Updated Main Company Status:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const updatedMain = await Company.findOne({ companyType: 'MAIN' });
    console.log(`Remaining Keys: ${updatedMain.keyAllocation.remainingKeys.toLocaleString()}`);
    console.log(`Used Keys: ${updatedMain.keyAllocation.usedKeys.toLocaleString()}`);
    console.log(`Total Keys: ${updatedMain.keyAllocation.totalKeys.toLocaleString()}`);

    console.log('\n⚠️  IMPORTANT NOTES:');
    console.log('━━━━━━━━━━━━━━━━━━━━');
    console.log('• Store the owner credentials securely');
    console.log('• Owner should change password after first login');
    console.log('• This company is isolated from other white-labels');
    console.log('• Main company users can access this company for support');
    console.log('• Support employees can be assigned to this company');

    console.log('\n🚀 Next Steps:');
    console.log('━━━━━━━━━━━━━━━━');
    console.log('1. Owner login via API: POST /api/auth/login');
    console.log('2. Create employees: POST /api/auth/register');
    console.log('3. Set up support access: npm run assign-support');
    console.log('4. View system overview: npm run list-system');

  } catch (error) {
    console.error('❌ White-label creation failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
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
  console.log('\n❌ Creation cancelled');
  rl.close();
  mongoose.connection.close();
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = { createWhitelabel };