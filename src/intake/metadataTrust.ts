import {validGtin} from '../knowledge/contracts';
import {normalizeText} from '../knowledge/normalization';
import {productDisplayName} from './products';
import {defaultIntake,type NormalizedIntake} from './normalized';
import {intakeFamilyFromCatalog} from './catalogFamily';
import {searchableProduct} from './productReview';
import type {Product} from './worldContract';

export const METADATA_TRUST=['VISIBLE_LABEL','EXACT_VERIFIED_SKU','EXACT_CANONICAL_PRODUCT_WITH_MARKET_MATCH','CANDIDATE_METADATA','UNKNOWN'] as const;
export type MetadataTrust=typeof METADATA_TRUST[number];
export type MetadataBinding={productId:string;canonicalIdentity:string;source:string;market:string|null;trust:MetadataTrust};
/** Only a separately reviewed source can create this record. A catalog hit, numeric
 * confidence, barcode checksum or matching name is never evidence of verification. */
export type VerifiedProductMetadata={productId:string;canonicalIdentity:string;source:string;barcodes:string[];markets:string[];abv:number|null;packageVolumeMl:number|null};
type Context={barcode?:string;market?:string;verified?:VerifiedProductMetadata;visible?:{identity:string;abv:number|null;packageVolumeMl:number|null}};
const same=(a:string,b:string)=>normalizeText(a)===normalizeText(b);
const abvValue=(n:number|null|undefined)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100?n:null;
const sizeValue=(n:number|null|undefined)=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=5000?n:null;
const sameBarcode=(a:string,b:string)=>validGtin(a)&&validGtin(b)&&a.padStart(14,'0')===b.padStart(14,'0');
export function resolveProductMetadata(product:Product,context:Context={}){
 const canonicalIdentity=productDisplayName(product),eligible=searchableProduct(product);
 const binding:MetadataBinding={productId:product.id,canonicalIdentity,source:product.source,market:context.market??null,trust:eligible?'CANDIDATE_METADATA':'UNKNOWN'};
 let abv:number|null=null,packageVolumeMl:number|null=null;
 const proof=context.verified;
 const bound=eligible&&proof&&proof.productId===product.id&&same(proof.canonicalIdentity,canonicalIdentity)&&/^https:\/\//.test(proof.source);
 const marketMatch=Boolean(bound&&context.market&&proof.markets.includes(context.market));
 // An explicit different market invalidates even a barcode assertion.
 const marketCompatible=!context.market||Boolean(proof?.markets.includes(context.market));
 const skuMatch=Boolean(bound&&marketCompatible&&context.barcode&&product.barcodes.some(b=>sameBarcode(b,context.barcode!))&&proof.barcodes.some(b=>sameBarcode(b,context.barcode!)));
 if(bound&&(skuMatch||marketMatch)){
  binding.trust=skuMatch?'EXACT_VERIFIED_SKU':'EXACT_CANONICAL_PRODUCT_WITH_MARKET_MATCH';
  binding.source=proof.source;abv=abvValue(proof.abv);packageVolumeMl=sizeValue(proof.packageVolumeMl);
 }
 const visible=context.visible;
 // Reading belongs to this identity only, not whichever catalog candidate ranks first.
 if(visible&&same(visible.identity,canonicalIdentity)){
  const printedAbv=abvValue(visible.abv),printedSize=sizeValue(visible.packageVolumeMl);
  if(printedAbv!==null||printedSize!==null){
   // No mixed source claim: unread label fields stay unknown on this reading.
   abv=printedAbv;packageVolumeMl=printedSize;
   binding.trust='VISIBLE_LABEL';binding.source='Visible label';
  }
 }
 return {abv,packageVolumeMl,servingVolumeMl:null,basis:'PRODUCT_KB' as const,source:binding.source,binding};
}
export function trustedCandidateMetadata(candidate:{drinkId:string;name:string;metadata?:{abv:number|null;packageVolumeMl:number|null;source:string;binding?:MetadataBinding}}){
 const m=candidate.metadata,b=m?.binding;
 const bound=Boolean(m&&b&&b.productId===candidate.drinkId&&same(b.canonicalIdentity,candidate.name)&&b.source===m.source&&searchableProduct({id:candidate.drinkId}));
 const trusted=bound&&b&&METADATA_TRUST.slice(0,3).includes(b.trust);
 return {abv:trusted?abvValue(m?.abv):null,packageVolumeMl:trusted?sizeValue(m?.packageVolumeMl):null};
}
export function productSearchDraft(product:Product):NormalizedIntake{
 const metadata=resolveProductMetadata(product),family=intakeFamilyFromCatalog(product.family);
 return {...defaultIntake(family,productDisplayName(product).slice(0,120)),productId:product.id,abv:metadata.abv??NaN,packageMl:metadata.packageVolumeMl,source:'SEARCH',
  metadataProvenance:[`Candidate identity · ${product.id} · ${productDisplayName(product)}`.slice(0,500),`Candidate source · ${product.source}`,`Metadata trust · ${metadata.binding.trust}`],estimate:true};
}
/** User edits win, without erasing which identity/source supplied the candidate. */
export function confirmIntakeAbv(draft:NormalizedIntake,abv:number):NormalizedIntake{
 return {...draft,abv,metadataProvenance:[...draft.metadataProvenance.filter(s=>!s.startsWith('User confirmed ABV')).slice(0,7),'User confirmed ABV']};
}
/** Old saved candidates predate field-level confirmation. Reusing a saved drink
 * must not promote that legacy catalog value into confirmed metadata. */
export function reuseIntake(draft:NormalizedIntake):NormalizedIntake{
 const candidate=draft.metadataProvenance.some(s=>/^Product KB candidate|^Metadata trust · (CANDIDATE_METADATA|UNKNOWN)$/.test(s));
 if(!candidate)return draft;
 const confirmed=draft.metadataProvenance.some(s=>/^User (confirmed|selected) ABV/.test(s));
 return {...draft,abv:confirmed?draft.abv:NaN,packageMl:null,estimate:true};
}
export function renameIntake(draft:NormalizedIntake,identity:string):NormalizedIntake{
 if(identity===draft.identity)return draft;
 const {productId:_,...unbound}=draft;
 const userAbv=draft.metadataProvenance.some(s=>/^(User confirmed ABV|User selected ABV|User entry|User configured measure)/.test(s));
 return {...unbound,identity,abv:userAbv?draft.abv:NaN,packageMl:null,metadataProvenance:['User entered identity',...(userAbv?['User confirmed ABV']:[])]};
}
