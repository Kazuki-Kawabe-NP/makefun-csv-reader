import {setFlagsFromString} from 'node:v8';
import {openSync,closeSync,readFileSync,writeFileSync} from 'node:fs';
import {isUtf8} from 'node:buffer';
import {runJSON} from './solve.js';
setFlagsFromString('--no-turbofan --no-incremental-marking');
const [source='/input/cases.json',destination='/output/answers.json'] = process.argv.slice(2);
const bytes=readFileSync(source);
// ASCII structural characters are invariant under the byte-preserving view.
// Escaped Unicode and malformed UTF-8 use the ordinary Unicode path.
let byteView=isUtf8(bytes)&&bytes.indexOf('\\u')<0;
let cases=JSON.parse(bytes.toString(byteView?'latin1':'utf8'));
if(byteView&&cases.some(c=>typeof c.input.text!=='string')){
  byteView=false;
  cases=JSON.parse(bytes.toString('utf8'));
}
const fd=openSync(destination,'w');
try {
  writeFileSync(fd,'[');
  for(let i=0;i<cases.length;i++) {
    const v=cases[i].input;
    if(byteView&&typeof v.text==='string'&&v.text.startsWith('\xef\xbb\xbf'))v.text=v.text.slice(3);
    const result=runJSON(v,128);
    cases[i]=null;
    if(i)writeFileSync(fd,',');
    writeFileSync(fd,result,byteView?'latin1':'utf8');
  }
  writeFileSync(fd,']');
} finally {closeSync(fd);}
