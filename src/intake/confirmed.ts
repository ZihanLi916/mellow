import {confirmedIntakeSchema,type ConfirmedIntake} from './worldContract';
import {RECIPES} from './recipes';
import {recipeIntake} from './world';
import {customIntake} from './customRecipe';
/** Do not trust client-computed dose. Recompute from accepted facts or a pinned recipe. */
export function normalizeConfirmedIntake(raw:unknown,label:string,abvPercent:number|null):ConfirmedIntake{
  const value=confirmedIntakeSchema.parse(raw);
  if(value.kind==='CUSTOM')return customIntake(value.customRecipe);
  if(value.kind==='RECIPE'){
    const r=RECIPES.find(r=>r.id===value.recipeId);
    if(!r||r.name!==label||abvPercent!==null)throw Error('RECIPE_IDENTITY_MISMATCH');
    return recipeIntake(r);
  }
  if(value.kind!=='PACKAGE')throw Error('CUSTOM_RECIPE_REQUIRES_QUANTITIES');
  const volume=value.packageVolumeMl;
  return {...value,recipeId:undefined,servedVolumeMl:null,abv:abvPercent===null?null:{min:abvPercent,max:abvPercent},ethanolGrams:volume!==null&&abvPercent!==null?{min:volume*abvPercent*.00789,max:volume*abvPercent*.00789}:null};
}
