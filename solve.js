export function run(input) { return parse(input,0); }
export function runJSON(input,chunkSize,enc) { return parse(input,chunkSize,enc); }
function parse(input,chunkSize,enc) {
  let s=String(input.text);
  const header=input.header===true;
  if(s.charCodeAt(0)===65279) s=s.slice(1);
  let columns=header?[]:null,width=-1,line=1,i=0, rows=[],errors=[];
  let rowCount=0;
  const encoded=[];
  function flush(){
    if(rows.length){
      const body=JSON.stringify(rows);
      if(enc==='utf8'||enc==='latin1'){
        const b=Buffer.from(body,enc);
        if(encoded.length){b[0]=44;encoded.push(b.subarray(0,b.length-1));}
        else encoded.push(b.subarray(1,b.length-1));
      }else{
        const inner=body.slice(1,-1);
        encoded.push(enc?Buffer.from((encoded.length?',':'')+inner,enc):inner);
      }
      rows=[];
    }
  }
  function finish(){
    if(!chunkSize)return {columns,rows,errors};
    flush();
    if(enc){
      const parts=[Buffer.from('{"columns":'+JSON.stringify(columns)+',"rows":[',enc),...encoded,Buffer.from('],"errors":'+JSON.stringify(errors)+'}',enc)];
      return parts;
    }
    return '{"columns":'+JSON.stringify(columns)+',"rows":['+encoded.join(',')+'],"errors":'+JSON.stringify(errors)+'}';
  }
  const error=(code,start,more)=>errors.push({code,line:start,row:header&&width<0?null:rowCount,...more});
  function emit(a,start) {
    const n=a.length;
    if(width<0){width=n;if(header){columns=a;return;}}
    const delta=n-width;
    if(delta<0){error('short_row',start,{fields:n});for(let j=n;j<width;j++)a[j]='';}
    else if(delta>0){error('long_row',start,{extra:a.slice(width)});a.length=width;}
    rows.push(a);rowCount++;
    if(chunkSize&&rows.length>=chunkSize)flush();
  }
  // A record without quote or CR can be split directly.
  if(!/["\r]/.test(s)){
    let from=0;
    for(;;){
      let end=s.indexOf('\n',from);if(end<0)end=s.length;
      if(end>from)emit(s.slice(from,end).split(','),line);
      if(end===s.length)break;
      from=end+1;line++;
    }
    return finish();
  }
  const group2=/((?:[^",\r\n][^,\r\n]*)?)(?:,((?:[^",\r\n][^,\r\n]*)?)(?:,((?:[^",\r\n][^,\r\n]*)?)(?:,((?:[^",\r\n][^,\r\n]*)?))?)?)?(,|\r\n|\n|$)/y;
  const quoteToken=/"([^"\r\n]*)((?:""[^"\r\n]*)*)"(,|\r\n|\n|$)/y;
  const delimiter=/[^,\r\n]*/y;
  track: while(i<s.length){
    const start=line,at=i,a=[];
    while(true){
      group2.lastIndex=i;
      const m=group2.exec(s);
      if(m!==null){
        if(m[2]===undefined)a.push(m[1]);else if(m[3]===undefined)a.push(m[1],m[2]);else if(m[4]===undefined)a.push(m[1],m[2],m[3]);else a.push(m[1],m[2],m[3],m[4]);
        i=group2.lastIndex;
        const sep=m[5];
        if(sep===',')continue;
        if(i-at>sep.length)emit(a,start);
        if(sep.length)line++;
        continue track;
      }
      let v='',j=i, closed=false, junk=false;
      if(s[i]==='"'){
        quoteToken.lastIndex=i;
        const q=quoteToken.exec(s);
        if(q!==null){
          const sep=q[3];
          a.push(q[2].length?q[1]+q[2].replace(/""/g,'"'):q[1]);
          i=quoteToken.lastIndex;
          if(sep===',')continue;
          emit(a,start);
          if(sep.length)line++;
          continue track;
        }
        let p=i+1,doubled=false;
        while((p=s.indexOf('"',p))>=0){if(s[p+1]==='"'){doubled=true;p+=2;continue;}closed=true;break;}
        if(closed){
          v=s.slice(i+1,p);
          const breaks=v.match(/\r\n|[\r\n]/g);
          if(breaks){line+=breaks.length;v=v.replace(/\r\n|\r/g,'\n');}
          if(doubled)v=v.replace(/""/g,'"');
          j=i=p+1;
          const c=s.charCodeAt(i);
          if(c===44){a.push(v);i++;continue;}
          if(c===10||c===13&&s.charCodeAt(i+1)===10||i===s.length){a.push(v);break;}
        }else error('unterminated_quote',start);
      }
      delimiter.lastIndex=i;
      delimiter.test(s);
      const p=delimiter.lastIndex;
      if(s.charCodeAt(p)!==13||s.charCodeAt(p+1)===10){
        if(closed&&p!==i) error('quote_junk',start);
        if(p!==i) v+=s.slice(i,p);
        i=p;
      }else{
        i=p;
        while(i<s.length){
          const c=s.charCodeAt(i);
          if(c===44 || c===10 || c===13&&s.charCodeAt(i+1)===10) break;
          if(c===13){if(i>j){v+=s.slice(j,i);junk=true;}error('stray_cr',start);j=++i;}
          else {junk=true;i++;}
        }
        if(i>j){v+=s.slice(j,i);junk=true;}
        if(closed&&junk) error('quote_junk',start);
      }
      a.push(v);
      if(s[i]!==',')break;
      i++;
    }
    if(i>at&&(a.length!==1||a[0]!==''||s.charCodeAt(at)===34))emit(a,start);
    if(i<s.length){i+=s[i]==='\r'?2:1;line++;}
  }
  return finish();
}

const RAW_E=new Uint8Array(256);
RAW_E[34]=34;RAW_E[92]=92;RAW_E[47]=47;RAW_E[98]=8;RAW_E[102]=12;RAW_E[110]=10;RAW_E[114]=13;RAW_E[116]=9;


const RAWHEX="0123456789abcdef";
const RAW_SHORT=new Uint8Array(32);RAW_SHORT[8]=98;RAW_SHORT[9]=116;RAW_SHORT[10]=110;RAW_SHORT[12]=102;RAW_SHORT[13]=114;
export function runRawJSON(input,data){
  if(data[0]===239&&data[1]===187&&data[2]===191)data=data.subarray(3);
  const n=data.length, E=RAW_E, header=input.header===true;
  let columns=header?[]:null,width=-1,rows=0,line=1,i=0,k=0;
  const max=64*1024*1024;
  if(n*6+128>max)return null;
  let out=Buffer.alloc(n*6+128);const errors=[];
  function reserve(need){
    if(k+need>max)return false;
    if(k+need>out.length){const b=Buffer.alloc(Math.min(max,Math.max(2*out.length,k+need)));out.copy(b,0,0,k);out=b;}
    return true;
  }
  function error(code,start,more){errors.push({code,line:start,row:header&&width<0?null:rows,...more});}
  while(i<n){
    const at=i,start=line,rowOffset=k,head=header&&width<0;
    if(data[i]===92&&data[i+1]===110){i+=2;line++;continue;}
    if(data[i]===92&&data[i+1]===114&&data[i+2]===92&&data[i+3]===110){i+=4;line++;continue;}
    let fields=0,extra,headFields=head?[]:null;
    if(rows)out[k++]=44;out[k++]=91;
    for(;;){
      const fieldOffset=k,keep=width<0||fields<width;
      if(fields&&keep)out[k++]=44;
      const startValue=k;out[k++]=34;
      const fieldStart=i,startLine=line;
      let closed=false,c;
      if(data[i]===92&&data[i+1]===34){
        i+=2;
        while(i<n){
          c=data[i];
          if(c!==92){out[k++]=c;i++;continue;}
          c=E[data[i+1]];i+=2;
          if(c===34){
            if(data[i]!==92||data[i+1]!==34){closed=true;break;}
            i+=2;
          }else if(c===13){if(data[i]===92&&data[i+1]===110)i+=2;c=10;line++;}
          else if(c===10)line++;
          if(c>=32 && c!==34 && c!==92){out[k++]=c;continue;}
          out[k++]=92;
          if(c===34||c===92)out[k++]=c;
          else{const e=RAW_SHORT[c];if(e)out[k++]=e;
            else{out[k++]=117;out[k++]=48;out[k++]=48;out[k++]=RAWHEX.charCodeAt(c>>>4);out[k++]=RAWHEX.charCodeAt(c&15);}}
        }
        if(!closed){k=startValue+1;i=fieldStart;line=startLine;error('unterminated_quote',start);}
      }
      const kb=k;
      while(i<n){
        c=data[i];
        if(c!==92){if(c===44)break;out[k++]=c;i++;continue;}
        c=E[data[i+1]];
        if(c===10||c===13&&data[i+2]===92&&data[i+3]===110)break;
        i+=2;
        if(c===13){error('stray_cr',start);continue;}
        if(c>=32&&c!==34&&c!==92){out[k++]=c;continue;}
        out[k++]=92;
        if(c===34||c===92)out[k++]=c;
        else{const e=RAW_SHORT[c];if(e)out[k++]=e;
          else{out[k++]=117;out[k++]=48;out[k++]=48;out[k++]=RAWHEX.charCodeAt(c>>>4);out[k++]=RAWHEX.charCodeAt(c&15);}}
      }
      if(closed&&k!==kb)error('quote_junk',start);
      out[k++]=34;
      if(head||!keep){
        const val=JSON.parse(out.toString('latin1',startValue,k));
        if(head)headFields.push(val);else{(extra??=[]).push(val);k=fieldOffset;}
      }
      fields++;
      if(data[i]===44){i++;continue;}
      break;
    }
    if(fields>1||k-rowOffset>3+!!rows||data[at]===92&&data[at+1]===34){
      if(width<0){width=fields;if(head)columns=headFields;}
      if(head)k=rowOffset;
      else{
        if(fields<width){
          error('short_row',start,{fields});
          if(!reserve(1+(width-fields)*3+6*(n-i)+64))return null;
          while(fields++<width){out[k++]=44;out[k++]=34;out[k++]=34;}
        }else if(fields>width)error('long_row',start,{extra});
        out[k++]=93;rows++;
      }
    }else k=rowOffset;
    if(i<n){i+=data[i+1]===114?4:2;line++;}
  }
  return [Buffer.from('{"columns":'+JSON.stringify(columns)+',"rows":[','latin1'),out.subarray(0,k),Buffer.from('],"errors":'+JSON.stringify(errors)+'}','latin1')].filter(b=>b.length);
}
function consumeCSV(data,i,arena){
  data=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
  if(data[i]===239&&data[i+1]===187&&data[i+2]===191)i+=3;
  const n=data.length,begin=arena.k;
  const st={i,k:begin,width:-1,line:1,rows:0,first:begin,out:arena.buf,dst:new Uint8Array(arena.buf.buffer,arena.buf.byteOffset,arena.buf.byteLength),errors:[],status:0,partialEnd:0,finishAt:0,finishLine:0,fields:0,cut:0};
  while(st.i<n&&data[st.i]!==34){
    if(st.width>=2){
      scanRegularRows(data,st.dst,st.width,st);
      if(st.status){if(!resolveWidth(data,st))return null;continue;}
      if(st.i>=n||data[st.i]===34)break;
    }
    if(!repairOne(data,st))return null;
  }
  if(data[st.i]!==34||st.k>st.out.length)return null;
  arena.buf=st.out;arena.k=st.k;
  return {out:st.out,begin,first:st.first,end:st.k,errors:st.errors,next:st.i+1};
}

function repairOne(data,st) {
 const n=data.length,E=RAW_E,max=64*1024*1024,errors=st.errors;
 let {i,k,rows,width,line,first,out,dst}=st;
    const at=i,start=line,rowOffset=k;
    if(data[i]===92&&data[i+1]===110){st.i=i+2;st.line=line+1;return true;}
    if(data[i]===92&&data[i+1]===114&&data[i+2]===92&&data[i+3]===110){st.i=i+4;st.line=line+1;return true;}
    let fields=0,extra;const f={i:0,k:0,line:0};
    if(rows)dst[k++]=44;dst[k++]=91;
    for(;;){
      const fieldOffset=k,keep=width<0||fields<width;
      if(fields&&keep)dst[k++]=44;
      const startValue=k;dst[k++]=34;
      f.i=i;f.k=k;f.line=line;
      if(!repairField(data,dst,f,start,rows,errors))return null;
      i=f.i;k=f.k;line=f.line;
      dst[k++]=34;
      if(!keep){
        const val=JSON.parse(out.toString('latin1',startValue,k));
        (extra??=[]).push(val);k=fieldOffset;
      }
      fields++;
      if(data[i]===44){i++;continue;}
      break;
    }
    if(fields>1||k-rowOffset>3+!!rows||data[at]===92&&data[at+1]===34){
      if(width<0)width=fields;
      {
        if(fields<width){
          appendCSVError(errors,'short_row',start,rows,{fields});
          const bigger=growCSV(out,k,1+(width-fields)*3+3*(n-i)+64,max);
          if(bigger===null)return null;
          if(bigger!==out){out=bigger;dst=new Uint8Array(out.buffer,out.byteOffset,out.byteLength);}
          while(fields++<width){dst[k++]=44;dst[k++]=34;dst[k++]=34;}
        }else if(fields>width)appendCSVError(errors,'long_row',start,rows,{extra});
        dst[k++]=93;if(!rows)first=k;rows++;
      }
    }else k=rowOffset;
    if(i<n&&data[i]!==34){i+=data[i+1]===114?4:2;line++;}
 st.i=i;st.k=k;st.width=width;st.rows=rows;st.line=line;st.first=first;st.out=out;st.dst=dst;
 return true;
}
export { RAW_E, consumeCSV };
function repairField(data,dst,f,start,rows,errors){
 const E=RAW_E,startValue=f.k-1;
 let i=f.i,k=f.k,line=f.line;
      const fieldStart=i,startLine=line;
      let closed=false,c;
      if(data[i]===92&&data[i+1]===34){
        i+=2;
        while(true){
          c=data[i];
          {const d=k-i; while(c>=32&&c!==34&&c!==92){dst[i+d]=c;c=data[++i];}k=i+d;if(c!==92){if(c===34)break;return false;}}
          c=E[data[i+1]];if(!c)return false;i+=2;
          if(c===34){
            if(data[i]!==92||data[i+1]!==34){closed=true;break;}
            i+=2;
          }else if(c===13){if(data[i]===92&&data[i+1]===110)i+=2;c=10;line++;}
          else if(c===10)line++;
          if(c>=32 && c!==34 && c!==92){dst[k++]=c;continue;}
          dst[k++]=92;
          if(c===34||c===92)dst[k++]=c;
          else{const e=RAW_SHORT[c];if(e)dst[k++]=e;
            else{dst[k++]=117;dst[k++]=48;dst[k++]=48;dst[k++]=RAWHEX.charCodeAt(c>>>4);dst[k++]=RAWHEX.charCodeAt(c&15);}}
        }
        if(!closed){k=startValue+1;i=fieldStart;line=startLine;appendCSVError(errors,'unterminated_quote',start,rows);}
      }
      const kb=k;
      while(true){
        c=data[i];
        {const d=k-i; while(c>=32&&c!==34&&c!==44&&c!==92){dst[i+d]=c;c=data[++i];}k=i+d;if(c!==92){if(c===34||c===44)break;return false;}}
        c=E[data[i+1]];if(!c)return false;
        if(c===10||c===13&&data[i+2]===92&&data[i+3]===110)break;
        i+=2;
        if(c===13){appendCSVError(errors,'stray_cr',start,rows);continue;}
        if(c>=32&&c!==34&&c!==92){dst[k++]=c;continue;}
        dst[k++]=92;
        if(c===34||c===92)dst[k++]=c;
        else{const e=RAW_SHORT[c];if(e)dst[k++]=e;
          else{dst[k++]=117;dst[k++]=48;dst[k++]=48;dst[k++]=RAWHEX.charCodeAt(c>>>4);dst[k++]=RAWHEX.charCodeAt(c&15);}}
      }
      if(closed&&k!==kb)appendCSVError(errors,'quote_junk',start,rows);

 f.i=i;f.k=k;f.line=line;
 return true;
}
const R_Q=new Uint8Array(256).fill(1,32),R_U=new Uint8Array(256).fill(1,32);
R_Q[34]=0;R_Q[92]=0;R_U[34]=0;R_U[44]=0;R_U[92]=0;
const RE_PAIRS=new Uint8Array(256), RE_SUFFIX=new Int32Array(256).fill(-1), RE_LINE=new Uint8Array(256), RE_OUT=new Uint8Array(256);
 RE_PAIRS[34]=2;RE_PAIRS[47]=3;RE_SUFFIX[34]=23586;RE_SUFFIX[114]=23662;RE_LINE[110]=1;RE_LINE[114]=1;
 for(const e of [34,92,98,102,110,116])RE_OUT[e]=e;
 RE_OUT[114]=110;
function scanRegularRows(data,dst,width,of) {
  const n=data.length,Q=R_Q,U=R_U;
  let i=of.i,k=of.k,line=of.line,r=of.rows,pi=i,pk=k,pl=line;
  let status=0,count=0,cut=0;
  rowLoop:while(i<n&&data[i]!==34){
    pi=i;pk=k;pl=line;
    const len0=data[i]===92?sepLength(data,i):0;
    i+=len0;line+=+(len0>0);pi=i;pl=line;
    if(len0)continue;
    dst[k++]=44;dst[k++]=91;
    count=0;cut=0;
    for(;;){
      dst[k++]=34;
      let c;
      if(data[i]===92&&data[i+1]===34){
        i+=2;
        for(;;){
          c=data[i];
          const d=k-i;
          while(Q[c]){dst[i+d]=c;c=data[++i];}
          k=i+d;
          if(c!==92)break rowLoop;
          const e=data[i+1]|0, pair=((data[i+2]|0)<<8)|(data[i+3]|0);
          const how=RE_PAIRS[e], matchingPair=+(pair===RE_SUFFIX[e]);
          i+=2+(matchingPair<<1);
          line+=RE_LINE[e];
          if(how===2 && !matchingPair)break;
          if(how===3){dst[k++]=47;continue;}
          const code=RE_OUT[e];
          if(!code)break rowLoop;
          dst[k++]=92;dst[k++]=code;
        }
        c=data[i];
      }else{
        for(;;){
          c=data[i];
          const d=k-i;
          while(U[c]){dst[i+d]=c;c=data[++i];}
          k=i+d;
          if(c!==92)break;
          const e=data[i+1];
          if(e===110||e===114)break;
          i+=2;
          if(e===47){dst[k++]=47;continue;}
          if(e!==34&&e!==92&&e!==98&&e!==102&&e!==116)break rowLoop;
          dst[k++]=92;dst[k++]=e;
        }
      }
      dst[k++]=34;
      ++count;
      if(count===width)cut=k;
      if(c===44){dst[k++]=44;i++;continue;}
      if(c===92){
        const len=sepLength(data,i);if(!len)break rowLoop;
        i+=len;line++;
      }else if(c!==34)break rowLoop;
      break;
    }
    if(k>=dst.length)break;
    if(count!==width){status=count>width?2:1;break;}
    dst[k++]=93;r++;
    pi=i;pk=k;pl=line;
  }
  of.i=pi;of.k=pk;of.line=pl;of.rows=r;
  of.status=status;
  if(status){of.partialEnd=k;of.finishAt=i;of.finishLine=line;of.fields=count;of.cut=cut;}
}

function resolveWidth(data,st) {
  let {out,dst,width,fields,partialEnd:k,finishAt,finishLine,cut,rows,line,errors,status}=st;
  if(status===1){
    errors.push({code:'short_row',line,row:rows,fields});
    const need=1+(width-fields)*3+3*(data.length-finishAt)+64,max=64*1024*1024;
    if(k+need>max)return false;
    if(k+need>out.length){
      const b=Buffer.alloc(Math.min(max,Math.max(2*out.length,k+need)));
      out.copy(b,0,0,k);out=b;dst=new Uint8Array(out.buffer,out.byteOffset,out.byteLength);
    }
    for(let p=fields;p<width;p++){dst[k++]=44;dst[k++]=34;dst[k++]=34;}
  }else{
    const extra=JSON.parse('['+out.toString('latin1',cut+1,k)+']');
    errors.push({code:'long_row',line,row:rows,extra});
    k=cut;
  }
  dst[k++]=93;
  st.i=finishAt;st.line=finishLine;st.k=k;st.rows=rows+1;st.out=out;st.dst=dst;
  return true;
}

function growCSV(out,k,need,max) {
  if(k+need>max)return null;
  if(k+need<=out.length)return out;
  const b=Buffer.alloc(Math.min(max,Math.max(2*out.length,k+need)));out.copy(b,0,0,k);return b;
}
function appendCSVError(errors,code,line,row,more){errors.push({code,line,row,...more});}


function sepLength(data,i){
 const e=data[i+1]|0,b=data[i+2]|0,c=data[i+3]|0;
 return ((e===110)<<1)|(((e===114)&(b===92)&(c===110))<<2);
}
const QUOTED_PASSTHROUGH=new Uint8Array(256);
QUOTED_PASSTHROUGH[92]=QUOTED_PASSTHROUGH[98]=QUOTED_PASSTHROUGH[102]=QUOTED_PASSTHROUGH[110]=QUOTED_PASSTHROUGH[116]=1;
