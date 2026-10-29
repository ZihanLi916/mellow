import type {Interval,RecipeVariant} from './worldContract';
const range=(min:number,max:number):Interval=>({min,max});
/** Bounds deliberately retain ingredient/recipe uncertainty. Dilution conserves ethanol. */
export function calculateRecipe(variant:RecipeVariant){
  if(!variant.ingredients.length||variant.dilution.min<0||variant.dilution.max<variant.dilution.min)throw Error('INVALID_RECIPE');
  let vMin=0,vMax=0,eMin=0,eMax=0,refV=0,refE=0;
  for(const i of variant.ingredients){
    if([i.ml.min,i.ml.max,i.abv.min,i.abv.max,i.referenceMl,i.referenceAbv].some(x=>!Number.isFinite(x))||i.ml.min<0||i.ml.max<i.ml.min||i.abv.min<0||i.abv.max>100||i.abv.max<i.abv.min||i.referenceMl<0||i.referenceAbv<0||i.referenceAbv>100)throw Error('INVALID_INGREDIENT');
    vMin+=i.ml.min;vMax+=i.ml.max;eMin+=i.ml.min*i.abv.min/100;eMax+=i.ml.max*i.abv.max/100;refV+=i.referenceMl;refE+=i.referenceMl*i.referenceAbv/100;
  }
  if(vMin<=0||refV<=0)throw Error('EMPTY_RECIPE');
  const served=range(vMin*(1+variant.dilution.min),vMax*(1+variant.dilution.max));
  return {liquidMl:range(vMin,vMax),pureEthanolMl:range(eMin,eMax),ethanolGrams:range(eMin*.789,eMax*.789),
    preDilutionAbv:range(100*eMin/vMax,Math.min(100,100*eMax/vMin)),
    servedAbv:range(100*eMin/served.max,Math.min(100,100*eMax/served.min)),servedVolumeMl:served,
    reference:{liquidMl:refV,pureEthanolMl:refE,ethanolGrams:refE*.789,preDilutionAbv:100*refE/refV},
    basis:'RECIPE_PRIOR' as const};
}
export function recipeEnvelope(variants:RecipeVariant[]){
  if(!variants.length)throw Error('EMPTY_VARIANTS');const values=variants.map(calculateRecipe);
  const envelope=(k:'servedAbv'|'servedVolumeMl'|'ethanolGrams')=>range(Math.min(...values.map(v=>v[k].min)),Math.max(...values.map(v=>v[k].max)));
  return {abv:envelope('servedAbv'),servedVolumeMl:envelope('servedVolumeMl'),ethanolGrams:envelope('ethanolGrams')};
}
/** Must confirm a fraction of a recipe/pack before this becomes consumed ethanol. */
export function consumedEthanol(full:Interval,fraction:Interval):Interval{
  if(fraction.min<0||fraction.max>1||fraction.max<fraction.min||![full.min,full.max,fraction.min,fraction.max].every(Number.isFinite)||full.min<0||full.max<full.min)throw Error('INVALID_CONSUMPTION');
  return range(full.min*fraction.min,full.max*fraction.max);
}
