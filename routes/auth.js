const bcrypt = require("bcrypt");
const { User, Company, AuditLog } = require("../schemas");
const {
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  authenticate,
} = require("../middleware/auth");
const { validate, userValidation } = require("../utils/validation");
const { catchAsync } = require("../middleware/errorHandler");

async function authRoutes(fastify, options) {
  // Register new user
  fastify.post(
    "/register",
    {
      preHandler: [authenticate, validate(userValidation.register)],
      schema: {
        description: "Register a new user",
        tags: ["Authentication"],
        security: [{ Bearer: [] }],
        body: {
          type: "object",
          required: ["name", "email", "phone", "password", "userType"],
          properties: {
            name: { type: "string", minLength: 2, maxLength: 50 },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
            password: { type: "string", minLength: 8 },
            userType: {
              type: "string",
              enum: [
                "TSM",
                "ASM",
                "SALES_EXECUTIVE",
                "SUPER_DISTRIBUTOR",
                "DISTRIBUTOR",
                "NATIONAL_DISTRIBUTOR",
                "MINI_DISTRIBUTOR",
                "RETAILER",
              ],
            },
            alternatePhone: { type: "string" },
            address: {
              type: "object",
              properties: {
                street: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
                country: { type: "string" },
                zipCode: { type: "string" },
              },
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  user: { type: "object" },
                  token: { type: "string" },
                  refreshToken: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    catchAsync(async (request, reply) => {
      const {
        name,
        email,
        phone,
        password,
        userType,
        alternatePhone,
        address,
      } = request.body;

      const company = await Company.findOne({
        companyId: request.user.companyId,
        isActive: true,
      });
      if (!company) {
        return reply.code(400).send({
          success: false,
          error: "Invalid company ID",
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { phone }],
      });

      if (existingUser) {
        return reply.code(400).send({
          success: false,
          error: "User already exists with this email or phone",
        });
      }

      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const parentUserId = request.user.userId;
      // Create user
      const user = new User({
        userId: `USER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        companyId: request.user.companyId,
        parentUserId: request.user.userId,
        userType,
        name,
        email: email.toLowerCase(),
        phone,
        alternatePhone,
        password: hashedPassword,
        isActive: true,
        address,
        hierarchyLevel: request.user.userId ? 1 : 0,
      });

      await user.save();

      // Create hierarchy if parent user exists
      if (parentUserId) {
        const HierarchyService = require("../services").HierarchyService;
        await HierarchyService.createUserHierarchy(
          user.userId,
          parentUserId,
          request.user.companyId
        );
      }
      // Generate tokens
      const tokenPayload = {
        userId: user.userId,
        companyId: user.companyId,
        userType: user.userType,
      };

      const token = generateToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Create audit log
      const auditLog = new AuditLog({
        logId: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        companyId: request.user.companyId,
        userId: user.userId,
        action: "CREATE",
        entityType: "USER",
        entityId: user.userId,
        newData: {
          name: user.name,
          email: user.email,
          userType: user.userType,
        },
      });
      await auditLog.save();

      // Remove password from response
      const userResponse = user.toObject();
      delete userResponse.password;

      return reply.code(201).send({
        success: true,
        message: "User registered successfully",
        data: {
          user: userResponse,
          token,
          refreshToken,
        },
      });
    })
  );

  // Login user
  fastify.post(
    "/login",
    {
      preHandler: [validate(userValidation.login)],
      schema: {
        description: "Login user",
        tags: ["Authentication"],
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  user: {
                    type: "object",
                    properties: {
                      userId: { type: "string" },
                      name: { type: "string" },
                      email: { type: "string" },
                      phone: { type: "string" },
                      userType: { type: "string" },
                      companyId: { type: "string" },
                      lastLoginAt: { type: "string", format: "date-time" },
                    },
                    additionalProperties: false, // Optional: blocks extra fields not listed
                  },
                  token: { type: "string" },
                  refreshToken: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    catchAsync(async (request, reply) => {
      const { email, password } = request.body;

      // Find user
      const user = await User.findOne({
        email: email.toLowerCase(),
        isActive: true,
      });

      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Invalid email or password",
        });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return reply.code(401).send({
          success: false,
          error: "Invalid email or password",
        });
      }

      // Check if company is active
      const company = await Company.findOne({
        companyId: user.companyId,
        isActive: true,
      });

      if (!company) {
        return reply.code(401).send({
          success: false,
          error: "Company is inactive",
        });
      }

      // Generate tokens
      const tokenPayload = {
        userId: user.userId,
        companyId: user.companyId,
        userType: user.userType,
      };

      const token = generateToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Update last login
      await User.updateOne(
        { userId: user.userId },
        { lastLoginAt: new Date() }
      );

      // Create audit log
      const auditLog = new AuditLog({
        logId: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        companyId: user.companyId,
        userId: user.userId,
        action: "LOGIN",
        entityType: "USER",
        entityId: user.userId,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });
      await auditLog.save();

      // Remove password from response
      const userResponse = user.toObject();
      console.log("userResponse: ", userResponse);

      delete userResponse.password;
      console.log("userResponse2: ", userResponse);

      return reply.send({
        success: true,
        message: "Login successful",
        data: {
          user: userResponse,
          token,
          refreshToken,
        },
      });
    })
  );

  // Refresh token
  fastify.post(
    "/refresh-token",
    {
      schema: {
        description: "Refresh access token",
        tags: ["Authentication"],
        body: {
          type: "object",
          required: ["refreshToken"],
          properties: {
            refreshToken: { type: "string" },
          },
        },
      },
    },
    catchAsync(async (request, reply) => {
      const { refreshToken } = request.body;

      if (!refreshToken) {
        return reply.code(400).send({
          success: false,
          error: "Refresh token is required",
        });
      }

      try {
        const decoded = verifyRefreshToken(refreshToken);

        // Find user
        const user = await User.findOne({
          userId: decoded.userId,
          isActive: true,
        });

        if (!user) {
          return reply.code(401).send({
            success: false,
            error: "Invalid refresh token",
          });
        }

        // Generate new tokens
        const tokenPayload = {
          userId: user.userId,
          companyId: user.companyId,
          userType: user.userType,
        };

        const newToken = generateToken(tokenPayload);
        const newRefreshToken = generateRefreshToken(tokenPayload);

        return reply.send({
          success: true,
          message: "Tokens refreshed successfully",
          data: {
            token: newToken,
            refreshToken: newRefreshToken,
          },
        });
      } catch (error) {
        return reply.code(401).send({
          success: false,
          error: "Invalid refresh token",
        });
      }
    })
  );

  // Change password
  fastify.put(
    "/change-password",
    {
      preHandler: [authenticate, validate(userValidation.changePassword)],
      schema: {
        description: "Change user password",
        tags: ["Authentication"],
        security: [{ Bearer: [] }],
        body: {
          type: "object",
          required: ["currentPassword", "newPassword", "confirmPassword"],
          properties: {
            currentPassword: { type: "string" },
            newPassword: { type: "string", minLength: 8 },
            confirmPassword: { type: "string" },
          },
        },
      },
    },
    catchAsync(async (request, reply) => {
      const { currentPassword, newPassword } = request.body;
      const userId = request.user.userId;

      // Get user with password
      const user = await User.findOne({ userId });
      if (!user) {
        return reply.code(404).send({
          success: false,
          error: "User not found",
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isCurrentPasswordValid) {
        return reply.code(400).send({
          success: false,
          error: "Current password is incorrect",
        });
      }

      // Hash new password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await User.updateOne(
        { userId },
        {
          password: hashedNewPassword,
          updatedAt: new Date(),
        }
      );

      // Create audit log
      const auditLog = new AuditLog({
        logId: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        companyId: user.companyId,
        userId: user.userId,
        action: "UPDATE",
        entityType: "USER",
        entityId: user.userId,
        newData: { passwordChanged: true },
      });
      await auditLog.save();

      return reply.send({
        success: true,
        message: "Password changed successfully",
      });
    })
  );

  // Get current user profile
  fastify.get(
    "/me",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get current user profile",
        tags: ["Authentication"],
        security: [{ Bearer: [] }],
      },
    },
    catchAsync(async (request, reply) => {
      const userResponse = request.user;
      delete userResponse.password;

      return reply.send({
        success: true,
        data: {
          user: userResponse,
        },
      });
    })
  );

  // Update user profile
  fastify.put(
    "/me",
    {
      preHandler: [authenticate, validate(userValidation.update)],
      schema: {
        description: "Update current user profile",
        tags: ["Authentication"],
        security: [{ Bearer: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 2, maxLength: 50 },
            phone: { type: "string" },
            alternatePhone: { type: "string" },
            address: {
              type: "object",
              properties: {
                street: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
                country: { type: "string" },
                zipCode: { type: "string" },
              },
            },
          },
        },
      },
    },
    catchAsync(async (request, reply) => {
      const userId = request.user.userId;
      const updateData = request.body;

      // Get old data for audit
      const oldUser = await User.findOne({ userId });

      // Update user
      const updatedUser = await User.findOneAndUpdate(
        { userId },
        {
          ...updateData,
          updatedAt: new Date(),
        },
        { new: true }
      ).select("-password");

      if (!updatedUser) {
        return reply.code(404).send({
          success: false,
          error: "User not found",
        });
      }

      // Create audit log
      const auditLog = new AuditLog({
        logId: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        companyId: updatedUser.companyId,
        userId: updatedUser.userId,
        action: "UPDATE",
        entityType: "USER",
        entityId: updatedUser.userId,
        oldData: {
          name: oldUser.name,
          phone: oldUser.phone,
          alternatePhone: oldUser.alternatePhone,
          address: oldUser.address,
        },
        newData: updateData,
      });
      await auditLog.save();

      return reply.send({
        success: true,
        message: "Profile updated successfully",
        data: {
          user: updatedUser,
        },
      });
    })
  );

  // Logout (client-side token invalidation)
  fastify.post(
    "/logout",
    {
      preHandler: [authenticate],
      schema: {
        description: "Logout user",
        tags: ["Authentication"],
        security: [{ Bearer: [] }],
      },
    },
    catchAsync(async (request, reply) => {
      // Create audit log
      const auditLog = new AuditLog({
        logId: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        companyId: request.user.companyId,
        userId: request.user.userId,
        action: "LOGOUT",
        entityType: "USER",
        entityId: request.user.userId,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });
      await auditLog.save();

      return reply.send({
        success: true,
        message: "Logged out successfully",
      });
    })
  );
}

module.exports = authRoutes;
