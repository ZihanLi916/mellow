import {exactPrintedAbv} from './printed';
export type VolumeReading={ml:number|null;packCount:number|null;totalMl:number|null;ambiguous:boolean;quote:string|null;unitSystem:'METRIC'|'US'|'IMPERIAL'|null};
const empty=():VolumeReading=>({ml:null,packCount:null,totalMl:null,ambiguous:false,quote:null,unitSystem:null});
/** FL OZ alone is ambiguous across markets. Never silently assume US fluid ounces. */
export function readPackageVolume(text:string,region?:string):VolumeReading {
  // Nutrition denominators are not container capacities (e.g. NATZ: 37 Kcal pour 100ml).
  const s=text.normalize('NFKC').split(/[\n;]+/).filter(line=>!(/kcal|kilojoule|nutrition|营养|每\s*100|\bper\s*100|\bpour\s*100/i.test(line))).join('\n');
  if(/[<>≤≥~≈±]|\b(?:about|approx|between)\b|约|\d\s*[-–—]\s*\d/i.test(s))return {...empty(),ambiguous:true};
  const matches=[...s.matchAll(/(?<![\d.,+\-])(\d+(?:[.,]\d+)?)\s*(ml|cl|litres?|liters?|l|毫升|升|(?:US\s*|imp(?:erial)?\s*)?fl\.?\s*oz\.?)(?:\s*[e℮])?(?![a-z])/gi)];
  if(!matches.length)return empty();
  const values=matches.map(m=>{
    const unit=m[2].toLowerCase(),n=Number(m[1].replace(',','.'));
    const oz=unit.includes('oz');
    const system=oz?(/imp/i.test(unit)||region==='GB'?'IMPERIAL':/us/i.test(unit)||region==='US'?'US':null):'METRIC';
    const factor=oz?(system==='US'?29.5735295625:system==='IMPERIAL'?28.4130625:null):/^(?:ml|毫升)$/.test(unit)?1:/^cl$/.test(unit)?10:1000;
    return {m,ml:factor===null?null:n*factor,system};
  });
  const metric=values.filter(v=>v.system==='METRIC'),known=metric.length?metric:values.filter(v=>v.ml!==null);
  if(!known.length)return {...empty(),ambiguous:true,quote:matches.map(m=>m[0]).join(' / ')};
  const unique=[...new Set(known.map(v=>v.ml!))];
  if(unique.length!==1)return {...empty(),ambiguous:true};
  const ml=unique[0];if(ml<=0||ml>5000)return {...empty(),ambiguous:true};
  // Repeated equivalent metric/ounce declarations are one unit, with label rounding tolerance.
  if(values.some(v=>v.ml!==null&&Math.abs(v.ml-ml)>Math.max(1,ml*.005)))return {...empty(),ambiguous:true};
  const v=known[0],before=s.slice(Math.max(0,v.m.index!-20),v.m.index),after=s.slice(v.m.index!+v.m[0].length,v.m.index!+v.m[0].length+20);
  const countMatch=before.match(/(\d{1,3})\s*[x×]\s*$/i)??after.match(/^\s*[x×]\s*(\d{1,3})\b/i);
  const count=countMatch?Number(countMatch[1]):null;
  if(count!==null&&(count<1||count>200))return {...empty(),ambiguous:true};
  // A pack count with only a total size cannot establish the individual unit.
  if(!count&&/\b\d+\s*(?:pack|bottles|cans)\b|\btotal\b|共|总/i.test(s))return {...empty(),ambiguous:true};
  return {ml,packCount:count,totalMl:ml*(count??1),ambiguous:false,quote:v.m[0],unitSystem:v.system as VolumeReading['unitSystem']};
}
export function readPackageText(text:string,region?:string){
  const bounded=text.slice(0,4000);
  // Restrict the ABV parser to alcohol markers; a nutrition 5% is not ABV.
  const lines=bounded.split(/[\n;]+/).filter(l=>/\b(?:ABV|alc|alcohol)\b|酒精|%\s*(?:vol|alc)/i.test(l));
  const bare=bounded.split(/[\n;]+/).filter(l=>/^\s*\d+(?:[.,]\d+)?\s*%\s*$/.test(l));
  const abv=lines.length?exactPrintedAbv(lines.join(' ')):bare.length===1&&!(/nutrition|daily value|sugar|fat|protein|营养|蛋白|糖|脂肪/i.test(bounded))?exactPrintedAbv(bare[0]):null;
  return {abv,volume:readPackageVolume(bounded,region),abvQuote:abv===null?null:(lines.length?lines.join(' '):bounded).slice(0,500)};
}
