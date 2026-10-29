import {z} from 'zod';
export const FAMILIES=['BEER','WINE','SPIRITS','COCKTAIL','RTD','OTHER'] as const;
export const normalizedIntakeSchema=z.object({
 identity:z.string().trim().min(1).max(120),productId:z.string().min(1).max(100).optional(),family:z.enum(FAMILIES),
 abv:z.number().finite().min(0).max(100),actualConsumedMl:z.number().finite().min(.01).max(5000),
 source:z.enum(['SCAN','BROWSE','SEARCH','SAME_AGAIN','CUSTOM','PREMIUM_SHORTCUT']),
 metadataProvenance:z.array(z.string().min(1).max(500)).min(1).max(8),
 servingProvenance:z.enum(['VISIBLE_PACKAGE','POPULATION_PRESET','PRODUCT_METADATA','USER_CUSTOM','PREMIUM_SHORTCUT']),
 packageMl:z.number().positive().max(5000).nullable(),estimate:z.boolean(),
}).strict();
export type NormalizedIntake=z.infer<typeof normalizedIntakeSchema>;
export const shortcutSchema=z.object({id:z.string().min(1).max(100),pinned:z.boolean(),intake:normalizedIntakeSchema}).strict();
export type Shortcut=z.infer<typeof shortcutSchema>;
// Nominal choices, never inferred personal servings or physiological claims.
export const SERVINGS={
 BEER:[['Bottle / Can',330],['Draft / Pint',473],['Large Draft',568]],
 WINE:[['Small Pour',100],['A Glass',150],['Generous Pour',200]],
 SPIRITS:[['Shot',30],['Standard Pour',45],['Generous / Double',60]],
 COCKTAIL:[['One cocktail',150],['Half',75]],RTD:[['Can',330],['Large can',500]],OTHER:[['Small glass',150],['A glass',250]],
} as const;
export const DEFAULT_ABV={BEER:5,WINE:13,SPIRITS:40,COCKTAIL:15,RTD:5,OTHER:5};
export function defaultIntake(family:NormalizedIntake['family'],identity:string=family):NormalizedIntake{return {identity,family,abv:DEFAULT_ABV[family],actualConsumedMl:SERVINGS[family][family==='WINE'||family==='SPIRITS'?1:0][1],source:'BROWSE',metadataProvenance:['Population default · confirm ABV'],servingProvenance:'POPULATION_PRESET',packageMl:null,estimate:true};}
export function intakeCommand(intake:NormalizedIntake,id:string,now=new Date()){
 const n=normalizedIntakeSchema.parse(intake);
 return {type:'drink' as const,timezoneOffsetMinutes:now.getTimezoneOffset(),input:{id,confirmedAt:now.toISOString(),label:n.identity,category:n.family==='RTD'?'OTHER':n.family,abvPercent:n.abv,photoFingerprint:`intake:${id}`,identitySource:'USER_CONFIRMED',recognitionVersion:'intake-v1',normalizedIntake:n,...(n.productId?{knowledgeDrinkId:n.productId}:{}),consumptionConfirmation:{consumedVolumeMl:n.actualConsumedMl,abvPercent:n.abv}}};
}
