const { authenticate } = require('../middleware/auth');
const { HierarchyService, WalletManagementService  } = require('../services');
const { catchAsync } = require('../middleware/errorHandler');

async function walletRoutes(fastify, options) {
  
  // Allocate Keys
  fastify.post('/allocate', {
    preHandler: [authenticate],
    schema: {
      description: 'Allocate keys to user',
      tags: ['Key Management'],
      security: [{ Bearer: [] }],
      body: {
         type: 'object',
         required: ['toUserId', 'amount'],
         properties: {
           toUserId: { type: 'string' },
           amount: { type: 'integer', minimum: 1 }
         }
       },
    }
  }, catchAsync(async (request, reply) => {
    const { toUserId, amount } = request.body;
    
    const keyRecord = await WalletManagementService.allocateWalletAmount(
      request.user.userId,
      toUserId,
      amount,
      request.user.companyId
    );

    return reply.code(201).send({
      success: true,
      message: 'Keys allocated successfully',
      data: { keyRecord }
    });
  }));

  // Get Key History
  fastify.post('/history', {
    preHandler: [authenticate],
    schema: {
      description: 'Get key allocation history',
      tags: ['Key Management'],
      security: [{ Bearer: [] }],
      body: {
         type: 'object',
         required: ['userId'],
         properties: {
           userId: { type: 'string' }
         }
       },
    }
  }, catchAsync(async (request, reply) => {
    const { userId } = request.body;
    if (!userId) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid User ID'
      });
    }
    if(request.user.userId !== userId){
      const isAllowed = await HierarchyService.isAncestor(
        request.user.userId,
        userId
      );
      if (!isAllowed) {
        return reply.code(403).send({
          success: false,
          message: 'Access denied'
        });
      }
    }
    const history = await WalletManagementService.getWalletHistory(
      userId,
      request.user.companyId
    );
    return reply.send({
      success: true,
      data: { history }
    });
  }));

  // Get Wallet Summary
fastify.get('/summary', {
  preHandler: [authenticate],
  schema: {
    description: 'Get wallet summary for logged-in user',
    tags: ['Wallet Management'],
    security: [{ Bearer: [] }]
  }
}, catchAsync(async (request, reply) => {
  const summary = await WalletManagementService.getWalletSummary(request.user.userId);
  return reply.send({ success: true, data: summary });
}));
}

module.exports = walletRoutes;