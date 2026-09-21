const lineBotService = require('../src/services/lineBotService');

console.log('Testing lineBotService.parseAllIntents:');

const testCases = [
  {
    input: 'DQ รับเข้า coke, oreo, นมจืด อย่างละ 10',
    expectedAction: 'ADD_STOCK',
    expectedQty: 10,
    expectedCount: 3
  },
  {
    input: 'เพิ่ม 5 ชิ้น perrier lemon, oreo',
    expectedAction: 'ADD_STOCK',
    expectedQty: 5,
    expectedCount: 2
  },
  {
    input: 'ตัด 2 ชิ้น coke, oreo',
    expectedAction: 'USE',
    expectedQty: 2,
    expectedCount: 2
  },
  {
    input: 'ทิ้ง coke, นมจืด อย่างละ 1',
    expectedAction: 'WASTE',
    expectedQty: 1,
    expectedCount: 2
  },
  {
    input: 'coke, oreo เหลือ อย่างละ 5',
    expectedAction: 'SET_STOCK',
    expectedQty: 5,
    expectedCount: 2
  },
  {
    input: `รับเข้า 10
coke
oreo
นมจืด`,
    expectedAction: 'ADD_STOCK',
    expectedQty: 10,
    expectedCount: 3
  },
  {
    input: 'ตัด coke 2',
    expectedAction: 'USE',
    expectedQty: 2,
    expectedCount: 1
  },
  {
    input: 'DQ รายการหมดอายุ',
    expectedAction: 'EXPIRING_SOON',
    expectedQty: null,
    expectedCount: 1
  },
  {
    input: 'DQ รายการใกล้หมดอายุ',
    expectedAction: 'EXPIRING_SOON',
    expectedQty: null,
    expectedCount: 1
  },
  {
    input: 'DQ ของหมดอายุ',
    expectedAction: 'EXPIRING_SOON',
    expectedQty: null,
    expectedCount: 1
  },
  {
    input: 'DQ รายการสั่งของ',
    expectedAction: 'ORDER_LIST',
    expectedQty: null,
    expectedCount: 1
  },
  {
    input: 'DQ สรุปสต็อกทั้งหมด',
    expectedAction: 'STOCK_OVERVIEW',
    expectedQty: null,
    expectedCount: 1
  }
];

let allPassed = true;

for (let i = 0; i < testCases.length; i++) {
  const tc = testCases[i];
  const cleaned = tc.input.replace(/^DQ\s+/i, '');
  const intents = lineBotService.parseAllIntents(cleaned);
  console.log(`\nTest #${i + 1}: "${tc.input}"`);
  console.log('Parsed intents:', JSON.stringify(intents, null, 2));

  if (!intents || intents.length !== tc.expectedCount) {
    console.error(`❌ Count mismatch: expected ${tc.expectedCount}, got ${intents?.length}`);
    allPassed = false;
    continue;
  }

  const actionMatch = intents.every(it => it.action === tc.expectedAction);
  const qtyMatch = tc.expectedQty === null ? true : intents.every(it => it.quantity === tc.expectedQty);

  if (!actionMatch || !qtyMatch) {
    console.error(`❌ Action or Qty mismatch: expected action=${tc.expectedAction}, qty=${tc.expectedQty}`);
    allPassed = false;
  } else {
    console.log(`✅ Test #${i + 1} passed!`);
  }
}

if (allPassed) {
  console.log('\n🎉 ALL INTEGRATION TESTS PASSED!');
} else {
  console.error('\n❌ SOME TESTS FAILED.');
  process.exit(1);
}

