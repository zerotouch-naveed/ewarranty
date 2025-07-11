const { authenticate } = require('../middleware/auth');
const { KeyManagementService } = require('../services');
const { catchAsync } = require('../middleware/errorHandler');

async function keyRoutes(fastify, options) {
  
  // Allocate Keys
  fastify.post('/allocate', {
    preHandler: [authenticate],
    schema: {
      description: 'Allocate keys to user',
      tags: ['Key Management'],
      security: [{ Bearer: [] }]
    }
  }, catchAsync(async (request, reply) => {
    const { toUserId, keyCount } = request.body;
    
    const keyRecord = await KeyManagementService.allocateKeys(
      request.user.userId,
      toUserId,
      keyCount,
      request.user.companyId
    );

    return reply.code(201).send({
      success: true,
      message: 'Keys allocated successfully',
      data: { keyRecord }
    });
  }));

  // Get Key History
  fastify.get('/history', {
    preHandler: [authenticate],
    schema: {
      description: 'Get key allocation history',
      tags: ['Key Management'],
      security: [{ Bearer: [] }]
    }
  }, catchAsync(async (request, reply) => {
    const history = await KeyManagementService.getKeyHistory(
      request.user.userId,
      request.user.companyId
    );
    
    return reply.send({
      success: true,
      data: { history }
    });
  }));
}

module.exports = keyRoutes;