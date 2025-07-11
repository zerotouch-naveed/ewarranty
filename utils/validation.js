 const Joi = require('joi');
 
 // Common validation patterns
 const patterns = {
   objectId: /^[a-fA-F0-9]{24}$/,
   phone: /^[+]?[\d\s\-\(\)]{10,15}$/,
   imei: /^[0-9]{15}$/,
   warrantyKey: /^WK_\d+_[A-Z0-9]{9}$/,
   userId: /^USER_\d+_[a-z0-9]{9}$/,
   customerId: /^CUST_\d+_[a-z0-9]{9}$/,
   companyId: /^COMP_\d+_[a-z0-9]{9}$/
 };
 
 // User validation schemas
 const userValidation = {
   register: Joi.object({
     name: Joi.string().min(2).max(50).required(),
     email: Joi.string().email().required(),
     phone: Joi.string().pattern(patterns.phone).required(),
     password: Joi.string().min(8).max(128).required(),
     userType: Joi.string().valid(
       'TSM', 'ASM', 'SALES_EXECUTIVE', 'SUPER_DISTRIBUTOR', 
       'DISTRIBUTOR', 'NATIONAL_DISTRIBUTOR', 'MINI_DISTRIBUTOR', 'RETAILER'
     ).required(),
     parentUserId: Joi.string().pattern(patterns.userId).allow(null),
     alternatePhone: Joi.string().pattern(patterns.phone).allow(null, ''),
     address: Joi.object({
       street: Joi.string().max(100),
       city: Joi.string().max(50),
       state: Joi.string().max(50),
       country: Joi.string().max(50),
       zipCode: Joi.string().max(10)
     }).allow(null)
   }),
 
   login: Joi.object({
     email: Joi.string().email().required(),
     password: Joi.string().required()
   }),
 
   update: Joi.object({
     name: Joi.string().min(2).max(50),
     phone: Joi.string().pattern(patterns.phone),
     alternatePhone: Joi.string().pattern(patterns.phone).allow(null, ''),
     address: Joi.object({
       street: Joi.string().max(100),
       city: Joi.string().max(50),
       state: Joi.string().max(50),
       country: Joi.string().max(50),
       zipCode: Joi.string().max(10)
     }),
     isActive: Joi.boolean()
   }),
 
   changePassword: Joi.object({
     currentPassword: Joi.string().required(),
     newPassword: Joi.string().min(8).max(128).required(),
     confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
   })
 };
 
 // Company validation schemas
 const companyValidation = {
   create: Joi.object({
     name: Joi.string().min(2).max(100).required(),
     email: Joi.string().email().required(),
     phone: Joi.string().pattern(patterns.phone).required(),
     address: Joi.object({
       street: Joi.string().max(100).required(),
       city: Joi.string().max(50).required(),
       state: Joi.string().max(50).required(),
       country: Joi.string().max(50).required(),
       zipCode: Joi.string().max(10).required()
     }).required(),
     settings: Joi.object({
       timezone: Joi.string().default('UTC'),
       currency: Joi.string().default('USD'),
       customFields: Joi.array().items(
         Joi.object({
           fieldName: Joi.string().required(),
           fieldType: Joi.string().valid('text', 'number', 'date', 'boolean').required(),
           isRequired: Joi.boolean().default(false)
         })
       )
     })
   }),
 
   update: Joi.object({
     name: Joi.string().min(2).max(100),
     email: Joi.string().email(),
     phone: Joi.string().pattern(patterns.phone),
     address: Joi.object({
       street: Joi.string().max(100),
       city: Joi.string().max(50),
       state: Joi.string().max(50),
       country: Joi.string().max(50),
       zipCode: Joi.string().max(10)
     }),
     settings: Joi.object({
       timezone: Joi.string(),
       currency: Joi.string(),
       customFields: Joi.array().items(
         Joi.object({
           fieldName: Joi.string().required(),
           fieldType: Joi.string().valid('text', 'number', 'date', 'boolean').required(),
           isRequired: Joi.boolean().default(false)
         })
       )
     }),
     isActive: Joi.boolean()
   })
 };
 
 // Customer validation schemas
 const customerValidation = {
   create: Joi.object({
     customerDetails: Joi.object({
       name: Joi.string().min(2).max(50).required(),
       email: Joi.string().email().allow(null, ''),
       mobile: Joi.string().pattern(patterns.phone).required(),
       alternateNumber: Joi.string().pattern(patterns.phone).allow(null, ''),
       address: Joi.object({
         street: Joi.string().max(100),
         city: Joi.string().max(50),
         state: Joi.string().max(50),
         country: Joi.string().max(50),
         zipCode: Joi.string().max(10)
       })
     }).required(),
 
     productDetails: Joi.object({
       modelName: Joi.string().max(50).required(),
       imei1: Joi.string().pattern(patterns.imei).required(),
       imei2: Joi.string().pattern(patterns.imei).allow(null, ''),
       brand: Joi.string().max(50).required(),
       category: Joi.string().max(50).required(),
       purchasePrice: Joi.number().positive().required()
     }).required(),
 
     invoiceDetails: Joi.object({
       invoiceNumber: Joi.string().max(50).required(),
       invoiceAmount: Joi.number().positive().required(),
       invoiceImage: Joi.string().uri().required(),
       invoiceDate: Joi.date().max('now').required()
     }).required(),
 
     productImages: Joi.object({
       frontImage: Joi.string().uri().required(),
       backImage: Joi.string().uri().required(),
       additionalImages: Joi.array().items(Joi.string().uri())
     }).required(),
 
     warrantyDetails: Joi.object({
       planId: Joi.string().required(),
       planName: Joi.string().required(),
       warrantyPeriod: Joi.number().integer().min(1).max(60).required(),
       startDate: Joi.date().required(),
       expiryDate: Joi.date().min(Joi.ref('startDate')).required(),
       premiumAmount: Joi.number().positive().required()
     }).required(),
 
     paymentDetails: Joi.object({
       paymentMethod: Joi.string().valid('CARD', 'UPI', 'NETBANKING', 'WALLET').required(),
       transactionId: Joi.string().max(100).allow(null, '')
     })
   }),
 
   update: Joi.object({
     status: Joi.number().valid(0, 1),
     notes: Joi.string().max(500)
   })
 };
 
 // Key management validation schemas
 const keyValidation = {
   allocate: Joi.object({
     toUserId: Joi.string().pattern(patterns.userId).required(),
     keyCount: Joi.number().integer().positive().required(),
     notes: Joi.string().max(200).allow(null, '')
   }),
 
   revoke: Joi.object({
     fromUserId: Joi.string().pattern(patterns.userId).required(),
     keyCount: Joi.number().integer().positive().required(),
     notes: Joi.string().max(200).allow(null, '')
   })
 };
 
 // Warranty plan validation schemas
 const warrantyPlanValidation = {
   create: Joi.object({
     planName: Joi.string().min(2).max(100).required(),
     planDescription: Joi.string().max(500).allow(null, ''),
     duration: Joi.number().integer().min(1).max(60).required(),
     premiumAmount: Joi.number().positive().required(),
     coverage: Joi.object({
       accidentalDamage: Joi.boolean().default(false),
       liquidDamage: Joi.boolean().default(false),
       screenDamage: Joi.boolean().default(false),
       theft: Joi.boolean().default(false),
       other: Joi.array().items(
         Joi.object({
           coverageType: Joi.string().required(),
           description: Joi.string().required()
         })
       )
     }),
     eligibleCategories: Joi.array().items(Joi.string()).required()
   }),
 
   update: Joi.object({
     planName: Joi.string().min(2).max(100),
     planDescription: Joi.string().max(500).allow(null, ''),
     duration: Joi.number().integer().min(1).max(60),
     premiumAmount: Joi.number().positive(),
     coverage: Joi.object({
       accidentalDamage: Joi.boolean(),
       liquidDamage: Joi.boolean(),
       screenDamage: Joi.boolean(),
       theft: Joi.boolean(),
       other: Joi.array().items(
         Joi.object({
           coverageType: Joi.string().required(),
           description: Joi.string().required()
         })
       )
     }),
     eligibleCategories: Joi.array().items(Joi.string()),
     isActive: Joi.boolean()
   })
 };
 
 // Claim validation schemas
 const claimValidation = {
   create: Joi.object({
     customerId: Joi.string().pattern(patterns.customerId).required(),
     claimType: Joi.string().valid(
       'ACCIDENTAL_DAMAGE', 'LIQUID_DAMAGE', 'SCREEN_DAMAGE', 'THEFT', 'OTHER'
     ).required(),
     claimDescription: Joi.string().min(10).max(1000).required(),
     claimAmount: Joi.number().positive().required(),
     damageImages: Joi.array().items(Joi.string().uri()).min(1).required()
   }),
 
   update: Joi.object({
     claimStatus: Joi.string().valid(
       'PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED'
     ),
     approvedAmount: Joi.number().positive(),
     repairDetails: Joi.object({
       repairCenter: Joi.string().max(100),
       repairDate: Joi.date(),
       repairCost: Joi.number().positive(),
       repairInvoice: Joi.string().uri()
     }),
     notes: Joi.string().max(500)
   })
 };
 
 // Query parameter validation
 const queryValidation = {
   pagination: Joi.object({
     page: Joi.number().integer().min(1).default(1),
     limit: Joi.number().integer().min(1).max(100).default(10),
     sort: Joi.string().default('-createdAt'),
     search: Joi.string().max(100).allow(''),
     status: Joi.number().valid(0, 1),
     userType: Joi.string().valid(
       'TSM', 'ASM', 'SALES_EXECUTIVE', 'SUPER_DISTRIBUTOR', 
       'DISTRIBUTOR', 'NATIONAL_DISTRIBUTOR', 'MINI_DISTRIBUTOR', 'RETAILER'
     ),
     startDate: Joi.date(),
     endDate: Joi.date().min(Joi.ref('startDate'))
   })
 };
 
 // Validation middleware factory
 const validate = (schema, property = 'body') => {
   return async (request, reply) => {
     try {
       const { error, value } = schema.validate(request[property], {
         abortEarly: false,
         stripUnknown: true,
         allowUnknown: false
       });
 
       if (error) {
         const errors = error.details.map(detail => ({
           field: detail.path.join('.'),
           message: detail.message
         }));
 
         return reply.code(400).send({
           success: false,
           error: 'Validation Error',
           details: errors
         });
       }
 
       request[property] = value;
     } catch (err) {
       return reply.code(500).send({
         success: false,
         error: 'Internal validation error'
       });
     }
   };
 };
 
 module.exports = {
   patterns,
   userValidation,
   companyValidation,
   customerValidation,
   keyValidation,
   warrantyPlanValidation,
   claimValidation,
   queryValidation,
   validate
 };