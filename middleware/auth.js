const jwt = require('jsonwebtoken');
 const { User } = require('../schemas');
 
 // Authentication middleware
 const authenticate = async (request, reply) => {
   try {
     const authHeader = request.headers.authorization;
     
     if (!authHeader || !authHeader.startsWith('Bearer ')) {
       return reply.code(401).send({ 
         success: false,
         error: 'Access denied. No token provided or invalid format.' 
       });
     }
 
     const token = authHeader.substring(7); // Remove 'Bearer ' prefix
     
     if (!token) {
       return reply.code(401).send({ 
         success: false,
         error: 'Access denied. No token provided.' 
       });
     }
 
     try {
       const decoded = jwt.verify(token, process.env.JWT_SECRET);
       const user = await User.findOne({ 
         userId: decoded.userId,
         isActive: true 
       }).select('-password');
       
       if (!user) {
         return reply.code(401).send({ 
           success: false,
           error: 'Invalid token or user not found.' 
         });
       }
 
       // Add user to request object
       request.user = user;
       
     } catch (jwtError) {
       if (jwtError.name === 'TokenExpiredError') {
         return reply.code(401).send({ 
           success: false,
           error: 'Token expired. Please login again.' 
         });
       } else if (jwtError.name === 'JsonWebTokenError') {
         return reply.code(401).send({ 
           success: false,
           error: 'Invalid token.' 
         });
       } else {
         throw jwtError;
       }
     }
     
   } catch (error) {
     request.log.error('Authentication error:', error);
     return reply.code(500).send({ 
       success: false,
       error: 'Internal server error during authentication.' 
     });
   }
 };
 
 // Authorization middleware for specific user types
 const authorize = (...userTypes) => {
   return async (request, reply) => {
     if (!request.user) {
       return reply.code(401).send({ 
         success: false,
         error: 'Authentication required.' 
       });
     }
 
     if (!userTypes.includes(request.user.userType)) {
       return reply.code(403).send({ 
         success: false,
         error: `Access denied. Required user type: ${userTypes.join(' or ')}` 
       });
     }
   };
 };
 
 // Company context middleware - ensures user belongs to the same company
 const ensureCompanyContext = async (request, reply) => {
   const { companyId } = request.params;
   
   if (companyId && request.user.companyId !== companyId) {
     return reply.code(403).send({ 
       success: false,
       error: 'Access denied. You can only access your company resources.' 
     });
   }
 };
 
 // Super admin middleware
 const requireSuperAdmin = async (request, reply) => {
   if (!request.user || request.user.userType !== 'SUPER_ADMIN') {
     return reply.code(403).send({ 
       success: false,
       error: 'Access denied. Super admin privileges required.' 
     });
   }
 };
 
 // Admin middleware (TSM or ASM)
 const requireAdmin = async (request, reply) => {
   if (!request.user || !['TSM', 'ASM'].includes(request.user.userType)) {
     return reply.code(403).send({ 
       success: false,
       error: 'Access denied. Admin privileges required.' 
     });
   }
 };
 
 // Retailer only middleware
 const requireRetailer = async (request, reply) => {
   if (!request.user || request.user.userType !== 'RETAILER') {
     return reply.code(403).send({ 
       success: false,
       error: 'Access denied. Retailer privileges required.' 
     });
   }
 };
 
 // Generate JWT token
 const generateToken = (payload) => {
   return jwt.sign(payload, process.env.JWT_SECRET, {
     expiresIn: process.env.JWT_EXPIRES_IN || '24h'
   });
 };
 
 // Generate refresh token
 const generateRefreshToken = (payload) => {
   return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
     expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
   });
 };
 
 // Verify refresh token
 const verifyRefreshToken = (token) => {
   return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
 };
 
 module.exports = {
   authenticate,
   authorize,
   ensureCompanyContext,
   requireSuperAdmin,
   requireAdmin,
   requireRetailer,
   generateToken,
   generateRefreshToken,
   verifyRefreshToken
 };