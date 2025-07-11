#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
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

// List all companies and their details
const listCompanies = async () => {
  try {
    console.log('🏢 Registered Companies');
    console.log('═══════════════════════\n');

    const companies = await Company.find({}).sort({ createdAt: 1 });
    
    if (companies.length === 0) {
      console.log('❌ No companies found. Run bootstrap script first:');
      console.log('   npm run bootstrap');
      return;
    }

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      console.log(`${i + 1}. ${company.name}`);
      console.log('   ─────────────────────────────');
      console.log(`   Company ID: ${company.companyId}`);
      console.log(`   Email: ${company.email}`);
      console.log(`   Phone: ${company.phone}`);
      console.log(`   Status: ${company.isActive ? '🟢 Active' : '🔴 Inactive'}`);
      console.log(`   Created: ${company.createdAt.toLocaleDateString()}`);
      
      // Key allocation
      console.log('   🔑 Key Allocation:');
      console.log(`      Total: ${company.keyAllocation.totalKeys}`);
      console.log(`      Used: ${company.keyAllocation.usedKeys}`);
      console.log(`      Remaining: ${company.keyAllocation.remainingKeys}`);

      // Address
      if (company.address && company.address.city) {
        console.log('   📍 Address:');
        console.log(`      ${company.address.street || ''}`);
        console.log(`      ${company.address.city}, ${company.address.state} ${company.address.zipCode}`);
        console.log(`      ${company.address.country}`);
      }

      // Find admin users for this company
      const adminUsers = await User.find({
        companyId: company.companyId,
        userType: { $in: ['TSM', 'ASM'] },
        isActive: true
      }).select('userId name email userType keyAllocation');

      if (adminUsers.length > 0) {
        console.log('   👤 Admin Users:');
        adminUsers.forEach(admin => {
          console.log(`      • ${admin.name} (${admin.userType})`);
          console.log(`        Email: ${admin.email}`);
          console.log(`        User ID: ${admin.userId}`);
          console.log(`        Keys: ${admin.keyAllocation.remainingKeys}/${admin.keyAllocation.totalKeys}`);
        });
      } else {
        console.log('   ⚠️  No admin users found');
      }

      // Count total users
      const totalUsers = await User.countDocuments({ 
        companyId: company.companyId, 
        isActive: true 
      });
      console.log(`   📊 Total Users: ${totalUsers}`);

      if (i < companies.length - 1) {
        console.log('');
      }
    }

    console.log('\n📈 Summary:');
    console.log('─────────────');
    const totalCompanies = companies.length;
    const activeCompanies = companies.filter(c => c.isActive).length;
    const totalKeys = companies.reduce((sum, c) => sum + c.keyAllocation.totalKeys, 0);
    const usedKeys = companies.reduce((sum, c) => sum + c.keyAllocation.usedKeys, 0);

    console.log(`Total Companies: ${totalCompanies}`);
    console.log(`Active Companies: ${activeCompanies}`);
    console.log(`Total Keys Allocated: ${totalKeys}`);
    console.log(`Total Keys Used: ${usedKeys}`);
    console.log(`Utilization Rate: ${totalKeys > 0 ? ((usedKeys / totalKeys) * 100).toFixed(1) : 0}%`);

  } catch (error) {
    console.error('❌ Error listing companies:', error.message);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await listCompanies();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    mongoose.connection.close();
  }
};

if (require.main === module) {
  main();
}

module.exports = { listCompanies };