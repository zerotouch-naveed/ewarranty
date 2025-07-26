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
    description: 'Get users with filters, search, pagination, and sorting',
    tags: ['Users'],
    security: [{ Bearer: [] }],
    body: {
      type: 'object',
      required: ['userType'],
      properties: {
        userType: {
          type: 'string',
          enum: [
            "ALL", "TSM", "ASM", "SALES_EXECUTIVE",
            "SUPER_DISTRIBUTOR", "DISTRIBUTOR", "NATIONAL_DISTRIBUTOR",
            "MINI_DISTRIBUTOR", "RETAILER", "WHITELABEL_OWNER"
          ],
        },
        search: { type: 'string' },
        page: { type: 'integer', minimum: 1, default: 1 },
        limit: { type: 'integer', minimum: 1, default: 10 },
        status: { type: 'string', enum: ['true', 'false'], default: 'true' },
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
        sortBy: {
          type: 'string',
          enum: ['name', 'createdAt', 'remainingAmount'],
          default: 'createdAt'
        },
        sortOrder: {
          type: 'string',
          enum: ['asc', 'desc'],
          default: 'desc'
        },
        companyId: { 
          type: 'string',
          default: 'ALL',
          description: "Company ID filter (only for MAIN_OWNER). Use 'ALL' or empty string for all companies"
        }
      }
    }
  }
}, catchAsync(async (request, reply) => {
  const { userType, search = '', page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', status, startDate, endDate, companyId } = request.body;

  const filters = {};
  if (userType !== 'ALL') filters.userType = userType;
  if (status) filters.isActive = status;
  if (request.user.userType === 'MAIN_OWNER' && companyId !== 'ALL' && companyId !== '') filters.companyId = companyId;
  if (startDate && endDate) {
    filters['createdAt'] = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const {
    users,
    totalData,
    currentPage,
    totalPages,
    companyList
  } = await HierarchyService.getManageableUsersWithFilters(
    request.user.userId,
    filters,
    page,
    limit,
    search,
    sortBy,
    sortOrder,
    request.user.userType === 'MAIN_OWNER' ? true : false
  );

  return reply.send({
    success: true,
    data: {
      users,
      companyList,
      pagination: {
        currentPage,
        totalPages,
        totalData,
        limit
      }
    }
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
