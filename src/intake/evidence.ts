import {z} from 'zod';
import {exactPrintedVolume} from './printed';
const text=z.string().min(1).max(160);
const quoted=z.object({value:text,quote:text}).strict().nullable();
export const observationsSchema=z.object({
  scene_type:z.enum(['menu','bottle','can','beer_glass','wine_glass','cocktail','shot','mixed_scene','unknown']),
  detected_text:z.array(text).max(8),
  brand:quoted, product_name:quoted, menu_item_name:quoted,
  stated_volume:z.object({ml:z.number().positive().max(5000),quote:text,scope:z.enum(['PACKAGE','SERVING'])}).strict().nullable(),
  container_type:z.enum(['bottle','can','glass','cup','unknown']),
  estimated_fill_level:z.number().min(0).max(1).nullable(),
  visible_size_reference:text.nullable(),
  ingredients_if_explicitly_visible:z.array(text).max(12),
  candidate_products:z.array(z.object({name:text,quote:text,visual_confidence:z.number().min(0).max(1).nullable()}).strict()).max(3),
  visual_confidence:z.number().min(0).max(1).nullable(),
  OCR_confidence:z.number().min(0).max(1).nullable(),
}).strict();
export type Observations=z.infer<typeof observationsSchema>;
const normalize=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
export function validateObservations(value:Observations):Observations {
  const o=observationsSchema.parse(value),ocr=normalize(o.detected_text.join(' '));
  const grounded=(value:string,quote:string)=>ocr.includes(normalize(quote))&&normalize(quote).includes(normalize(value));
  const field=(v:Observations['brand'])=>v&&grounded(v.value,v.quote)?v:null;
  return {...o,brand:field(o.brand),product_name:field(o.product_name),menu_item_name:field(o.menu_item_name),
    stated_volume:o.stated_volume&&ocr.includes(normalize(o.stated_volume.quote))&&exactPrintedVolume(o.stated_volume.quote)===o.stated_volume.ml?o.stated_volume:null,
    ingredients_if_explicitly_visible:o.ingredients_if_explicitly_visible.filter(v=>ocr.includes(normalize(v))),
    candidate_products:o.candidate_products.filter(v=>grounded(v.name,v.quote)),
  };
}
