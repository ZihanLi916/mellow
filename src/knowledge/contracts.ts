import { z } from 'zod';

// ----------------------------------------------------------------------
// Version constants
// ----------------------------------------------------------------------
export const Versions = {
  ontology: 'drink-ontology-v1',
  knowledge: 'universal-drinks-v1',
  retrieval: 'hybrid-rules-v1',
  glass: 'glass-vision-v1',
} as const;

// ----------------------------------------------------------------------
// Core enums and scalar schemas
// ----------------------------------------------------------------------
export const FamilyEnum = [
  'COCKTAIL', 'HIGHBALL', 'SPIRIT', 'BEER', 'WINE', 'SPARKLING_WINE',
  'CIDER', 'HARD_SELTZER', 'RTD', 'SHOT', 'NON_ALCOHOLIC', 'OTHER',
] as const;
export const DrinkFamily = z.enum(FamilyEnum);
export type DrinkFamily = z.infer<typeof DrinkFamily>;

export const DrinkKind = z.enum(['FAMILY', 'RECIPE', 'PRODUCT']);
export type DrinkKind = z.infer<typeof DrinkKind>;

export const NumericRange = z.object({
  min: z.number().finite(),
  max: z.number().finite(),
}).refine((r) => r.min <= r.max, { message: 'min must be <= max' });
export type NumericRange = z.infer<typeof NumericRange>;

export const ConfidenceEnum = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const Confidence = z.enum(ConfidenceEnum);
export type Confidence = z.infer<typeof Confidence>;

export const FactBasis = z.enum(['SOURCE', 'CURATED_PRIOR']);
export type FactBasis = z.infer<typeof FactBasis>;

export const SourceClassification = z.enum([
  'PRODUCTION_INGEST_OK',
  'PRODUCTION_INGEST_WITH_CONDITIONS',
  'REFERENCE_ONLY',
  'DO_NOT_USE',
]);
export type SourceClassification = z.infer<typeof SourceClassification>;

// ----------------------------------------------------------------------
// Fact
// ----------------------------------------------------------------------
export const Fact = z.object({
  field: z.string().min(1),
  value: z.union([
    z.string(),
    z.number().finite(),
    z.array(z.string()),
    NumericRange,
  ]),
  sourceId: z.string().min(1),
  sourceRecord: z.string().min(1),
  independenceKey: z.string().min(1),
  confidence: Confidence,
  basis: FactBasis,
});
export type Fact = z.infer<typeof Fact>;

// ----------------------------------------------------------------------
// Source
// ----------------------------------------------------------------------
export const Source = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url().optional(),
  licenseUrl: z.string().url().optional(),
  classification: SourceClassification,
  license: z.string().min(1),
  requirements: z.array(z.string()).default([]),
  conditionsMet: z.boolean(),
  reviewedAt: z.string().datetime(),
});
export type Source = z.infer<typeof Source>;

// ----------------------------------------------------------------------
// Glass
// ----------------------------------------------------------------------
export const Glass = z.object({
  id: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  stem: z.boolean().nullable(),
  shape: z.string().min(1),
  features: z.array(z.string()).default([]),
  capacityMlRange: z.object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
  }).refine(r => r.min <= r.max, { message: 'min must be <= max' }).optional(),
  servedVolumeMlRange: NumericRange.optional(),
  commonCocktails: z.array(z.string()).optional(),
  regionalNotes: z.string().optional(),
  aspectRatioRange: z.object({
    min: z.number().positive(),
    max: z.number().positive(),
  }).refine(r => r.min <= r.max, { message: 'min must be <= max' }).optional(),
  confusableWith: z.array(z.string()).default([]),
  iconFamily: z.string().min(1),
  facts: z.array(Fact).default([]),
}).refine(g => g.stem !== null || g.shape !== '', { message: 'stem or shape required' });
export type Glass = z.infer<typeof Glass>;

// ----------------------------------------------------------------------
// Drink
// ----------------------------------------------------------------------
export const Drink = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  family: DrinkFamily,
  kind: DrinkKind,
  ingredientIds: z.array(z.string()).default([]),
  glassIds: z.array(z.string()).default([]),
  colors: z.array(z.string()).default([]),
  garnishes: z.array(z.string()).default([]),
  ice: z.array(z.string()).default([]),
  fizz: z.array(z.string()).default([]),
  variants: z.array(z.string()).default([]),
  brand: z.string().optional(),
  barcodes: z.array(z.string()).default([]),
  abvRange: z.object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative().max(100),
  }).refine(r => r.min <= r.max, { message: 'min must be <= max' }).optional(),
  servingMlRange: z.object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
  }).refine(r => r.min <= r.max, { message: 'min must be <= max' }).optional(),
  facts: z.array(Fact).default([]),
});
export type Drink = z.infer<typeof Drink>;

// ----------------------------------------------------------------------
// Knowledge container
// ----------------------------------------------------------------------
export const Knowledge = z.object({
  versions: z.object({
    ontology: z.literal(Versions.ontology),
    knowledge: z.literal(Versions.knowledge),
    retrieval: z.literal(Versions.retrieval),
    glass: z.literal(Versions.glass),
  }),
  drinks: z.array(Drink),
  glasses: z.array(Glass),
  sources: z.array(Source),
});
export type Knowledge = z.infer<typeof Knowledge>;

// ----------------------------------------------------------------------
// Validation helpers
// ----------------------------------------------------------------------
/**
 * Validates a GTIN (Global Trade Item Number) using GS1 checksum algorithm.
 * Supports lengths 8, 12, 13, 14. The rightmost digit is the check digit,
 * and the weighting is from right to left: data digits (excluding check) alternate
 * weight 3 and 1, with the digit immediately left of the check digit having weight 3.
 */
export function validGtin(gtin: string): boolean {
  if (!/^\d+$/.test(gtin)) return false;
  const length = gtin.length;
  if (![8, 12, 13, 14].includes(length)) return false;
  const digits = gtin.split('').map(Number);
  const checkDigit = digits.pop()!;
  let sum = 0;
  // Process from rightmost data digit to leftmost. The rightmost data digit has weight 3.
  // We iterate over digits array (without check) from right to left, alternating weight starting with 3.
  for (let i = digits.length - 1, weight = 3; i >= 0; i--) {
    sum += digits[i] * weight;
    weight = weight === 3 ? 1 : 3;
  }
  const computedCheck = (10 - (sum % 10)) % 10;
  return computedCheck === checkDigit;
}

// ----------------------------------------------------------------------
// KnowledgeSchema with cross-validation
// ----------------------------------------------------------------------
export const KnowledgeSchema = z.object({
  versions: z.object({
    ontology: z.literal(Versions.ontology),
    knowledge: z.literal(Versions.knowledge),
    retrieval: z.literal(Versions.retrieval),
    glass: z.literal(Versions.glass),
  }),
  drinks: z.array(Drink),
  glasses: z.array(Glass),
  sources: z.array(Source),
}).superRefine((kb, ctx) => {
  // 1. No duplicate entity IDs
  const drinkIds = new Set<string>();
  for (const drink of kb.drinks) {
    if (drinkIds.has(drink.id)) {
      ctx.addIssue({ code: 'custom', message: `Duplicate drink ID: ${drink.id}` });
    }
    drinkIds.add(drink.id);
  }
  const glassIds = new Set<string>();
  for (const glass of kb.glasses) {
    if (glassIds.has(glass.id)) {
      ctx.addIssue({ code: 'custom', message: `Duplicate glass ID: ${glass.id}` });
    }
    glassIds.add(glass.id);
  }
  const sourceIds = new Set<string>();
  for (const source of kb.sources) {
    if (sourceIds.has(source.id)) {
      ctx.addIssue({ code: 'custom', message: `Duplicate source ID: ${source.id}` });
    }
    sourceIds.add(source.id);
  }

  // 2. Glass references must exist, barcodes valid
  for (const drink of kb.drinks) {
    for (const gid of drink.glassIds) {
      if (!glassIds.has(gid)) {
        ctx.addIssue({ code: 'custom', message: `Drink ${drink.id} references unknown glass ${gid}` });
      }
    }
    for (const barcode of drink.barcodes) {
      if (!validGtin(barcode)) {
        ctx.addIssue({ code: 'custom', message: `Invalid GTIN ${barcode} in drink ${drink.id}` });
      }
    }
    for (const fact of drink.facts) {
      if (!sourceIds.has(fact.sourceId)) {
        ctx.addIssue({ code: 'custom', message: `Drink ${drink.id} fact references unknown source ${fact.sourceId}` });
      }
    }
  }

  for (const glass of kb.glasses) {
    for (const fact of glass.facts) {
      if (!sourceIds.has(fact.sourceId)) {
        ctx.addIssue({ code: 'custom', message: `Glass ${glass.id} fact references unknown source ${fact.sourceId}` });
      }
    }
  }

  // 3. Source license gating: only PRODUCTION_INGEST_OK or
  //    PRODUCTION_INGEST_WITH_CONDITIONS with conditionsMet may contribute facts.
  const allowedSourceIds = new Set<string>(
    kb.sources
      .filter((s) =>
        s.classification === 'PRODUCTION_INGEST_OK' ||
        (s.classification === 'PRODUCTION_INGEST_WITH_CONDITIONS' && s.conditionsMet)
      )
      .map((s) => s.id)
  );

  for (const drink of kb.drinks) {
    for (const fact of drink.facts) {
      if (!allowedSourceIds.has(fact.sourceId)) {
        ctx.addIssue({ code: 'custom', message: `Fact in drink ${drink.id} uses non-production source ${fact.sourceId}` });
      }
    }
  }
  for (const glass of kb.glasses) {
    for (const fact of glass.facts) {
      if (!allowedSourceIds.has(fact.sourceId)) {
        ctx.addIssue({ code: 'custom', message: `Fact in glass ${glass.id} uses non-production source ${fact.sourceId}` });
      }
    }
  }

  // 4. ABV range check already in schema but extra custom for clarity
  for (const drink of kb.drinks) {
    if (drink.abvRange) {
      if (drink.abvRange.min < 0 || drink.abvRange.max > 100) {
        ctx.addIssue({ code: 'custom', message: `ABV range out of [0,100] for drink ${drink.id}` });
      }
    }
  }
});

// ----------------------------------------------------------------------
// Summarization function
// ----------------------------------------------------------------------
/**
 * Summarize facts for a given field by aggregating exact values and counting
 * unique independence keys. Retains disagreements.
 */
export function summarizeFacts(
  facts: Fact[],
  field: string
): Array<{ value: Fact['value']; count: number; confidence: Confidence }> {
  const groups = new Map<string, { value: Fact['value']; independenceKeys: Set<string>; highestConfidence: Confidence }>();
  for (const fact of facts) {
    if (fact.field !== field) continue;
    const key = JSON.stringify(fact.value);
    const existing = groups.get(key);
    if (existing) {
      existing.independenceKeys.add(fact.independenceKey);
      const confOrder: Confidence[] = ['LOW', 'MEDIUM', 'HIGH'];
      if (confOrder.indexOf(fact.confidence) > confOrder.indexOf(existing.highestConfidence)) {
        existing.highestConfidence = fact.confidence;
      }
    } else {
      groups.set(key, {
        value: fact.value,
        independenceKeys: new Set([fact.independenceKey]),
        highestConfidence: fact.confidence,
      });
    }
  }
  return Array.from(groups.values()).map((g) => ({
    value: g.value,
    count: g.independenceKeys.size,
    confidence: g.highestConfidence,
  }));
}
