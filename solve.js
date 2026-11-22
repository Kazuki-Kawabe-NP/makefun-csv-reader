export function run(input) { return parse(input,0); }
export function runJSON(input,chunkSize) { return parse(input,chunkSize); }
function parse(input,chunkSize) {
  let s=String(input.text);
  const header=input.header===true;
  if(s.charCodeAt(0)===65279) s=s.slice(1);
  let columns=header?[]:null,width=-1,line=1,i=0, rows=[],errors=[];
  let rowCount=0;
  const encoded=[];
  function flush(){
    if(rows.length){encoded.push(JSON.stringify(rows).slice(1,-1));rows=[];}
  }
  function finish(){
    if(!chunkSize)return {columns,rows,errors};
    flush();
    return '{"columns":'+JSON.stringify(columns)+',"rows":['+encoded.join(',')+'],"errors":'+JSON.stringify(errors)+'}';
  }
  const error=(code,start,more)=>errors.push({code,line:start,row:header&&width<0?null:rowCount,...more});
  function emit(a,start) {
    if(width<0) {width=a.length;if(header){columns=a;return;}}
    if(a.length<width){error('short_row',start,{fields:a.length});while(a.length<width)a.push('');}
    if(a.length>width){error('long_row',start,{extra:a.slice(width)});a.length=width;}
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
  const delimiter=/[,\r\n]/g;
  while(i<s.length){
    const start=line,at=i,a=[];
    while(true){
      let v='',j=i, closed=false, junk=false;
      if(s[i]==='"'){
        let p=i+1,doubled=false;
        while((p=s.indexOf('"',p))>=0){if(s[p+1]==='"'){doubled=true;p+=2;continue;}closed=true;break;}
        if(closed){
          v=s.slice(i+1,p);
          if(doubled||/[\r\n]/.test(v))v=v.replace(/""|\r\n|[\r\n]/g,m=>{if(m==='""')return '"';line++;return '\n';});
          j=i=p+1;
          const c=s.charCodeAt(i);
          if(c===44){a.push(v);i++;continue;}
          if(c===10||c===13&&s.charCodeAt(i+1)===10||i===s.length){a.push(v);break;}
        }else error('unterminated_quote',start);
      }
      delimiter.lastIndex=i;
      const p=delimiter.test(s)?delimiter.lastIndex-1:s.length;
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
