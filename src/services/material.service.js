/**
 * @module services/material
 * @description Service layer for Bill of Materials (BOM) management.
 *
 * Unlike suppliers and surveys (which are embedded in the User document),
 * materials are stored in their own collection. This is because materials
 * represent shared product/part data that may be queried independently of
 * any single user, and the dataset can grow much larger than the subdocument
 * arrays. Each Material document references its owning user via the `user`
 * field, and all write operations verify ownership to prevent cross-user edits.
 */
const httpStatus = require('http-status');
const { Material } = require('../models');
const ApiError = require('../utils/ApiError');
const { subUserRoles } = require('../configs/roles');


/**
 * Query bill of materials records with Mongo filter and pagination options.
 * Typically filtered by `user` to scope results to the authenticated user.
 * @param {Object} filter - Mongo filter (e.g., { user: userId, supplier: supplierId })
 * @param {Object} options - Pagination options (sortBy, limit, page)
 * @returns {Promise<QueryResult>} Paginated result set
 */
const queryBillOfMaterials = async (filter, options) => {
    return Material.paginate(filter, options);
};

/**
 * Create a single bill of material record, stamping it with the owning user's ID.
 * @param {ObjectId} userId - The authenticated user's ID (set as `material.user`)
 * @param {Object} materialBody - Material fields (productName, productPartNumber, etc.)
 * @returns {Promise<Material>} The created Material document
 */
const createBillOfMaterial = async (userId, materialBody) => {
    // if (await Material.isMaterialNameTaken(materialBody.materialName)) {
    //     throw new ApiError(httpStatus.BAD_REQUEST, 'Material Name already taken');
    // }
    materialBody.user = userId;
    return Material.create(materialBody);
}

/**
 * Create multiple bill of material records in a single `insertMany` call.
 * Each entry is stamped with the owning user's ID before insertion.
 * @param {ObjectId} userId - The authenticated user's ID
 * @param {Object[]} materialBody - Array of material field objects
 * @returns {Promise<Material[]>} Array of created Material documents
 */
const createBillOfMaterialsBatch = async (userId, materialBody) => {
    for (let i = 0; i < materialBody.length; i++) {
        // if (await Material.isMaterialNameTaken(materialBody[i].materialName)) {
        //     throw new ApiError(httpStatus.BAD_REQUEST, 'Material Name already taken');
        // }
        materialBody[i].user = userId;
    }
    return Material.insertMany(materialBody);
}

/**
 * Update a bill of material record by its document ID.
 * Verifies that the requesting user owns the record before allowing the update.
 * @param {ObjectId} userId - The authenticated user's ID (for ownership check)
 * @param {ObjectId} materialId - The Material document's _id
 * @param {Object} materialBody - Fields to update
 * @returns {Promise<Material>} The updated Material document
 * @throws {ApiError} 404 if not found, 403 if user does not own the record
 */
const updateBillOfMaterialById = async (userId, materialId, materialBody) => {
    const material = await Material.findById(materialId);
    if (!material) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Material not found');
    }
    if (material.user.toString() !== userId.toString()) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
    }
    Object.assign(material, materialBody);
    await material.save();
    return material;
}

/**
 * Delete multiple bill of material records by their document IDs.
 * Verifies ownership of every record before deleting any -- if any record
 * belongs to a different user, the entire operation is rejected (fail-fast).
 * @param {ObjectId} userId - The authenticated user's ID (for ownership check)
 * @param {ObjectId[]} materialIds - Array of Material document _id values
 * @returns {Promise<Material[]>} The deleted Material documents
 * @throws {ApiError} 403 if user does not own any of the records
 */
const deleteBillOfMaterialsByIds = async (userId, materialIds) => {
    const materials = await Material.find({ _id: { $in: materialIds } });
    for (let i = 0; i < materials.length; i++) {
        if (materials[i].user.toString() !== userId.toString()) {
            throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
        }
    }
    await Material.deleteMany({ _id: { $in: materialIds } });
    return materials;
}

module.exports = {
    queryBillOfMaterials,
    createBillOfMaterial,
    createBillOfMaterialsBatch,
    updateBillOfMaterialById,
    deleteBillOfMaterialsByIds,
};
