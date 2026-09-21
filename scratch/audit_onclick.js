const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/js/app.js', 'utf8');

const regex = /onclick="([^"]+)"/g;
let match;
const onclicks = new Set();

while ((match = regex.exec(html)) !== null) {
  onclicks.add(match[1].trim());
}

console.log('Total onclick expressions found in index.html:', onclicks.size);

const missing = [];
for (const expr of onclicks) {
  const fnMatch = expr.match(/^([a-zA-Z0-9_$]+)\s*\(/);
  if (fnMatch) {
    const fnName = fnMatch[1];
    const stdFns = ['alert', 'confirm', 'prompt', 'closeDialog', 'openDialog'];
    const definedInJs = new RegExp('function\\s+' + fnName + '\\b|window\\.' + fnName + '\\b|const\\s+' + fnName + '\\s*=|let\\s+' + fnName + '\\s*=|var\\s+' + fnName + '\\s*=').test(js);
    if (!definedInJs && !stdFns.includes(fnName)) {
      missing.push({ expr, fnName });
    }
  }
}

console.log('Missing/Undefined functions:', JSON.stringify(missing, null, 2));

// Also check form onsubmit handlers
const submitRegex = /onsubmit="([^"]+)"/g;
const onsubmits = new Set();
while ((match = submitRegex.exec(html)) !== null) {
  onsubmits.add(match[1].trim());
}

console.log('Total onsubmit expressions found in index.html:', onsubmits.size);
const missingSubmits = [];
for (const expr of onsubmits) {
  const fnMatch = expr.match(/^([a-zA-Z0-9_$]+)\s*\(/);
  if (fnMatch) {
    const fnName = fnMatch[1];
    const definedInJs = new RegExp('function\\s+' + fnName + '\\b|window\\.' + fnName + '\\b|const\\s+' + fnName + '\\s*=|let\\s+' + fnName + '\\s*=|var\\s+' + fnName + '\\s*=').test(js);
    if (!definedInJs) {
      missingSubmits.push({ expr, fnName });
    }
  }
}
console.log('Missing/Undefined submit functions:', JSON.stringify(missingSubmits, null, 2));

