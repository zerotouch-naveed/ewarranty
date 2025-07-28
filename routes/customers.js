const { Customer, Category } = require("../schemas");
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
    { preHandler: [authenticate, requireAdmin] },
    async (req, reply) => {
      try {
        const { categoryName } = req.body;

        const existingCategory = await Category.findOne({ categoryName });
        if (existingCategory) {
          return reply
            .status(409)
            .send({ message: `Category "${categoryName}" already exists.` });
        }

        const newCategory = new Category({ categoryName });
        await newCategory.save();

        reply.status(201).send(newCategory);
      } catch (error) {
        reply.status(500).send({ message: "Something went wrong!" });
        console.log("Error while adding category: ", error);
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

      console.log("filters    ", filters);

      const { customers, totalData, currentPage, totalPages, companyList } =
        await CustomerService.getAccessibleCustomers(
          request.user.userId,
          request.user.companyId,
          request.user.userType,
          filters,
          page,
          limit,
          search,
          sortBy,
          sortOrder
        );

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
