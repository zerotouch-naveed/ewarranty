 const { User, Company, AuditLog } = require('../schemas');
 const { authenticate, requireAdmin } = require('../middleware/auth');
 const { validate, companyValidation } = require('../utils/validation');
 const { catchAsync } = require('../middleware/errorHandler');
 
 async function companyRoutes(fastify, options) {
   
   // Create Company (Admin only)
   fastify.post('/create', {
     preHandler: [authenticate, requireAdmin],
     schema: {
       description: 'Create a new white-label company (and owner)',
       tags: ['Companies'],
       security: [{ Bearer: [] }],
       body: {
         type: 'object',
         required: ['name', 'email', 'phone', 'address', 'totalAmount', 'owner'],
         properties: {
           name: { type: 'string', minLength: 2, maxLength: 100 },
           email: { type: 'string', format: 'email' },
           phone: { type: 'string', minLength: 10, maxLength: 15 },
           address: {
             type: 'object',
             required: ['street', 'city', 'state', 'country', 'zipCode'],
             properties: {
               street: { type: 'string', maxLength: 100 },
               city: { type: 'string', maxLength: 50 },
               state: { type: 'string', maxLength: 50 },
               country: { type: 'string', maxLength: 50 },
               zipCode: { type: 'string', maxLength: 10 }
             }
           },
           totalAmount: { type: 'integer', minimum: 1 },
           branding: {
             type: 'object',
             properties: {
               logo: { type: 'string' },
               primaryColor: { type: 'string' },
               secondaryColor: { type: 'string' }
             },
             default: {}
           },
           owner: {
             type: 'object',
             required: ['name', 'email', 'phone', 'password'],
             properties: {
               name: { type: 'string', minLength: 2, maxLength: 100 },
               email: { type: 'string', format: 'email' },
               phone: { type: 'string', minLength: 10, maxLength: 15 },
               password: { type: 'string', minLength: 8, maxLength: 128 }
             }
           }
         }
       },
       response: {
         201: {
           type: 'object',
           properties: {
             success: { type: 'boolean' },
             message: { type: 'string' },
             data: {
               type: 'object',
               properties: {
                 company: { type: 'object' },
                 owner: { type: 'object' }
               }
             }
           }
         },
         400: {
           type: 'object',
           properties: {
             success: { type: 'boolean' },
             error: { type: 'string' }
           }
         },
         403: {
           type: 'object',
           properties: {
             success: { type: 'boolean' },
             error: { type: 'string' }
           }
         }
       }
     }
   }, catchAsync(async (request, reply) => {
     const { name, email, phone, address, totalAmount, branding = {}, owner } = request.body;
     const parentCompany = await Company.findOne({ companyId: request.user.companyId, companyType: 'MAIN' });
     if (!parentCompany) {
       return reply.code(400).send({ success: false, error: 'Parent (main) company not found.' });
     }
     if (parentCompany.walletBalance.remainingAmount < totalAmount) {
       return reply.code(400).send({ success: false, error: `Not enough keys available. Main company has ${parentCompany.keyAllocation.remainingKeys} keys remaining.` });
     }
     // Check for duplicate company or owner
     const existingCompany = await Company.findOne({ email });
     if (existingCompany) {
       return reply.code(400).send({ success: false, error: 'Company with this email already exists.' });
     }
     const existingOwner = await User.findOne({ email: owner.email });
     if (existingOwner) {
       return reply.code(400).send({ success: false, error: 'User with this email already exists.' });
     }
     // Create company
     const company = new Company({
      companyId: `COMPANY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
       companyType: 'WHITELABEL',
       parentCompanyId: parentCompany.companyId,
       name,
       email,
       phone,
       address,
       branding,
       walletBalance: {
         totalAmount,
         usedAmount: 0,
         remainingAmount: totalAmount
       },
       settings: {
         timezone: 'UTC',
         currency: 'INR'
       },
       createdBy: request.user.userId
     });
     await company.save();
     // Update main company key allocation
     await Company.findByIdAndUpdate(parentCompany._id, {
       $inc: {
         'walletBalance.usedAmount': totalAmount,
         'walletBalance.remainingAmount': -totalAmount
       }
     });


     await User.findOneAndUpdate({userId:request.user.userId}, {
       $inc: {
         'walletBalance.usedAmount': totalAmount,
         'walletBalance.remainingAmount': -totalAmount
       }
     });
     // Create owner user
     const bcrypt = require('bcrypt');
     const hashedPassword = await bcrypt.hash(owner.password, 12);
     const ownerUser = new User({
       userId: `USER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
       companyId: company.companyId,
       userType: 'WHITELABEL_OWNER',
       name: owner.name,
       email: owner.email,
       phone: owner.phone,
       password: hashedPassword,
       isActive: true,
       parentUserId: null,
       hierarchyLevel: 0,
       walletBalance: {
         totalAmount,
         usedAmount: 0,
         remainingAmount: totalAmount
       },
       permissions: {
         canCreateUser: true,
         canEditUser: true,
         canViewReports: true,
         canManageKeys: true
       },
       supportPermissions: {
         permissionSetId: null,
         assignedBy: null,
         assignedAt: null,
         effectivePermissions: {}
       },
       assignedCompanies: [],
       createdBy: request.user.userId
     });
     await ownerUser.save();
     // Create user hierarchy
     const { HierarchyService } = require('../services');
     await HierarchyService.createUserHierarchy(ownerUser.userId, null, company.companyId);
     // Create audit log
     const { AuditLog } = require('../schemas');
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
       message: 'Company and owner created successfully',
       data: {
         company: company.toObject(),
         owner: { ...ownerUser.toObject(), password: undefined }
       }
     });
   }));



   
 
   // Get Company Details
   fastify.post('/get', {
     preHandler: [authenticate],
     schema: {
       description: 'Get company details',
       tags: ['Companies'],
       security: [{ Bearer: [] }],
       body: {
         type: 'object',
         required: ['companyId'],
         properties: {
           companyId: { type: 'string' },
         }
        }
     }
   }, catchAsync(async (request, reply) => {
     const { companyId } = request.body;
 
     // Users can only access their own company details
     if (request.user.companyId !== companyId && !['WHITELABEL_OWNER', 'MAIN_OWNER'].includes(request.user.userType)) {
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
   fastify.post('/update', {
     preHandler: [authenticate, requireAdmin, validate(companyValidation.update)],
     schema: {
       description: 'Update company details',
       tags: ['Companies'],
       security: [{ Bearer: [] }],
       body: {
         type: 'object',
         required: ['companyId'],
         properties: {
           companyId: { type: 'string' },
         }
        }
     }
   }, catchAsync(async (request, reply) => {
     const { companyId, ...updateData } = request.body;
 
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
   fastify.post('/all', {
     preHandler: [authenticate, requireAdmin],
     schema: {
       description: 'Get all companies',
       tags: ['Companies'],
       security: [{ Bearer: [] }]
     }
   }, catchAsync(async (request, reply) => {
 
     const companies = await Company.find()
       .sort({ createdAt: -1 }).lean();
 
     return reply.send({
       success: true,
       data: {
         companies,
       }
     });
   }));
 
   // Deactivate Company
   fastify.post('/delete', {
     preHandler: [authenticate, requireAdmin],
     schema: {
       description: 'Deactivate company',
       tags: ['Companies'],
       security: [{ Bearer: [] }],
       body: {
         type: 'object',
         required: ['companyId'],
         properties: {
           companyId: { type: 'string' },
         }
        }
     }
   }, catchAsync(async (request, reply) => {
     const { companyId } = request.body;
 
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