const { User, Customer, Claim } = require('../schemas');
const { authenticate } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');

async function dashboardRoutes(fastify, options) {
  
  // Get Dashboard Stats
  fastify.get('/stats', {
    preHandler: [authenticate],
    schema: {
      description: 'Get dashboard statistics',
      tags: ['Dashboard'],
      security: [{ Bearer: [] }]
    }
  }, catchAsync(async (request, reply) => {
    const companyId = request.user.companyId;

    // Get counts
    const totalUsers = await User.countDocuments({ companyId, isActive: true });
    const totalCustomers = await Customer.countDocuments({ companyId });
    const totalClaims = await Claim.countDocuments({ companyId });
    const pendingClaims = await Claim.countDocuments({ 
      companyId, 
      claimStatus: 'PENDING' 
    });

    return reply.send({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalCustomers,
          totalClaims,
          pendingClaims
        }
      }
    });
  }));
}

module.exports = dashboardRoutes;