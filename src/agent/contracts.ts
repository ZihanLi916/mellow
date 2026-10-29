import {z} from 'zod';
import {FAMILIES,normalizedIntakeSchema} from '../intake/normalized';
export const AGENT_VERSION='mellow-agent-v0.1';
export const intents=['INTAKE','REPEAT','MEASURE','RECALL','COMPARE','TIDE','STYLE','FEEDBACK','CHAT','SAFETY'] as const;
export const candidateSchema=z.object({identity:z.string().trim().min(1).max(120),family:z.enum(FAMILIES),abv:z.number().min(0).max(100).nullable(),packageMl:z.number().positive().max(5000).nullable()}).strict();
export const draftSchema=z.object({identity:z.string().max(120),family:z.enum(FAMILIES),abv:z.number().min(0).max(100).nullable(),consumedMl:z.number().positive().max(5000).nullable(),quantity:z.number().positive().max(100),fraction:z.number().positive().max(10),provenance:z.record(z.string(),z.string().max(200)),unresolved:z.array(z.string()),confidence:z.enum(['LOW','MEDIUM','HIGH']),intake:normalizedIntakeSchema.nullable()}).strict();
export const requestSchema=z.object({requestId:z.string().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/).optional(),version:z.literal(AGENT_VERSION).optional(),text:z.string().trim().min(1).max(1000),timezoneOffsetMinutes:z.number().int().min(-840).max(840),candidate:candidateSchema.optional(),draft:draftSchema.optional(),context:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(500)}).strict()).max(6).optional()}).strict();
export type AgentInput=z.infer<typeof requestSchema>;
export type IntakeDraft=z.infer<typeof draftSchema>;
export type AgentResult={version:typeof AGENT_VERSION;intent:typeof intents[number];line:string;tools:string[];draft?:IntakeDraft;feedback?:{sessionId:string;direction:'LIGHTER'|'ABOUT_RIGHT'|'STRONGER'};evidence?:Record<string,unknown>;chips?:string[];provider:'deterministic'|'deepseek-flash'|'fallback';latencyMs:number;requiresConfirmation:true;blocks?:AgentBlockV1[];premium?:boolean;error?:AgentErrorV1;metrics?:{providerMs:number;toolMs:number;inputTokens:number;outputTokens:number}};

export const planSchema=z.object({intent:z.enum(intents),identity:z.string().max(120).nullable(),reply:z.string().max(240)}).strict();
export const blockSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('assistant_text'),text:z.string().max(4000)}).strict(),
 z.object({type:z.literal('general_chat'),text:z.string().max(240)}).strict(),
 z.object({type:z.literal('clarification'),question:z.string().max(1000),choices:z.array(z.string().max(160)).max(8)}).strict(),
 z.object({type:z.literal('intake_draft'),draft:draftSchema}).strict(),
 ...(['night_tide','comparison','history_result','personal_model'] as const).map(type=>z.object({type:z.literal(type),facts:z.record(z.string(),z.unknown())}).strict()),
 z.object({type:z.literal('felt_feedback_draft'),sessionId:z.string(),direction:z.enum(['LIGHTER','ABOUT_RIGHT','STRONGER'])}).strict(),
 z.object({type:z.literal('error'),code:z.enum(['PROVIDER_UNAVAILABLE','MODEL_TIMEOUT','MALFORMED_RESPONSE']),recoverable:z.literal(true)}).strict(),
]);
export type AgentBlockV1=z.infer<typeof blockSchema>;
export type AgentRequestV1=AgentInput;
export type AgentPlanV1=z.infer<typeof planSchema>;
export type AgentResultV1=AgentResult;
export type AgentErrorV1={code:'PROVIDER_UNAVAILABLE'|'MODEL_TIMEOUT'|'MALFORMED_RESPONSE';recoverable:true};
export type AgentActionV1={type:'confirm_intake';requestId:string;intake:IntakeDraft}|{type:'cancel_draft'}|{type:'confirm_feedback';direction:'LIGHTER'|'ABOUT_RIGHT'|'STRONGER'};
export function resultBlocks(r:AgentResult):AgentBlockV1[]{
 const blocks:AgentBlockV1[]=[{type:r.intent==='CHAT'?'general_chat':'assistant_text',text:r.line}];
 if(r.draft)blocks.push({type:'intake_draft',draft:r.draft});
 if(r.chips?.length||r.draft?.unresolved.length)blocks.push({type:'clarification',question:r.line,choices:r.chips??[]});
 if(r.feedback)blocks.push({type:'felt_feedback_draft',...r.feedback});
 if(r.evidence){const type=({TIDE:'night_tide',COMPARE:'comparison',RECALL:'history_result',STYLE:'personal_model'} as const)[r.intent as 'TIDE'|'COMPARE'|'RECALL'|'STYLE'];if(type)blocks.push({type,facts:r.evidence});}
 if(r.error)blocks.push({type:'error',...r.error});
 return blocks.map(b=>blockSchema.parse(b));
}
