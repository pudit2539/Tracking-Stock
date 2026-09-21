const dbClient = require('../src/db/dbClient');
const stockService = require('../src/services/stockService');

async function testBulk() {
  console.log('Testing Bulk Actions...');
  
  // 1. Get all products
  const products = await stockService.getAllProducts();
  if (products.length < 2) {
    console.error('Not enough products to test bulk action');
    process.exit(1);
  }

  const testIds = [products[0].id, products[1].id];
  console.log('Testing with products:', products[0].name, 'and', products[1].name, 'IDs:', testIds);

  // Test 1: Bulk Add Stock (+10)
  const addRes = await stockService.bulkAddStock(testIds, 10, '2026-12-31', 'ทดสอบ Bulk Add', 'TestRunner');
  console.log('Bulk Add Stock Result:', addRes);
  if (addRes.length !== 2 || !addRes[0].success || !addRes[1].success) {
    throw new Error('Bulk Add Stock failed!');
  }

  // Test 2: Bulk Set Safety Stock
  const safetyRes = await stockService.bulkSetSafetyStock(testIds, 3);
  console.log('Bulk Set Safety Stock Result:', safetyRes);
  if (safetyRes.length !== 2 || !safetyRes[0].success) {
    throw new Error('Bulk Set Safety Stock failed!');
  }

  // Test 3: Bulk Set Expiry Date
  const expRes = await stockService.bulkSetExpiryDate(testIds, '2026-11-15');
  console.log('Bulk Set Expiry Date Result:', expRes);
  if (expRes.length !== 2 || !expRes[0].success) {
    throw new Error('Bulk Set Expiry Date failed!');
  }

  console.log('✅ All Bulk Action DB & Service tests passed successfully!');
}

testBulk().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

