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

    const Company = require('../schemas').Company;
    const mainCompany = await Company.findOne({ companyType: 'MAIN' });
    if (!mainCompany) {
      console.log('❌ Main company not found.');
      process.exit(1);
    }

    console.log(`\n🏢 Main Company: ${mainCompany.name}`);
    console.log(`Current Total Keys: ${mainCompany.keyAllocation.totalKeys}`);
    console.log(`Current Used Keys: ${mainCompany.keyAllocation.usedKeys}`);
    console.log(`Current Remaining Keys: ${mainCompany.keyAllocation.remainingKeys}`);

    const addStr = await prompt('How many keys do you want to add to the main company? ');
    const addKeys = parseInt(addStr);
    if (isNaN(addKeys) || addKeys <= 0) {
      console.log('❌ Invalid number of keys.');
      process.exit(1);
    }

    mainCompany.keyAllocation.totalKeys += addKeys;
    mainCompany.keyAllocation.remainingKeys += addKeys;
    await mainCompany.save();

    console.log('\n✅ Keys added successfully!');
    console.log(`New Total Keys: ${mainCompany.keyAllocation.totalKeys}`);
    console.log(`New Used Keys: ${mainCompany.keyAllocation.usedKeys}`);
    console.log(`New Remaining Keys: ${mainCompany.keyAllocation.remainingKeys}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
    mongoose.connection.close();
  }
};

main(); 