import {resolveProductMetadata} from './metadataTrust';
import {readPackageText} from './packageText';
import {recipesFromText,recipeByName} from './recipes';
import {recipeEnvelope} from './recipeMath';
import type {ProductIndex,ProductMatch} from './products';
import type {ConfirmedIntake,Recipe} from './worldContract';
import {customRecipeFromText} from './customRecipe';

export interface WorldReading {
  text:string;barcode:string|null;products:ProductMatch[];recipes:Recipe[];
  custom?:{name:string;intake:ConfirmedIntake}|null;
  facts:ReturnType<typeof readPackageText>;
  decision:'CHOOSE_TARGET'|'CONFIRM_READING'|'ABSTAIN';
  autoConfirm:false;probability:null;calibration:'NOT_CALIBRATED';
}
export function interpretWorld(index:ProductIndex,input:{text:string;barcode?:string;region?:string;scene?:string}):WorldReading{
  const facts=readPackageText(input.text,input.region),custom=input.scene==='PACKAGED'?null:customRecipeFromText(input.text),recipes=input.scene==='PACKAGED'||custom?[]:recipesFromText(input.text);
  const products=input.scene==='MENU'||recipes.length||custom?[]:index.search(input);
  return {text:input.text,barcode:input.barcode??null,products,recipes,custom,facts,decision:recipes.length>1?'CHOOSE_TARGET':custom||recipes.length||products.length||facts.abv!==null||facts.volume.ml!==null?'CONFIRM_READING':'ABSTAIN',autoConfirm:false,probability:null,calibration:'NOT_CALIBRATED'};
}
export function packageIntake(reading:WorldReading,match?:ProductMatch):ConfirmedIntake {
  const p=match?.product,metadata=p?resolveProductMetadata(p):null;
  // Only a selected barcode binds these local facts to a SKU. OCR alternatives keep
  // their quantities unknown; the independent label reading remains available.
  const labelBound=!match||match.path==='BARCODE';
  const abv=labelBound?reading.facts.abv??metadata?.abv??null:metadata?.abv??null,volume=labelBound?reading.facts.volume.ml??metadata?.packageVolumeMl??null:metadata?.packageVolumeMl??null;
  return {version:'intake-world-v1',kind:'PACKAGE',...(p?{productId:p.id}:{}),packageVolumeMl:volume,servedVolumeMl:null,abv:abv!==null?{min:abv,max:abv}:null,
    ethanolGrams:abv!==null&&volume!==null?{min:volume*abv*.00789,max:volume*abv*.00789}:null,
    basis:labelBound&&(reading.facts.abv!==null||reading.facts.volume.ml!==null)?'LABEL_READING':'USER',sources:p?[p.source]:['user-confirmed-label-reading'],requiresConsumptionConfirmation:true};
}
export function recipeIntake(recipe:Recipe):ConfirmedIntake{return {version:'intake-world-v1',kind:'RECIPE',recipeId:recipe.id,packageVolumeMl:null,...recipeEnvelope(recipe.variants),basis:'RECIPE_PRIOR',sources:[recipe.source],requiresConsumptionConfirmation:true};}
export function namedRecipeIntake(name:string):ConfirmedIntake|null{const recipe=recipeByName(name);return recipe?recipeIntake(recipe):null;}
