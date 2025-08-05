const { Brand, Category } = require("../schemas");
const {
  authenticate,
  requireAdmin,
} = require("../middleware/auth");
const path = require("path");
const fs = require("fs");


async function brandRoutes(fastify, options) {
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
    "/get-brand",
    { preHandler: [authenticate,requireAdmin] },
    async (req, reply) => {
        try {
        const brandId = req.body.brandId;
        const existingBrands = await Brand.find({ brandId });
        if (!existingBrands || existingBrands.length === 0) {
            return reply.status(409).send({ message: `No brands found!` });
        }

        reply.status(200).send(existingBrands);
        } catch (error) {
        reply.status(500).send({ message: "Something went wrong!" });
        console.log("Error while fetching brands: ", error);
        }
    });

    fastify.post(
    "/update-brand",
    { preHandler: [authenticate,requireAdmin] },
    async (req, reply) => {
        try {
        const isMultipart = req.isMultipart();
        let BrandId, otherBrandData = {};
        let fileName, filePath;
        if (isMultipart) {
            const parts = req.parts();
            for await (const part of parts) {
                if (part.type === 'field') {
                    if (part.fieldname === 'brandId') {
                        BrandId = part.value;
                    } else {
                        otherBrandData[part.fieldname] = part.value;
                    }
                } else if (part.type === 'file' && part.fieldname === 'img') {
                    fileName = part.filename;
                    filePath = path.join("public/", fileName);
                    const writableStream = fs.createWriteStream(filePath);
                    await part.file.pipe(writableStream);
                    otherBrandData.img = 'public/' + fileName;
                }
            }
        }else {
            const { brandId , ...brandData } = req.body;
            BrandId = brandId;
            otherBrandData = brandData;
           
        }
         const existingBrands = await Brand.findOneAndUpdate(
                { brandId: BrandId },
                { ...otherBrandData, updatedAt: new Date() },
                { new: true }
            );
        if (!existingBrands || existingBrands.length === 0) {
            return reply.status(409).send({ message: `No brands found!` });
        }
        return reply.status(200).send(existingBrands);
        } catch (error) {
        reply.status(500).send({ message: "Something went wrong!" });
        console.log("Error while fetching brands: ", error);
        }
    });

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
    });
}

module.exports = brandRoutes;