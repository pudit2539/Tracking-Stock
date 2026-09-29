const dbClient = require('../src/db/dbClient');
const lineBotService = require('../src/services/lineBotService');
const lineService = require('../src/services/lineService');

async function testExpiryAdjustment() {
  console.log('🧪 TESTING EXPIRY DATE ADJUSTMENT & LINE COMMANDS\n');
  let passed = 0;
  let failed = 0;

  function assert(cond, name, detail = '') {
    if (cond) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} ${detail ? '(' + detail + ')' : ''}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1: INTENT PARSING
    // ----------------------------------------------------
    console.log('--- 1. Testing Intent Parsing ---');

    // 1.1 "dq ปรับวันหมดอายุ แก๊สบอม เป็น 2026-11-30"
    const p1 = lineBotService.parseIntent('dq ปรับวันหมดอายุ แก๊สบอม เป็น 2026-11-30');
    assert(p1 && p1.action === 'UPDATE_EXPIRY' && p1.productName === 'แก๊สบอม' && p1.date === '2026-11-30', '1.1 Parse full command with product and date');

    // 1.2 "dq ปรับวันหมดอายุ LOT-9789 2026-11-30"
    const p2 = lineBotService.parseIntent('dq ปรับวันหมดอายุ LOT-9789 2026-11-30');
    assert(p2 && p2.action === 'UPDATE_EXPIRY' && p2.lotNumber === 'LOT-9789' && p2.date === '2026-11-30', '1.2 Parse with LOT number');

    // 1.3 Relative: "dq ปรับวันหมดอายุ แก๊สบอม +1 เดือน"
    const p3 = lineBotService.parseIntent('dq ปรับวันหมดอายุ แก๊สบอม +1 เดือน');
    assert(p3 && p3.action === 'UPDATE_EXPIRY' && p3.productName === 'แก๊สบอม' && !!p3.date, '1.3 Parse relative +1 เดือน');

    // 1.4 User prompt from screenshot: "dq ปรับวันหมดอายุเป็น 2026-11-31" (clamped to Nov 30)
    const p4 = lineBotService.parseIntent('dq ปรับวันหมดอายุเป็น 2026-11-31');
    assert(p4 && p4.action === 'UPDATE_EXPIRY' && p4.date === '2026-11-30' && !p4.productName, '1.4 Parse screenshot prompt (clamp 11-31 -> 11-30 without product)');

    // 1.5 "dq ปรับวันหมดอายุ แก๊สบอม" (no date) -> UPDATE_EXPIRY_PROMPT
    const p5 = lineBotService.parseIntent('dq ปรับวันหมดอายุ แก๊สบอม');
    assert(p5 && p5.action === 'UPDATE_EXPIRY_PROMPT' && p5.productName === 'แก๊สบอม', '1.5 Parse prompt without date');

    // 1.6 "dq ปรับวันหมดอายุ" (bare prompt) -> UPDATE_EXPIRY_PROMPT
    const p6 = lineBotService.parseIntent('dq ปรับวันหมดอายุ');
    assert(p6 && p6.action === 'UPDATE_EXPIRY_PROMPT' && !p6.productName, '1.6 Parse bare prompt');

    // 1.7 Receive with expiry: "dq รับ แก๊สบอม 10 หมดอายุ 2026-11-30"
    const p7 = lineBotService.parseIntent('dq รับ แก๊สบอม 10 หมดอายุ 2026-11-30');
    assert(p7 && p7.action === 'ADD_STOCK' && p7.productName === 'แก๊สบอม' && p7.quantity === 10 && p7.expiryDate === '2026-11-30', '1.7 Receive with explicit expiry date');

    // 1.8 Receive with relative expiry: "dq รับ แก๊สบอม 5 +6 เดือน"
    const p8 = lineBotService.parseIntent('dq รับ แก๊สบอม 5 +6 เดือน');
    assert(p8 && p8.action === 'ADD_STOCK' && p8.productName === 'แก๊สบอม' && p8.quantity === 5 && !!p8.expiryDate, '1.8 Receive with relative +6 เดือน');

    // 1.9 parseAllIntents delegation
    const allIntents = lineBotService.parseAllIntents('dq ปรับวันหมดอายุเป็น 2026-11-31');
    assert(allIntents && allIntents.length === 1 && allIntents[0].action === 'UPDATE_EXPIRY', '1.9 parseAllIntents correctly routes UPDATE_EXPIRY');

    // ----------------------------------------------------
    // TEST 2: DATABASE & DIRECT UPDATE
    // ----------------------------------------------------
    console.log('\n--- 2. Testing Database Operations ---');

    // Create a temporary test product
    const testProd = await dbClient.createProduct({
      name: 'Test_ExpProd_' + Date.now(),
      category: 'ท็อปปิ้ง & วัตถุดิบ',
      unit: 'ถุง',
      safety_stock: 5,
      expiry_warning_days: 7,
      initial_quantity: 10,
      expiry_date: '2026-10-06'
    });
    assert(testProd && testProd.id, '2.1 Create test product with batch');

    // 2.2 Update expiry date by product name
    const updateRes = await dbClient.updateProductExpiryDate(testProd.name, '2026-11-30', 'Tester');
    assert(updateRes.success && updateRes.newExpiryDate === '2026-11-30' && updateRes.oldExpiryDate === '2026-10-06', '2.2 Update expiry date by product name');

    // Verify fetched product
    const refetched = await dbClient.getProductById(testProd.id);
    assert(refetched.batches && refetched.batches[0].expiry_date === '2026-11-30', '2.3 Refetched product has updated expiry_date');

    // 2.4 Update expiry date by LOT number
    const lotNum = refetched.batches[0].lot_number;
    const lotRes = await dbClient.updateProductExpiryDate(lotNum, '2026-12-31', 'Tester');
    assert(lotRes.success && lotRes.newExpiryDate === '2026-12-31', '2.4 Update expiry date by LOT number');

    // 2.5 addProductStockDirect with custom expiry date
    const addedProd = await dbClient.addProductStockDirect(testProd.id, 5, 'Tester', '2027-01-15');
    assert(addedProd && addedProd.new_batch_expiry === '2027-01-15', '2.5 addProductStockDirect saves custom expiry date');

    // ----------------------------------------------------
    // TEST 3: BOT MESSAGE EXECUTION & UNDO
    // ----------------------------------------------------
    console.log('\n--- 3. Testing Bot Messages & Undo ---');

    // 3.1 Send command to adjust expiry
    const msg1 = await lineBotService.handleMessage('DQ ปรับวันหมดอายุ แก๊สบอม เป็น 2027-05-20', 'Manager', 'http://localhost:3000');
    assert(msg1 && msg1.type === 'flex' && msg1.altText.includes('2027-05-20'), '3.1 Bot executes adjust expiry command');

    // 3.2 Test Undo
    const undoMsg = await lineBotService.handleMessage('DQ ยกเลิก', 'Manager', 'http://localhost:3000');
    assert(undoMsg && undoMsg.text && undoMsg.text.includes('ยกเลิกการปรับวันหมดอายุสำเร็จ'), '3.2 Bot executes Undo for expiry adjustment');

    // 3.3 Test Receiving with Expiry
    const rcvMsg = await lineBotService.handleMessage('DQ รับ แก๊สบอม 8 หมดอายุ 2027-06-30', 'Staff', 'http://localhost:3000');
    assert(rcvMsg && rcvMsg.type === 'flex' && rcvMsg.quickReply, '3.3 Receive stock with expiry date returns flex with quickReply');

    // 3.4 Test Bare prompt: "DQ ปรับวันหมดอายุ"
    const bareMsg = await lineBotService.handleMessage('DQ ปรับวันหมดอายุ', 'Staff', 'http://localhost:3000');
    assert(bareMsg && bareMsg.text.includes('ปรับวันหมดอายุ'), '3.4 Bare prompt returns helpful instructions & quickReply');

    // Clean up test product
    await dbClient.deleteProduct(testProd.id);

    // ----------------------------------------------------
    // TEST 4: EXPIRING ALERT FLEX ACTIONS
    // ----------------------------------------------------
    console.log('\n--- 4. Testing Expiring Flex Card ---');
    const mockBatches = [
      { product_name: 'แก๊สบอม', lot_number: 'LOT-9789', quantity: 8, unit: 'กระป๋อง', expiry_date: '2026-10-06', days_until_expiry: 7 },
      { product_name: 'โคน', lot_number: 'LOT-4078', quantity: 2, unit: 'ลัง', expiry_date: '2026-10-06', days_until_expiry: 7 }
    ];
    const expiringFlex = lineService.buildExpiringFlex(mockBatches, 'http://localhost:3000');
    assert(expiringFlex && expiringFlex.type === 'flex', '4.1 Build expiring flex');
    assert(expiringFlex.quickReply && expiringFlex.quickReply.items.length > 0, '4.2 Expiring flex has quickReply chips');
    
    // Check buttons inside body
    const bodyStr = JSON.stringify(expiringFlex.contents.body);
    assert(bodyStr.includes('✏️ ปรับวัน') && bodyStr.includes('+1 ด.') && bodyStr.includes('+3 ด.') && bodyStr.includes('🗑️ ทิ้ง'), '4.3 Expiring card rows contain ✏️ ปรับวัน, +1 ด., +3 ด., 🗑️ ทิ้ง action buttons');

    // ----------------------------------------------------
    // TEST 5: RICH MENU 6-TILES CONFIGURATION
    // ----------------------------------------------------
    console.log('\n--- 5. Testing Rich Menu 6-Tiles ---');
    const fs = require('fs');
    assert(fs.existsSync('public/img/richmenu.png'), '5.1 richmenu.png file exists');
    const imgStat = fs.statSync('public/img/richmenu.png');
    assert(imgStat.size > 10000, '5.2 richmenu.png is valid size');

  } catch (err) {
    console.error('💥 Test error:', err);
    failed++;
  }

  console.log(`\n🏁 RESULT: ${passed} PASSED, ${failed} FAILED`);
  if (failed > 0) process.exit(1);
}

testExpiryAdjustment();
