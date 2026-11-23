import {setFlagsFromString} from 'node:v8';
import {openSync,closeSync,readFileSync,writeFileSync,writevSync} from 'node:fs';
import {isUtf8} from 'node:buffer';
import {runJSON,runRawJSON,RAW_E,consumeCSV} from './solve.js';
setFlagsFromString('--no-incremental-marking --no-parallel-scavenge --optimize-for-size --regexp-tier-up-ticks=8');
const [source='/input/cases.json',destination='/output/answers.json'] = process.argv.slice(2);
const bytes=readFileSync(source);
// ASCII structural characters are invariant under the byte-preserving view.
// Escaped Unicode and malformed UTF-8 use the ordinary Unicode path.
const fused=transportFuse(bytes);
const ranges=fused??transport(bytes);
let byteView=ranges!==null||isUtf8(bytes)&&bytes.indexOf('\\u')<0;
let cases=ranges??JSON.parse(bytes.toString(byteView?'latin1':'utf8'));
if(!ranges&&byteView&&cases.some(c=>typeof c.input.text!=='string')){
  byteView=false;
  cases=JSON.parse(bytes.toString('utf8'));
}
const fd=openSync(destination,'w');
try {
  writeFileSync(fd,'[');
  for(let i=0;i<cases.length;i++) {
    const v=ranges?cases[i]:cases[i].input;
    let result=fused?v:ranges?runRawJSON(v,v.text):null;
    if(!result){
      if(ranges)v.text=JSON.parse('"'+v.text.toString('latin1')+'"');
      if(byteView&&typeof v.text==='string'&&v.text.startsWith('\xef\xbb\xbf'))v.text=v.text.slice(3);
      result=runJSON(v,160,byteView?'latin1':'utf8');
    }
    cases[i]=null;
    if(i)writeFileSync(fd,',');
    while(result.length){
      let n=writevSync(fd,result);
      if(n<=0)throw new Error('output write did not advance');
      let count=0;
      while(count<result.length&&n>=result[count].length)n-=result[count++].length;
      if(count)result.splice(0,count);
      if(n&&result.length)result[0]=result[0].subarray(n);
    }
  }
  writeFileSync(fd,']');
} finally {closeSync(fd);}


function transportFuse(bytes) {
  const capacity=3*bytes.length+128;
  if(capacity>64*1024*1024||!isUtf8(bytes)||bytes.indexOf('\\u')>=0)return null;
  let p=0,l=bytes.length,out=[]; const arena={buf:Buffer.alloc(capacity),k:0};
  const Q=34;
  function skip(){ while(p<l){const c=bytes[p]; if(c===32||c===10||c===13||c===9)p++;else break;}}
  function take(c){skip();if(bytes[p]!==c)return false;p++;return true;}
  function key(){
    skip();
    if(bytes[p]!==Q)return "";
    ++p;
    if(bytes[p]===105&&bytes[p+1]===100&&bytes[p+2]===Q){p+=3;return "id";}
    if(bytes[p]===116&&bytes[p+1]===101&&bytes[p+2]===120&&bytes[p+3]===116&&bytes[p+4]===Q){p+=5;return "text";}
    if(bytes[p]===105&&bytes[p+1]===110&&bytes[p+2]===112&&bytes[p+3]===117&&bytes[p+4]===116&&bytes[p+5]===Q){p+=6;return "input";}
    if(bytes[p]===104&&bytes[p+1]===101&&bytes[p+2]===97&&bytes[p+3]===100&&bytes[p+4]===101&&bytes[p+5]===114&&bytes[p+6]===Q){p+=7;return "header";}
    return "";
  }

  function skipString(){
    if(!take(Q))return false;
    while(p<l){
      const c=bytes[p++];
      if(c===34)return true;
      if(c<32 || c===92&&!RAW_E[bytes[p++]])return false;
    }
    return false;
  }
  function input(){
    if(!take(123))return null;
    let seen=0,header=false,text;
    do{
      const k=key();
      if(!take(58))return null;
      if(k==="text"&&!(seen&1)){seen|=1;if(!take(Q))return null;text=consumeCSV(bytes,p,arena);if(text===null)return null;p=text.next;}
      else if(k==="header"&&!(seen&2)){
        seen|=2;skip();
        if(bytes[p]===116&&bytes[p+1]===114&&bytes[p+2]===117&&bytes[p+3]===101){ header=true;p+=4;}
        else if(bytes[p]===102&&bytes[p+1]===97&&bytes[p+2]===108&&bytes[p+3]===115&&bytes[p+4]===101){p+=5;}
        else return null;
      }else return null;
    }while(take(44));
    if(!(seen&1)||!take(125))return null;
    const {out,begin,first,end,errors}=text;
    if(header)for(const e of errors)e.row=e.row?e.row-1:null;
    return [Buffer.from('{"columns":','latin1'), header?(first>begin?out.subarray(begin,first):Buffer.from('[]')):Buffer.from('null'),Buffer.from(',"rows":[','latin1'),out.subarray(header?Math.min(first+1,end):begin,end),Buffer.from('],"errors":'+JSON.stringify(errors)+'}','latin1')].filter(b=>b.length);
  }
  function item(){
    if(!take(123))return null;
    let seen=0,result=null;
    do{
      const k=key();
      if(!take(58))return null;
      if(k==="id"&&!(seen&1)){seen|=1;if(!skipString())return null;}
      else if(k==="input"&&!(seen&2)){seen|=2;result=input();if(!result)return null;}
      else return null;
    }while(take(44));
    return (seen&2)&&take(125)?result:null;
  }
  if(!take(91))return null;
  if(take(93)){skip();return p===l?out:null;}
  do{
    const obj=item();if(!obj)return null;
    out.push(obj);
  }while(take(44));
  if(!take(93))return null;
  skip();return p===l?out:null;
}

function transport(bytes) {
  if(!isUtf8(bytes)||bytes.length>64*1024*1024)return null;
  let p=0,l=bytes.length, out=[], latin=bytes.toString('latin1');
  const Q=34;
  function skip(){ while(p<l){const c=bytes[p]; if(c===32||c===10||c===13||c===9)p++;else break;}}
  function take(c){skip();if(bytes[p]!==c)return false;p++;return true;}
  function key(){
    skip();
    if(bytes[p]!==Q)return "";
    ++p;
    if(bytes[p]===105&&bytes[p+1]===100&&bytes[p+2]===Q){p+=3;return "id";}
    if(bytes[p]===116&&bytes[p+1]===101&&bytes[p+2]===120&&bytes[p+3]===116&&bytes[p+4]===Q){p+=5;return "text";}
    if(bytes[p]===105&&bytes[p+1]===110&&bytes[p+2]===112&&bytes[p+3]===117&&bytes[p+4]===116&&bytes[p+5]===Q){p+=6;return "input";}
    if(bytes[p]===104&&bytes[p+1]===101&&bytes[p+2]===97&&bytes[p+3]===100&&bytes[p+4]===101&&bytes[p+5]===114&&bytes[p+6]===Q){p+=7;return "header";}
    return "";
  }
  const escSpan=/[^"\\\x00-\x1f]*(?:\\["\\/bfnrt][^"\\\x00-\x1f]*)*"/y;
  function rawStr(need){
    if(!take(Q))return null;
    const start=p;
    escSpan.lastIndex=p;
    try { if(!escSpan.test(latin))return null; }
    catch(e) { if(!(e instanceof RangeError))throw e;return null; }
    p=escSpan.lastIndex;
    return need?bytes.subarray(start,p-1):true;
  }
  function input(){
    if(!take(123))return null;
    let seen=0,header=false,text;
    do{
      const k=key();
      if(!take(58))return null;
      if(k==="text"&&!(seen&1)){seen|=1;text=rawStr(true);if(text===null)return null;}
      else if(k==="header"&&!(seen&2)){
        seen|=2;skip();
        if(bytes[p]===116&&bytes[p+1]===114&&bytes[p+2]===117&&bytes[p+3]===101){ header=true;p+=4;}
        else if(bytes[p]===102&&bytes[p+1]===97&&bytes[p+2]===108&&bytes[p+3]===115&&bytes[p+4]===101){p+=5;}
        else return null;
      }else return null;
    }while(take(44));
    return (seen&1)&&take(125)?{header,text}:null;
  }
  function item(){
    if(!take(123))return null;
    let seen=0,result=null;
    do{
      const k=key();
      if(!take(58))return null;
      if(k==="id"&&!(seen&1)){seen|=1;if(rawStr(false)===null)return null;}
      else if(k==="input"&&!(seen&2)){seen|=2;result=input();if(!result)return null;}
      else return null;
    }while(take(44));
    return (seen&2)&&take(125)?result:null;
  }
  if(!take(91))return null;
  if(take(93)){skip();return p===l?out:null;}
  do{
    const obj=item();if(!obj)return null;
    out.push(obj);
  }while(take(44));
  if(!take(93))return null;
  skip();return p===l?out:null;
}
