const { Customer, Category, Brand } = require("../schemas");
const {
  authenticate,
  requireRetailer,
  requireAdmin,
} = require("../middleware/auth");
const { CustomerService } = require("../services");
const { catchAsync } = require("../middleware/errorHandler");
const path = require("path");
const fs = require("fs");

async function customerRoutes(fastify, options) {
  // Create Customer (Retailers only)
  fastify.post(
    "/create",
    {
      preHandler: [authenticate, requireRetailer],
      schema: {
        description: "Create a new customer warranty",
        tags: ["Customers"],
        security: [{ Bearer: [] }],
        body: {
          type: "object",
          required: [
            "customerDetails",
            "productDetails",
            "invoiceDetails",
            "productImages",
            "warrantyDetails",
          ],
          properties: {
            customerDetails: {
              type: "object",
              required: ["name", "mobile"],
              properties: {
                name: { type: "string" },
                email: { type: "string", format: "email" },
                mobile: { type: "string" },
                alternateNumber: { type: "string" },
                address: {
                  type: "object",
                  properties: {
                    street: { type: "string" },
                    city: { type: "string" },
                    state: { type: "string" },
                    country: { type: "string" },
                    zipCode: { type: "string" },
                  },
                },
              },
            },
            productDetails: {
              type: "object",
              required: ["serialNumber"],
              properties: {
                modelName: { type: "string" },
                serialNumber: { type: "string" },
                imei2: { type: "string" },
                brand: { type: "string" },
                category: { type: "string" },
                purchasePrice: { type: "number" },
              },
            },
            invoiceDetails: {
              type: "object",
              required: ["invoiceNumber", "invoiceImage", "invoiceDate"],
              properties: {
                invoiceNumber: { type: "string" },
                invoiceAmount: { type: "number" },
                invoiceImage: { type: "string", format: "uri" },
                invoiceDate: { type: "string", format: "date" },
              },
            },
            productImages: {
              type: "object",
              required: ["frontImage", "backImage"],
              properties: {
                frontImage: { type: "string", format: "uri" },
                backImage: { type: "string", format: "uri" },
                additionalImages: {
                  type: "array",
                  items: { type: "string", format: "uri" },
                },
              },
            },
            warrantyDetails: {
              type: "object",
              required: ["warrantyPeriod", "premiumAmount"],
              properties: {
                planId: { type: "string" },
                planName: { type: "string" },
                warrantyPeriod: { type: "number" },
                premiumAmount: { type: "number" },
              },
            },
          },
        },
      },
    },
    catchAsync(async (request, reply) => {
      const customer = await CustomerService.createCustomer(
        request.body,
        request.user.userId,
        request.user.companyId
      );

      return reply.code(201).send({
        success: true,
        message: "Customer created successfully",
        data: { customer },
      });
    })
  );

  fastify.post(
    "/handle-file",
    { preHandler: [authenticate, requireRetailer] },
    async (req, reply) => {
      try {
        const parts = req.parts();
        let data = {};
        let fileName;
        let filePath;

        for await (const part of parts) {
          if (part.type === "field") {
            data[part.fieldname] = part.value;
          } else if (part.type === "file") {
            fileName = part.filename;
            filePath = path.join("public/", fileName);
            const writableStream = fs.createWriteStream(filePath);
            await part.file.pipe(writableStream);
          }
        }

        const mode = data.mode;
        const deleteFileUrl = data.deleteFile;

        if (mode === "delete") {
          if (deleteFileUrl) {
            const fileToDelete = path.join(
              "public/",
              path.basename(deleteFileUrl)
            );
            if (fs.existsSync(fileToDelete)) {
              fs.unlinkSync(fileToDelete);
            }
          }
          return reply.send({ message: "deleted" });
        }

        if (mode === "upload") {
          const uploadedUrl = `public/${fileName}`;
          return reply.send({ message: uploadedUrl });
        }

        return reply.status(400).send({ error: "Invalid mode" });
      } catch (error) {
        console.error(error);
        reply.status(500).send({ error: "Internal Server Error" });
      }
    }
  );

  fastify.get(
    "/categories",
    { preHandler: [authenticate] },
    async (req, reply) => {
      try {
        const existingCategories = await Category.find({ isActive: true });
        if (!existingCategories) {
          return reply.status(409).send({ message: `No categories found!` });
        }

        reply.status(200).send(existingCategories);
      } catch (error) {
        reply.status(500).send({ message: "Something went wrong!" });
        console.log("Error while adding category: ", error);
      }
    }
  );

  fastify.post(
  "/add-category",
  { preHandler: [authenticate] },
  async (req, reply) => {
    try {
      const parts = req.parts();
      let categoryName, percent, description, imgFile, fileName, filePath;

      for await (const part of parts) {
        if (part.type === 'field') {
          if (part.fieldname === 'categoryName') {
            categoryName = part.value;
          } else if (part.fieldname === 'percent') {
            percent = parseFloat(part.value);
          } else if (part.fieldname === 'description') {
            description = part.value;
          }
        } else if (part.type === 'file' && part.fieldname === 'img') {
            fileName = part.filename;
            filePath = path.join("public/", fileName);
            const writableStream = fs.createWriteStream(filePath);
            await part.file.pipe(writableStream);
        }
      }

      if (!categoryName || percent === undefined || percent === null) {
        return reply
          .status(400)
          .send({ 
            message: "categoryName and percent are required fields." 
          });
      }

      if (isNaN(percent) || percent < 0 || percent > 100) {
        return reply
          .status(400)
          .send({ 
            message: "percent must be a number between 0 and 100." 
          });
      }

      const existingCategoryByName = await Category.findOne({ categoryName });
      if (existingCategoryByName) {
        return reply
          .status(409)
          .send({ message: `Category with name "${categoryName}" already exists.` });
      }

      const categoryId = `CATE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const newCategory = new Category({ 
        categoryName,
        categoryId,
        percent,
        img: 'public/' + fileName,
        description: description || null
      });

      await newCategory.save();

      return reply.status(201).send(newCategory);
    } catch (error) {
      // Handle mongoose validation errors
      if (error.name === 'ValidationError') {
        return reply
          .status(400)
          .send({ 
            message: "Validation error", 
            details: Object.values(error.errors).map(err => err.message)
          });
      }
      
      // Handle mongoose duplicate key errors
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return reply
          .status(409)
          .send({ 
            message: `Category with this ${field} already exists.` 
          });
      }
      console.log("Error while adding category: ", error);
      return reply.status(500).send({ message: "Something went wrong!" });
    }
  }
);

// GET route - List all active brands
fastify.get(
  "/all-brands",
  { preHandler: [authenticate,requireAdmin] },
  async (req, reply) => {
    try {
      const existingBrands = await Brand.find({ isActive: true });
      if (!existingBrands || existingBrands.length === 0) {
        return reply.status(409).send({ message: `No brands found!` });
      }

      reply.status(200).send(existingBrands);
    } catch (error) {
      reply.status(500).send({ message: "Something went wrong!" });
      console.log("Error while fetching brands: ", error);
    }
  }
);


fastify.post(
  "/brands",
  { preHandler: [authenticate] },
  async (req, reply) => {
    try {
      const categoryId = req.body.categoryId;
      if (!categoryId) {
        return reply
          .status(400)
          .send({ 
            message: "categoryId is a required field." 
          });
      }

      const existingBrands = await Brand.find({ isActive: true, "categoryIds.categoryId": { $in: [categoryId] } });
      if (!existingBrands || existingBrands.length === 0) {
        return reply.status(409).send({ message: `No brands found!` });
      }

      reply.status(200).send(existingBrands);
    } catch (error) {
      reply.status(500).send({ message: "Something went wrong!" });
      console.log("Error while fetching brands: ", error);
    }
  }
);

fastify.post(
  "/add-brand",
  { preHandler: [authenticate] },
  async (req, reply) => {
    try {
      const parts = req.parts();
      let brandName, categoryIds, imgFile, fileName, filePath;

      for await (const part of parts) {
        if (part.type === 'field') {
          if (part.fieldname === 'brandName') {
            brandName = part.value;
          } else if (part.fieldname === 'categoryIds') {
            // Parse categoryIds as JSON string array of IDs
            try {
              categoryIds = JSON.parse(part.value);
              console.log("Parsed categoryIds:", categoryIds);
              
            } catch (parseError) {
              return reply
                .status(400)
                .send({ 
                  message: "categoryIds must be a valid JSON array." 
                });
            }
          }
        } else if (part.type === 'file' && part.fieldname === 'img') {
          fileName = part.filename;
          filePath = path.join("public/", fileName);
          const writableStream = fs.createWriteStream(filePath);
          await part.file.pipe(writableStream);
        }
      }

      // Validate required fields
      if (!brandName) {
        return reply
          .status(400)
          .send({ 
            message: "brandName is a required field." 
          });
      }

      // Validate categoryIds format if provided
      if (categoryIds && !Array.isArray(categoryIds)) {
        return reply
          .status(400)
          .send({ 
            message: "categoryIds must be an array of category IDs." 
          });
      }

      // Process categoryIds - fetch category details and build the array
      let processedCategoryIds = [];
      if (categoryIds && categoryIds.length > 0) {
        for (const categoryId of categoryIds) {
          if (typeof categoryId !== 'string') {
            return reply
              .status(400)
              .send({ 
                message: "Each categoryId must be a string." 
              });
          }
          
          // Fetch the category details
          const existingCategory = await Category.findOne({ 
            categoryId: categoryId,
            isActive: true 
          });
          if (!existingCategory) {
            return reply
              .status(400)
              .send({ 
                message: `Category with ID "${categoryId}" not found.` 
              });
          }
          
          // Add to processed array with both ID and name
          processedCategoryIds.push({
            categoryId: categoryId,
            categoryName: existingCategory.categoryName
          });
        }
      }

      // Check if brand with same name already exists
      const existingBrandByName = await Brand.findOne({ brandName });
      if (existingBrandByName) {
        return reply
          .status(409)
          .send({ message: `Brand with name "${brandName}" already exists.` });
      }

      // Generate unique brandId
      const brandId = `BRAND_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create new brand object
      const newBrand = new Brand({ 
        brandName,
        brandId,
        categoryIds: processedCategoryIds,
        img: fileName ? 'public/' + fileName : null
      });

      await newBrand.save();

      return reply.status(201).send(newBrand);
    } catch (error) {
      // Handle mongoose validation errors
      if (error.name === 'ValidationError') {
        return reply
          .status(400)
          .send({ 
            message: "Validation error", 
            details: Object.values(error.errors).map(err => err.message)
          });
      }
      
      // Handle mongoose duplicate key errors
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return reply
          .status(409)
          .send({ 
            message: `Brand with this ${field} already exists.` 
          });
      }
      
      console.log("Error while adding brand: ", error);
      return reply.status(500).send({ message: "Something went wrong!" });
    }
  }
);

  // Get Customers (based on hierarchy)
  fastify.post(
    "/all",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get customers based on hierarchy",
        tags: ["Customers"],
        security: [{ Bearer: [] }],
        body: {
          type: "object",
          required: [],
          properties: {
            search: { type: "string" },
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, default: 10 },
            status: {
              type: "string",
              enum: ["true", "false"],
              default: "true",
            },
            startDate: { type: "string", format: "date" },
            endDate: { type: "string", format: "date" },
            companyId: { type: "string" },
            sortBy: {
              type: "string",
              enum: ["createdDate", "premiumAmount"],
              default: "createdDate",
            },
            sortOrder: {
              type: "string",
              enum: ["asc", "desc"],
              default: "desc",
            },
            isCsv: { type: "boolean", default: false },
          },
        },
      },
    },
    catchAsync(async (request, reply) => {
      const {
        status,
        startDate,
        endDate,
        page = 1,
        limit = 1,
        search = "",
        sortBy = "createdDate",
        sortOrder = "desc",
        companyId = "ALL",
        isCsv = false
      } = request.body;

      const filters = {};
      if (status) filters.isActive = status;
      if (
        request.user.userType === "MAIN_OWNER" &&
        companyId !== "ALL" &&
        companyId !== ""
      )
        filters.companyId = companyId;
      if (startDate && endDate) {
        filters["dates.createdDate"] = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      const csvLimit = isCsv ? 10000 : limit; // Adjust as needed
      const csvPage = isCsv ? 1 : page;

      const { customers, totalData, currentPage, totalPages, companyList } =
        await CustomerService.getAccessibleCustomers(
          request.user.userId,
          request.user.companyId,
          request.user.userType,
          filters,
          csvPage,
          csvLimit,
          search,
          sortBy,
          sortOrder
        );

      if (isCsv) {
          if (!customers || customers.length === 0) {
            return reply.code(404).send({
              success: false,
              message: 'No customers found for CSV export'
            });
          }

          const csvOutput = jsonToCsv(customers);
          
          // Generate filename with timestamp and filters
          const timestamp = new Date().toISOString().split('T')[0];
          const filename = `customers__${timestamp}.csv`;
          
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
          customers,
          companyList,
          pagination: {
            currentPage,
            totalPages,
            totalData,
            limit,
          },
        },
      });
    })
  );

  function jsonToCsv(jsonArray) {
  if (!jsonArray || jsonArray.length === 0) {
    return 'No data available';
  }
  
  try {
    // Flatten nested objects for CSV export
    const flattenedData = jsonArray.map(customer => ({
      warrantyKey: customer.warrantyKey || '',
      customerId: customer.customerId || '',
      companyId: customer.companyId || '',
      name: customer.customerDetails.address.city || '',
      city: customer.customerDetails.mobile || '',
      state: customer.customerDetails.address.state || '',
      productName: customer.productDetails.modelName || '',
      productCategory: customer.productDetails.category || '',
      premiumAmount: customer.warrantyDetails.premiumAmount || 0,
      warrantyPeriod: customer.warrantyDetails.warrantyPeriod || 0,
      createdAt: customer.dates.createdDate ? new Date(customer.dates.createdDate).toLocaleDateString() : '',
      status: customer.status == 1 ? 'Active' : 'Inactive',
      notes: customer.notes || ''
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

  // Get Customer Details
  fastify.post(
    "/get",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get customer details",
        tags: ["Customers"],
        security: [{ Bearer: [] }],
        body: {
          type: "object",
          required: ["customerId"],
          properties: {
            customerId: { type: "string" },
          },
        },
      },
    },
    catchAsync(async (request, reply) => {
      const canAccess = await CustomerService.canAccessCustomer(
        request.user.userId,
        request.body.customerId
      );

      if (!canAccess) {
        return reply.code(403).send({
          success: false,
          error: "No permission to view this customer",
        });
      }
      const customer = await Customer.findOne({
        customerId: request.body.customerId,
      });
      if (!customer) {
        return reply.code(404).send({
          success: false,
          error: "Customer not found",
        });
      }

      return reply.send({
        success: true,
        data: { customer },
      });
    })
  );
}

module.exports = customerRoutes;
