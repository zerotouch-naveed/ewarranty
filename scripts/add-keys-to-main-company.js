#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const prompt = (question) => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

const main = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/multi_tenant_warranty';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const {Company, User, WalletManagement} = require('../schemas');
    const mainCompany = await Company.findOne({ companyType: 'MAIN' });
    if (!mainCompany) {
      console.log('❌ Main company not found.');
      process.exit(1);
    }

    const mainOwner = await User.findOne({ userType: 'MAIN_OWNER' });
    if (!mainOwner) {
      console.log('❌ Main Owner not found.');
      process.exit(1);
    }

    console.log(`\n🏢 Main Company: ${mainCompany.name}`);
    console.log(`\n🏢 Main Owner: ${mainOwner.name}`);
    console.log(`Current Wallet Balance: ${mainCompany.walletBalance.totalAmount}`);
    console.log(`Current Remaining Keys: ${mainCompany.walletBalance.remainingAmount}`);

    const addStr = await prompt('How many keys do you want to add to the main company? ');
    const addAmount = parseInt(addStr);
    if (isNaN(addAmount) || addAmount <= 0) {
      console.log('❌ Invalid number of keys.');
      process.exit(1);
    }

    mainCompany.walletBalance.totalAmount += addAmount;
    mainCompany.walletBalance.remainingAmount += addAmount;
    await mainCompany.save();


    mainOwner.walletBalance.totalAmount += addAmount;
    mainOwner.walletBalance.remainingAmount += addAmount;
    await mainOwner.save();

    // Create wallet management record
    const walletRecord = new WalletManagement({
      transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyId:mainCompany.companyId,
      transactionType: 'SELF-ALLOCATION',
      toUserId: mainOwner.userId,
      amount: addAmount,
      isActive: true,
      isRestrictedOperation: true
    });

    await walletRecord.save();

    console.log('\n✅ Keys added successfully!');
    console.log(`      New Total: ${mainCompany.walletBalance.totalAmount}`);
    console.log(`      New usedAmount: ${mainCompany.walletBalance.usedAmount}`);
    console.log(`      New Available: ${mainCompany.walletBalance.remainingAmount}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
    mongoose.connection.close();
  }
};

main(); 