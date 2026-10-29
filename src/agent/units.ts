/** V0 unit policy: arithmetic belongs here, never in provider output. Ambiguous systems ask. */
export const UNIT_POLICY_VERSION = 'mellow-units-v1';
const numerals: Record<string, number> = {一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10,半:.5,one:1,two:2,three:3,a:1,an:1};
export const unitNumber = (value:string):number => {
 if(value.toLowerCase() in numerals)return numerals[value.toLowerCase()];
 if(!/[零〇一二两三四五六七八九十百千点]/.test(value))return Number(value);
 const [whole,decimal]=value.split('点');let total=0,digit=0;
 for(const char of whole){const place=({十:10,百:100,千:1000} as Record<string,number>)[char];if(place){total+=(digit||1)*place;digit=0;}else digit=char==='零'||char==='〇'?0:numerals[char];}
 // Colloquial forms such as 一百五 do not establish an exact amount.
 if(/[百千][一二两三四五六七八九]$/.test(whole))return NaN;
 return total+digit+(decimal?Number('0.'+[...decimal].map(c=>c==='零'||c==='〇'?0:numerals[c]).join('')):0);
};
export function parseUnits(text:string) {
 const abvs=[...text.matchAll(/(\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百千]+(?:点[零〇一二两三四五六七八九]+)?)\s*(?:%|度|percent\b)/gi)].map(m=>unitNumber(m[1]));
 const proof=/\bproof\b/i.test(text);
 const proofValue=text.match(/(\d+(?:\.\d+)?)\s*(?:US\s*)?proof\b/i);
 const ambiguousProof=proof&&!(/\bUS\b|American|美制/i.test(text)&&proofValue);
 if(proofValue&&!ambiguousProof)abvs.push(Number(proofValue[1])/2);
 const amounts=[...text.matchAll(/(\d+(?:\.\d+)?|半|[零〇一二两三四五六七八九十百千]+(?:点[零〇一二两三四五六七八九]+)?)\s*(ml|millilit(?:er|re)s?\b|毫升|cl|(?:fl\s*)?oz|升|lit(?:er|re)s?\b|[lL]\b|两)/gi)].map(m=>unitNumber(m[1])*({ml:1,'毫升':1,cl:10,oz:29.5735295625,floz:29.5735295625,l:1000,liter:1000,liters:1000,litre:1000,litres:1000,'升':1000,'两':50}[m[2].toLowerCase().replace(/\s/g,'')]??1));
 const pint=/\bpints?\b/i.test(text),pintSize=/\bUS\b|American/i.test(text)?473.176473:/\bUK\b|imperial|British/i.test(text)?568.26125:null;
 if(pint&&pintSize){const count=text.match(/(\d+(?:\.\d+)?|one|two|three|a|half)\s+(?:(?:US|UK|imperial|British)\s+)?pints?/i);amounts.push((count?.[1]==='half'?.5:unitNumber(count?.[1]??'1'))*pintSize);}
 return {abvs,amounts,ambiguousProof,ambiguousPint:pint&&!pintSize,provenance:`${UNIT_POLICY_VERSION}; 两 = 50 ml; oz = US fluid oz; pint/proof require explicit system`};
}
