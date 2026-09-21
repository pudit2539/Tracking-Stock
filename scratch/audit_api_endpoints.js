const fs = require('fs');
const js = fs.readFileSync('public/js/app.js', 'utf8');

// Find all fetch calls in app.js
const fetchRegex = /fetch\((?:`|'|")(\/api\/[^`'"]+)(?:`|'|")/g;
let m;
const endpoints = new Set();
while ((m = fetchRegex.exec(js)) !== null) {
  // normalize dynamic IDs: e.g. /api/products/${id} -> /api/products/:id
  const norm = m[1].replace(/\$\{[^}]+\}/g, ':id');
  endpoints.add(norm);
}

console.log('Frontend API calls:', Array.from(endpoints));

