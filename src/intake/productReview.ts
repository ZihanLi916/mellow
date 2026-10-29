/** Narrow holds from physical Search acceptance. Preserve the upstream catalog unchanged.
 * A hold is not a corrected identity or a verified replacement SKU. */
export const PRODUCT_REVIEW_HOLDS:Readonly<Record<string,string>>={
 'off-0080432402931':'Chivas Regal 12: conflicting 9.6% alcohol and 700 g package; no verified SKU truth',
 'off-20005047':'Gelantine with James Cook / Liberté and spirit metadata: identity/source conflict',
 'off-0082184090473':'Jack Daniels display name contains retailer price per litre, not a canonical name',
};
export const searchableProduct=(p:{id:string})=>!Object.hasOwn(PRODUCT_REVIEW_HOLDS,p.id);
