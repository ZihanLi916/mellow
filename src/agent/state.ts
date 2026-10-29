import type {AgentResult} from './contracts';
export const phases=['IDLE','COMPOSING','LISTENING','TRANSCRIBING','PLANNING','CLARIFYING','DRAFT_READY','COMMITTING','RESPONDING','ERROR'] as const;
export type AgentPhase=typeof phases[number];
export type AgentState={phase:AgentPhase;requestId:string|null};
export type AgentEvent={type:'COMPOSE'|'LISTEN'|'TRANSCRIBE'|'TRANSCRIPT'|'CANCEL'|'CLEAR'|'COMMIT'|'SAVED'|'FAIL'}|{type:'REQUEST';id:string}|{type:'RESULT';id:string;result:AgentResult};
export const initialAgentState:AgentState={phase:'IDLE',requestId:null};
export function agentTransition(s:AgentState,e:AgentEvent):AgentState{
 if(e.type==='CLEAR'||e.type==='CANCEL')return s.phase==='COMMITTING'?s:initialAgentState;
 if(e.type==='RESULT')return s.phase!=='PLANNING'||e.id!==s.requestId?s:{phase:e.result.draft?(e.result.draft.intake?'DRAFT_READY':'CLARIFYING'):e.result.feedback?'DRAFT_READY':e.result.chips?.length?'CLARIFYING':'RESPONDING',requestId:null};
 if(e.type==='REQUEST')return ['PLANNING','COMMITTING','LISTENING','TRANSCRIBING'].includes(s.phase)?s:{phase:'PLANNING',requestId:e.id};
 if(e.type==='COMMIT')return s.phase==='DRAFT_READY'?{phase:'COMMITTING',requestId:null}:s;
 if(e.type==='SAVED')return s.phase==='COMMITTING'?{phase:'RESPONDING',requestId:null}:s;
 if(e.type==='COMPOSE')return ['PLANNING','COMMITTING','LISTENING','TRANSCRIBING'].includes(s.phase)?s:{phase:'COMPOSING',requestId:null};
 if(e.type==='LISTEN')return ['PLANNING','COMMITTING','LISTENING','TRANSCRIBING'].includes(s.phase)?s:{phase:'LISTENING',requestId:null};
 if(e.type==='TRANSCRIBE')return s.phase==='LISTENING'?{phase:'TRANSCRIBING',requestId:null}:s;
 if(e.type==='TRANSCRIPT')return ['LISTENING','TRANSCRIBING'].includes(s.phase)?{phase:'COMPOSING',requestId:null}:s;
 if(e.type==='FAIL')return {phase:'ERROR',requestId:null};
 return s;
}
