const { User, Customer, Claim } = require("../schemas");
const { authenticate } = require("../middleware/auth");
const { catchAsync } = require("../middleware/errorHandler");
const { HierarchyService, CustomerService } = require("../services");
async function dashboardRoutes(fastify, options) {
  // Get Dashboard Stats
  fastify.post( // Changed to POST to accept body parameters
    "/stats",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get dashboard statistics",
        tags: ["Dashboard"],
        security: [{ Bearer: [] }],
        body: {
          type: "object",
          properties: {
            companyId: { 
              type: "string",
              description: "Company ID filter (only for MAIN_OWNER). Use 'ALL' or empty string for all companies"
            }
          }
        }
      },
    },
    catchAsync(async (request, reply) => {
    const { companyId: userCompanyId, userId, userType } = request.user;
    
    // Determine target company ID based on user type
    let targetCompanyId = userCompanyId;
    let filters = {};
    if (userType === 'MAIN_OWNER') {
      const requestedCompanyId = request.body?.companyId;
      targetCompanyId = (!requestedCompanyId || requestedCompanyId === 'ALL' || requestedCompanyId === '') 
        ? 'ALL' 
        : requestedCompanyId;
      if (targetCompanyId !== 'ALL' && targetCompanyId !== '') {
        filters.companyId = targetCompanyId;
      }
    }

    // Parallel execution of independent queries
    const [user, userStatsData, customerData] = await Promise.all([
      // Get wallet balance
      User.findOne({ userId }).select("walletBalance").lean(),
      
      // Get user type counts and total count using aggregation
      userType === 'MAIN_OWNER' 
        ? HierarchyService.getOwnerUserTypeCounts(targetCompanyId)
        : HierarchyService.getManageableUserTypeCounts(userId),
      
      // Get customer data
      CustomerService.getAccessibleCustomers(userId, userCompanyId, userType, filters)
    ]);

    const walletBalance = user?.walletBalance || 0;
    const { customers, totalData, companyList } = customerData || { customers: [], totalData: 0 };
    
    // Extract user statistics
    const { userTypeCounts, totalUsers } = userStatsData || { userTypeCounts: [], totalUsers: 0 };

    return reply.send({
      success: true,
      userTypeCount: userTypeCounts,
      totalUsersCount: totalUsers,
      lastAddedUsers: customers,
      walletBalance,
      totalCustomersCount: totalData,
      companyList,
      ...(userType === 'MAIN_OWNER' && { filteredCompanyId: targetCompanyId })
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
            "customerId": 1,
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
          customerId: customer.customerId || "",
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
