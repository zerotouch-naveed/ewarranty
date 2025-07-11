#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const { Company, User, SupportPermission, SupportAssignment } = require('../schemas');
const { SupportAssignmentService } = require('../services');

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

// List all support employees
const listSupportEmployees = async () => {
  console.log('\n🛠️ Available Support Employees');
  console.log('═══════════════════════════════════');

  const supportEmployees = await User.find({
    userType: { $in: ['MAIN_SUPPORT_EMPLOYEE', 'WHITELABEL_SUPPORT_EMPLOYEE'] },
    isActive: true
  }).populate('companyId', 'name companyType').sort({ name: 1 });

  if (supportEmployees.length === 0) {
    console.log('❌ No support employees found.');
    console.log('💡 Create support employees first through the user registration API.');
    return [];
  }

  for (let i = 0; i < supportEmployees.length; i++) {
    const emp = supportEmployees[i];
    console.log(`\n${i + 1}. ${emp.name}`);
    console.log(`   Email: ${emp.email}`);
    console.log(`   Type: ${getUserTypeDisplay(emp.userType)}`);
    console.log(`   Company: ${emp.companyId.name} (${emp.companyId.companyType})`);
    console.log(`   User ID: ${emp.userId}`);
    
    // Show current permission set
    if (emp.supportPermissions && emp.supportPermissions.permissionSetId) {
      const permSet = await SupportPermission.findOne({ 
        permissionSetId: emp.supportPermissions.permissionSetId 
      });
      if (permSet) {
        console.log(`   Permissions: ${permSet.name}`);
      }
    } else {
      console.log(`   Permissions: ❌ Not Set`);
    }

    // Show current assignments
    const assignments = await SupportAssignment.find({
      supportEmployeeId: emp._id
    }).populate('targetCompanyId', 'name').populate('targetUserId', 'name');

    if (assignments.length > 0) {
      console.log(`   Current Assignments (${assignments.length}):`);
      for (const assignment of assignments) {
        if (assignment.assignmentType === 'COMPANY') {
          console.log(`      • Company: ${assignment.targetCompanyId.name}`);
        } else if (assignment.assignmentType === 'USER') {
          console.log(`      • User: ${assignment.targetUserId.name}`);
        } else {
          console.log(`      • Hierarchy: Level ${assignment.targetHierarchyLevel}`);
        }
      }
    } else {
      console.log(`   Current Assignments: None`);
    }
  }

  return supportEmployees;
};

// List companies for assignment
const listCompanies = async () => {
  console.log('\n🏢 Available Companies');
  console.log('═══════════════════════');

  const companies = await Company.find({ isActive: true }).sort({ companyType: 1, name: 1 });

  if (companies.length === 0) {
    console.log('❌ No companies found.');
    return [];
  }

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    console.log(`\n${i + 1}. ${company.name}`);
    console.log(`   Type: ${company.companyType}`);
    console.log(`   Company ID: ${company.companyId}`);
    console.log(`   Email: ${company.email}`);
    
    // Count users
    const userCount = await User.countDocuments({ 
      companyId: company.companyId,
      isActive: true 
    });
    console.log(`   Users: ${userCount}`);

    // Check existing support assignments
    const supportCount = await SupportAssignment.countDocuments({
      targetCompanyId: company._id,
      assignmentType: 'COMPANY'
    });
    console.log(`   Assigned Support: ${supportCount}`);
  }

  return companies;
};

// List users for assignment
const listUsersForAssignment = async (companyId = null) => {
  console.log('\n👥 Available Users');
  console.log('═══════════════════');

  const filter = { isActive: true };
  if (companyId) {
    filter.companyId = companyId;
  }

  const users = await User.find(filter)
    .populate('companyId', 'name companyType')
    .sort({ 'companyId.name': 1, name: 1 });

  if (users.length === 0) {
    console.log('❌ No users found.');
    return [];
  }

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    console.log(`\n${i + 1}. ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Type: ${getUserTypeDisplay(user.userType)}`);
    console.log(`   Company: ${user.companyId.name} (${user.companyId.companyType})`);
    console.log(`   User ID: ${user.userId}`);
    console.log(`   Hierarchy Level: ${user.hierarchyLevel}`);

    // Check existing support assignments
    const supportCount = await SupportAssignment.countDocuments({
      targetUserId: user._id,
      assignmentType: 'USER'
    });
    console.log(`   Assigned Support: ${supportCount}`);
  }

  return users;
};

// Assign support to company
const assignSupportToCompany = async (supportEmployees) => {
  console.log('\n🏢 Assign Support to Company');
  console.log('════════════════════════════');

  if (supportEmployees.length === 0) {
    console.log('❌ No support employees available');
    return;
  }

  // Select support employee
  const empChoice = await prompt('\nEnter support employee number: ');
  const empIndex = parseInt(empChoice) - 1;

  if (empIndex < 0 || empIndex >= supportEmployees.length) {
    console.log('❌ Invalid support employee selection');
    return;
  }

  const supportEmployee = supportEmployees[empIndex];

  // Check if support employee has permissions set
  if (!supportEmployee.supportPermissions || !supportEmployee.supportPermissions.permissionSetId) {
    console.log('❌ Support employee does not have permission set assigned.');
    console.log('💡 Assign permissions through user management first.');
    return;
  }

  // Select company
  const companies = await listCompanies();
  if (companies.length === 0) return;

  const companyChoice = await prompt('\nEnter company number to assign: ');
  const companyIndex = parseInt(companyChoice) - 1;

  if (companyIndex < 0 || companyIndex >= companies.length) {
    console.log('❌ Invalid company selection');
    return;
  }

  const targetCompany = companies[companyIndex];

  // Check for existing assignment
  const existingAssignment = await SupportAssignment.findOne({
    supportEmployeeId: supportEmployee._id,
    targetCompanyId: targetCompany._id,
    assignmentType: 'COMPANY'
  });

  if (existingAssignment) {
    console.log('❌ Support employee is already assigned to this company');
    return;
  }

  // Show summary
  console.log('\n📋 Assignment Summary:');
  console.log('══════════════════════');
  console.log(`Support Employee: ${supportEmployee.name}`);
  console.log(`Employee Type: ${getUserTypeDisplay(supportEmployee.userType)}`);
  console.log(`Target Company: ${targetCompany.name}`);
  console.log(`Company Type: ${targetCompany.companyType}`);
  console.log(`Assignment Type: COMPANY`);

  const confirm = await prompt('\n✅ Create this assignment? (y/N): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('❌ Assignment cancelled');
    return;
  }

  try {
    const assignment = await SupportAssignmentService.assignSupportToCompany(
      supportEmployee.userId,
      targetCompany.companyId
    );

    console.log('\n🎉 Support Assignment Created Successfully!');
    console.log(`Assignment ID: ${assignment.assignmentId}`);
    console.log(`Support Employee: ${supportEmployee.name}`);
    console.log(`Assigned to Company: ${targetCompany.name}`);
    console.log(`Created: ${new Date().toLocaleDateString()}`);

  } catch (error) {
    console.error('❌ Failed to create assignment:', error.message);
  }
};

// Assign support to user
const assignSupportToUser = async (supportEmployees) => {
  console.log('\n👤 Assign Support to User');
  console.log('═══════════════════════════');

  if (supportEmployees.length === 0) {
    console.log('❌ No support employees available');
    return;
  }

  // Select support employee
  const empChoice = await prompt('\nEnter support employee number: ');
  const empIndex = parseInt(empChoice) - 1;

  if (empIndex < 0 || empIndex >= supportEmployees.length) {
    console.log('❌ Invalid support employee selection');
    return;
  }

  const supportEmployee = supportEmployees[empIndex];

  // Check if support employee has permissions set
  if (!supportEmployee.supportPermissions || !supportEmployee.supportPermissions.permissionSetId) {
    console.log('❌ Support employee does not have permission set assigned.');
    console.log('💡 Assign permissions through user management first.');
    return;
  }

  // Option to filter by company
  const filterByCompany = await prompt('\nFilter users by company? (y/N): ');
  let companyId = null;

  if (filterByCompany.toLowerCase() === 'y') {
    const companies = await listCompanies();
    if (companies.length === 0) return;

    const companyChoice = await prompt('\nEnter company number to filter: ');
    const companyIndex = parseInt(companyChoice) - 1;

    if (companyIndex < 0 || companyIndex >= companies.length) {
      console.log('❌ Invalid company selection');
      return;
    }

    companyId = companies[companyIndex].companyId;
  }

  // Select user
  const users = await listUsersForAssignment(companyId);
  if (users.length === 0) return;

  const userChoice = await prompt('\nEnter user number to assign: ');
  const userIndex = parseInt(userChoice) - 1;

  if (userIndex < 0 || userIndex >= users.length) {
    console.log('❌ Invalid user selection');
    return;
  }

  const targetUser = users[userIndex];

  // Check for existing assignment
  const existingAssignment = await SupportAssignment.findOne({
    supportEmployeeId: supportEmployee._id,
    targetUserId: targetUser._id,
    assignmentType: 'USER'
  });

  if (existingAssignment) {
    console.log('❌ Support employee is already assigned to this user');
    return;
  }

  // Show summary
  console.log('\n📋 Assignment Summary:');
  console.log('══════════════════════');
  console.log(`Support Employee: ${supportEmployee.name}`);
  console.log(`Employee Type: ${getUserTypeDisplay(supportEmployee.userType)}`);
  console.log(`Target User: ${targetUser.name}`);
  console.log(`User Type: ${getUserTypeDisplay(targetUser.userType)}`);
  console.log(`User Company: ${targetUser.companyId.name}`);
  console.log(`Assignment Type: USER`);

  const confirm = await prompt('\n✅ Create this assignment? (y/N): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('❌ Assignment cancelled');
    return;
  }

  try {
    const assignment = await SupportAssignmentService.assignSupportToUser(
      supportEmployee.userId,
      targetUser.userId
    );

    console.log('\n🎉 Support Assignment Created Successfully!');
    console.log(`Assignment ID: ${assignment.assignmentId}`);
    console.log(`Support Employee: ${supportEmployee.name}`);
    console.log(`Assigned to User: ${targetUser.name}`);
    console.log(`Created: ${new Date().toLocaleDateString()}`);

  } catch (error) {
    console.error('❌ Failed to create assignment:', error.message);
  }
};

// Assign support to hierarchy
const assignSupportToHierarchy = async (supportEmployees) => {
  console.log('\n🏗️ Assign Support to Hierarchy Level');
  console.log('═══════════════════════════════════════');

  if (supportEmployees.length === 0) {
    console.log('❌ No support employees available');
    return;
  }

  // Select support employee
  const empChoice = await prompt('\nEnter support employee number: ');
  const empIndex = parseInt(empChoice) - 1;

  if (empIndex < 0 || empIndex >= supportEmployees.length) {
    console.log('❌ Invalid support employee selection');
    return;
  }

  const supportEmployee = supportEmployees[empIndex];

  // Check if support employee has permissions set
  if (!supportEmployee.supportPermissions || !supportEmployee.supportPermissions.permissionSetId) {
    console.log('❌ Support employee does not have permission set assigned.');
    console.log('💡 Assign permissions through user management first.');
    return;
  }

  // Select hierarchy level
  console.log('\nHierarchy levels typically range from 0 (top level) to 5+ (lower levels)');
  const hierarchyLevel = await prompt('Enter hierarchy level to assign (0-10): ');
  const level = parseInt(hierarchyLevel);

  if (isNaN(level) || level < 0 || level > 10) {
    console.log('❌ Invalid hierarchy level');
    return;
  }

  // Optional: Select specific company for hierarchy assignment
  const includeCompany = await prompt('\nLimit to specific company? (y/N): ');
  let targetCompany = null;

  if (includeCompany.toLowerCase() === 'y') {
    const companies = await listCompanies();
    if (companies.length === 0) return;

    const companyChoice = await prompt('\nEnter company number: ');
    const companyIndex = parseInt(companyChoice) - 1;

    if (companyIndex < 0 || companyIndex >= companies.length) {
      console.log('❌ Invalid company selection');
      return;
    }

    targetCompany = companies[companyIndex];
  }

  // Check for existing assignment
  const filter = {
    supportEmployeeId: supportEmployee._id,
    assignmentType: 'HIERARCHY',
    targetHierarchyLevel: level
  };

  if (targetCompany) {
    filter.targetCompanyId = targetCompany._id;
  }

  const existingAssignment = await SupportAssignment.findOne(filter);

  if (existingAssignment) {
    console.log('❌ Support employee is already assigned to this hierarchy level' + 
      (targetCompany ? ' for this company' : ''));
    return;
  }

  // Show summary
  console.log('\n📋 Assignment Summary:');
  console.log('══════════════════════');
  console.log(`Support Employee: ${supportEmployee.name}`);
  console.log(`Employee Type: ${getUserTypeDisplay(supportEmployee.userType)}`);
  console.log(`Target Hierarchy Level: ${level}`);
  console.log(`Company Scope: ${targetCompany ? targetCompany.name : 'All Companies'}`);
  console.log(`Assignment Type: HIERARCHY`);

  // Show affected users
  const affectedFilter = { hierarchyLevel: level, isActive: true };
  if (targetCompany) {
    affectedFilter.companyId = targetCompany.companyId;
  }

  const affectedUsers = await User.countDocuments(affectedFilter);
  console.log(`Affected Users: ${affectedUsers}`);

  const confirm = await prompt('\n✅ Create this assignment? (y/N): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('❌ Assignment cancelled');
    return;
  }

  try {
    const assignment = await SupportAssignmentService.assignSupportToHierarchy(
      supportEmployee.userId,
      level,
      targetCompany ? targetCompany.companyId : null
    );

    console.log('\n🎉 Support Assignment Created Successfully!');
    console.log(`Assignment ID: ${assignment.assignmentId}`);
    console.log(`Support Employee: ${supportEmployee.name}`);
    console.log(`Assigned to Hierarchy Level: ${level}`);
    console.log(`Company Scope: ${targetCompany ? targetCompany.name : 'All Companies'}`);
    console.log(`Affected Users: ${affectedUsers}`);
    console.log(`Created: ${new Date().toLocaleDateString()}`);

  } catch (error) {
    console.error('❌ Failed to create assignment:', error.message);
  }
};

// View existing assignments
const viewAssignments = async () => {
  console.log('\n📋 Current Support Assignments');
  console.log('═══════════════════════════════════');

  const assignments = await SupportAssignment.find({})
    .populate('supportEmployeeId', 'name email userType')
    .populate('targetCompanyId', 'name companyType')
    .populate('targetUserId', 'name email userType')
    .sort({ assignmentType: 1, createdAt: -1 });

  if (assignments.length === 0) {
    console.log('❌ No assignments found.');
    return [];
  }

  for (let i = 0; i < assignments.length; i++) {
    const assignment = assignments[i];
    console.log(`\n${i + 1}. ${assignment.supportEmployeeId.name}`);
    console.log(`   Support Type: ${getUserTypeDisplay(assignment.supportEmployeeId.userType)}`);
    console.log(`   Email: ${assignment.supportEmployeeId.email}`);
    console.log(`   Assignment ID: ${assignment.assignmentId}`);
    console.log(`   Assignment Type: ${assignment.assignmentType}`);

    if (assignment.assignmentType === 'COMPANY') {
      console.log(`   Assigned to Company: ${assignment.targetCompanyId.name}`);
      console.log(`   Company Type: ${assignment.targetCompanyId.companyType}`);
    } else if (assignment.assignmentType === 'USER') {
      console.log(`   Assigned to User: ${assignment.targetUserId.name}`);
      console.log(`   User Type: ${getUserTypeDisplay(assignment.targetUserId.userType)}`);
      console.log(`   User Email: ${assignment.targetUserId.email}`);
    } else if (assignment.assignmentType === 'HIERARCHY') {
      console.log(`   Assigned to Hierarchy Level: ${assignment.targetHierarchyLevel}`);
      if (assignment.targetCompanyId) {
        console.log(`   Company Scope: ${assignment.targetCompanyId.name}`);
      } else {
        console.log(`   Company Scope: All Companies`);
      }
    }

    console.log(`   Created: ${assignment.createdAt.toLocaleDateString()}`);
  }

  return assignments;
};

// Remove assignment
const removeAssignment = async (assignments) => {
  console.log('\n🗑️ Remove Support Assignment');
  console.log('════════════════════════════');

  if (assignments.length === 0) {
    console.log('❌ No assignments available to remove');
    return;
  }

  const choice = await prompt('\nEnter assignment number to remove (or 0 to cancel): ');
  const index = parseInt(choice) - 1;

  if (index < 0 || index >= assignments.length) {
    console.log('❌ Invalid selection');
    return;
  }

  const assignment = assignments[index];

  console.log(`\n⚠️  Removing Assignment:`);
  console.log(`Support Employee: ${assignment.supportEmployeeId.name}`);
  console.log(`Assignment Type: ${assignment.assignmentType}`);

  if (assignment.assignmentType === 'COMPANY') {
    console.log(`Company: ${assignment.targetCompanyId.name}`);
  } else if (assignment.assignmentType === 'USER') {
    console.log(`User: ${assignment.targetUserId.name}`);
  } else if (assignment.assignmentType === 'HIERARCHY') {
    console.log(`Hierarchy Level: ${assignment.targetHierarchyLevel}`);
  }

  const confirm = await prompt('\n❗ Remove this assignment? (y/N): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('❌ Removal cancelled');
    return;
  }

  try {
    await SupportAssignment.findByIdAndDelete(assignment._id);
    console.log('\n🎉 Assignment Removed Successfully!');

  } catch (error) {
    console.error('❌ Failed to remove assignment:', error.message);
  }
};

// Main menu
const showMenu = async () => {
  while (true) {
    console.log('\n🔧 Support Assignment Management');
    console.log('═══════════════════════════════════');
    console.log('1. List support employees');
    console.log('2. Assign support to company');
    console.log('3. Assign support to user');
    console.log('4. Assign support to hierarchy level');
    console.log('5. View current assignments');
    console.log('6. Remove assignment');
    console.log('0. Exit');

    const choice = await prompt('\nSelect option (0-6): ');

    switch (choice) {
      case '1':
        await listSupportEmployees();
        break;
      case '2':
        const supportEmpsForCompany = await listSupportEmployees();
        await assignSupportToCompany(supportEmpsForCompany);
        break;
      case '3':
        const supportEmpsForUser = await listSupportEmployees();
        await assignSupportToUser(supportEmpsForUser);
        break;
      case '4':
        const supportEmpsForHierarchy = await listSupportEmployees();
        await assignSupportToHierarchy(supportEmpsForHierarchy);
        break;
      case '5':
        await viewAssignments();
        break;
      case '6':
        const assignmentsForRemoval = await viewAssignments();
        await removeAssignment(assignmentsForRemoval);
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
    
    console.log('🚀 Support Assignment Management System');
    console.log('═══════════════════════════════════════');
    console.log('Assign support employees to companies, users, or hierarchy levels.');
    console.log('Note: Support employees cannot transfer keys regardless of assignments.');
    
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