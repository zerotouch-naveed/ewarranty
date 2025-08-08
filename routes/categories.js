const { Category } = require("../schemas");
const {
  authenticate,
  requireAdmin,
} = require("../middleware/auth");
const path = require("path");
const fs = require("fs");
const { request } = require("https");


async function categoriesRoutes(fastify, options) {
    fastify.get(
        "/categories",
        { preHandler: [authenticate] },
        async (req, reply) => {
        try {
            let query = {}
            query.createdAt = "-1";
            if (req.user.userType !== "MAIN_OWNER"){
                query.isActive = true
            }
            const existingCategories = await Category.find(query);
            if (!existingCategories) {
            return reply.status(409).send({ message: `No categories found!` });
            }

            reply.status(200).send(existingCategories);
        } catch (error) {
            reply.status(500).send({ message: "Something went wrong!" });
            console.log("Error while adding category: ", error);
        }
    });

    fastify.post(
    "/add-category",
    { preHandler: [authenticate] },
    async (req, reply) => {
        try {
            const parts = req.parts();
            let categoryName, percentListData, description, fileName, filePath;

            for await (const part of parts) {
                if (part.type === 'field') {
                    if (part.fieldname === 'categoryName') {
                        categoryName = part.value;
                    } else if (part.fieldname === 'percentList') {
                        try {
                            const value = part.value.trim();
                            if (value.startsWith('[') && value.endsWith(']')) {
                                percentListData = parsePercentDurationString(value);
                            } else {
                                percentListData = JSON.parse(value);
                            }
                        } catch (e) {
                            return reply.status(400).send({ 
                                message: "Invalid percentList format. Expected JSON array or format [percent:duration,percent:duration]." 
                            });
                        }
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

            // Validate required fields
            if (!categoryName || !percentListData) {
                return reply
                    .status(400)
                    .send({ 
                        message: "categoryName and either percent or percentList are required fields." 
                    });
            }

            let percentList = [];

            // Handle multiple percent:duration values
            if (percentListData && Array.isArray(percentListData)) {
                percentList = validateAndFormatPercentList(percentListData, reply);
                if (!percentList) return; // Error response already sent
            }

            if (percentList.length === 0) {
                return reply.status(400).send({ 
                    message: "At least one valid percent:duration pair is required." 
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
                percentList,
                img: fileName ? 'public/' + fileName : null,
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
    });

    fastify.post(
    "/get-category",
    { preHandler: [authenticate,requireAdmin] },
    async (req, reply) => {
        try {
        const categoryId = req.body.categoryId;
        console.log(categoryId);
        
        const existingCategory = await Category.find({ categoryId });
        if (!existingCategory || existingCategory.length === 0) {
            return reply.status(409).send({ message: `No Category found!` });
        }

        reply.status(200).send(existingCategory);
        } catch (error) {
        reply.status(500).send({ message: "Something went wrong!" });
        console.log("Error while fetching Category: ", error);
        }
    });

    fastify.post(
    "/update-category",
    { preHandler: [authenticate, requireAdmin] },
    async (req, reply) => {
        try {
            // Check if request is multipart (contains file upload)
            const isMultipart = req.isMultipart();
            
            let categoryId, percentList, otherCategoryData = {};
            let fileName, filePath;

            if (isMultipart) {
                // Handle multipart form data (with file upload)
                const parts = req.parts();
                
                for await (const part of parts) {
                    if (part.type === 'field') {
                        if (part.fieldname === 'categoryId') {
                            categoryId = part.value;
                        } else if (part.fieldname === 'percentList') {
                            percentList = part.value;
                        } else {
                            // Handle other category data fields
                            otherCategoryData[part.fieldname] = part.value;
                        }
                    } else if (part.type === 'file' && part.fieldname === 'img') {
                        fileName = part.filename;
                        filePath = path.join("public/", fileName);
                        const writableStream = fs.createWriteStream(filePath);
                        await part.file.pipe(writableStream);
                    }
                }
            } else {
                // Handle JSON body (no file upload)
                const body = req.body;
                categoryId = body.categoryId;
                percentList = body.percentList;
                const { categoryId: _, percentList: __, ...rest } = body;
                otherCategoryData = rest;
            }
            
            if (!categoryId) {
                return reply.status(400).send({ message: "categoryId is required." });
            }

            let updateData = { ...otherCategoryData, updatedAt: new Date() };

            // Handle image update
            if (fileName) {
                updateData.img = 'public/' + fileName;
            }

            // Handle percentList updates
            if (percentList !== undefined) {
                let newPercentList = [];

                // Handle multiple percent:duration values
                if (percentList) {
                    let parsedPercentList;
                    
                    if (typeof percentList === 'string') {
                        try {
                            const value = percentList.trim();
                            if (value.startsWith('[') && value.endsWith(']')) {
                                // Parse format: [5:12,6.5:24,8:36]
                                parsedPercentList = parsePercentDurationString(value);
                            } else {
                                // Parse as JSON string
                                parsedPercentList = JSON.parse(value);
                            }
                        } catch (e) {
                            return reply.status(400).send({ 
                                message: "Invalid percentList format. Expected JSON array or format [percent:duration,percent:duration]." 
                            });
                        }
                    } else if (Array.isArray(percentList)) {
                        parsedPercentList = percentList;
                    } else {
                        return reply.status(400).send({ 
                            message: "percentList must be an array or a valid string format." 
                        });
                    }

                    newPercentList = validateAndFormatPercentList(parsedPercentList, reply);
                    if (!newPercentList) return; // Error response already sent
                }

                if (newPercentList.length > 0) {
                    updateData.percentList = newPercentList;
                }
            }

            const existingCategory = await Category.findOneAndUpdate(
                { categoryId },
                updateData,
                { new: true, runValidators: true }
            );

            if (!existingCategory) {
                return reply.status(404).send({ message: `No Category found with categoryId: ${categoryId}` });
            }

            reply.status(200).send(existingCategory);
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
            
            console.log("Error while updating Category: ", error);
            reply.status(500).send({ message: "Something went wrong!" });
        }
    });
    
    fastify.post(
    "/add-percent-to-category",
    { preHandler: [authenticate, requireAdmin] },
    async (req, reply) => {
        try {
            const { categoryId, percent, duration, isActive = true } = req.body;
            
            if (!categoryId || percent === undefined || percent === null || duration === undefined || duration === null) {
                return reply.status(400).send({ 
                    message: "categoryId, percent, and duration are required." 
                });
            }

            if (isNaN(percent) || percent < 0 || percent > 100) {
                return reply.status(400).send({ 
                    message: "percent must be a number between 0 and 100." 
                });
            }

            if (isNaN(duration) || duration < 0) {
                return reply.status(400).send({ 
                    message: "duration must be a positive number." 
                });
            }

            const category = await Category.findOneAndUpdate(
                { categoryId },
                { 
                    $push: { 
                        percentList: { percent, duration, isActive } 
                    },
                    updatedAt: new Date()
                },
                { new: true, runValidators: true }
            );

            if (!category) {
                return reply.status(404).send({ message: `No Category found with categoryId: ${categoryId}` });
            }

            reply.status(200).send(category);
        } catch (error) {
            console.log("Error while adding percent to category: ", error);
            reply.status(500).send({ message: "Something went wrong!" });
        }
    });

    fastify.post(
    "/update-percent-in-category",
    { preHandler: [authenticate, requireAdmin] },
    async (req, reply) => {
        try {
            const { categoryId, percentId, percentIndex, percent, duration, isActive } = req.body;
            
            if (!categoryId || (percentId === undefined && percentIndex === undefined) || 
                percent === undefined || duration === undefined) {
                return reply.status(400).send({ 
                    message: "categoryId, (percentId or percentIndex), percent, and duration are required." 
                });
            }

            if (isNaN(percent) || percent < 0 || percent > 100) {
                return reply.status(400).send({ 
                    message: "percent must be a number between 0 and 100." 
                });
            }

            if (isNaN(duration) || duration < 0) {
                return reply.status(400).send({ 
                    message: "duration must be a positive number." 
                });
            }

            let category;

            if (percentId) {
                // Update using _id (preferred method)
                const updateFields = {
                    "percentList.$.percent": percent,
                    "percentList.$.duration": duration,
                    updatedAt: new Date()
                };

                if (isActive !== undefined) {
                    updateFields["percentList.$.isActive"] = isActive;
                }

                category = await Category.findOneAndUpdate(
                    { 
                        categoryId, 
                        "percentList._id": percentId 
                    },
                    { $set: updateFields },
                    { new: true, runValidators: true }
                );

                if (!category) {
                    return reply.status(404).send({ 
                        message: `No Category found with categoryId: ${categoryId} or percentId: ${percentId}` 
                    });
                }
            } else {
                // Update using array index (fallback method)
                const updateFields = {
                    [`percentList.${percentIndex}.percent`]: percent,
                    [`percentList.${percentIndex}.duration`]: duration,
                    updatedAt: new Date()
                };

                if (isActive !== undefined) {
                    updateFields[`percentList.${percentIndex}.isActive`] = isActive;
                }

                category = await Category.findOneAndUpdate(
                    { categoryId },
                    { $set: updateFields },
                    { new: true, runValidators: true }
                );

                if (!category) {
                    return reply.status(404).send({ 
                        message: `No Category found with categoryId: ${categoryId}` 
                    });
                }
            }

            reply.status(200).send(category);
        } catch (error) {
            console.log("Error while updating percent in category: ", error);
            reply.status(500).send({ message: "Something went wrong!" });
        }
    });

    fastify.post(
    "/delete-percent-from-category",
    { preHandler: [authenticate, requireAdmin] },
    async (req, reply) => {
        try {
            const { categoryId, percentId, percentIndex } = req.body;
            
            if (!categoryId || (percentId === undefined && percentIndex === undefined)) {
                return reply.status(400).send({ 
                    message: "categoryId and (percentId or percentIndex) are required." 
                });
            }

            let category;

            if (percentId) {
                // Delete using _id (preferred method)
                category = await Category.findOneAndUpdate(
                    { categoryId },
                    { 
                        $pull: { percentList: { _id: percentId } },
                        updatedAt: new Date()
                    },
                    { new: true, runValidators: true }
                );

                if (!category) {
                    return reply.status(404).send({ 
                        message: `No Category found with categoryId: ${categoryId}` 
                    });
                }
            } else {
                // Delete using array index (fallback method)
                // First get the category to find the element to remove
                const existingCategory = await Category.findOne({ categoryId });
                
                if (!existingCategory) {
                    return reply.status(404).send({ 
                        message: `No Category found with categoryId: ${categoryId}` 
                    });
                }

                if (!existingCategory.percentList[percentIndex]) {
                    return reply.status(404).send({ 
                        message: `No percent found at index: ${percentIndex}` 
                    });
                }

                // Remove the element at the specified index
                existingCategory.percentList.splice(percentIndex, 1);
                existingCategory.updatedAt = new Date();
                
                category = await existingCategory.save();
            }

            reply.status(200).send(category);
        } catch (error) {
            console.log("Error while deleting percent from category: ", error);
            reply.status(500).send({ message: "Something went wrong!" });
        }
    });

    fastify.post(
    "/toggle-percent-status",
    { preHandler: [authenticate, requireAdmin] },
    async (req, reply) => {
        try {
            const { categoryId, percentId, percentIndex } = req.body;
            
            if (!categoryId || (percentId === undefined && percentIndex === undefined)) {
                return reply.status(400).send({ 
                    message: "categoryId and (percentId or percentIndex) are required." 
                });
            }

            let category;

            if (percentId) {
                // First get the current status
                const existingCategory = await Category.findOne({
                    categoryId,
                    "percentList._id": percentId
                });

                if (!existingCategory) {
                    return reply.status(404).send({ 
                        message: `No Category found with categoryId: ${categoryId} or percentId: ${percentId}` 
                    });
                }

                const percentItem = existingCategory.percentList.id(percentId);
                const newStatus = !percentItem.isActive;

                category = await Category.findOneAndUpdate(
                    { 
                        categoryId, 
                        "percentList._id": percentId 
                    },
                    { 
                        $set: { 
                            "percentList.$.isActive": newStatus,
                            updatedAt: new Date()
                        }
                    },
                    { new: true, runValidators: true }
                );
            } else {
                // Toggle using array index
                const existingCategory = await Category.findOne({ categoryId });
                
                if (!existingCategory || !existingCategory.percentList[percentIndex]) {
                    return reply.status(404).send({ 
                        message: `No Category or percent found.` 
                    });
                }

                const currentStatus = existingCategory.percentList[percentIndex].isActive;
                
                category = await Category.findOneAndUpdate(
                    { categoryId },
                    { 
                        $set: { 
                            [`percentList.${percentIndex}.isActive`]: !currentStatus,
                            updatedAt: new Date()
                        }
                    },
                    { new: true, runValidators: true }
                );
            }

            reply.status(200).send(category);
        } catch (error) {
            console.log("Error while toggling percent status: ", error);
            reply.status(500).send({ message: "Something went wrong!" });
        }
    });
}

function validateAndFormatPercentList(percentListData, reply) {
    const percentList = [];
    
    for (let i = 0; i < percentListData.length; i++) {
        const item = percentListData[i];
        
        if (typeof item === 'object' && item.percent !== undefined && item.duration !== undefined) {
            // Object with percent and duration properties
            if (isNaN(item.percent) || item.percent < 0 || item.percent > 100) {
                reply.status(400).send({ 
                    message: `percent at index ${i} must be a number between 0 and 100.` 
                });
                return null;
            }
            
            if (isNaN(item.duration) || item.duration < 0) {
                reply.status(400).send({ 
                    message: `duration at index ${i} must be a positive number.` 
                });
                return null;
            }
            
            percentList.push({
                percent: item.percent,
                duration: item.duration,
                isActive: item.isActive !== undefined ? item.isActive : true
            });
        } else {
            reply.status(400).send({ 
                message: `Invalid data at index ${i}. Expected object with percent and duration properties.` 
            });
            return null;
        }
    }
    
    return percentList;
}

function parsePercentDurationString(str) {
    // Remove brackets and split by comma
    const cleanStr = str.replace(/^\[|\]$/g, '');
    const pairs = cleanStr.split(',');
    
    return pairs.map((pair, index) => {
        const trimmedPair = pair.trim();
        const [percentStr, durationStr] = trimmedPair.split(':');
        
        if (!percentStr || !durationStr) {
            throw new Error(`Invalid format at index ${index}. Expected format: percent:duration`);
        }
        
        const percent = parseFloat(percentStr.trim());
        const duration = parseFloat(durationStr.trim());
        
        if (isNaN(percent) || isNaN(duration)) {
            throw new Error(`Invalid numbers at index ${index}. Both percent and duration must be valid numbers.`);
        }
        
        return {
            percent,
            duration,
            isActive: true
        };
    });
}

module.exports = categoriesRoutes;