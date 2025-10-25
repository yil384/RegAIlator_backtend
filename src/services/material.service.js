const httpStatus = require('http-status');
const { Material } = require('../models');
const ApiError = require('../utils/ApiError');
const { subUserRoles } = require('../configs/roles');


const queryBillOfMaterials = async (filter, options) => {
    return Material.paginate(filter, options);
};

const createBillOfMaterial = async (userId, materialBody) => {
    // if (await Material.isMaterialNameTaken(materialBody.materialName)) {
    //     throw new ApiError(httpStatus.BAD_REQUEST, 'Material Name already taken');
    // }
    materialBody.user = userId;
    return Material.create(materialBody);
}

const createBillOfMaterialsBatch = async (userId, materialBody) => {
    for (let i = 0; i < materialBody.length; i++) {
        // if (await Material.isMaterialNameTaken(materialBody[i].materialName)) {
        //     throw new ApiError(httpStatus.BAD_REQUEST, 'Material Name already taken');
        // }
        materialBody[i].user = userId;
    }
    return Material.insertMany(materialBody);
}

const updateBillOfMaterialById = async (userId, materialId, materialBody) => {
    const material = await Material.findById(materialId);
    if (!material) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Material not found');
    }
    if (material.user != userId) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
    }
    Object.assign(material, materialBody);
    await material.save();
    return material;
}

const deleteBillOfMaterialsByIds = async (userId, materialIds) => {
    console.log('materialIds: ', materialIds);
    const materials = await Material.find({ _id: { $in: materialIds } });
    for (let i = 0; i < materials.length; i++) {
        if (materials[i].user != userId) {
            throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
        }
    }
    await Material.deleteMany({ _id: { $in: materialIds } });
    console.log('materials: ', materials);
    return materials;
}

module.exports = {
    queryBillOfMaterials,
    createBillOfMaterial,
    createBillOfMaterialsBatch,
    updateBillOfMaterialById,
    deleteBillOfMaterialsByIds,
};
