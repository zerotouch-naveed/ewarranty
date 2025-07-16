// Assign support employee to company/user/hierarchy
const createAssignment = async (assignmentData, assignedBy) => {
    try {
      const assigner = await User.findOne({ userId: assignedBy });
      const supportEmployee = await User.findOne({ userId: assignmentData.supportEmployeeId });

      if (!assigner || !supportEmployee) {
        throw new Error('Assigner or support employee not found');
      }

      // Verify support employee
      if (!supportEmployee.userType.includes('SUPPORT_EMPLOYEE')) {
        throw new Error('Can only assign support employees');
      }

      // Check assignment permission
      const canAssign = await canCreateAssignment(assignedBy, assignmentData);
      if (!canAssign) {
        throw new Error('No permission to create this assignment');
      }

      const assignment = new SupportAssignment({
        assignmentId: `ASSIGN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...assignmentData,
        assignedBy
      });

      await assignment.save();

      // Update user's assigned companies if it's a company assignment
      if (assignmentData.assignmentType === 'COMPANY' && assignmentData.targetCompanyId) {
        const targetCompany = await Company.findOne({ companyId: assignmentData.targetCompanyId });
        if (targetCompany) {
          supportEmployee.assignedCompanies.push({
            companyId: assignmentData.targetCompanyId,
            companyName: targetCompany.name,
            assignedAt: new Date(),
            assignedBy
          });
          await supportEmployee.save();
        }
      }

      // Create audit log
      await CompanyService.createAuditLog(
        assignedBy,
        'SUPPORT_ASSIGNMENT',
        'ASSIGNMENT',
        assignment.assignmentId,
        null,
        assignment.toObject(),
        assigner.companyId
      );

      return assignment;
    } catch (error) {
      throw new Error(`Error creating assignment: ${error.message}`);
    }
}


// Check if user can create assignment
const canCreateAssignment = async (assignerId, assignmentData) => {
    try {
      const assigner = await User.findOne({ userId: assignerId });
      if (!assigner) return false;

      // Only owners and employees can create assignments
      if (!assigner.userType.includes('OWNER') && !assigner.userType.includes('EMPLOYEE')) {
        return false;
      }

      // Main company users can assign to any white-label
      if (assigner.userType.startsWith('MAIN_')) {
        return true;
      }

      // White-label users can only assign within their company
      if (assigner.userType.startsWith('WHITELABEL_')) {
        if (assignmentData.targetCompanyId === assigner.companyId) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
}


const getUserAssignments = async (supportEmployeeId) => {
    try {
      return await SupportAssignment.find({
        supportEmployeeId,
        isActive: true,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      }).sort({ assignedAt: -1 });
    } catch (error) {
      throw new Error(`Error getting user assignments: ${error.message}`);
    }
}


module.exports = {
    createAssignment,
    canCreateAssignment,
    getUserAssignments
};