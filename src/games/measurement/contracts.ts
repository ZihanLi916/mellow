import type { GameDomain, GameId, GameProtocolVersion, GameResult } from '../core/contracts';

export const MEASUREMENT_VERSION = 'play-measurement-v1' as const;
export const MEASUREMENT_CONTEXT_VERSION = 'measurement-context-v1' as const;
export const BASELINE_POLICY_VERSION = 'personal-baseline-v1' as const;

export type MeasurementVersion = typeof MEASUREMENT_VERSION;
export type SessionQualityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INVALID';
export type FamiliarizationState = 'NEW' | 'FAMILIARIZING' | 'CALIBRATING' | 'ESTABLISHED';
export type TrialLifecycleState = 'ACTIVE' | 'RESOLVED' | 'FEEDBACK' | 'NEXT_TRIAL';
export type InputModality = 'TOUCH' | 'POINTER' | 'KEYBOARD' | 'DEVICE_ORIENTATION' | 'UNKNOWN';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type QualityReason =
  | 'BACKGROUND_INTERRUPTION'
  | 'RUNTIME_ERROR'
  | 'SENSOR_UNAVAILABLE'
  | 'SENSOR_SAMPLE_RATE_LOW'
  | 'INSUFFICIENT_TRIALS'
  | 'ABNORMAL_FRAME_DROPS'
  | 'INPUT_STREAM_CORRUPTED'
  | 'USER_QUIT'
  | 'EXTREME_NONCOMPLIANCE';

export interface QualityFlag {
  reason: QualityReason;
  severity: Exclude<SessionQualityLevel, 'HIGH'>;
  evidence: string;
  observedValue?: number;
  threshold?: number;
}

export interface SessionQuality {
  level: SessionQualityLevel;
  reasons: QualityFlag[];
  assessedBy: 'quality-rules-v1';
}

export interface MeasurementContext {
  contextVersion: typeof MEASUREMENT_CONTEXT_VERSION;
  capturedAt: string;
  gameProtocolVersion: GameProtocolVersion;
  deviceClass: 'PHONE' | 'TABLET' | 'DESKTOP' | 'UNKNOWN';
  browserFamily: 'CHROMIUM' | 'SAFARI' | 'FIREFOX' | 'OTHER' | 'UNKNOWN';
  viewport: { width: number; height: number; devicePixelRatio: number };
  inputModalities: InputModality[];
  pointerMode: 'COARSE' | 'FINE' | 'MIXED' | 'UNKNOWN';
  touchPoints: number;
  performance: {
    observedFrames: number;
    estimatedFps: number | null;
    droppedFrameCount: number;
    droppedFrameRate: number | null;
  };
  sensor: {
    requested: boolean;
    available: boolean | null;
    permission: 'GRANTED' | 'DENIED' | 'NOT_REQUESTED' | 'UNKNOWN';
    sampleRateHz: number | null;
  };
  visibility: {
    interruptionCount: number;
    hiddenDurationMs: number;
  };
  runtimeErrorCodes: string[];
}

export interface RawBehavioralEvent {
  eventId: string;
  sessionId: string;
  gameId: GameId;
  domain: GameDomain;
  protocolVersion: GameProtocolVersion;
  measurementVersion: MeasurementVersion;
  trialIndex: number;
  sequence: number;
  occurredAt: string;
  monotonicTimeMs: number;
  lifecycleState: TrialLifecycleState;
  eventType: string;
  payload: Record<string, JsonValue>;
}

export interface TrialLifecycleEvent {
  state: TrialLifecycleState;
  monotonicTimeMs: number;
}

export interface MeasuredTrial<TTrial extends object> {
  trialIndex: number;
  rawTrial: TTrial;
  lifecycle: TrialLifecycleEvent[];
  resolvedAtMs: number | null;
}

export interface BehavioralMeasurementSession<
  TTrial extends object = Record<string, unknown>,
  TSummary extends object = Record<string, unknown>,
> {
  sessionId: string;
  measurementVersion: MeasurementVersion;
  gameId: GameId;
  domain: GameDomain;
  protocolVersion: GameProtocolVersion;
  startedAt: string;
  completedAt: string;
  rawGameResult: GameResult<TTrial, TSummary>;
  measuredTrials: MeasuredTrial<TTrial>[];
  rawEvents: RawBehavioralEvent[];
  context: MeasurementContext;
  quality: SessionQuality;
  familiarizationState: FamiliarizationState;
}

export interface MetricObservation {
  observationId: string;
  sessionId: string;
  gameId: GameId;
  metricId: string;
  value: number;
  observedAt: string;
  protocolVersion: string;
  measurementVersion: MeasurementVersion;
  quality: SessionQualityLevel;
  familiarizationState: FamiliarizationState;
}

export interface FutureModelEvidence<TPayload extends JsonValue = JsonValue> {
  evidenceId: string;
  source:
    | 'ESTIMATED_ALCOHOL_EXPOSURE'
    | 'DRINK_TIMING'
    | 'FOOD_CONTEXT'
    | 'SUBJECTIVE_STATE'
    | 'MEASURED_BAC'
    | 'NEXT_DAY_OUTCOME'
    | 'BEHAVIORAL_GAME_DATA';
  confidence: number;
  timestamp: string;
  measurementQuality: SessionQualityLevel | 'NOT_APPLICABLE';
  payload: TPayload;
}
