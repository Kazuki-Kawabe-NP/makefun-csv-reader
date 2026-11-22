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
