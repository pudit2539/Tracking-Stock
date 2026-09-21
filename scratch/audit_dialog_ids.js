const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/js/app.js', 'utf8');

// Find all dialog ids in html
const dialogRegex = /<dialog\s+id="([^"]+)"/g;
let m;
const dialogIds = new Set();
while ((m = dialogRegex.exec(html)) !== null) {
  dialogIds.add(m[1]);
}
console.log('Dialog IDs in HTML:', Array.from(dialogIds));

// Find all openDialog('id') and closeDialog('id') in html and js
const allCode = html + '\n' + js;
const callRegex = /(?:openDialog|closeDialog)\(['"]([^'"]+)['"]\)/g;
const calledIds = new Set();
while ((m = callRegex.exec(allCode)) !== null) {
  calledIds.add(m[1]);
}
console.log('Dialog IDs referenced in openDialog/closeDialog:', Array.from(calledIds));

const missingDialogs = [];
for (const id of calledIds) {
  if (!dialogIds.has(id)) {
    missingDialogs.push(id);
  }
}

console.log('Missing/Unmatched Dialog IDs:', missingDialogs);

