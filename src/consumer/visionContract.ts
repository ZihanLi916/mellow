import {z} from 'zod';
import {exactPrintedAbv} from '../intake/printed';
import {observationsSchema,validateObservations} from '../intake/evidence';
// Production primary: official DeepSeek API, explicit thinking disabled. Qwen is rollback-only.
export const VISION_MODEL='deepseek-flash';
export const VISION_VERSION='mellow-visible-evidence-v6-deepseek-recovery';
export const printedAbvSchema=z.object({percent:z.number().min(0).max(100),quote:z.string().min(1).max(100)}).strict();
export const targetSchema=z.object({label:z.string().min(1).max(120),category:z.enum(['UNKNOWN','BEER','WINE','COCKTAIL','SPIRITS','OTHER']),confidence:z.enum(['LOW','MEDIUM','HIGH']),position:z.string().max(100),visibleEvidence:z.array(z.string().max(160)).max(4),kind:z.enum(['DRINK','MENU_ITEM']).optional(),printedAbv:printedAbvSchema.nullable().optional(),observations:observationsSchema.optional(),detectedText:z.array(z.string().max(160)).max(8).optional(),sceneType:observationsSchema.shape.scene_type.optional(),statedVolume:observationsSchema.shape.stated_volume.optional()}).strict();
export const visionSchema=z.object({scene:z.enum(['PACKAGED','SERVED','MULTIPLE','MENU','UNKNOWN']),targets:z.array(targetSchema).max(8)}).strict();
// The provider must explicitly represent missing fields. Local parser also reads v1 responses.
export const providerDetailedVisionSchema=z.object({scene:visionSchema.shape.scene,targets:z.array(targetSchema.extend({label:z.string().min(1).max(80),position:z.string().max(60),visibleEvidence:z.array(z.string().max(80)).max(1)}).required({kind:true,printedAbv:true,observations:true})).max(4)}).strict();
// Short online contract: omit speculative/null-heavy fields; expand them to explicit unknown locally.
export const providerVisionSchema=z.object({scene:visionSchema.shape.scene,targets:z.array(targetSchema.omit({observations:true}).extend({label:z.string().min(1).max(80),position:z.string().max(60),visibleEvidence:z.array(z.string().max(80)).max(1)}).required({kind:true,printedAbv:true,detectedText:true,sceneType:true,statedVolume:true})).max(4)}).strict();
/** Remove only an unsupported numeric field, never discard the useful identity beside it. */
export function validatePrintedEvidence(input:z.infer<typeof visionSchema>):z.infer<typeof visionSchema>{
  return {...input,targets:input.targets.map(t=>{
    const abv=t.printedAbv;
    const observations=t.observations?validateObservations(t.observations):t.detectedText?validateObservations({
      scene_type:t.sceneType??'unknown',detected_text:t.detectedText,brand:null,product_name:null,menu_item_name:null,
      stated_volume:t.statedVolume??null,container_type:t.sceneType==='bottle'?'bottle':t.sceneType==='can'?'can':'unknown',
      estimated_fill_level:null,visible_size_reference:null,ingredients_if_explicitly_visible:[],candidate_products:[],visual_confidence:null,OCR_confidence:null,
    }):undefined;
    const grounded=!observations||observations.detected_text.some(text=>text.normalize('NFKC').includes(abv?.quote.normalize('NFKC')??'\0'));
    return {...t,...(observations?{observations}:{}),category:t.confidence==='LOW'?'UNKNOWN':t.category,kind:input.scene==='MENU'?'MENU_ITEM':t.kind??'DRINK',printedAbv:abv&&grounded&&exactPrintedAbv(abv.quote)===abv.percent?abv:null};
  })};
}
export type VisualIdentity=z.infer<typeof visionSchema>;
export type VisualTarget=z.infer<typeof targetSchema>;
