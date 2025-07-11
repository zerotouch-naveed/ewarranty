 const { Company, AuditLog } = require('../schemas');
 const { authenticate, requireAdmin } = require('../middleware/auth');
 const { validate, companyValidation } = require('../utils/validation');
 const { catchAsync } = require('../middleware/errorHandler');
 
 async function companyRoutes(fastify, options) {
   
   // Create Company (Admin only)
   fastify.post('/', {
     preHandler: [authenticate, requireAdmin, validate(companyValidation.create)],
     schema: {
       description: 'Create a new company',
       tags: ['Companies'],
       security: [{ Bearer: [] }]
     }
   }, catchAsync(async (request, reply) => {
     const companyData = request.body;
 
     // Check if company already exists
     const existingCompany = await Company.findOne({
       $or: [
         { email: companyData.email },
         { name: companyData.name }
       ]
     });
 
     if (existingCompany) {
       return reply.code(400).send({
         success: false,
         error: 'Company already exists with this name or email'
       });
     }
 
     const company = new Company({
       ...companyData,
       companyId: `COMP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
     });
 
     await company.save();
 
     // Create audit log
     const auditLog = new AuditLog({
       logId: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
       companyId: request.user.companyId,
       userId: request.user.userId,
       action: 'CREATE',
       entityType: 'COMPANY',
       entityId: company.companyId,
       newData: company.toObject()
     });
     await auditLog.save();
 
     return reply.code(201).send({
       success: true,
       message: 'Company created successfully',
       data: { company }
     });
   }));
 
   // Get Company Details
   fastify.get('/:companyId', {
     preHandler: [authenticate],
     schema: {
       description: 'Get company details',
       tags: ['Companies'],
       security: [{ Bearer: [] }]
     }
   }, catchAsync(async (request, reply) => {
     const { companyId } = request.params;
 
     // Users can only access their own company details
     if (request.user.companyId !== companyId && !['TSM', 'ASM'].includes(request.user.userType)) {
       return reply.code(403).send({
         success: false,
         error: 'Access denied'
       });
     }
 
     const company = await Company.findOne({ companyId });
     if (!company) {
       return reply.code(404).send({
         success: false,
         error: 'Company not found'
       });
     }
 
     return reply.send({
       success: true,
       data: { company }
     });
   }));
 
   // Update Company
   fastify.put('/:companyId', {
     preHandler: [authenticate, requireAdmin, validate(companyValidation.update)],
     schema: {
       description: 'Update company details',
       tags: ['Companies'],
       security: [{ Bearer: [] }]
     }
   }, catchAsync(async (request, reply) => {
     const { companyId } = request.params;
     const updateData = request.body;
 
     // Get old data for audit
     const oldCompany = await Company.findOne({ companyId });
     if (!oldCompany) {
       return reply.code(404).send({
         success: false,
         error: 'Company not found'
       });
     }
 
     const company = await Company.findOneAndUpdate(
       { companyId },
       { ...updateData, updatedAt: new Date() },
       { new: true }
     );
 
     // Create audit log
     const auditLog = new AuditLog({
       logId: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
       companyId: request.user.companyId,
       userId: request.user.userId,
       action: 'UPDATE',
       entityType: 'COMPANY',
       entityId: companyId,
       oldData: oldCompany.toObject(),
       newData: updateData
     });
     await auditLog.save();
 
     return reply.send({
       success: true,
       message: 'Company updated successfully',
       data: { company }
     });
   }));
 
   // Get All Companies (Super Admin only)
   fastify.get('/', {
     preHandler: [authenticate, requireAdmin],
     schema: {
       description: 'Get all companies',
       tags: ['Companies'],
       security: [{ Bearer: [] }]
     }
   }, catchAsync(async (request, reply) => {
     const { page = 1, limit = 10, search = '', status } = request.query;
 
     const query = {};
     if (search) {
       query.$or = [
         { name: { $regex: search, $options: 'i' } },
         { email: { $regex: search, $options: 'i' } }
       ];
     }
     if (status !== undefined) {
       query.isActive = status === '1';
     }
 
     const skip = (page - 1) * limit;
     const companies = await Company.find(query)
       .skip(skip)
       .limit(parseInt(limit))
       .sort({ createdAt: -1 });
 
     const total = await Company.countDocuments(query);
 
     return reply.send({
       success: true,
       data: {
         companies,
         pagination: {
           page: parseInt(page),
           limit: parseInt(limit),
           total,
           pages: Math.ceil(total / limit)
         }
       }
     });
   }));
 
   // Deactivate Company
   fastify.delete('/:companyId', {
     preHandler: [authenticate, requireAdmin],
     schema: {
       description: 'Deactivate company',
       tags: ['Companies'],
       security: [{ Bearer: [] }]
     }
   }, catchAsync(async (request, reply) => {
     const { companyId } = request.params;
 
     const company = await Company.findOneAndUpdate(
       { companyId },
       { isActive: false, updatedAt: new Date() },
       { new: true }
     );
 
     if (!company) {
       return reply.code(404).send({
         success: false,
         error: 'Company not found'
       });
     }
 
     // Create audit log
     const auditLog = new AuditLog({
       logId: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
       companyId: request.user.companyId,
       userId: request.user.userId,
       action: 'DELETE',
       entityType: 'COMPANY',
       entityId: companyId,
       newData: { isActive: false }
     });
     await auditLog.save();
 
     return reply.send({
       success: true,
       message: 'Company deactivated successfully'
     });
   }));
 }
 
 module.exports = companyRoutes;