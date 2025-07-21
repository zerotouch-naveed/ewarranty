 const { Customer } = require('../schemas');
 const { authenticate, requireRetailer } = require('../middleware/auth');
 const { CustomerService } = require('../services');
 const { catchAsync } = require('../middleware/errorHandler');
 
 async function customerRoutes(fastify, options) {
   
   // Create Customer (Retailers only)
   fastify.post('/create', {
  preHandler: [authenticate, requireRetailer],
  schema: {
    description: 'Create a new customer warranty',
    tags: ['Customers'],
    security: [{ Bearer: [] }],
    body: {
      type: 'object',
      required: ['customerDetails', 'productDetails', 'invoiceDetails', 'productImages', 'warrantyDetails'],
      properties: {
        customerDetails: {
          type: 'object',
          required: ['name', 'mobile'],
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            mobile: { type: 'string' },
            alternateNumber: { type: 'string' },
            address: {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                country: { type: 'string' },
                zipCode: { type: 'string' }
              }
            }
          }
        },
        productDetails: {
          type: 'object',
          required: ['imei1'],
          properties: {
            modelName: { type: 'string' },
            imei1: { type: 'string' },
            imei2: { type: 'string' },
            brand: { type: 'string' },
            category: { type: 'string' },
            purchasePrice: { type: 'number' }
          }
        },
        invoiceDetails: {
          type: 'object',
          required: ['invoiceNumber', 'invoiceImage', 'invoiceDate'],
          properties: {
            invoiceNumber: { type: 'string' },
            invoiceAmount: { type: 'number' },
            invoiceImage: { type: 'string', format: 'uri' },
            invoiceDate: { type: 'string', format: 'date' }
          }
        },
        productImages: {
          type: 'object',
          required: ['frontImage', 'backImage'],
          properties: {
            frontImage: { type: 'string', format: 'uri' },
            backImage: { type: 'string', format: 'uri' },
            additionalImages: {
              type: 'array',
              items: { type: 'string', format: 'uri' }
            }
          }
        },
        warrantyDetails: {
          type: 'object',
          required: ['startDate', 'expiryDate'],
          properties: {
            planId: { type: 'string' },
            planName: { type: 'string' },
            warrantyPeriod: { type: 'number' },
            startDate: { type: 'string', format: 'date' },
            expiryDate: { type: 'string', format: 'date' },
            premiumAmount: { type: 'number' }
          }
        },
        paymentDetails: {
          type: 'object',
          properties: {
            paymentStatus: { type: 'string', enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] },
            paymentDate: { type: 'string', format: 'date' },
            paymentMethod: { type: 'string' },
            paymentOrderId: { type: 'string' },
            paymentId: { type: 'string' },
            transactionId: { type: 'string' }
          }
        }
      }
    }
  }
}, catchAsync(async (request, reply) => {
     const customer = await CustomerService.createCustomer(
       request.body,
       request.user.userId,
       request.user.companyId
     );
 
     return reply.code(201).send({
       success: true,
       message: 'Customer created successfully',
       data: { customer }
     });
   }));
 
   // Get Customers (based on hierarchy)
   fastify.post('/all', {
     preHandler: [authenticate],
     schema: {
       description: 'Get customers based on hierarchy',
       tags: ['Customers'],
       security: [{ Bearer: [] }],
       body: {
      type: 'object',
      required: [],
      properties: {
        status: { type: 'integer' },
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
        page: { type: 'integer' },
        limit: { type: 'integer' },
        search: { type: 'string' }
      }
    },
     }
   }, catchAsync(async (request, reply) => {
     const { status, startDate, endDate, page = 1, limit = 1, search = '' } = request.body;
     
     const filters = {};
     if (status) filters.status = parseInt(status);
     if (startDate && endDate) {
       filters['dates.createdDate'] = {
         $gte: new Date(startDate),
         $lte: new Date(endDate)
       };
     }
 
     const customers = await CustomerService.getAccessibleCustomers(
       request.user.userId,
       request.user.companyId,
       request.user.userType,
       filters,
       page,
       limit,
       search
     );
 
     return reply.send({
       success: true,
       data: { customers }
     });
   }));
 
   // Get Customer Details
   fastify.post('/get', {
     preHandler: [authenticate],
     schema: {
       description: 'Get customer details',
       tags: ['Customers'],
       security: [{ Bearer: [] }],
       body: {
        type: 'object',
        required: ['customerId'],
        properties: {
          customerId: { type: 'string' }
        }
      }
     }
   }, catchAsync(async (request, reply) => {
     const canAccess = await CustomerService.canAccessCustomer(
       request.user.userId,
       request.body.customerId
     );
 
     if (!canAccess) {
       return reply.code(403).send({ 
         success: false,
         error: 'No permission to view this customer' 
       });
     }
 
     const customer = await Customer.findOne({ customerId: request.body.customerId });
     if (!customer) {
       return reply.code(404).send({ 
         success: false,
         error: 'Customer not found' 
       });
     }
 
     return reply.send({
       success: true,
       data: { customer }
     });
   }));
 }
 
 module.exports = customerRoutes;