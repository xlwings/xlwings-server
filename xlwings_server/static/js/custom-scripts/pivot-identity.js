// Resolve against live Excel metadata. A locally created PivotTable has no ID
// until the next book load, so its name is the identity for that interval.
export function selectPivotTable(items, index, id, name) {
  const pivot =
    id != null
      ? items.find((item) => item.id === id)
      : name != null
        ? items.find((item) => item.name === name)
        : items[index]; // Older action payloads only carry an index.
  if (!pivot) {
    const error = new Error(
      `PivotTable ${name ?? id ?? index} no longer exists.`,
    );
    error.code = "pivot_table_not_found";
    throw error;
  }
  return pivot;
}
