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

    // References a supplier subdocument _id within a User document (not a separate collection)
    supplier: { type: ObjectId, default: null },

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

// Indexes for query performance
materialSchema.index({ user: 1 });
materialSchema.index({ supplier: 1, user: 1 });

/**
 * @typedef Material
 */
const Material = mongoose.model('Material', materialSchema);

module.exports = Material;
