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

      const user = await User.findOne({ userId }).select("walletBalance");
      const walletBalance = user?.walletBalance;

      const users = (await HierarchyService.getManageableUsers(userId)) || [];

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

      const { customers, totalData } =
        (await CustomerService.getAccessibleCustomers(
          userId,
          companyId,
          userType,
          {}
        )) || [];

      return reply.send({
        success: true,
        userTypeCount,
        lastAddedUsers: customers,
        walletBalance,
        totalCustomersCount: totalData,
      });
    })
  );

  fastify.get(
    "/retailer-stats",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get Retailer dashboard statistics",
        tags: ["Dashboard"],
        security: [{ Bearer: [] }],
      },
    },

    async (request, reply) => {
      try {
        const { userId } = request.user;

        const user = await User.findOne({ userId });
        console.log("US: ", user);

        const walletBalance = user?.walletBalance;
        const eWarrantyStats = user?.eWarrantyStats;

        const totalCustomersCount = await Customer.countDocuments({
          retailerId: userId,
        });

        const lastAddedUsersRaw = await Customer.find({ retailerId: userId })
          .sort({ "dates.createdDate": -1 })
          .limit(10)
          .select({
            "customerDetails.name": 1,
            "notes": 1,
            "productDetails.modelName": 1,
            "productDetails.category": 1,
            "warrantyDetails.warrantyPeriod": 1,
            "warrantyDetails.premiumAmount": 1,
            "dates.createdDate": 1,
            warrantyKey: 1,
          })
          .lean();

        const lastAddedUsers = lastAddedUsersRaw.map((customer) => ({
          customerName: customer.customerDetails?.name || "",
          modelName: customer.productDetails?.modelName || "",
          notes: customer.notes || "",
          warrantyPeriod: customer.warrantyDetails?.warrantyPeriod || "",
          premiumAmount: customer.warrantyDetails?.premiumAmount || "",
          createdDate: customer.dates?.createdDate || "",
          warrantyKey: customer.warrantyKey || "",
          category: customer.productDetails?.category || "",
        }));

        return reply.send({
          success: true,
          walletBalance,
          totalCustomersCount,
          eWarrantyStats,
          customers: lastAddedUsers,
        });
      } catch (error) {
        request.log.error(error);
        return reply
          .status(500)
          .send({ success: false, error: "Internal Server Error" });
      }
    }
  );
}

module.exports = dashboardRoutes;
