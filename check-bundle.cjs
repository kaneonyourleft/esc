const fs = require('fs');
const files = fs.readdirSync('public/assets').filter(f => f.endsWith('.js'));
if (files.length === 0) { console.log('No JS files'); process.exit(0); }
const js = fs.readFileSync('public/assets/' + files[0], 'utf8');
const lines = js.split('\n');
console.log('파일:', files[0], '총', lines.length, '줄');

// 에러 주변 확인: 745~755
for (let i = 744; i < Math.min(756, lines.length); i++) {
  const line = lines[i];
  console.log((i+1) + ': ' + (line.length > 200 ? line.substring(0, 200) + '...' : line));
}
