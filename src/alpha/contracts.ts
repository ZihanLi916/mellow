import {productSchema,productCommands,type ProductState} from '../productV1/contracts';
import { z } from "zod";
import { parseConsumerState, type ConsumerState } from "../consumer/contracts";
import { createConsumerState } from "../consumer/domain";
import type { ReactionHistory, ReactionLine } from "./reactions";
export const PRIVACY_VERSION = "alpha-privacy-model-v2";
export const STATES = ["Clear", "Light", "Mellow", "Tipsy", "Heavy"] as const;
export type Cohort = "REAL" | "QA";
export type Report = {
  id: string;
  sessionId: string;
  kind: "DURING_NIGHT" | "RETROSPECTIVE";
  level: number;
  observedAt: string;
  clientObservedAt?: string;
  recordedAt: string;
  revision: number;
  source: "USER_SELF_REPORT";
  eligible: false;
};
export type AlphaSnapshot = {
  version: 1;
  product?: ProductState;
  revision: number;
  consumer: ConsumerState;
  reports: Report[];
  skippedFollowups: string[];
  quarantinedSessions: string[];
  reactionHistory: ReactionHistory;
  lastReaction: ReactionLine | null;
  derived: {
    version: "tonight-foundation-v1";
    sourceRevision: number;
    status: "UNAVAILABLE";
    position: null;
    reason: "MODEL_NOT_VALIDATED";
  };
};
export type AuditChange = {
  kind: string;
  recordId: string;
  before: unknown;
  after: unknown;
};
export const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_.:-]+$/);
const session = id,
  date = z.string().datetime(),
  level = z.number().int().min(0).max(4);
export const commandSchema = z.discriminatedUnion("type", [
  ...productCommands,
  z.object({ type: z.literal("start-night"),timezoneOffsetMinutes:z.number().int().min(-840).max(840).optional() }).strict(),
  z.object({ type: z.literal("end-night") }).strict(),
  z.object({ type: z.literal("drink"), input: z.unknown(),timezoneOffsetMinutes:z.number().int().min(-840).max(840).optional() }).strict(),
  z
    .object({
      type: z.literal("report"),
      id,
      sessionId: session,
      level,
      observedAt: date,
      timezoneOffsetMinutes: z.number().int().min(-840).max(840).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("followup"),
      id,
      sessionId: session,
      level: level.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("edit-drink"),
      sessionId: session,
      id,
      label: z.string().trim().min(1).max(120),
      abvPercent: z.number().min(0).max(100).nullable(),
    })
    .strict(),
  z
    .object({ type: z.literal("delete-drink"), sessionId: session, id })
    .strict(),
  z.object({ type: z.literal("edit-report"), id, level }).strict(),
  z.object({ type: z.literal("delete-report"), id }).strict(),
  z
    .object({
      type: z.literal("start-check"),
      id,
      games: z
        .array(
          z.enum([
            "MELLOW_MIX",
            "THREE_CARDS",
            "OPPOSITE_CAT",
            "PERFECT_POUR",
            "DONT_SPILL",
            "BLOW_BALL",
          ]),
        )
        .min(1)
        .max(3),
      timezoneOffsetMinutes:z.number().int().min(-840).max(840).optional(),
    })
    .strict(),
  z
    .object({ type: z.literal("bundle"), checkId: id, bundle: z.unknown() })
    .strict(),
  z.object({ type: z.literal("abort-check"), checkId: id }).strict(),
  z
    .object({
      type: z.literal("import"),
      sourceKey: id,
      confirmedOwner: z.literal(true),
      state: z.unknown(),
    })
    .strict(),
]);
export type AlphaCommand = z.infer<typeof commandSchema>;
export const requestSchema = z
  .object({
    id,
    expectedRevision: z.number().int().min(0),
    command: commandSchema,
  })
  .strict();
export function emptySnapshot(): AlphaSnapshot {
  return {
    version: 1,
    revision: 0,
    consumer: createConsumerState(),
    reports: [],
    skippedFollowups: [],
    quarantinedSessions: [],
    reactionHistory: [],
    lastReaction: null,
    derived: {
      version: "tonight-foundation-v1",
      sourceRevision: 0,
      status: "UNAVAILABLE",
      position: null,
      reason: "MODEL_NOT_VALIDATED",
    },
  };
}
export function parseSnapshot(value: unknown): AlphaSnapshot {
  const v = value as AlphaSnapshot;
  if (
    !v ||
    v.version !== 1 ||
    !Number.isInteger(v.revision) ||
    v.revision < 0 ||
    !Array.isArray(v.reports) ||
    v.reports.length > 2000 ||
    !Array.isArray(v.quarantinedSessions) ||
    !Array.isArray(v.skippedFollowups) ||
    !Array.isArray(v.reactionHistory)
  )
    throw Error("INVALID_SNAPSHOT");
  parseConsumerState(v.consumer);
  if(v.product) { productSchema.parse(v.product); for(const [sid,meta] of Object.entries(v.product.nights)){const night=v.consumer.sessions.find(n=>n.id===sid);if(!night)throw Error("ORPHAN_PRODUCT_NIGHT");const ids=new Set<string>();for(const w of meta.water){if(ids.has(w.id)||w.timestamp<night.startedAt||(night.endedAt&&w.timestamp>night.endedAt))throw Error("INVALID_WATER_EVENT");ids.add(w.id);}} }
  const seen = new Set<string>();
  for (const r of v.reports) {
    id.parse(r.id);
    level.parse(r.level);
    date.parse(r.observedAt);
    date.parse(r.recordedAt);
    if (r.clientObservedAt) date.parse(r.clientObservedAt);
    if (
      r.eligible !== false ||
      !Number.isInteger(r.revision) ||
      r.revision < 1 ||
      seen.has(r.id) ||
      r.source !== "USER_SELF_REPORT" ||
      !["DURING_NIGHT", "RETROSPECTIVE"].includes(r.kind) ||
      !v.consumer.sessions.some((s) => s.id === r.sessionId)
    )
      throw Error("INVALID_REPORT");
    seen.add(r.id);
  }
  if (
    v.reactionHistory.length > 64 ||
    new Set(v.quarantinedSessions).size !== v.quarantinedSessions.length ||
    new Set(v.skippedFollowups).size !== v.skippedFollowups.length
  )
    throw Error("INVALID_METADATA");
  for (const sid of [...v.quarantinedSessions, ...v.skippedFollowups])
    if (!v.consumer.sessions.some((s) => s.id === sid))
      throw Error("INVALID_NIGHT_REFERENCE");
  if (
    v.derived.sourceRevision !== v.revision ||
    v.derived.position !== null ||
    v.derived.status !== "UNAVAILABLE" ||
    v.derived.reason !== "MODEL_NOT_VALIDATED"
  )
    throw Error("UNVALIDATED_MODEL_OUTPUT");
  return v;
}
export const defaultFlags = {
  vision: true,
  sharing: true,
  reactions: true,
  sensors: false,
  personalModel: false,
};
export type FeatureFlags = typeof defaultFlags;
export const flagsSchema = z
  .object({
    vision: z.boolean(),
    sharing: z.boolean(),
    reactions: z.boolean(),
    sensors: z.boolean(),
    personalModel: z.boolean(),
  })
  .strict();
