import {z} from 'zod';
export const MODEL_VERSION='response-offset-v1';
export const OFFSET_BOUNDS={min:-.12,max:.12};
export const directionSchema=z.enum(['LIGHTER','ABOUT_RIGHT','STRONGER']);
export const evidenceSchema=z.object({nightId:z.string(),source:z.enum(['REALTIME','NEXT_DAY']),direction:directionSchema,qualityWeight:z.number().min(0).max(1),sourceRevision:z.number().int().nonnegative()});
export const calibrationSchema=z.object({personalResponseOffset:z.number().min(-.12).max(.12),evidence:z.array(evidenceSchema),updates:z.array(z.object({nightId:z.string(),feedbackSource:z.string(),feedbackDirection:directionSchema,qualityWeight:z.number(),oldOffset:z.number(),newOffset:z.number(),modelVersion:z.literal(MODEL_VERSION),sourceRevision:z.number()}))});
export type Calibration=z.infer<typeof calibrationSchema>;
export const emptyCalibration=():Calibration=>({personalResponseOffset:0,evidence:[],updates:[]});
export function calibrationEnvelope(base:number,offset:number){
 const b=Math.max(0,Math.min(1,base)),o=Math.max(OFFSET_BOUNDS.min,Math.min(OFFSET_BOUNDS.max,offset));
 return b+o*4*b*(1-b); // contracts to zero at both endpoints; cannot reverse ordering.
}
/** Internal evidence diagnostics, never an XP/progress meter. Low-quality and conflicting
 * observations cannot unlock a mature label by accumulating calendar nights. */
export function calibrationEvidence(c:Calibration){
 const usable=c.updates.filter(u=>u.qualityWeight>0);
 const mass=usable.reduce((sum,u)=>sum+u.qualityWeight,0);
 const directions=new Map<string,number>();
 for(const u of usable)directions.set(u.feedbackDirection,(directions.get(u.feedbackDirection)??0)+u.qualityWeight);
 const agreement=mass?Math.max(0,...directions.values())/mass:0;
 const conflictShare=c.updates.length?c.updates.filter(u=>u.qualityWeight===0&&c.evidence.some(e=>e.nightId===u.nightId&&e.direction!==u.feedbackDirection)).length/c.updates.length:0;
 // Sensitivity to any single independent contribution, using the same fixed update rule.
 const maxOmissionShift=Math.max(0,...usable.map(omitted=>{
  let offset=0;
  for(const u of c.updates){if(u.nightId===omitted.nightId)continue;const sign=u.feedbackDirection==='STRONGER'?1:u.feedbackDirection==='LIGHTER'?-1:0;
   offset=Math.max(OFFSET_BOUNDS.min,Math.min(OFFSET_BOUNDS.max,offset*(1-.04*u.qualityWeight)+sign*.012*u.qualityWeight));}
  return Math.abs(offset-c.personalResponseOffset);
 }));
 return {mass,agreement,conflictShare,maxOmissionShift,stable:agreement>=.75&&conflictShare<=.2&&maxOmissionShift<=.02};
}
export function calibrationStatus(c:Calibration){const e=calibrationEvidence(c);return e.mass<2.4-1e-9?'Learning':e.mass>=6.4-1e-9&&e.stable?'Personalized':'Taking shape';}
/** One replaceable contribution per independent night. Replaying the ledger prevents double updates
 * when the higher-quality retrospective arrives. Conflicts contribute zero. No exposure/safety input. */
export function recordCalibration(current:Calibration,input:z.infer<typeof evidenceSchema>):Calibration{
 const e=evidenceSchema.parse(input);
 if(current.evidence.some(v=>v.nightId===e.nightId&&v.source===e.source))return current;
 const evidence=[...current.evidence,e],groups=new Map<string,typeof evidence>();
 for(const v of evidence)groups.set(v.nightId,[...groups.get(v.nightId)??[],v]);
 let offset=0;const updates:Calibration['updates']=[];
 for(const [nightId,notes] of groups){
  const rt=notes.find(v=>v.source==='REALTIME'),nd=notes.find(v=>v.source==='NEXT_DAY'),note=nd??rt!;
  const conflict=rt&&nd&&rt.direction!==nd.direction;
  const qualityWeight=conflict?0:Math.min(...notes.map(n=>n.qualityWeight))*(nd?(rt?1:.8):.3);
  const oldOffset=offset,sign=note.direction==='STRONGER'?1:note.direction==='LIGHTER'?-1:0;
  offset=Math.max(OFFSET_BOUNDS.min,Math.min(OFFSET_BOUNDS.max,offset*(1-.04*qualityWeight)+sign*.012*qualityWeight));
  updates.push({nightId,feedbackSource:notes.map(n=>n.source).join('+'),feedbackDirection:note.direction,qualityWeight,oldOffset,newOffset:offset,modelVersion:MODEL_VERSION,sourceRevision:Math.max(...notes.map(n=>n.sourceRevision))});
 }
 return {personalResponseOffset:offset,evidence,updates};
}

export function forgetCalibrationNight(c:Calibration,nightId:string):Calibration{return c.evidence.filter(e=>e.nightId!==nightId).reduce(recordCalibration,emptyCalibration());}
