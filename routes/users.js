const { User, UserHierarchy } = require('../schemas');
const { authenticate } = require('../middleware/auth');
const { HierarchyService, ValidationService } = require('../services');
const { catchAsync } = require('../middleware/errorHandler');
const bcrypt = require('bcrypt');

async function userRoutes(fastify, options) {

  // ✅ Get all users the current user can manage (based on upward hierarchy)
  fastify.post('/get-all', {
    preHandler: [authenticate],
    schema: {
      description: 'Get users based on hierarchy',
      tags: ['Users'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['userType'],
        properties: {
          userType: { 
            type: 'string',
            enum: [
                "ALL",
                "TSM",
                "ASM",
                "SALES_EXECUTIVE",
                "SUPER_DISTRIBUTOR",
                "DISTRIBUTOR",
                "NATIONAL_DISTRIBUTOR",
                "MINI_DISTRIBUTOR",
                "RETAILER",
                "WHITELABEL_OWNER"
              ],
          }
        }
      }
    }
  }, catchAsync(async (request, reply) => {
    const { userType } = request.body;
    const manageableUsers = await HierarchyService.getManageableUsers(request.user.userId, userType);

    const usersResponse = manageableUsers.map(user => {
      const userObj = user.toObject();
      delete userObj.password;
      return userObj;
    });

    console.log('usersResponse     ',usersResponse);
    

    return reply.send({
      success: true,
      data: { users: usersResponse }
    });
  }));

  // ✅ Get user details with permission check
  fastify.post('/get', {
    preHandler: [authenticate],
    schema: {
      description: 'Get user details',
      tags: ['Users'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      }
    }
  }, catchAsync(async (request, reply) => {
    const hasPermission = await HierarchyService.checkUserPermission(
      request.user.userId,
      request.body.userId
    );

    if (!hasPermission) {
      return reply.code(403).send({
        success: false,
        error: 'No permission to view this user'
      });
    }

    const user = await User.findOne({ userId: request.body.userId }).select('-password');
    if (!user) {
      return reply.code(404).send({
        success: false,
        error: 'User not found'
      });
    }

    return reply.send({
      success: true,
      data: { user }
    });
  }));

  // ✅ Get hierarchy info of a user (only shows upward path)
  fastify.post('/hierarchy', {
    preHandler: [authenticate],
    schema: {
      description: 'Get user hierarchy path',
      tags: ['Users'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      }
    }
  }, catchAsync(async (request, reply) => {
    const hasPermission = await HierarchyService.checkUserPermission(
      request.user.userId,
      request.body.userId
    );

    if (!hasPermission) {
      return reply.code(403).send({
        success: false,
        error: 'No permission to view this user hierarchy'
      });
    }

    const hierarchy = await UserHierarchy.findOne({ userId: request.body.userId });
    if (!hierarchy) {
      return reply.code(404).send({
        success: false,
        error: 'Hierarchy not found'
      });
    }

    return reply.send({
      success: true,
      data: { hierarchy }
    });
  }));

  // ✅ Update user info with permission check
  fastify.post('/update', {
    preHandler: [authenticate],
    schema: {
      description: 'Update user details',
      tags: ['Users'],
      security: [{ Bearer: [] }]
    }
  }, catchAsync(async (request, reply) => {
    const { userId, ...updateData } = request.body;
    const hasPermission = await HierarchyService.checkUserPermission(
      request.user.userId,
      userId
    );

    if (!hasPermission) {
      return reply.code(403).send({
        success: false,
        error: 'No permission to update this user'
      });
    }

    
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 12);
    }

    const user = await User.findOneAndUpdate(
      { userId },
      updateData,
      { new: true }
    ).select('-password');

    if (!user) {
      return reply.code(404).send({
        success: false,
        error: 'User not found'
      });
    }

    return reply.send({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });
  }));
}

module.exports = userRoutes;
