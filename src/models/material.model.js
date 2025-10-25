const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');
const constants = require('../configs/constants');

const { ObjectId } = mongoose.SchemaTypes;

const materialSchema = mongoose.Schema(
  {
    // 物料名称
    productName: { type: String, required: true },

    // 物料编号
    // productPartNumber: { type: String, required: true, unique: true },
    productPartNumber: { type: String, required: true },

    // 工厂名称
    facility: { type: String, default: '' },

    // 原材料名称
    rawMaterialName: { type: String, default: '' },

    // 原材料编号
    rawMaterialPartNumber: { type: String, default: '' },

    // 功能说明
    function: { type: String, default: '' },

    // 供应商
    supplier: { type: ObjectId, ref: 'Supplier', default: null },

    // 所属的用户
    user: { type: ObjectId, ref: 'User', required: true },

    // JSON 格式的额外属性（例如，技术文档、供应链相关等）
    json: { type: Object, default: {} },

    createdAt: { type: Date, default: Date.now }, // 调查的创建时间
    updatedAt: { type: Date }, // 调查的更新时间
  },
  {    
    _id: true, // 使用默认的 _id 字段
    timestamps: true, // 自动生成创建和更新时间
  }
);

// 添加插件：将Mongoose模型转换为JSON
materialSchema.plugin(toJSON);

// 添加分页插件
materialSchema.plugin(paginate);

// /**
//  * 检查物料编号是否已存在
//  * @param productPartNumber 物料编号
//  * @param {ObjectId} [excludeMaterialId] - 排除某个物料的ID（用于编辑场景）
//  * @returns {Promise<boolean>}
//  */
// materialSchema.statics.isPartNumberTaken = async function (productPartNumber, excludeMaterialId) {
//   const material = await this.findOne({ productPartNumber, _id: { $ne: excludeMaterialId } });
//   return !!material;
// };

/**
 * @typedef Material
 */
const Material = mongoose.model('Material', materialSchema);

module.exports = Material;
