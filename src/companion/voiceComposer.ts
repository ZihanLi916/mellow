import type {ContentDecision, FamiliarityBand} from '../content';
import {templatesFor,isTemplateAllowed} from '../content';
import {auditVoice,hardViolations,sentenceCount} from '../content';
/** A deliberately constrained voice composer: approved equivalent sentences only until free-form grounding is validated. */
export type VoiceRequest={allowedFacts:ContentDecision['current_fact'];tone:ContentDecision['tone'];allowedSentences:string[];allowNoComment:boolean};
export type VoiceComposer=(request:VoiceRequest,signal:AbortSignal)=>Promise<string>;
export function similarSentence(a:string,b:string){
  const words=(s:string)=>new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean));
  const x=words(a),y=words(b),union=new Set([...x,...y]);
  return a.trim().toLowerCase()===b.trim().toLowerCase()||[...x].filter(w=>y.has(w)).length/Math.max(1,union.size)>=.65;
}
export function approvedVoiceSentences(decision:ContentDecision,band:FamiliarityBand){
  if(!decision.should_speak||!decision.speech_reason)return [];
  return templatesFor(decision.speech_reason).filter(t=>isTemplateAllowed(t,{band,safety:decision.safety_level,
    evidence:{level:decision.evidence_level,generalization:t.generalization},facts:decision.current_fact}))
    .map(t=>t.text).filter(text=>sentenceCount(text)<=1);
}
export function validateComposedVoice(text:string,decision:ContentDecision,allowed:string[],previous:string[]=[]){
  if(!allowed.includes(text)||previous.some(p=>similarSentence(p,text))||!decision.tone||!decision.speech_act)return false;
  return hardViolations(auditVoice(text,{safetyLevel:decision.safety_level,speechAct:decision.speech_act,tone:decision.tone,maxWords:22,maxSentences:1})).length===0;
}
export async function composeVoice(decision:ContentDecision,band:FamiliarityBand,composer?:VoiceComposer,previous:string[]=[],timeoutMs=1500){
  if(!decision.should_speak)return {message:null,source:'NO_COMMENT' as const};
  // Safety priority and safety copy cannot be rewritten or suppressed by an LLM.
  if(decision.priority==='P0')return {message:decision.message,source:'DETERMINISTIC_SAFETY' as const};
  const allowed=approvedVoiceSentences(decision,band).filter(t=>validateComposedVoice(t,decision,approvedVoiceSentences(decision,band),previous));
  const fallback=allowed.includes(decision.message??'')?decision.message:allowed[0]??null;
  if(!composer||!allowed.length)return {message:fallback,source:fallback?'DETERMINISTIC_FALLBACK' as const:'NO_COMMENT' as const};
  const abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error('VOICE_TIMEOUT'));},Math.max(1,Math.min(timeoutMs,1500)));});
    const text=await Promise.race([composer({allowedFacts:{...decision.current_fact},tone:decision.tone,allowedSentences:allowed,allowNoComment:true},abort.signal),timeout]);
    if(text==='NO_COMMENT')return {message:null,source:'NO_COMMENT' as const};
    if(validateComposedVoice(text,decision,allowed,previous))return {message:text,source:'LLM_CONSTRAINED_VOICE' as const};
  }catch{/* Deterministic fallback is the complete offline path. */}finally{if(timer)clearTimeout(timer);abort.abort();}
  return {message:fallback,source:'DETERMINISTIC_FALLBACK' as const};
}
