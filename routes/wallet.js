const { authenticate } = require('../middleware/auth');
const { HierarchyService, WalletManagementService  } = require('../services');
const { catchAsync } = require('../middleware/errorHandler');
const { User } = require('../schemas');

async function walletRoutes(fastify, options) {
  
  // Allocate Keys
  fastify.post('/allocate', {
    preHandler: [authenticate],
    schema: {
      description: 'Allocate keys to user',
      tags: ['Key Management'],
      security: [{ Bearer: [] }],
      body: {
         type: 'object',
         required: ['toUserId', 'amount'],
         properties: {
           toUserId: { type: 'string' },
           amount: { type: 'integer', minimum: 1 }
         }
       },
    }
  }, catchAsync(async (request, reply) => {
    const { toUserId, amount } = request.body;
    
    const keyRecord = await WalletManagementService.allocateWalletAmount(
      request.user.userId,
      toUserId,
      amount,
      request.user.companyId
    );

    return reply.code(201).send({
      success: true,
      message: 'Keys allocated successfully',
      data: { keyRecord }
    });
  }));

  // Get Key History
  fastify.post('/history', {
    preHandler: [authenticate],
    schema: {
      description: 'Get key allocation history',
      tags: ['Key Management'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, default: 10 },
          transactionType: { type: 'string', enum: ['SELF-ALLOCATION','ALLOCATION', 'WARRANTY_USAGE', 'REVOKE', 'REFUND', 'ALL'], default: 'ALL' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          sortBy: {
            type: 'string',
            enum: ['createdAt', 'amount'],
            default: 'createdAt'
          },
          sortOrder: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc'
          },
          isCsv: { type: "boolean", default: false },
        }
      },
    }
  }, catchAsync(async (request, reply) => {
    const { userId, transactionType = 'ALL', startDate, endDate, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', isCsv = false, } = request.body;
    if (!userId) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid User ID'
      });
    }
    let companyId = request.user.companyId;
    if(request.user.userId !== userId){
      if (request.user.userType !== 'MAIN_OWNER') {
        const isAllowed = await HierarchyService.isAncestor(
          request.user.userId,
          userId
        );
        if (!isAllowed) {
          return reply.code(403).send({
            success: false,
            message: 'Access denied'
          });
        }
      } else {
        const user = await User.findOne({ userId }).select('companyId');
        if (!user) {
          return reply.code(404).send({
            success: false,
            message: 'User not found'
          });
        }
        companyId = user.companyId;
      }
    }
    const filters = {};
    if (transactionType !== 'ALL') filters.transactionType = transactionType;
    if (startDate && endDate) {
      filters['createdAt'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    const csvLimit = isCsv ? 10000 : limit;
    const csvPage = isCsv ? 1 : page;
    const { history, totalData, currentPage, totalPages } = await WalletManagementService.getWalletHistory(
      userId,
      companyId,
      filters,
      csvPage,
      csvLimit,
      sortBy,
      sortOrder
    );
    if (isCsv) {
      if (!history || history.length === 0) {
        return reply.code(404).send({
          success: false,
          message: 'No history found for CSV export'
        });
      }

      const csvOutput = jsonToCsv(history);
      
      // Generate filename with timestamp and filters
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `history_${timestamp}.csv`;
      
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.header('Cache-Control', 'no-cache');
      reply.header('Content-Length', Buffer.byteLength(csvOutput, 'utf8'));
      
      // Use reply.send() instead of return
      return reply.send(csvOutput);
    }
    return reply.send({
      success: true,
      data: { 
        history,
        pagination: {
          currentPage,
          totalPages,
          totalData,
          limit
        }
       }
    });
  }));

  // Get current user profile
    fastify.get(
      "/wallet-balance",
      {
        preHandler: [authenticate],
        schema: {
          description: "Get current user profile",
          tags: ["Authentication"],
          security: [{ Bearer: [] }],
        },
      },
      catchAsync(async (request, reply) => {
  
        const wallet = await User.findOne({ userId: request.user.userId })
        .select('walletBalance.remainingAmount')
        .lean();
        if(!wallet) return reply.code(404).send({
          success: false,
          error: "User not found",
        });
  
        return reply.send({
          success: true,
          data: wallet
        });
      })
    );

  // Get Wallet Summary
fastify.get('/summary', {
  preHandler: [authenticate],
  schema: {
    description: 'Get wallet summary for logged-in user',
    tags: ['Wallet Management'],
    security: [{ Bearer: [] }]
  }
}, catchAsync(async (request, reply) => {
  const summary = await WalletManagementService.getWalletSummary(request.user.userId);
  return reply.send({ success: true, data: summary });
}));

  function jsonToCsv(jsonArray) {
  if (!jsonArray || jsonArray.length === 0) {
    return 'No data available';
  }
  
  try {
    // Flatten nested objects for CSV export
    const flattenedData = jsonArray.map(history => ({
      transactionId: history.transactionId || '',
      transactionType: history.transactionType || '',
      fromUser: history.fromUser?.name || '',
      toUser: history.toUser?.name|| '',
      notes: history.notes || '',
      isActive: history.isActive ? 'Active' : 'Inactive',
      amount: history.amount || 0,
      warrantyKey: history.warrantyKey || 'N/A',
      customerDetails: history.customerDetails?.customerName || '',
      transactionDate: history.transactionDate ? new Date(history.createdAt).toLocaleDateString() : ''
    }));

    // Get headers from first object
    const headers = Object.keys(flattenedData[0]);
    
    // Create CSV content
    const csvContent = [
      headers.join(','), // Header row
      ...flattenedData.map(row => 
        headers.map(header => {
          let value = row[header];
          
          // Handle null/undefined values
          if (value === null || value === undefined) {
            value = '';
          }
          
          // Convert to string and handle special characters
          value = String(value);
          
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
            value = `"${value.replace(/"/g, '""')}"`;
          }
          
          return value;
        }).join(',')
      )
    ].join('\n');
    return csvContent;
  } catch (error) {
    console.error('Error converting to CSV:', error);
    return 'Error generating CSV data';
  }
}

}

module.exports = walletRoutes;