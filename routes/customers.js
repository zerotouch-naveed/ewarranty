 const { Customer } = require('../schemas');
 const { authenticate, requireRetailer } = require('../middleware/auth');
 const { CustomerService } = require('../services');
 const { catchAsync } = require('../middleware/errorHandler');
 
 async function customerRoutes(fastify, options) {
   
   // Create Customer (Retailers only)
   fastify.post('/', {
     preHandler: [authenticate, requireRetailer],
     schema: {
       description: 'Create a new customer warranty',
       tags: ['Customers'],
       security: [{ Bearer: [] }]
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
   fastify.get('/', {
     preHandler: [authenticate],
     schema: {
       description: 'Get customers based on hierarchy',
       tags: ['Customers'],
       security: [{ Bearer: [] }]
     }
   }, catchAsync(async (request, reply) => {
     const { status, startDate, endDate } = request.query;
     
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
       filters
     );
 
     return reply.send({
       success: true,
       data: { customers }
     });
   }));
 
   // Get Customer Details
   fastify.get('/:customerId', {
     preHandler: [authenticate],
     schema: {
       description: 'Get customer details',
       tags: ['Customers'],
       security: [{ Bearer: [] }]
     }
   }, catchAsync(async (request, reply) => {
     const canAccess = await CustomerService.canAccessCustomer(
       request.user.userId,
       request.params.customerId
     );
 
     if (!canAccess) {
       return reply.code(403).send({ 
         success: false,
         error: 'No permission to view this customer' 
       });
     }
 
     const customer = await Customer.findOne({ customerId: request.params.customerId });
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