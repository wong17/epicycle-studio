export function planTessellation(
  maxSecondDerivative: number,
  tolerance: number,
): { segments: number; errorBound: number; withinBudget: boolean } {
  if (
    !Number.isFinite(maxSecondDerivative) ||
    maxSecondDerivative < 0 ||
    !Number.isFinite(tolerance) ||
    tolerance <= 0
  )
    throw new Error('TESSELLATION');
  const required = Math.max(512, Math.ceil(Math.sqrt(maxSecondDerivative / (8 * tolerance)))),
    segments = Math.min(2048, required);
  return {
    segments,
    errorBound: maxSecondDerivative / (8 * segments ** 2),
    withinBudget: required <= 2048,
  };
}
