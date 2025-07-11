 const { User, UserHierarchy, AuditLog } = require('../schemas');
 const { authenticate } = require('../middleware/auth');
 const { HierarchyService, ValidationService } = require('../services');
 const { catchAsync } = require('../middleware/errorHandler');
 
 async function userRoutes(fastify, options) {
   
   // Get Users (based on hierarchy)
   fastify.get('/', {
     preHandler: [authenticate],
     schema: {
       description: 'Get users based on hierarchy',
       tags: ['Users'],
       security: [{ Bearer: [] }]
     }
   }, catchAsync(async (request, reply) => {
     const manageableUsers = await HierarchyService.getManageableUsers(request.user.userId);
     
     // Remove passwords from response
     const usersResponse = manageableUsers.map(user => {
       const userObj = user.toObject();
       delete userObj.password;
       return userObj;
     });
 
     return reply.send({
       success: true,
       data: { users: usersResponse }
     });
   }));
 
   // Get User Details
   fastify.get('/:userId', {
     preHandler: [authenticate],
     schema: {
       description: 'Get user details',
       tags: ['Users'],
       security: [{ Bearer: [] }]
     }
   }, catchAsync(async (request, reply) => {
     const hasPermission = await HierarchyService.checkUserPermission(
       request.user.userId,
       request.params.userId
     );
 
     if (!hasPermission) {
       return reply.code(403).send({ 
         success: false,
         error: 'No permission to view this user' 
       });
     }
 
     const user = await User.findOne({ userId: request.params.userId }).select('-password');
     if (!user) {
       return reply.code(404).send({ 
         success: false,
         error: 'User not found' 
       });
     }
 
     return reply.send({
       success: true,
       data: { user }
     });
   }));
 
   // Get User Hierarchy
   fastify.get('/:userId/hierarchy', {
     preHandler: [authenticate],
     schema: {
       description: 'Get user hierarchy',
       tags: ['Users'],
       security: [{ Bearer: [] }]
     }
   }, catchAsync(async (request, reply) => {
     const hasPermission = await HierarchyService.checkUserPermission(
       request.user.userId,
       request.params.userId
     );
 
     if (!hasPermission) {
       return reply.code(403).send({ 
         success: false,
         error: 'No permission to view this user hierarchy' 
       });
     }
 
     const hierarchy = await HierarchyService.getUserHierarchy(request.params.userId);
     return reply.send({
       success: true,
       data: { hierarchy }
     });
   }));
 
   // Update User
   fastify.put('/:userId', {
     preHandler: [authenticate],
     schema: {
       description: 'Update user details',
       tags: ['Users'],
       security: [{ Bearer: [] }]
     }
   }, catchAsync(async (request, reply) => {
     const hasPermission = await HierarchyService.checkUserPermission(
       request.user.userId,
       request.params.userId
     );
 
     if (!hasPermission) {
       return reply.code(403).send({ 
         success: false,
         error: 'No permission to update this user' 
       });
     }
 
     const updateData = { ...request.body };
     if (updateData.password) {
       const bcrypt = require('bcrypt');
       updateData.password = await bcrypt.hash(updateData.password, 12);
     }
 
     const user = await User.findOneAndUpdate(
       { userId: request.params.userId },
       updateData,
       { new: true }
     ).select('-password');
 
     if (!user) {
       return reply.code(404).send({ 
         success: false,
         error: 'User not found' 
       });
     }
 
     return reply.send({
       success: true,
       message: 'User updated successfully',
       data: { user }
     });
   }));
 }
 
 module.exports = userRoutes;