const { User, UserHierarchy } = require("../schemas");
const { authenticate } = require("../middleware/auth");
const { HierarchyService, ValidationService } = require("../services");
const { catchAsync } = require("../middleware/errorHandler");
const bcrypt = require("bcrypt");

async function userRoutes(fastify, options) {
  // ✅ Get all users the current user can manage (based on upward hierarchy)
  fastify.post(
    "/get-all",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get users with filters, search, pagination, and sorting",
        tags: ["Users"],
        security: [{ Bearer: [] }],
        body: {
          type: "object",
          required: ["userType"],
          properties: {
            userType: {
              type: "string",
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
                "WHITELABEL_OWNER",
              ],
            },
            search: { type: "string" },
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, default: 10 },
            status: {
              type: "string",
              enum: ["true", "false"],
              default: "true",
            },
            startDate: { type: "string", format: "date" },
            endDate: { type: "string", format: "date" },
            sortBy: {
              type: "string",
              enum: ["name", "createdAt", "remainingAmount"],
              default: "createdAt",
            },
            sortOrder: {
              type: "string",
              enum: ["asc", "desc"],
              default: "desc",
            },
            companyId: {
              type: "string",
              default: "ALL",
              description:
                "Company ID filter (only for MAIN_OWNER). Use 'ALL' or empty string for all companies",
            },
            isCsv: { type: "boolean", default: false },
            userId: {
              type: "string",
              default: "ALL",
              description:
                "User ID filter (only for MAIN_OWNER). Use 'ALL' or empty string for all companies",
            },
          },
        },
      },
    },
    catchAsync(async (request, reply) => {
      const {
        userType,
        search = "",
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
        status,
        startDate,
        endDate,
        companyId,
        isCsv = false,
        userId = request.user.userId,
      } = request.body;
      let targetUserId = request.user.userId;

      const filters = {};
      if (userType !== "ALL") filters.userType = userType;
      if (status) filters.isActive = status;
      if (
        request.user.userType === "MAIN_OWNER" &&
        companyId !== "ALL" &&
        companyId !== ""
      )
        filters.companyId = companyId;
      if (startDate && endDate) {
        filters["createdAt"] = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      if (userId &&
        userId !== "ALL" &&
        userId !== "" &&
        userId !== undefined &&
        userId !== request.user.userId
      ){
        targetUserId = userId;
        const isAllowed = await HierarchyService.isAncestor(
          request.user.userId,
          targetUserId
        );
        if (!isAllowed) {
          return reply.code(403).send({
            success: false,
            message: 'Access denied'
          });
        }
      }
      
      const csvLimit = isCsv ? 10000 : limit; // Adjust as needed
      const csvPage = isCsv ? 1 : page;

      const { users, totalData, currentPage, totalPages, companyList } =
        await HierarchyService.getManageableUsersWithFilters(
          targetUserId,
          filters,
          csvPage,
          csvLimit,
          search,
          sortBy,
          sortOrder,
          request.user.userType === "MAIN_OWNER"
        );

        if (isCsv) {
          if (!users || users.length === 0) {
            return reply.code(404).send({
              success: false,
              message: 'No users found for CSV export'
            });
          }

          const csvOutput = jsonToCsv(users);
          
          // Generate filename with timestamp and filters
          const timestamp = new Date().toISOString().split('T')[0];
          const userTypeFilter = userType !== 'ALL' ? `_${userType}` : '';
          const filename = `users_${request.user.userType}${userTypeFilter}_${timestamp}.csv`;
          
          reply.header('Content-Type', 'text/csv; charset=utf-8');
          reply.header('Content-Disposition', `attachment; filename="${filename}"`);
          reply.header('Cache-Control', 'no-cache');
          reply.header('Content-Length', Buffer.byteLength(csvOutput, 'utf8'));
          
          // Use reply.send() instead of return
          return reply.send(csvOutput);
      }

      return reply.send({
        success: true,
        data: {
          users,
          companyList,
          pagination: {
            currentPage,
            totalPages,
            totalData,
            limit,
          },
        },
      });
    })
  );


  function jsonToCsv(jsonArray) {
  if (!jsonArray || jsonArray.length === 0) {
    return 'No data available';
  }
  
  try {
    // Flatten nested objects for CSV export
    const flattenedData = jsonArray.map(user => ({
      userId: user.userId || '',
      companyId: user.companyId || '',
      name: user.name || '',
      userType: user.userType || '',
      email: user.email || '',
      phone: user.phone || '',
      isActive: user.isActive ? 'Active' : 'Inactive',
      remainingAmount: user.walletBalance?.remainingAmount || 0,
      city: user.address?.city || '',
      state: user.address?.state || '',
      parentUserName: user.parentUser?.name || '',
      createdAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : ''
    }));

    // Get headers from first object
    const headers = Object.keys(flattenedData[0]);
    
    // Create CSV content
    const csvContent = [
      headers.join(','), // Header row
      ...flattenedData.map(row => 
        headers.map(header => {
          let value = row[header];
          
          // Handle null/undefined values
          if (value === null || value === undefined) {
            value = '';
          }
          
          // Convert to string and handle special characters
          value = String(value);
          
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
            value = `"${value.replace(/"/g, '""')}"`;
          }
          
          return value;
        }).join(',')
      )
    ].join('\n');
    return csvContent;
  } catch (error) {
    console.error('Error converting to CSV:', error);
    return 'Error generating CSV data';
  }
}

  // ✅ Get user details with permission check
  fastify.post(
    "/get",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get user details",
        tags: ["Users"],
        security: [{ Bearer: [] }],
        body: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "string" },
          },
        },
      },
    },
    catchAsync(async (request, reply) => {
      const hasPermission = await HierarchyService.checkUserPermission(
        request.user.userId,
        request.body.userId
      );

      if (!hasPermission) {
        return reply.code(403).send({
          success: false,
          error: "No permission to view this user",
        });
      }

      const user = await User.findOne({ userId: request.body.userId }).select(
        "-password"
      ).lean();
      if (!user) {
        return reply.code(404).send({
          success: false,
          error: "User not found",
        });
      }
      const parentUser = await User.findOne({ userId: user.parentUserId })
      .select('userId name phone email userType -_id')
      .lean();
      // Attach parent name to each user
      const userWithParent = {
        ...user,
        parentUser: user.parentUserId ? {
          userId: user.parentUserId,
          name: parentUser.name,
          phone: parentUser.phone,
          email: parentUser.email,
          userType: parentUser.userType || null
        } : null
      };

      return reply.send({
        success: true,
        data: { user: userWithParent },
      });
    })
  );

  fastify.post(
    "/take-action",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get user details",
        tags: ["Users"],
        security: [{ Bearer: [] }],
        body: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "string" },
          },
        },
      },
    },
    catchAsync(async (request, reply) => {
      console.log("REQ: ", request.body);

      const hasPermission = await HierarchyService.checkUserPermission(
        request.user.userId,
        request.body.userId
      );

      if (!hasPermission) {
        return reply.code(403).send({
          success: false,
          error: "No permission to take action",
        });
      }

      const user = await User.findOne({ userId: request.body.userId }).select(
        "-password"
      );
      if (!user) {
        return reply.code(404).send({
          success: false,
          error: "User not found",
        });
      }
      user.isActive = request.body.isActive;
      await user.save();

      return reply.send({
        success: true,
      });
    })
  );

  // ✅ Get hierarchy info of a user (only shows upward path)
  fastify.post(
    "/hierarchy",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get user hierarchy path",
        tags: ["Users"],
        security: [{ Bearer: [] }],
        body: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "string" },
          },
        },
      },
    },
    catchAsync(async (request, reply) => {
      const hasPermission = await HierarchyService.checkUserPermission(
        request.user.userId,
        request.body.userId
      );

      if (!hasPermission) {
        return reply.code(403).send({
          success: false,
          error: "No permission to view this user hierarchy",
        });
      }

      const hierarchy = await UserHierarchy.findOne({
        userId: request.body.userId,
      });
      if (!hierarchy) {
        return reply.code(404).send({
          success: false,
          error: "Hierarchy not found",
        });
      }

      return reply.send({
        success: true,
        data: { hierarchy },
      });
    })
  );

  // ✅ Update user info with permission check
  fastify.post(
    "/update",
    {
      preHandler: [authenticate],
      schema: {
        description: "Update user details",
        tags: ["Users"],
        security: [{ Bearer: [] }],
      },
    },
    catchAsync(async (request, reply) => {
      const { userId, ...updateData } = request.body;
      const hasPermission = await HierarchyService.checkUserPermission(
        request.user.userId,
        userId
      );

      if (!hasPermission) {
        return reply.code(403).send({
          success: false,
          error: "No permission to update this user",
        });
      }

      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 12);
      }

      const user = await User.findOneAndUpdate({ userId }, updateData, {
        new: true,
      }).select("-password");

      if (!user) {
        return reply.code(404).send({
          success: false,
          error: "User not found",
        });
      }

      return reply.send({
        success: true,
        message: "User updated successfully",
        data: { user },
      });
    })
  );
}

module.exports = userRoutes;
