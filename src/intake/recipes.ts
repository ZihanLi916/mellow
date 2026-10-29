import data from '../../data/intake/recipes.json';
import {normalizeText} from '../knowledge/normalization';
import type {Recipe} from './worldContract';
export const RECIPES:Recipe[]=data.recipes as Recipe[];
const names=RECIPES.flatMap(recipe=>[recipe.name,...recipe.aliases].map(name=>({name:normalizeText(name),recipe}))).sort((a,b)=>b.name.length-a.name.length);
/** Exact name lookup is separate from appearance. A menu ingredient alone is never a recipe identity. */
export function recipeByName(name:string):Recipe|null {const normalized=normalizeText(name);return names.find(n=>n.name===normalized)?.recipe??null;}
export function recipesFromText(text:string):Recipe[]{
  const lines=text.slice(0,4000).split(/[\n;]+/).map(normalizeText),found=new Map<string,Recipe>();
  for(const line of lines){
    // Require the entry name at the start, before description/price. Suppresses ingredient/house-name collisions.
    const match=names.find(n=>{
      if(line===n.name)return true;if(!line.startsWith(n.name+' '))return false;
      const tail=line.slice(n.name.length+1);
      return /^\d/.test(tail)||n.recipe.variants.some(v=>v.ingredients.some(i=>tail.startsWith(normalizeText(i.name))));
    });
    if(match)found.set(match.recipe.id,match.recipe);
  }
  return [...found.values()].slice(0,5);
}
