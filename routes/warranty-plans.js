const { WarrantyPlan } = require('../schemas');
const { authenticate, requireAdmin } = require('../middleware/auth');
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
      isActive: true
    }).select("planId companyId planName planDescription duration premiumAmount eligibleCategories createdAt");

    return reply.send({
      success: true,
      data: { plans }
    });
  }));

  // Create Warranty Plan
  // Optimized Warranty Plan Creation Route with Swagger Documentation

fastify.post('/create', {
  preHandler: [authenticate,requireAdmin],
  schema: {
    description: 'Create a new warranty plan',
    summary: 'Create warranty plan',
    tags: ['Warranty Plans'],
    security: [{ Bearer: [] }],
    body: {
      type: 'object',
      required: ['planName', 'duration', 'premiumAmount'],
      properties: {
        planName: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
          description: 'Name of the warranty plan'
        },
        planDescription: {
          type: 'string',
          maxLength: 500,
          description: 'Description of the warranty plan'
        },
        duration: {
          type: 'integer',
          minimum: 1,
          maximum: 120,
          description: 'Duration of the plan in months'
        },
        premiumAmount: {
          type: 'number',
          minimum: 0,
          description: 'Premium amount for the plan'
        },
        coverage: {
          type: 'object',
          properties: {
            extendedWarranty: {
              type: 'boolean',
              default: false,
              description: 'Coverage for extended warranty'
            },
            accidentalDamage: {
              type: 'boolean',
              default: false,
              description: 'Coverage for accidental damage'
            },
            liquidDamage: {
              type: 'boolean',
              default: false,
              description: 'Coverage for liquid damage'
            },
            screenDamage: {
              type: 'boolean',
              default: false,
              description: 'Coverage for screen damage'
            },
            theft: {
              type: 'boolean',
              default: false,
              description: 'Coverage for theft'
            },
            other: {
              type: 'array',
              items: {
                type: 'object',
                required: ['coverageType', 'description'],
                properties: {
                  coverageType: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 50
                  },
                  description: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 200
                  }
                }
              },
              description: 'Additional coverage types'
            }
          },
          additionalProperties: false
        },
        eligibleCategories: {
          type: 'array',
          items: {
            type: 'string',
            minLength: 1,
            maxLength: 50
          },
          uniqueItems: true,
          description: 'Product categories eligible for this plan'
        }
      },
      additionalProperties: false
    }
  }
}, catchAsync(async (request, reply) => {
  try {
    

    const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 11);
      const planId = `PLAN_${timestamp}_${randomString}`;
      // Create plan with validated data
      const planData = {
        ...request.body,
        planId,
        companyId: request.user.companyId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Set defaults for coverage if not provided
      if (!planData.coverage) {      planData.coverage = {
          extendedWarranty: false,
          accidentalDamage: false,
          liquidDamage: false,
          screenDamage: false,
          theft: false,
          other: []
        };
      }

      const plan = new WarrantyPlan(planData);
      await plan.save();

      // Log successful creation
      request.log.info({
        planId: plan.planId,
        companyId: request.user.companyId,
        userId: request.user.userId,
        action: 'warranty_plan_created'
      }, 'Warranty plan created successfully');

      return reply.code(201).send({
        success: true,
        message: 'Warranty plan created successfully',
        data: { plan }
      });
    

  } catch (error) {
    return reply.code(409).send({
      success: false,
      message: 'Plan with this ID already exists',
      error: 'DUPLICATE_PLAN_ID'
    });
  }
  }));
}

module.exports = warrantyPlanRoutes;