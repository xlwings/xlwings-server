export function unqualifiedAddress(range) {
  if (!range || range.isNullObject) return null;
  return range.address.split("!").pop();
}

export function rangeMetadata(range) {
  if (!range || range.isNullObject) {
    return { address: null, row_count: 0, column_count: 0 };
  }
  return {
    address: unqualifiedAddress(range),
    row_count: range.rowCount,
    column_count: range.columnCount,
  };
}
