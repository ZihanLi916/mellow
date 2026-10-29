import {z} from 'zod';

export const intervalSchema=z.object({min:z.number().finite().nonnegative(),max:z.number().finite().nonnegative()}).refine(r=>r.min<=r.max);
export type Interval=z.infer<typeof intervalSchema>;
export const customRecipeSchema=z.object({ingredients:z.array(z.object({name:z.string().min(1).max(100),ml:z.number().positive().max(1000),abv:z.number().min(0).max(100)}).strict()).min(2).max(12),dilution:intervalSchema}).strict();
export const productSchema=z.object({
  id:z.string().max(100),kind:z.literal('PRODUCT'),brand:z.string().max(300),name:z.string().min(1).max(300),variant:z.string().max(500),
  family:z.string().max(80),barcodes:z.array(z.string().regex(/^\d{8,14}$/)).max(8),regions:z.array(z.string().max(80)).max(100),
  abv:z.number().min(0).max(100).nullable(),packageVolumeMl:z.number().positive().max(5000).nullable(),
  packCount:z.number().int().positive().max(200).nullable(),packBarcode:z.boolean(),
  source:z.string().url(),sourceDate:z.string(),retrievedAt:z.string(),license:z.literal('ODbL-1.0'),
  confidence:z.literal('UNVERIFIED_CATALOG'),
});
export type Product=z.infer<typeof productSchema>;
export interface Ingredient {id:string;name:string;ml:Interval;abv:Interval;referenceMl:number;referenceAbv:number;basis:'SOURCE_QUANTITY'|'CURATED_CONVERSION';unitNote:string}
export interface RecipeVariant {id:string;name:string;ingredients:Ingredient[];dilution:Interval;basis:string}
export interface Recipe {id:string;name:string;aliases:string[];glassId:string;source:string;upstreamReference:string|null;sourceDate:string;variants:RecipeVariant[];assumptions:string[]}
/** Intake evidence is a user-confirmed reading, never a consumption event. */
export const confirmedIntakeSchema=z.object({
  version:z.literal('intake-world-v1'),kind:z.enum(['PACKAGE','RECIPE','CUSTOM']),
  productId:z.string().max(100).optional(),recipeId:z.string().max(100).optional(),
  customRecipe:customRecipeSchema.optional(),
  packageVolumeMl:z.number().positive().max(5000).nullable(),
  servedVolumeMl:intervalSchema.nullable(),abv:intervalSchema.nullable(),ethanolGrams:intervalSchema.nullable(),
  basis:z.enum(['LABEL_READING','CATALOG_CONFIRMED','RECIPE_PRIOR','USER']),
  sources:z.array(z.string().max(500)).max(8),requiresConsumptionConfirmation:z.literal(true),
}).strict();
export type ConfirmedIntake=z.infer<typeof confirmedIntakeSchema>;
