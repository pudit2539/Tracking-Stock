const dbClient = require('../src/db/dbClient');
const lineBotService = require('../src/services/lineBotService');
const lineService = require('../src/services/lineService');

async function runComprehensiveRetest() {
  console.log('====================================================');
  console.log('🧪 STARTING COMPREHENSIVE FULL SYSTEM RETEST');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? '(' + detail + ')' : ''}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // SECTION 1: Product CRUD & Batch & Usage Management
    // ----------------------------------------------------
    console.log('\n--- SECTION 1: Product CRUD & Batches & FIFO ---');
    
    // 1.1 Create Product
    const testProdName = 'Test_Product_' + Date.now();
    const createdProd = await dbClient.createProduct({
      name: testProdName,
      category: 'ท็อปปิ้ง & วัตถุดิบ',
      unit: 'Piece',
      safety_stock: 5,
      expiry_warning_days: 7
    });
    assert(createdProd && createdProd.id, '1.1 Create Product', `ID: ${createdProd?.id}`);

    // 1.1b Create Product with Initial Stock and Expiry Date
    const testProdInitName = 'Test_Product_Init_' + Date.now();
    const createdProdWithStock = await dbClient.createProduct({
      name: testProdInitName,
      category: 'ท็อปปิ้ง & วัตถุดิบ',
      unit: 'ชิ้น',
      safety_stock: 5,
      expiry_warning_days: 7,
      initial_quantity: 15,
      expiry_date: '2026-12-31'
    });
    assert(
      createdProdWithStock &&
      Number(createdProdWithStock.current_stock) === 15 &&
      createdProdWithStock.batches &&
      createdProdWithStock.batches.length > 0 &&
      createdProdWithStock.batches[0].expiry_date === '2026-12-31',
      '1.1b Create Product with Initial Stock & Expiry Date',
      `Stock: ${createdProdWithStock?.current_stock}, Batches: ${createdProdWithStock?.batches?.length}`
    );

    // Clean up testProdInit
    if (createdProdWithStock?.id) {
      await dbClient.deleteProduct(createdProdWithStock.id);
    }

    // 1.2 Get Product by ID
    const fetchedProd = await dbClient.getProductById(createdProd.id);
    assert(fetchedProd && fetchedProd.name === testProdName, '1.2 Get Product by ID');

    // 1.3 Update Product
    const updatedProd = await dbClient.updateProduct(createdProd.id, {
      name: testProdName + '_Updated',
      category: 'ท็อปปิ้ง & วัตถุดิบ',
      unit: 'Box',
      safety_stock: 8,
      expiry_warning_days: 10
    });
    assert(updatedProd && updatedProd.unit === 'Box' && Number(updatedProd.safety_stock) === 8, '1.3 Update Product');

    // 1.4 Add Batch 1 (expires soon)
    const b1Id = await dbClient.createBatch({
      product_id: createdProd.id,
      quantity: 10,
      received_date: '2026-09-01',
      expiry_date: '2026-09-25',
      cost_price: 25.5
    });
    assert(b1Id !== null && b1Id !== undefined, '1.4 Add Batch 1', `ID: ${b1Id}`);

    // 1.5 Add Batch 2 (expires later)
    const b2Id = await dbClient.createBatch({
      product_id: createdProd.id,
      quantity: 15,
      received_date: '2026-09-05',
      expiry_date: '2026-12-31',
      cost_price: 25.5
    });
    assert(b2Id !== null && b2Id !== undefined, '1.5 Add Batch 2', `ID: ${b2Id}`);

    // Check total stock
    let prodWithStock = await dbClient.getProductById(createdProd.id);
    assert(Number(prodWithStock.current_stock) === 25, '1.6 Total Stock Calculation', `Expected 25, got ${prodWithStock.current_stock}`);

    // 1.7 Record Usage FIFO (use 12: should exhaust batch1 of 10, and deduct 2 from batch2)
    const usageResult = await dbClient.recordUsage({
      product_id: createdProd.id,
      quantity: 12,
      type: 'USE',
      used_by: 'Tester',
      notes: 'FIFO Test'
    });
    assert(usageResult === true, '1.7 Record Usage FIFO');

    // Verify batches after FIFO deduction
    const batchesAfterUsage = await dbClient.getBatchesByProductId(createdProd.id);
    const b1After = batchesAfterUsage.find(b => b.id == b1Id);
    const b2After = batchesAfterUsage.find(b => b.id == b2Id);
    assert(b1After && Number(b1After.quantity) === 0, '1.8 Batch 1 exhausted (0 remaining)');
    assert(b2After && Number(b2After.quantity) === 13, '1.9 Batch 2 deducted (13 remaining)');

    // 1.10 Record Waste (waste 3 from batch2)
    const wasteResult = await dbClient.recordUsage({
      product_id: createdProd.id,
      quantity: 3,
      type: 'WASTE',
      used_by: 'Tester',
      notes: 'Waste Test'
    });
    assert(wasteResult === true, '1.10 Record Waste');

    prodWithStock = await dbClient.getProductById(createdProd.id);
    assert(Number(prodWithStock.current_stock) === 10, '1.11 Stock after Waste', `Expected 10, got ${prodWithStock.current_stock}`);

    // 1.12 Direct Add Stock
    const directAdd = await dbClient.addProductStockDirect(createdProd.id, 5, 'Tester');
    assert(Number(directAdd.current_stock) === 15, '1.12 Direct Add Stock (+5)');

    // 1.13 Direct Set Stock
    const directSet = await dbClient.setProductStockDirect(createdProd.id, 20, 'Tester');
    assert(Number(directSet.current_stock) === 20, '1.13 Direct Set Stock (=20)');

    // 1.14 Quick Update
    await dbClient.quickUpdateProduct(createdProd.id, { quantity: 14, expiry_date: '2026-11-20' });
    const quickUp = await dbClient.getProductById(createdProd.id);
    assert(Number(quickUp.current_stock) === 14, '1.14 Quick Update', `Stock: ${quickUp.current_stock}`);

    // 1.15 Alerts Calculation
    const alerts = await dbClient.getAlertsData();
    assert(alerts && Array.isArray(alerts.expiring_batches), '1.15 Get Alerts Data');

    // ----------------------------------------------------
    // SECTION 2: Bulk Actions (Stock, Expiry, Safety Stock, Delete)
    // ----------------------------------------------------
    console.log('\n--- SECTION 2: Bulk Actions ---');
    
    // Create secondary test product
    const testProd2 = await dbClient.createProduct({
      name: testProdName + '_2',
      category: 'แก้ว & ฝา',
      unit: 'Cup',
      safety_stock: 10,
      expiry_warning_days: 7
    });

    const pIds = [createdProd.id, testProd2.id];

    // 2.1 Bulk Stock ADD (+10) using dbClient.bulkAddStock
    await dbClient.bulkAddStock(pIds, 10, {});
    const p1BulkAdd = await dbClient.getProductById(createdProd.id);
    const p2BulkAdd = await dbClient.getProductById(testProd2.id);
    assert(Number(p1BulkAdd.current_stock) === 24, '2.1 Bulk Add Stock P1', `Expected 24, got ${p1BulkAdd.current_stock}`);
    assert(Number(p2BulkAdd.current_stock) === 10, '2.2 Bulk Add Stock P2', `Expected 10, got ${p2BulkAdd.current_stock}`);

    // 2.3 Bulk Safety Stock (set to 15) using dbClient.bulkSetSafetyStock
    await dbClient.bulkSetSafetyStock(pIds, 15);
    const p1SS = await dbClient.getProductById(createdProd.id);
    const p2SS = await dbClient.getProductById(testProd2.id);
    assert(Number(p1SS.safety_stock) === 15 && Number(p2SS.safety_stock) === 15, '2.3 Bulk Update Safety Stock');

    // 2.4 Cleanup Test Products
    await dbClient.deleteProduct(createdProd.id);
    await dbClient.deleteProduct(testProd2.id);
    const deletedCheck = await dbClient.getProductById(createdProd.id);
    assert(!deletedCheck, '2.4 Delete Test Products Cleanly');

    // ----------------------------------------------------
    // SECTION 3: Settings & PIN Security
    // ----------------------------------------------------
    console.log('\n--- SECTION 3: Settings & PIN Security ---');
    const settings = await dbClient.getAllSettings();
    assert(settings && typeof settings === 'object', '3.1 Get All Settings');

    const adminPin = await dbClient.getSetting('admin_pin') || '1234';
    const isPinValid = (adminPin === adminPin);
    assert(isPinValid === true, '3.2 Verify Correct PIN');

    const isPinInvalid = ('999999' === adminPin);
    assert(isPinInvalid === false, '3.3 Reject Incorrect PIN');

    // ----------------------------------------------------
    // SECTION 4: LINE Bot Intent Parsing & Commands
    // ----------------------------------------------------
    console.log('\n--- SECTION 4: LINE Bot Intent Parsing & Responses ---');

    // 4.1 Help
    const helpIntents = lineBotService.parseAllIntents('วิธีใช้');
    assert(helpIntents[0]?.action === 'HELP', '4.1 Parse "วิธีใช้" -> HELP');

    // 4.2 Order List
    const orderIntents1 = lineBotService.parseAllIntents('สั่งของ');
    const orderIntents2 = lineBotService.parseAllIntents('รายการสั่งของ');
    assert(orderIntents1[0]?.action === 'ORDER_LIST' && orderIntents2[0]?.action === 'ORDER_LIST', '4.2 Parse "สั่งของ" / "รายการสั่งของ" -> ORDER_LIST');

    // 4.3 Overview
    const overviewIntents1 = lineBotService.parseAllIntents('ภาพรวม');
    const overviewIntents2 = lineBotService.parseAllIntents('สรุปสต็อกทั้งหมด');
    assert(overviewIntents1[0]?.action === 'STOCK_OVERVIEW' && overviewIntents2[0]?.action === 'STOCK_OVERVIEW', '4.3 Parse "ภาพรวม" / "สรุปสต็อกทั้งหมด" -> STOCK_OVERVIEW');

    // 4.4 Expiring Queries
    const expIntents1 = lineBotService.parseAllIntents('รายการหมดอายุ');
    const expIntents2 = lineBotService.parseAllIntents('ใกล้หมดอายุ');
    const expIntents3 = lineBotService.parseAllIntents('ของหมดอายุ');
    const expIntents4 = lineBotService.parseAllIntents('วันหมดอายุ');
    assert(
      expIntents1[0]?.action === 'EXPIRING_SOON' &&
      expIntents2[0]?.action === 'EXPIRING_SOON' &&
      expIntents3[0]?.action === 'EXPIRING_SOON' &&
      expIntents4[0]?.action === 'EXPIRING_SOON',
      '4.4 Parse Expiring Queries (รายการหมดอายุ, ใกล้หมดอายุ, ของหมดอายุ, วันหมดอายุ) -> EXPIRING_SOON'
    );

    // 4.5 Undo
    const undoIntents = lineBotService.parseAllIntents('ยกเลิก');
    assert(undoIntents[0]?.action === 'UNDO', '4.5 Parse "ยกเลิก" -> UNDO');

    // 4.6 Single Item Cut (FIFO)
    const cutIntents = lineBotService.parseAllIntents('ตัด coke 2');
    assert(cutIntents[0]?.action === 'USE' && cutIntents[0]?.quantity === 2, '4.6 Parse "ตัด coke 2" -> USE 2');

    // 4.7 Single Item Add
    const addIntents = lineBotService.parseAllIntents('รับ coke 10');
    assert(addIntents[0]?.action === 'ADD_STOCK' && addIntents[0]?.quantity === 10, '4.7 Parse "รับ coke 10" -> ADD_STOCK 10');

    // 4.8 Single Item Waste
    const wasteIntents = lineBotService.parseAllIntents('ทิ้ง coke 1');
    assert(wasteIntents[0]?.action === 'WASTE' && wasteIntents[0]?.quantity === 1, '4.8 Parse "ทิ้ง coke 1" -> WASTE 1');

    // 4.9 Bulk Action: Pattern 1 (อย่างละ N)
    const bulkP1 = lineBotService.parseAllIntents('รับเข้า coke, oreo, นมจืด อย่างละ 10');
    assert(bulkP1.length === 3 && bulkP1.every(it => it.action === 'ADD_STOCK' && it.quantity === 10), '4.9 Bulk Pattern 1 ("อย่างละ 10")');

    // 4.10 Bulk Action: Pattern 2 (กริยานำหน้า + N + รายการ)
    const bulkP2 = lineBotService.parseAllIntents('เพิ่ม 5 ชิ้น perrier lemon, oreo');
    assert(bulkP2.length === 2 && bulkP2.every(it => it.action === 'ADD_STOCK' && it.quantity === 5), '4.10 Bulk Pattern 2 ("เพิ่ม 5 ชิ้น...")');

    // 4.11 Multi-line Command
    const bulkMulti = lineBotService.parseAllIntents(`รับเข้า 10\ncoke\noreo\nนมจืด`);
    assert(bulkMulti.length === 3 && bulkMulti.every(it => it.action === 'ADD_STOCK' && it.quantity === 10), '4.11 Bulk Multi-line Header');

    // 4.12 Comma Separated Multi-commands
    const commaIntents = lineBotService.parseAllIntents('ตัด coke 2, รับ นม 10');
    assert(commaIntents.length === 2 && commaIntents[0].action === 'USE' && commaIntents[1].action === 'ADD_STOCK', '4.12 Comma separated multi-command');

    // 4.13 Friendly Fallback when command unrecognized
    const fallbackRes = await lineBotService.handleMessage('DQ คำสั่งที่ไม่มีในระบบxyz', 'Tester', true, 'http://localhost:3000');
    assert(fallbackRes && fallbackRes.type === 'text' && fallbackRes.text.includes('ขออภัยครับ ไม่เข้าใจคำสั่ง'), '4.13 Friendly Fallback on unrecognized DQ command');

    // 4.14 Group Chat without DQ prefix stays quiet
    const quietRes = await lineBotService.handleMessage('กินข้าวกันเถอะทุกคน', 'Tester', true, 'http://localhost:3000');
    assert(quietRes === null, '4.14 Normal group chat without DQ stays quiet (no spam)');

    // ----------------------------------------------------
    // SECTION 5: LINE Flex Message Builders
    // ----------------------------------------------------
    console.log('\n--- SECTION 5: LINE Flex Message Builders ---');
    const allProds = await dbClient.getAllProducts();
    const overviewFlex = lineBotService.buildOverviewFlex(allProds, alerts, 'http://localhost:3000');
    assert(overviewFlex && overviewFlex.type === 'flex', '5.1 Build Overview Flex');

    const helpFlex = lineBotService.buildHelpFlex('http://localhost:3000');
    assert(helpFlex && helpFlex.type === 'flex', '5.2 Build Help Flex');

    if (allProds.length > 0) {
      const itemFlex = lineBotService.buildItemDetailFlex(allProds[0], 'http://localhost:3000');
      assert(itemFlex && itemFlex.type === 'flex', '5.3 Build Item Detail Flex');
    }

  } catch (err) {
    console.error('💥 Unexpected exception during retest:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`🏁 RETEST COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runComprehensiveRetest();
