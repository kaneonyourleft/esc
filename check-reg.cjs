const fs = require('fs');

// RegisterProduct
const m02 = fs.readFileSync('vba-txt/M02_Product.txt', 'utf8').split('\n');
for (let i = 16; i < Math.min(70, m02.length); i++) {
  console.log('M02:' + (i+1) + ': ' + m02[i]);
}

// CalcAndWriteDays
console.log('\n=== CalcAndWriteDays ===');
const m08 = fs.readFileSync('vba-txt/M08_Utils.txt', 'utf8').split('\n');
for (let i = 195; i < Math.min(225, m08.length); i++) {
  console.log('M08:' + (i+1) + ': ' + m08[i]);
}
