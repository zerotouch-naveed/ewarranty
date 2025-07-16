const { WarrantyPlan } = require('../schemas');
const { authenticate } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');

async function warrantyPlanRoutes(fastify, options) {
  
  // Get Warranty Plans
  fastify.get('/all', {
    preHandler: [authenticate],
    schema: {
      description: 'Get warranty plans',
      tags: ['Warranty Plans'],
      security: [{ Bearer: [] }]
    }
  }, catchAsync(async (request, reply) => {
    const plans = await WarrantyPlan.find({
      companyId: request.user.companyId,
      isActive: true
    });

    return reply.send({
      success: true,
      data: { plans }
    });
  }));

  // Create Warranty Plan
  fastify.post('/create', {
    preHandler: [authenticate],
    schema: {
      description: 'Create warranty plan',
      tags: ['Warranty Plans'],
      security: [{ Bearer: [] }]
    }
  }, catchAsync(async (request, reply) => {
    const plan = new WarrantyPlan({
      ...request.body,
      planId: `PLAN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyId: request.user.companyId
    });

    await plan.save();

    return reply.code(201).send({
      success: true,
      message: 'Warranty plan created successfully',
      data: { plan }
    });
  }));
}

module.exports = warrantyPlanRoutes;