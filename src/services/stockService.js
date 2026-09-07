const dbClient = require('../db/dbClient');

const stockService = {
  getAllProducts() {
    return dbClient.getAllProducts();
  },

  getProductById(id) {
    return dbClient.getProductById(id);
  },

  createProduct(data) {
    return dbClient.createProduct(data);
  },

  updateProduct(id, data) {
    return dbClient.updateProduct(id, data);
  },

  deleteProduct(id) {
    return dbClient.deleteProduct(id);
  },

  getBatchesByProductId(productId) {
    return dbClient.getBatchesByProductId(productId);
  },

  getAllBatches() {
    return dbClient.getAllBatches();
  },

  createBatch(data) {
    return dbClient.createBatch(data);
  },

  updateBatch(id, data) {
    return dbClient.updateBatch(id, data);
  },

  deleteBatch(id) {
    return dbClient.deleteBatch(id);
  },

  recordUsage(data) {
    return dbClient.recordUsage(data);
  },

  getUsageLogs(limit = 100) {
    return dbClient.getUsageLogs(limit);
  },

  getUsageSummary(days = 30) {
    return dbClient.getUsageSummary(days);
  },

  getAlertsData() {
    return dbClient.getAlertsData();
  }
};

module.exports = stockService;
