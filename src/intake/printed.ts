/** Quotes are observations, never independent verification. Bounds/ranges cannot become points. */
export function exactPrintedAbv(quote:string):number|null {
  const text=quote.normalize('NFKC');
  if (/[<>≤≥~≈±]|\b(?:up to|under|over|less|more|about|approx|between|to)\b|低于|高于|不超过|至少|至多|约|[\d]\s*[-–—]\s*\d/i.test(text)) return null;
  const values=[...text.matchAll(/(?<![\d.,+\-])(?:(?:\bABV\b|酒精度|酒精含量)\s*[:：]?\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:%|度))/gi)]
    .map(m=>Number((m[1]??m[2]).replace(',','.')));
  return values.length&&new Set(values).size===1&&values[0]>=0&&values[0]<=100?values[0]:null;
}
export function exactPrintedVolume(quote:string):number|null {
  const text=quote.normalize('NFKC');
  if(/[<>≤≥~≈±]|\b(?:about|approx|to)\b|约|\d\s*[-–—]\s*\d/i.test(text))return null;
  const values=[...text.matchAll(/(?<![\d.,+\-])(\d+(?:[.,]\d+)?)\s*(ml|cl|l|毫升|升)(?![a-zA-Z])/gi)].map(m=>Number(m[1].replace(',','.'))*({ml:1,cl:10,l:1000,'毫升':1,'升':1000}[m[2].toLowerCase()]??0));
  return values.length&&new Set(values).size===1&&values[0]>0&&values[0]<=5000?values[0]:null;
}
