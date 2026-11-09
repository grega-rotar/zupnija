/**
 * The village a church stands in, for the small line on church cards
 * (ZUP-15): the street of its address without the house number. The
 * churches stand in villages without street names, so »Zgornje Pirniče 74b«
 * is »Zgornje Pirniče«. Null without a street.
 */
export function churchPlace(address: { street?: string | null } | null | undefined): string | null {
  const street = address?.street?.trim();
  if (!street) return null;
  return street.replace(/\s+\d+\s*[a-zA-Z]?$/, "") || null;
}
