import {z} from 'zod';
import {shortcutSchema} from '../intake/normalized';
import {calibrationSchema,directionSchema} from '../personalCalibration/model';
export const CONTEXTS=['Just chilling','Dinner','Friends','Party','Date','Other'] as const;
export const PURPOSES=['Social','Relax','Celebrate','Dinner','Date','Me time'] as const;
export const MOODS=['Good','Calm','Excited','Tired','Stressed','Low'] as const;
export type Purpose=typeof PURPOSES[number];
export type Mood=typeof MOODS[number];
export const PURPOSE_CONTEXT:Record<Purpose,typeof CONTEXTS[number]>={Social:'Friends',Relax:'Just chilling',Celebrate:'Party',Dinner:'Dinner',Date:'Date','Me time':'Other'};
export const FOODS=['Ate','A little','Not yet'] as const;
/**
 * The four-tier food input the user actually chooses from.
 *
 * The percentages exist **only** to size the icon's food mound. They are never shown as an intake
 * figure and never enter the model as a coefficient: `FOOD_DETAIL_TO_MODEL` is the single bridge, and
 * it lands on the existing three-value vocabulary so no estimate, prior or personal-model parameter
 * changes. "Unanswered" stays `null` and is *not* one of these four — an explicit "Not yet" and a
 * skipped question are different facts and are stored differently.
 */
export const FOOD_DETAILS=['Not yet','A few bites','Light meal','Full meal'] as const;
export type FoodDetail=typeof FOOD_DETAILS[number];
export type Food=typeof FOODS[number];
/**
 * This round's compatibility mapping, and nothing more than that.
 *
 * `Light meal` and `Full meal` both land on `Ate`, so the model cannot distinguish them yet. That is
 * a deliberate, stated limitation rather than a claim that four tiers have been validated
 * physiologically. A stored `Ate` from before this change is never back-filled: it cannot be known
 * which tier produced it, and guessing `Full meal` would invent data.
 */
export const FOOD_DETAIL_TO_MODEL:Record<FoodDetail,Food>={
  'Not yet':'Not yet',
  'A few bites':'A little',
  'Light meal':'Ate',
  'Full meal':'Ate',
};
export const WATER_ML={SMALL:150,MEDIUM:250,LARGE:400} as const;
export const COACHMARKS=['SHORTCUTS','NIGHT_TIDE','PERSONAL_MODEL'] as const;
export type Coachmark=typeof COACHMARKS[number];
export const productSchema=z.object({
 shortcuts:z.array(shortcutSchema).max(100).optional(),personalCalibration:calibrationSchema.optional(),premiumGuidanceDone:z.boolean().optional(),
 premiumOnboarding:z.object({status:z.enum(['LATER','COMPLETED']),updatedAt:z.string().datetime()}).strict().optional(),
 premiumCoachmarks:z.object({SHORTCUTS:z.boolean().optional(),NIGHT_TIDE:z.boolean().optional(),PERSONAL_MODEL:z.boolean().optional()}).strict().optional(),
 version:z.literal(1), trackingStartedAt:z.string().datetime().nullable(),
 nights:z.record(z.string(),z.object({context:z.enum(CONTEXTS).nullable(),purpose:z.enum(PURPOSES).nullable().optional(),mood:z.enum(MOODS).nullable().optional(),food:z.enum(FOODS).nullable(),foodDetail:z.enum(FOOD_DETAILS).nullable().optional(),reviewedAt:z.string().datetime().nullable(),confirmedAt:z.string().datetime().nullable(),calibration:z.object({response:z.enum(['LIGHTER','ABOUT_RIGHT','STRONGER','SKIPPED']),estimatedBand:z.enum(['CLEAR','LIGHT','MELLOW','TIPSY','HEAVY']).nullable(),recordedAt:z.string().datetime(),sourceRevision:z.number().int().nonnegative()}).optional(),waterTracked:z.boolean(),water:z.array(z.object({id:z.string(),timestamp:z.string().datetime(),size:z.enum(['SMALL','MEDIUM','LARGE']),estimatedMl:z.number().finite().positive()})).max(500)})),
 profile:z.object({name:z.string().trim().max(80)}),
 settings:z.object({sound:z.boolean(),music:z.boolean(),soundEffects:z.boolean(),units:z.enum(['METRIC','US']),notifications:z.boolean(),experimental:z.boolean()}),
 relationship:z.object({unlockedAt:z.string().datetime().nullable(),bondDays:z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(3660)}),
}).strict();
export type ProductState=z.infer<typeof productSchema>;
export function emptyProduct():ProductState{return {version:1,trackingStartedAt:null,nights:{},profile:{name:''},settings:{sound:true,music:true,soundEffects:true,units:'METRIC',notifications:false,experimental:false},relationship:{unlockedAt:null,bondDays:[]}};}
export const emptyNight=()=>({context:null,food:null,foodDetail:null,reviewedAt:null,confirmedAt:null,waterTracked:false,water:[]} satisfies ProductState['nights'][string]);
export const productCommands=[
 z.object({type:z.literal('save-shortcut'),shortcut:shortcutSchema}).strict(),
 z.object({type:z.literal('delete-shortcut'),id:z.string()}).strict(),
 z.object({type:z.literal('premium-guidance-done')}).strict(),
 z.object({type:z.literal('premium-onboarding'),status:z.enum(['LATER','COMPLETED'])}).strict(),
 z.object({type:z.literal('premium-coachmark-seen'),coachmark:z.enum(COACHMARKS)}).strict(),
 z.object({type:z.literal('personal-feedback'),sessionId:z.string(),source:z.enum(['REALTIME','NEXT_DAY']),direction:directionSchema}).strict(),
 z.object({type:z.literal('calibrate-night'),sessionId:z.string(),response:z.enum(['LIGHTER','ABOUT_RIGHT','STRONGER','SKIPPED']),estimatedBand:z.enum(['CLEAR','LIGHT','MELLOW','TIPSY','HEAVY']).nullable()}).strict(),
 z.object({type:z.literal('setup-night'),context:z.enum(CONTEXTS).nullable(),purpose:z.enum(PURPOSES).nullable().optional(),mood:z.enum(MOODS).nullable().optional(),food:z.enum(FOODS).nullable(),foodDetail:z.enum(FOOD_DETAILS).nullable().optional(),timezoneOffsetMinutes:z.number().int().min(-840).max(840)}).strict(),
 z.object({type:z.literal('water'),sessionId:z.string(),id:z.string().min(1).max(100),size:z.enum(['SMALL','MEDIUM','LARGE'])}).strict(),
 z.object({type:z.literal('review-night'),sessionId:z.string(),confirm:z.boolean()}).strict(),
 z.object({type:z.literal('product-settings'),profile:productSchema.shape.profile,settings:productSchema.shape.settings}).strict(),
 z.object({type:z.literal('relationship-visit'),page:z.enum(['MODEL','RETURN','RESULT'])}).strict(),
 z.object({type:z.literal('missing-drink'),sessionId:z.string(),id:z.string().min(1).max(100),label:z.string().trim().min(1).max(120),category:z.enum(['BEER','WINE','COCKTAIL','SPIRITS','OTHER','UNKNOWN']),abvPercent:z.number().min(0).max(100).nullable(),timestamp:z.string().datetime()}).strict(),
] as const;
export const BETA_EVENTS=['first_night_started','first_night_completed','scan_started','top3_shown','customize_used','confirm_saved','recognition_latency_bucket','fifth_valid_night_reached','basic_archetype_viewed','basic_archetype_shared','premium_paywall_viewed','premium_preview_started','premium_dimension_viewed','followup_completed','account_deleted'] as const;
export const EVENTS=[...BETA_EVENTS,'home_viewed','start_night_clicked','context_selected','context_skipped','food_selected','food_skipped','night_started','drink_scan_started','candidate_shown','drink_confirmed','drink_corrected','water_opened','water_logged','session_closed','previous_session_reviewed','previous_session_confirmed','previous_session_edited','my_model_viewed','identity_card_opened','recent_history_expanded','subscore_viewed','familiarity_changed','bond_changed','share_page_opened','game_opened','game_completed'] as const;
