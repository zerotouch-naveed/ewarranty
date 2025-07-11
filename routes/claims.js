const { Claim } = require('../schemas');
const { authenticate } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');

async function claimRoutes(fastify, options) {
  
  // Get Claims
  fastify.get('/', {
    preHandler: [authenticate],
    schema: {
      description: 'Get claims',
      tags: ['Claims'],
      security: [{ Bearer: [] }]
    }
  }, catchAsync(async (request, reply) => {
    const claims = await Claim.find({
      companyId: request.user.companyId
    }).sort({ claimDate: -1 });

    return reply.send({
      success: true,
      data: { claims }
    });
  }));

  // Create Claim
  fastify.post('/', {
    preHandler: [authenticate],
    schema: {
      description: 'Create new claim',
      tags: ['Claims'],
      security: [{ Bearer: [] }]
    }
  }, catchAsync(async (request, reply) => {
    const claim = new Claim({
      ...request.body,
      claimId: `CLAIM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyId: request.user.companyId
    });

    await claim.save();

    return reply.code(201).send({
      success: true,
      message: 'Claim created successfully',
      data: { claim }
    });
  }));
}

module.exports = claimRoutes;