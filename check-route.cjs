const fs = require('fs');
const m08 = fs.readFileSync('vba-txt/M08_Utils.txt', 'utf8').split('\n');

// BuildRoute 전체
console.log('=== BuildRoute ===');
for (let i = 0; i < m08.length; i++) {
  if (m08[i].includes('Function BuildRoute') || m08[i].includes('Sub BuildRoute')) {
    for (let j = i; j < Math.min(i + 40, m08.length); j++) {
      console.log((j+1) + ': ' + m08[j]);
      if (j > i && m08[j].trim().startsWith('End ')) break;
    }
    break;
  }
}

// GetProcDays 전체
console.log('\n=== GetProcDays ===');
for (let i = 0; i < m08.length; i++) {
  if (m08[i].includes('Function GetProcDays')) {
    for (let j = i; j < Math.min(i + 30, m08.length); j++) {
      console.log((j+1) + ': ' + m08[j]);
      if (j > i && m08[j].trim().startsWith('End ')) break;
    }
    break;
  }
}

// CalcAndWriteDays 전체 (d5 할당 포함)
console.log('\n=== CalcAndWriteDays ===');
for (let i = 0; i < m08.length; i++) {
  if (m08[i].includes('Sub CalcAndWriteDays')) {
    for (let j = i; j < Math.min(i + 50, m08.length); j++) {
      console.log((j+1) + ': ' + m08[j]);
      if (j > i && m08[j].trim().startsWith('End ')) break;
    }
    break;
  }
}
