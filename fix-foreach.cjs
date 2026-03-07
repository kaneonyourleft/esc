const fs = require('fs');
const lines = fs.readFileSync('src/js/main.js', 'utf8').split('\n');

// 2849~2857 (즉시실행 forEach) 삭제
// 그리고 2859~ 이전 saveProduct도 확인
console.log('삭제 전 2847:', lines[2846]);
console.log('삭제 전 2848:', lines[2847]);
console.log('삭제 전 2849:', lines[2848]);
console.log('삭제 전 2857:', lines[2856]);
console.log('삭제 전 2858:', lines[2857]);
console.log('삭제 전 2859:', lines[2858]);

// 2848~2857 삭제 (0-indexed 2847~2856, 빈줄 포함)
lines.splice(2847, 10);
console.log('\n즉시실행 forEach 10줄 삭제');
console.log('삭제 후 2848:', lines[2847]);
console.log('삭제 후 2849:', lines[2848]);

// 이제 이전 saveProduct가 남아있는지 확인 - 현재 위치에서 찾기
let dupStart = -1, dupEnd = -1;
for (let i = 2847; i < Math.min(2900, lines.length); i++) {
  if (lines[i].includes('window.saveProduct = async function()')) {
    dupStart = i;
    // 함수 끝 찾기
    let depth = 0;
    for (let j = i; j < lines.length; j++) {
      for (const c of lines[j]) {
        if (c === '{') depth++;
        if (c === '}') depth--;
      }
      if (depth === 0 && j > i) { dupEnd = j; break; }
    }
    break;
  }
}

if (dupStart > -1) {
  console.log('\n중복 saveProduct 발견: 줄', dupStart+1, '~', dupEnd+1);
  
  // 이전 saveProduct 뒤에 또 중복 함수가 있는지 확인
  for (let i = dupStart; i <= Math.min(dupEnd + 5, lines.length - 1); i++) {
    console.log((i+1) + ': ' + lines[i].substring(0, 100));
  }
  
  // 중복 saveProduct 삭제 (새 saveProduct는 위쪽에 이미 있음)
  // 위에 새 saveProduct 있는지 확인
  let hasNew = false;
  for (let i = 0; i < dupStart; i++) {
    if (lines[i].includes('window.saveProduct = async function()')) { hasNew = true; break; }
  }
  
  if (hasNew) {
    lines.splice(dupStart, dupEnd - dupStart + 1);
    console.log('중복 saveProduct 삭제 완료');
  } else {
    console.log('새 saveProduct가 없으므로 유지');
  }
}

// deleteProduct 함수 확인
let delCount = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('window.deleteProduct')) { delCount++; console.log('deleteProduct at', i+1); }
}
if (delCount === 0) console.log('\ndeleteProduct 함수 없음 - 추가 필요');

fs.writeFileSync('src/js/main.js', lines.join('\n'), 'utf8');
console.log('\ndone');
