import {customRecipeSchema,type ConfirmedIntake} from './worldContract';
import {calculateRecipe} from './recipeMath';
export function customIntake(raw:unknown):ConfirmedIntake{
  const customRecipe=customRecipeSchema.parse(raw);
  if(customRecipe.dilution.max>1||customRecipe.ingredients.reduce((s,i)=>s+i.ml,0)>5000)throw Error('CUSTOM_RECIPE_OUT_OF_RANGE');
  const math=calculateRecipe({id:'custom',name:'User supplied quantities',basis:'USER',dilution:customRecipe.dilution,ingredients:customRecipe.ingredients.map((i,n)=>({id:'custom-'+n,name:i.name,ml:{min:i.ml,max:i.ml},abv:{min:i.abv,max:i.abv},referenceMl:i.ml,referenceAbv:i.abv,basis:'SOURCE_QUANTITY',unitNote:'Explicit user-confirmed quantity and strength'}))});
  return {version:'intake-world-v1',kind:'CUSTOM',customRecipe,packageVolumeMl:null,servedVolumeMl:math.servedVolumeMl,abv:math.servedAbv,ethanolGrams:math.ethanolGrams,basis:'USER',sources:['user-confirmed-ingredient-quantities','mellow-dilution-prior-0-to-40-percent'],requiresConsumptionConfirmation:true};
}
/** A name/ingredient list without amounts does not support a numeric estimate. */
export function customRecipeFromText(text:string):{name:string;intake:ConfirmedIntake}|null{
  const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);if(lines.length<3||lines.length>13)return null;
  const [name,...rest]=lines;if(name.length>120)return null;
  const ingredients=[];
  for(const line of rest){
    const match=line.match(/^(.+?)\s*[:：]?\s+(\d+(?:[.,]\d+)?)\s*(ml|cl|毫升)\s*@\s*(\d+(?:[.,]\d+)?)\s*%$/i);if(!match)return null;
    ingredients.push({name:match[1].replace(/[:：]$/,'').trim(),ml:Number(match[2].replace(',','.'))*(match[3].toLowerCase()==='cl'?10:1),abv:Number(match[4].replace(',','.'))});
  }
  try{return {name,intake:customIntake({ingredients,dilution:{min:0,max:.4}})};}catch{return null;}
}
