import {validGtin} from '../knowledge/contracts';
import {normalizeText} from '../knowledge/normalization';
import {readPackageText} from './packageText';
import type {Product} from './worldContract';
import {searchableProduct} from './productReview';

export function productDisplayName(p:Product):string{return normalizeText(p.name).startsWith(normalizeText(p.brand))||!p.brand?p.name:(p.brand+' '+p.name).slice(0,120);}
export interface ProductMatch {product:Product;score:number;path:'BARCODE'|'OCR';conflicts:string[]}
const GENERIC=new Set('water wine wines beer beers spirit spirits whisky whiskey bourbon vodka gin rum tequila sake soju liqueur aperitif lager ale ipa stout pale pilsner pilsener cider hard seltzer sparkling soda alcohol alcoholic infused drink beverage premium craft brewing brewed brewery distillery distilleries distillers distilled produced product produce of by bottled company limited ltd co inc corporation original bottle can raspberry lime lemon orange apple peach cherry mango pink red white black dry brut aged barrel barrels cask vin vino biere blonde blanc rouge rose produit france french italian italy appellation origine protegee controlee grand bourgogne bordeaux loire val domaine chateau la le les de des du et au the and mit hergestellt bayerisches lecker trop forte'.split(' '));
export const distinctiveIdentityTerms=(text:string)=>normalizeText(text).split(' ').filter(t=>t.length>2&&!/^\d+$/.test(t)&&!GENERIC.has(t));
const key=(code:string)=>validGtin(code)?code.padStart(14,'0'):null;
const tokens=(text:string)=>normalizeText(text).split(' ').filter(t=>t.length>1&&!/^\d+$/.test(t));
export class ProductIndex {
  private codes=new Map<string,Product[]>();
  private terms=new Map<string,Set<number>>();
  private names:Array<Set<string>>=[];
  private numericBrands=new Set<string>();
  constructor(readonly products:Product[]){
    this.products=products.filter(searchableProduct);
    products=this.products;
    products.forEach((p,i)=>{
      p.barcodes.forEach(c=>{const k=key(c);if(k)this.codes.set(k,[...this.codes.get(k)??[],p]);});
      const t=new Set(tokens(p.brand+' '+p.name));const numeric=normalizeText(p.brand);if(/^\d{4,}$/.test(numeric)){t.add(numeric);this.numericBrands.add(numeric);}this.names.push(t);
      t.forEach(w=>{if(!this.terms.has(w))this.terms.set(w,new Set());this.terms.get(w)!.add(i);});
    });
  }
  barcode(code:string):Product[]{const k=key(code.trim());return k?this.codes.get(k)??[]:[];}
  search(input:{text:string;barcode?:string;region?:string;limit?:number}):ProductMatch[]{
    const facts=readPackageText(input.text,input.region);
    const conflicts=(p:Product)=>[
      ...(facts.abv!==null&&p.abv!==null&&facts.abv!==p.abv?['ABV_CONFLICT']:[]),
      ...(facts.volume.ml!==null&&p.packageVolumeMl!==null&&Math.abs(facts.volume.ml-p.packageVolumeMl)>Math.max(1,p.packageVolumeMl*.005)?['VOLUME_CONFLICT']:[]),
    ];
    const exact=input.barcode?this.barcode(input.barcode):[];
    if(exact.length)return exact.map(p=>({product:p,score:100,path:'BARCODE' as const,conflicts:conflicts(p)}));
    // Barcode miss does not bind text to some other SKU. OCR still provides independent dose facts.
    const words=tokens(input.text.slice(0,4000)),query=new Set(words),pool=new Set<number>();
    for(let i=0;i<words.length;i++)for(const count of [2,3]){const parts=words.slice(i,i+count),joined=parts.join('');if(!parts.every(t=>GENERIC.has(t))&&this.terms.has(joined))query.add(joined);}
    for(const n of input.text.match(/\b\d{4,}\b/g)??[])if(this.numericBrands.has(n))query.add(n);
    query.forEach(t=>this.terms.get(t)?.forEach(i=>pool.add(i)));
    const n=this.products.length;
    return [...pool].flatMap(i=>{
      const p=this.products[i],name=new Set([...this.names[i]].filter(t=>!GENERIC.has(t)));let matched=0,total=0,hits=0;
      name.forEach(t=>{const w=Math.log(1+n/(1+(this.terms.get(t)?.size??0)));total+=w;if(query.has(t)){matched+=w;hits++;}});
      // A partial personal/company name (Paul, Bernard) cannot bind another producer's SKU.
      const brandAliases=p.brand.split(',').map(b=>tokens(b).filter(t=>t.length>=4&&!GENERIC.has(t)));
      if(this.numericBrands.has(normalizeText(p.brand)))brandAliases.push([normalizeText(p.brand)]);
      const brandHit=brandAliases.some(ws=>ws.length>0&&ws.every(t=>query.has(t))&&ws.some(t=>(this.terms.get(t)?.size??0)<200));
      const productWords=tokens(p.name).filter(t=>!GENERIC.has(t));
      // A distinctive complete product name can be visible without its catalog's corporate owner.
      // Generic appellations/origin text cannot qualify through this path.
      const productHit=productWords.length>0&&productWords.every(t=>query.has(t))&&productWords.some(t=>t.length>=5&&(this.terms.get(t)?.size??0)<20);
      if(!hits||!name.size||(matched/total<.55&&!brandHit&&!productHit))return [];
      // One generic word is not a product identity, even if the database happens to contain one match.
      if(hits<2&&!brandHit&&!productHit)return [];
      const conflict=conflicts(p);
      const score=matched/total*60+hits+(brandHit?15:0)+(!conflict.length?8:-25)+(facts.abv!==null&&facts.abv===p.abv?8:0)+(facts.volume.ml!==null&&p.packageVolumeMl!==null&&Math.abs(facts.volume.ml-p.packageVolumeMl)<=1?10:0)+(input.region&&p.regions.includes(input.region)?3:0);
      return [{product:p,score,path:'OCR' as const,conflicts:conflict}];
    }).sort((a,b)=>b.score-a.score||a.product.id.localeCompare(b.product.id)).slice(0,input.limit??5);
  }
}
let loading:Promise<ProductIndex>|undefined;
export function loadProductIndex():Promise<ProductIndex>{
  return loading??=fetch('/intake/products-off.json').then(async r=>{if(!r.ok)throw Error('CATALOG_UNAVAILABLE');const v=await r.json() as {products:Product[]};return new ProductIndex(v.products);}).catch(e=>{loading=undefined;throw e;});
}
