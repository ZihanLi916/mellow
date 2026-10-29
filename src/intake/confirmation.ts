import {defaultIntake,normalizedIntakeSchema,type NormalizedIntake} from './normalized';
/** New entries must not silently confirm the nominal category defaults.
 * Same Again / saved Measures deliberately use their own confirmed values instead. */
export function freshIntakeDraft(family:NormalizedIntake['family'],identity:string):NormalizedIntake{
 return {...defaultIntake(family,identity),abv:NaN,actualConsumedMl:NaN,metadataProvenance:['User entry · choose amount and ABV']};
}
export const INTAKE_CONFIRM_COPY={amount:'Amount',abv:'ABV',chooseAmount:'Choose amount',chooseAbv:'Choose ABV',required:'Choose amount and ABV to confirm.'} as const;
const number=new Intl.NumberFormat('en-US',{maximumFractionDigits:20});
/** One display contract shared by the readout and command: ml, percentage points. */
export function confirmationValues(draft:NormalizedIntake){
 return {consumedMl:draft.actualConsumedMl,abvPercent:draft.abv,amountText:Number.isFinite(draft.actualConsumedMl)?`${number.format(draft.actualConsumedMl)} ml`:INTAKE_CONFIRM_COPY.chooseAmount,abvText:Number.isFinite(draft.abv)?`${number.format(draft.abv)}%`:INTAKE_CONFIRM_COPY.chooseAbv,valid:normalizedIntakeSchema.safeParse(draft).success};
}
