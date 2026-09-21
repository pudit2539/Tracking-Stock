const PRODUCT_ALIASES = [
  { name: 'Cokeขวดฝาแดง', aliases: ['cokeขวดฝาแดง', 'coke', 'โค้ก'] },
  { name: 'Oreo', aliases: ['oreo', 'โอริโอ้'] },
  { name: 'นมจืด', aliases: ['นมจืด', 'นมสด', 'นม'] },
  { name: 'Purra', aliases: ['purra', 'เพอร์ร่า'] },
  { name: 'Perrier', aliases: ['perrier', 'เปอริเอ้'] },
  { name: 'Perrier Lemon', aliases: ['perrier lemon', 'เปอริเอ้มะนาว'] }
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findAllProductsInText(text) {
  const clean = text.toLowerCase();
  const matched = [];
  const matchedNames = new Set();

  const allAliases = [];
  for (const item of PRODUCT_ALIASES) {
    for (const alias of item.aliases) {
      allAliases.push({ name: item.name, alias: alias.toLowerCase() });
    }
  }
  allAliases.sort((a, b) => b.alias.length - a.alias.length);

  let tempText = clean;
  for (const { name, alias } of allAliases) {
    if (tempText.includes(alias)) {
      if (!matchedNames.has(name)) {
        matchedNames.add(name);
        matched.push(name);
      }
      tempText = tempText.replace(new RegExp(escapeRegex(alias), 'g'), ' '.repeat(alias.length));
    }
  }
  return matched;
}

function parseBulkIntents(text) {
  const trimmed = text.trim();
  
  // 1. "อย่างละ N"
  const eachMatch = trimmed.match(/(?:อย่างละ|ละ)\s*(\d+(?:\.\d+)?)\s*(?:ชิ้น|pack|box|bag|cs|ea)?/i);
  if (eachMatch) {
    const qty = parseFloat(eachMatch[1]);
    let action = 'ADD_STOCK';
    if (/(ทิ้ง|เสีย|ชำรุด|หมดอายุ)/i.test(trimmed)) action = 'WASTE';
    else if (/(ใช้ไปแล้ว|ใช้ไป|ใช้|ตัด|เบิก|หัก|minus|-)/i.test(trimmed)) action = 'USE';
    else if (/(เหลือ|นับได้|ปรับเป็น|set)/i.test(trimmed)) action = 'SET_STOCK';

    const textWithoutEach = trimmed.replace(eachMatch[0], '');
    const prods = findAllProductsInText(textWithoutEach);
    if (prods.length > 0) {
      return prods.map(p => ({ action, productName: p, quantity: qty, rawText: `${p} ${qty}` }));
    }
  }

  // 2. Leading verb + quantity + products
  const leadMatch = trimmed.match(/^(รับเข้า|รับของ|รับ|เพิ่ม|เติมสต็อก|เติมของ|เติม|ซื้อมา|add|\+|ใช้ไปแล้ว|ใช้ไป|ใช้|ตัดสต็อก|ตัดของ|ตัด|เบิกใช้|เบิกของ|เบิก|หัก|minus|-|ทิ้ง|เสีย|ชำรุด|นับได้|เหลือ|ปรับเป็น)\s*[:\s]*(\d+(?:\.\d+)?)\s*(?:ชิ้น|pack|box|bag|cs|ea)?\s*[:\s,]+(.*)$/i);
  if (leadMatch) {
    const verb = leadMatch[1];
    const qty = parseFloat(leadMatch[2]);
    const rest = leadMatch[3];
    let action = 'ADD_STOCK';
    if (/(ทิ้ง|เสีย|ชำรุด)/i.test(verb)) action = 'WASTE';
    else if (/(ตัด|ใช้|เบิก|หัก|minus|-)/i.test(verb)) action = 'USE';
    else if (/(เหลือ|นับ|ปรับ)/i.test(verb)) action = 'SET_STOCK';

    const prods = findAllProductsInText(rest);
    if (prods.length > 0) {
      return prods.map(p => ({ action, productName: p, quantity: qty, rawText: `${p} ${qty}` }));
    }
  }

  // 3. Multi-line with header line
  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const headerMatch = lines[0].match(/^(รับเข้า|รับของ|รับ|เพิ่ม|เติมสต็อก|เติมของ|เติม|ซื้อมา|add|\+|ใช้ไปแล้ว|ใช้ไป|ใช้|ตัดสต็อก|ตัดของ|ตัด|เบิกใช้|เบิกของ|เบิก|หัก|minus|-|ทิ้ง|เสีย|ชำรุด|นับได้|เหลือ|ปรับเป็น)\s*[:\s]*(\d+(?:\.\d+)?)\s*(?:ชิ้น|pack|box|bag|cs|ea)?$/i);
    if (headerMatch) {
      const verb = headerMatch[1];
      const qty = parseFloat(headerMatch[2]);
      let action = 'ADD_STOCK';
      if (/(ทิ้ง|เสีย|ชำรุด)/i.test(verb)) action = 'WASTE';
      else if (/(ตัด|ใช้|เบิก|หัก|minus|-)/i.test(verb)) action = 'USE';
      else if (/(เหลือ|นับ|ปรับ)/i.test(verb)) action = 'SET_STOCK';

      const prods = [];
      for (let i = 1; i < lines.length; i++) {
        const found = findAllProductsInText(lines[i]);
        if (found.length > 0) prods.push(...found);
      }
      if (prods.length > 0) {
        return prods.map(p => ({ action, productName: p, quantity: qty, rawText: `${p} ${qty}` }));
      }
    }
  }

  return null;
}

// Tests
console.log('Test 1:', parseBulkIntents('รับเข้า coke, oreo, นมจืด อย่างละ 10'));
console.log('Test 2:', parseBulkIntents('รับเข้า 10 ชิ้น coke, oreo, นมจืด'));
console.log('Test 3:', parseBulkIntents('ตัด 2 coke, oreo'));
console.log('Test 4:', parseBulkIntents(`รับเข้า 10
coke
oreo
นมจืด`));
console.log('Test 5:', parseBulkIntents('เพิ่ม 5 ชิ้น perrier lemon, oreo'));
