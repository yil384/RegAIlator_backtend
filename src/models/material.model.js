const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');
const constants = require('../configs/constants');

const { ObjectId } = mongoose.SchemaTypes;

const materialSchema = mongoose.Schema(
  {
    // Material name
    productName: { type: String, required: true },

    // Material part number
    // productPartNumber: { type: String, required: true, unique: true },
    productPartNumber: { type: String, required: true },

    // Factory name
    facility: { type: String, default: '' },

    // Raw material name
    rawMaterialName: { type: String, default: '' },

    // Raw material part number
    rawMaterialPartNumber: { type: String, default: '' },

    // Function description
    function: { type: String, default: '' },

    // Supplier
    supplier: { type: ObjectId, ref: 'Supplier', default: null },

    // Owning user
    user: { type: ObjectId, ref: 'User', required: true },

    // Additional properties in JSON format (e.g., technical documents, supply chain related, etc.)
    json: { type: Object, default: {} },

    createdAt: { type: Date, default: Date.now }, // Record creation time
    updatedAt: { type: Date }, // Record update time
  },
  {    
    _id: true, // Use the default _id field
    timestamps: true, // Automatically generate created and updated timestamps
  }
);

// Add plugin: convert Mongoose model to JSON
materialSchema.plugin(toJSON);

// Add pagination plugin
materialSchema.plugin(paginate);

// /**
//  * Check if the material part number already exists
//  * @param productPartNumber Material part number
//  * @param {ObjectId} [excludeMaterialId] - Exclude a specific material's ID (used for edit scenarios)
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
