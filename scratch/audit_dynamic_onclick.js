const fs = require('fs');
const js = fs.readFileSync('public/js/app.js', 'utf8');

const regex = /onclick=["']([^"']+)["']/g;
let match;
const onclicks = new Set();

while ((match = regex.exec(js)) !== null) {
  onclicks.add(match[1].trim());
}

console.log('Total onclick expressions found in app.js:', onclicks.size);

const missing = [];
const stdFns = ['alert', 'confirm', 'prompt', 'closeDialog', 'openDialog'];

for (const expr of onclicks) {
  // Can be e.g. openEditProductModal(123) or this.select()
  const fnMatch = expr.match(/^([a-zA-Z0-9_$]+)\s*\(/);
  if (fnMatch) {
    const fnName = fnMatch[1];
    const definedInJs = new RegExp('function\\s+' + fnName + '\\b|window\\.' + fnName + '\\b|const\\s+' + fnName + '\\s*=|let\\s+' + fnName + '\\s*=|var\\s+' + fnName + '\\s*=').test(js);
    if (!definedInJs && !stdFns.includes(fnName)) {
      missing.push({ expr, fnName });
    }
  }
}

console.log('Missing/Undefined functions in app.js dynamic HTML:', JSON.stringify(missing, null, 2));

