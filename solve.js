export function run(input){
 let s=String(input.text);if(s.charCodeAt(0)===65279)s=s.slice(1);
 const header=input.header===true,n=s.length,rows=[],errors=[];
 let columns=header?[]:null,width=-1,i=0,line=1;
 let nextLF=s.indexOf('\n');if(nextLF<0)nextLF=n;
 let nextCR=s.indexOf('\r');if(nextCR<0)nextCR=n;
 const rowError=(code,start,more)=>errors.push({code,line:start,row:header&&width<0?null:rows.length,...more});
 const advanceLF=()=>{nextLF=s.indexOf('\n',nextLF+1);if(nextLF<0)nextLF=n;};
 const advanceCR=()=>{nextCR=s.indexOf('\r',nextCR+1);if(nextCR<0)nextCR=n;};
 outer: while(i<n){
   const start=line,at=i,row=[];
   while(true){
     let field='',closed=false;
     if(s.charCodeAt(i)===34){
       const from=i+1;
       let p=from,doubled=false;
       for(;;){
         p=s.indexOf('"',p);
         if(p<0)break;
         if(s.charCodeAt(p+1)!==34){closed=true;break;}
         doubled=true;p+=2;
       }
       if(closed){
         field=s.slice(from,p);
         const norm=nextCR<p;
         while(nextCR<p||nextLF<p){
           if(nextCR<nextLF){if(nextCR===nextLF-1&&nextLF<p)advanceLF();advanceCR();}
           else advanceLF();
           line++;
         }
         if(norm)field=field.replace(/\r\n|\r/g,'\n');
         if(doubled)field=field.replace(/""/g,'"');
         i=p+1;
       }else rowError('unterminated_quote',start);
     }
     let comma=s.indexOf(',',i);
     if(comma<0)comma=n;
     let junk=false;
     for(;;){
       const end=Math.min(comma,nextLF,nextCR);
       if(end>i){field+=s.slice(i,end);junk=true;}
       i=end;
       if(end!==nextCR||end===n||nextLF<n&&nextCR===nextLF-1)break;
       rowError('stray_cr',start);
       advanceCR();i++;
     }
     if(closed&&junk)rowError('quote_junk',start);
     row.push(field);
     if(i<n&&i===comma){i++;continue;}
     if(row.length!==1||row[0]!==''||s.charCodeAt(at)===34){
       if(width<0){width=row.length;if(header){columns=row;}else rows.push(row);}
       else {
         if(row.length<width){rowError('short_row',start,{fields:row.length});while(row.length<width)row.push('');}
         else if(row.length>width){rowError('long_row',start,{extra:row.slice(width)});row.length=width;}
         rows.push(row);
       }
     }
     if(i>=n)break outer;
     if(i===nextCR){advanceCR();i++;}
     advanceLF();i++;line++;break;
   }
 }
 return {columns,rows,errors};
}
