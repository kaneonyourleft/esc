const fs = require('fs');
const lines = fs.readFileSync('src/js/main.js', 'utf8').split('\n');

// 콘솔에 보인 에러: "properties of undefined (read 'forEach')" 
// 즉시 실행 컨텍스트에서 forEach 호출하는 곳 찾기
// 특히 snap.forEach, Object.values().forEach 등

// 줄 510~550 확인 (Firebase onSnapshot 부분)
for (let i = 508; i < Math.min(560, lines.length); i++) {
  console.log((i+1) + ': ' + lines[i]);
}
