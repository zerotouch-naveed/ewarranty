#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const { SupportPermission, User } = require('../schemas');
const { SupportPermissionService } = require('../services');

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

// Available permissions with descriptions
const AVAILABLE_PERMISSIONS = {
  canCreateUser: 'Create new users',
  canEditUser: 'Edit existing users',
  canViewReports: 'View reports and analytics',
  canCreateCustomer: 'Create new customers',
  canEditCustomer: 'Edit existing customers',
  canViewCustomer: 'View customer details',
  canCreateWarranty: 'Create warranties',
  canEditWarranty: 'Edit warranties',
  canViewWarranty: 'View warranty details',
  canCreateTicket: 'Create support tickets',
  canEditTicket: 'Edit support tickets',
  canViewTicket: 'View support tickets',
  canAccessCompanySettings: 'Access company settings',
  canViewAnalytics: 'View analytics dashboard',
  canManageHierarchy: 'Manage user hierarchy',
  canViewAuditLog: 'View audit logs',
  canExportData: 'Export data',
  canManageIntegrations: 'Manage integrations'
};

// Display existing permission sets
const listPermissionSets = async () => {
  console.log('\n🛠️ Existing Support Permission Sets');
  console.log('═══════════════════════════════════════');

  const permissionSets = await SupportPermission.find({}).sort({ name: 1 });
  
  if (permissionSets.length === 0) {
    console.log('❌ No permission sets found.');
    return [];
  }

  for (let i = 0; i < permissionSets.length; i++) {
    const perm = permissionSets[i];
    console.log(`\n${i + 1}. ${perm.name}`);
    console.log(`   ID: ${perm.permissionSetId}`);
    console.log(`   Description: ${perm.description}`);
    console.log(`   Created: ${perm.createdAt.toLocaleDateString()}`);
    
    const enabledPerms = Object.keys(perm.permissions).filter(k => perm.permissions[k]);
    console.log(`   Enabled Permissions (${enabledPerms.length}):`);
    
    if (enabledPerms.length > 0) {
      for (const permKey of enabledPerms) {
        console.log(`      ✅ ${AVAILABLE_PERMISSIONS[permKey] || permKey}`);
      }
    } else {
      console.log('      (None)');
    }

    // Check usage
    const usageCount = await User.countDocuments({
      'supportPermissions.permissionSetId': perm.permissionSetId,
      isActive: true
    });
    console.log(`   Currently Used By: ${usageCount} support employees`);
  }

  return permissionSets;
};

// Create new permission set
const createPermissionSet = async () => {
  console.log('\n🆕 Create New Permission Set');
  console.log('════════════════════════════════');

  // Get basic info
  const name = await prompt('\nPermission Set Name: ');
  if (!name.trim()) {
    console.log('❌ Name is required');
    return;
  }

  const description = await prompt('Description: ');
  if (!description.trim()) {
    console.log('❌ Description is required');
    return;
  }

  // Select permissions
  console.log('\n🔐 Select Permissions (y/N for each):');
  console.log('Note: Support employees can NEVER manage keys regardless of permissions');
  
  const permissions = {};
  
  for (const [permKey, permDesc] of Object.entries(AVAILABLE_PERMISSIONS)) {
    const answer = await prompt(`${permDesc}? (y/N): `);
    permissions[permKey] = answer.toLowerCase() === 'y';
  }

  // Force key management permissions to false
  permissions.canManageKeys = false;
  permissions.canAllocateKeys = false;
  permissions.canTransferKeys = false;
  permissions.canRevokeKeys = false;

  // Show summary
  console.log('\n📋 Permission Set Summary:');
  console.log('══════════════════════════');
  console.log(`Name: ${name}`);
  console.log(`Description: ${description}`);
  
  const enabledPerms = Object.keys(permissions).filter(k => permissions[k]);
  console.log(`\nEnabled Permissions (${enabledPerms.length}):`);
  for (const permKey of enabledPerms) {
    console.log(`   ✅ ${AVAILABLE_PERMISSIONS[permKey] || permKey}`);
  }

  console.log('\n🔒 Restricted Permissions (Security):');
  console.log('   ❌ Manage Keys (Always restricted for support)');
  console.log('   ❌ Allocate Keys (Always restricted for support)');
  console.log('   ❌ Transfer Keys (Always restricted for support)');
  console.log('   ❌ Revoke Keys (Always restricted for support)');

  const confirm = await prompt('\n✅ Create this permission set? (y/N): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('❌ Creation cancelled');
    return;
  }

  try {
    const permissionSet = await SupportPermissionService.createPermissionSet({
      name,
      description,
      permissions
    });

    console.log('\n🎉 Permission Set Created Successfully!');
    console.log(`ID: ${permissionSet.permissionSetId}`);
    console.log(`Name: ${permissionSet.name}`);
    console.log(`Enabled Permissions: ${enabledPerms.length}`);
    
  } catch (error) {
    console.error('❌ Failed to create permission set:', error.message);
  }
};

// Edit existing permission set
const editPermissionSet = async (permissionSets) => {
  console.log('\n✏️ Edit Permission Set');
  console.log('═══════════════════════');

  if (permissionSets.length === 0) {
    console.log('❌ No permission sets available to edit');
    return;
  }

  const choice = await prompt('\nEnter permission set number to edit (or 0 to cancel): ');
  const index = parseInt(choice) - 1;

  if (index < 0 || index >= permissionSets.length) {
    console.log('❌ Invalid selection');
    return;
  }

  const permSet = permissionSets[index];
  console.log(`\nEditing: ${permSet.name}`);
  console.log(`Current Description: ${permSet.description}`);

  // Edit name
  const newName = await prompt(`New name (current: ${permSet.name}): `);
  const name = newName.trim() || permSet.name;

  // Edit description
  const newDesc = await prompt(`New description (current: ${permSet.description}): `);
  const description = newDesc.trim() || permSet.description;

  // Edit permissions
  console.log('\n🔐 Update Permissions (y/N/s to skip):');
  const permissions = { ...permSet.permissions };
  
  for (const [permKey, permDesc] of Object.entries(AVAILABLE_PERMISSIONS)) {
    const current = permissions[permKey] ? 'ENABLED' : 'DISABLED';
    const answer = await prompt(`${permDesc} (${current})? (y/N/s): `);
    
    if (answer.toLowerCase() === 'y') {
      permissions[permKey] = true;
    } else if (answer.toLowerCase() === 'n') {
      permissions[permKey] = false;
    }
    // 's' or anything else keeps current value
  }

  // Force key management permissions to false
  permissions.canManageKeys = false;
  permissions.canAllocateKeys = false;
  permissions.canTransferKeys = false;
  permissions.canRevokeKeys = false;

  // Show summary
  console.log('\n📋 Updated Permission Set Summary:');
  console.log('═══════════════════════════════════');
  console.log(`Name: ${name}`);
  console.log(`Description: ${description}`);
  
  const enabledPerms = Object.keys(permissions).filter(k => permissions[k]);
  console.log(`\nEnabled Permissions (${enabledPerms.length}):`);
  for (const permKey of enabledPerms) {
    console.log(`   ✅ ${AVAILABLE_PERMISSIONS[permKey] || permKey}`);
  }

  const confirm = await prompt('\n✅ Save changes? (y/N): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('❌ Changes cancelled');
    return;
  }

  try {
    await SupportPermission.findByIdAndUpdate(permSet._id, {
      name,
      description,
      permissions,
      updatedAt: new Date()
    });

    console.log('\n🎉 Permission Set Updated Successfully!');
    
    // Check if this affects existing users
    const affectedUsers = await User.countDocuments({
      'supportPermissions.permissionSetId': permSet.permissionSetId,
      isActive: true
    });
    
    if (affectedUsers > 0) {
      console.log(`⚠️  This change affects ${affectedUsers} support employees.`);
      console.log('   Changes will take effect on their next login.');
    }
    
  } catch (error) {
    console.error('❌ Failed to update permission set:', error.message);
  }
};

// Delete permission set
const deletePermissionSet = async (permissionSets) => {
  console.log('\n🗑️ Delete Permission Set');
  console.log('══════════════════════════');

  if (permissionSets.length === 0) {
    console.log('❌ No permission sets available to delete');
    return;
  }

  const choice = await prompt('\nEnter permission set number to delete (or 0 to cancel): ');
  const index = parseInt(choice) - 1;

  if (index < 0 || index >= permissionSets.length) {
    console.log('❌ Invalid selection');
    return;
  }

  const permSet = permissionSets[index];
  
  // Check usage
  const usageCount = await User.countDocuments({
    'supportPermissions.permissionSetId': permSet.permissionSetId,
    isActive: true
  });

  console.log(`\n⚠️  Deleting: ${permSet.name}`);
  console.log(`Description: ${permSet.description}`);
  console.log(`Currently used by: ${usageCount} support employees`);

  if (usageCount > 0) {
    console.log('\n❌ Cannot delete permission set that is currently in use.');
    console.log('Please reassign affected support employees first.');
    return;
  }

  const confirm = await prompt('\n❗ This action cannot be undone. Delete? (y/N): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('❌ Deletion cancelled');
    return;
  }

  try {
    await SupportPermission.findByIdAndDelete(permSet._id);
    console.log('\n🎉 Permission Set Deleted Successfully!');
    
  } catch (error) {
    console.error('❌ Failed to delete permission set:', error.message);
  }
};

// Create default permission sets
const createDefaultPermissionSets = async () => {
  console.log('\n🔧 Create Default Permission Sets');
  console.log('═══════════════════════════════════');

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
    },
    {
      name: 'Account Manager',
      description: 'Account management permissions',
      permissions: {
        canCreateUser: true,
        canEditUser: true,
        canViewCustomer: true,
        canEditCustomer: true,
        canCreateCustomer: true,
        canViewWarranty: true,
        canViewTicket: true,
        canViewReports: true,
        canViewAnalytics: true,
        canAccessCompanySettings: true
      }
    },
    {
      name: 'Read Only',
      description: 'View-only access for monitoring',
      permissions: {
        canViewCustomer: true,
        canViewWarranty: true,
        canViewTicket: true,
        canViewReports: true
      }
    }
  ];

  console.log(`Creating ${defaults.length} default permission sets...`);

  let created = 0;
  for (const defaultSet of defaults) {
    // Check if already exists
    const existing = await SupportPermission.findOne({ name: defaultSet.name });
    if (existing) {
      console.log(`⚠️  Skipping "${defaultSet.name}" - already exists`);
      continue;
    }

    try {
      await SupportPermissionService.createPermissionSet(defaultSet);
      console.log(`✅ Created "${defaultSet.name}"`);
      created++;
    } catch (error) {
      console.log(`❌ Failed to create "${defaultSet.name}": ${error.message}`);
    }
  }

  console.log(`\n🎉 Created ${created} default permission sets!`);
};

// Main menu
const showMenu = async () => {
  while (true) {
    console.log('\n🛠️ Support Permission Management');
    console.log('═══════════════════════════════════');
    console.log('1. List existing permission sets');
    console.log('2. Create new permission set');
    console.log('3. Edit permission set');
    console.log('4. Delete permission set');
    console.log('5. Create default permission sets');
    console.log('0. Exit');

    const choice = await prompt('\nSelect option (0-5): ');

    switch (choice) {
      case '1':
        await listPermissionSets();
        break;
      case '2':
        await createPermissionSet();
        break;
      case '3':
        const permSetsForEdit = await listPermissionSets();
        await editPermissionSet(permSetsForEdit);
        break;
      case '4':
        const permSetsForDelete = await listPermissionSets();
        await deletePermissionSet(permSetsForDelete);
        break;
      case '5':
        await createDefaultPermissionSets();
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
    
    console.log('🚀 Support Permission Management System');
    console.log('═══════════════════════════════════════');
    console.log('Manage permission sets for support employees.');
    console.log('Note: Support employees can NEVER manage keys.');
    
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
  console.log('\n❌ Operation cancelled');
  rl.close();
  mongoose.connection.close();
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = { main };