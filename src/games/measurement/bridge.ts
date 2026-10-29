import type { GameDomain, GameId, GameProtocolVersion, GameResult } from '../core/contracts';
import { MEASUREMENT_VERSION, type FamiliarizationState, type JsonValue, type MeasurementContext, type RawBehavioralEvent, type TrialLifecycleEvent } from './contracts';

export const RAW_STREAM_POLICY_VERSION = 'raw-stream-v1' as const;
export const RAW_STREAM_LIMITS = { defaultEvents: 2_000, highFrequencySamples: 1_200 } as const;

export interface GameMeasurementBundle<TTrial extends object = Record<string, unknown>, TSummary extends object = Record<string, unknown>> {
  bundleVersion: 'game-measurement-bundle-v1';
  streamPolicyVersion: typeof RAW_STREAM_POLICY_VERSION;
  sessionId: string;
  gameResult: GameResult<TTrial, TSummary>;
  rawEvents: RawBehavioralEvent[];
  lifecycleByTrial: TrialLifecycleEvent[][];
  measurementContext: MeasurementContext;
  familiarizationState: FamiliarizationState;
  truncatedEventCount: number;
}

export type MeasurementBundleHandler<TTrial extends object, TSummary extends object> = (bundle: GameMeasurementBundle<TTrial, TSummary>) => void;

export class GameMeasurementRecorder {
  private readonly rawEvents: RawBehavioralEvent[]=[];
  private readonly lifecycleByTrial: TrialLifecycleEvent[][]=[];
  private sequence=0;
  private truncatedEventCount=0;
  private emitted=false;
  constructor(private readonly identity:{sessionId:string;gameId:GameId;domain:GameDomain;protocolVersion:GameProtocolVersion}){}
  startTrial(trialIndex:number,at=performance.now()){if(!Number.isInteger(trialIndex)||trialIndex<0)throw new Error('INVALID_TRIAL_INDEX');if(this.lifecycleByTrial[trialIndex])throw new Error('TRIAL_ALREADY_STARTED');this.lifecycleByTrial[trialIndex]=[{state:'ACTIVE',monotonicTimeMs:at}]}
  record(trialIndex:number,eventType:string,payload:Record<string,JsonValue>,options:{at?:number;occurredAt?:string;highFrequency?:boolean}={}){
    if(this.lifecycleByTrial[trialIndex]?.at(-1)?.state!=='ACTIVE')return;
    const event:RawBehavioralEvent={eventId:`${this.identity.sessionId}:${++this.sequence}`,sessionId:this.identity.sessionId,gameId:this.identity.gameId,domain:this.identity.domain,protocolVersion:this.identity.protocolVersion,measurementVersion:MEASUREMENT_VERSION,trialIndex,sequence:this.sequence,occurredAt:options.occurredAt??new Date().toISOString(),monotonicTimeMs:options.at??performance.now(),lifecycleState:'ACTIVE',eventType,payload:structuredClone(payload)};
    const limit=options.highFrequency?RAW_STREAM_LIMITS.highFrequencySamples:RAW_STREAM_LIMITS.defaultEvents;
    if(this.rawEvents.length<limit)this.rawEvents.push(event);else if(options.highFrequency){this.rawEvents[this.rawEvents.length-1]=event;this.truncatedEventCount++}else this.truncatedEventCount++;
  }
  resolve(trialIndex:number,at=performance.now()){this.transition(trialIndex,'RESOLVED',at)}
  beginFeedback(trialIndex:number,at=performance.now()){this.transition(trialIndex,'FEEDBACK',at)}
  nextTrial(trialIndex:number,at=performance.now()){this.transition(trialIndex,'NEXT_TRIAL',at)}
  reset(){this.rawEvents.length=0;this.lifecycleByTrial.length=0;this.sequence=0;this.truncatedEventCount=0;this.emitted=false}
  bundle<TTrial extends object,TSummary extends object>(gameResult:GameResult<TTrial,TSummary>,measurementContext:MeasurementContext,familiarizationState:FamiliarizationState):GameMeasurementBundle<TTrial,TSummary>{if(this.emitted)throw new Error('MEASUREMENT_BUNDLE_ALREADY_EMITTED');this.emitted=true;return {bundleVersion:'game-measurement-bundle-v1',streamPolicyVersion:RAW_STREAM_POLICY_VERSION,sessionId:this.identity.sessionId,gameResult,rawEvents:[...this.rawEvents],lifecycleByTrial:this.lifecycleByTrial.map(events=>[...events]),measurementContext,familiarizationState,truncatedEventCount:this.truncatedEventCount}}
  private transition(trialIndex:number,state:TrialLifecycleEvent['state'],at:number){const events=this.lifecycleByTrial[trialIndex];if(!events)throw new Error('TRIAL_NOT_STARTED');const order=['ACTIVE','RESOLVED','FEEDBACK','NEXT_TRIAL'];if(order.indexOf(state)!==order.indexOf(events.at(-1)!.state)+1)throw new Error('INVALID_LIFECYCLE_TRANSITION');if(at<events.at(-1)!.monotonicTimeMs)throw new Error('NON_MONOTONIC_LIFECYCLE');events.push({state,monotonicTimeMs:at})}
}

export function validateMeasurementBundle<TTrial extends object, TSummary extends object>(bundle: GameMeasurementBundle<TTrial, TSummary>): string[] {
  const errors: string[]=[];
  const { gameResult }=bundle;
  if(bundle.rawEvents.length>RAW_STREAM_LIMITS.defaultEvents)errors.push('RAW_EVENT_LIMIT_EXCEEDED');
  if(bundle.lifecycleByTrial.length!==gameResult.trials.length)errors.push('TRIAL_LIFECYCLE_COUNT_MISMATCH');
  if(bundle.rawEvents.some(event=>event.sessionId!==bundle.sessionId||event.gameId!==gameResult.gameId||event.protocolVersion!==gameResult.protocolVersion))errors.push('EVENT_IDENTITY_MISMATCH');
  if(bundle.rawEvents.some(event=>event.lifecycleState!=='ACTIVE'))errors.push('NON_ACTIVE_RAW_EVENT');
  if(new Set(bundle.rawEvents.map(event=>event.eventId)).size!==bundle.rawEvents.length)errors.push('DUPLICATE_EVENT_ID');
  if(bundle.lifecycleByTrial.some(events=>events[0]?.state!=='ACTIVE'||(gameResult.valid&&events.at(-1)?.state!=='NEXT_TRIAL')))errors.push('INVALID_LIFECYCLE');
  const order=['ACTIVE','RESOLVED','FEEDBACK','NEXT_TRIAL'];
  if(bundle.lifecycleByTrial.some(events=>events.some((event,index)=>index>0&&(order.indexOf(event.state)!==order.indexOf(events[index-1].state)+1||event.monotonicTimeMs<events[index-1].monotonicTimeMs))))errors.push('INVALID_LIFECYCLE');
  return [...new Set(errors)];
}
