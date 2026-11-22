import {openSync,closeSync,readFileSync,writeFileSync} from 'node:fs';
import {runJSON} from './solve.js';

const [source='/input/cases.json',destination='/output/answers.json'] = process.argv.slice(2);
const cases = JSON.parse(readFileSync(source,'utf8'));
const fd = openSync(destination,'w');
try {
  writeFileSync(fd,'[');
  for (let i=0;i<cases.length;i++) {
    const result = runJSON(cases[i].input,128);
    cases[i] = null;
    if (i) writeFileSync(fd,',');
    writeFileSync(fd, result);
  }
  writeFileSync(fd,']');
} finally {
  closeSync(fd);
}
