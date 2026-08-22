export function unsupportedRangeExpansion(address, requireSupport) {
  if (!requireSupport) return address;
  const error = new Error(
    "Contiguous range expansion requires ExcelApi 1.13 or newer",
  );
  error.code = "range_expansion_unavailable";
  throw error;
}
