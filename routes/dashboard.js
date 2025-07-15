const { User, Customer, Claim } = require("../schemas");
const { authenticate } = require("../middleware/auth");
const { catchAsync } = require("../middleware/errorHandler");
const { HierarchyService, CustomerService } = require("../services");
async function dashboardRoutes(fastify, options) {
  // Get Dashboard Stats
  fastify.get(
    "/stats",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get dashboard statistics",
        tags: ["Dashboard"],
        security: [{ Bearer: [] }],
      },
    },
    catchAsync(async (request, reply) => {
      const { companyId, userId, userType } = request.user;

      // Get manageable users (return empty array if none)
      const users = (await HierarchyService.getManageableUsers(userId)) || [];

      // Sort users by createdAt descending
      const sortedUsers = users.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      // Get the last 5 added users
      const lastAddedUsers = sortedUsers.slice(0, 5);

      // Count users by userType
      const userTypeCountMap = {};
      for (const user of users) {
        const type = user.userType || "UNKNOWN";
        userTypeCountMap[type] = (userTypeCountMap[type] || 0) + 1;
      }

      const userTypeCount = Object.entries(userTypeCountMap).map(
        ([type, count]) => ({
          type,
          count,
        })
      );

      // Get accessible customers
      const customers =
        (await CustomerService.getAccessibleCustomers(
          userId,
          companyId,
          userType,
          {}
        )) || [];

      // Respond with stats
      return reply.send({
        success: true,
        userTypeCount,
        lastAddedUsers,
        totalCustomersCount: customers.length,
      });
    })
  );
}

module.exports = dashboardRoutes;
