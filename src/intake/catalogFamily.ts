import {FAMILIES,type NormalizedIntake} from './normalized';

/** The product catalog uses singular SPIRIT; intake uses plural SPIRITS. */
export function intakeFamilyFromCatalog(family:string):NormalizedIntake['family']{
 if(family==='SPIRIT')return 'SPIRITS';
 return FAMILIES.includes(family as NormalizedIntake['family'])?family as NormalizedIntake['family']:'OTHER';
}
