function actionError(
  message,
  { code, actionIndex, appliedActionCount, actionFunc, cause } = {},
) {
  const error = new Error(message);
  error.code = code;
  if (Number.isInteger(actionIndex)) {
    error.actionIndex = actionIndex;
    error.appliedActionCount = Number.isInteger(appliedActionCount)
      ? appliedActionCount
      : actionIndex;
  }
  if (actionFunc) error.actionFunc = actionFunc;
  if (cause) error.cause = cause;
  return error;
}

const FORCE_SYNC_TERMS = ["sheet"];

function requiresFollowUpSync(actionFunc) {
  const normalized = actionFunc.toLowerCase();
  return FORCE_SYNC_TERMS.some((term) => normalized.includes(term));
}

export async function dispatchActions(actions, context, callbacks) {
  if (!Array.isArray(actions)) {
    throw actionError("Action payload must contain an actions array", {
      code: "invalid_actions",
    });
  }

  for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
    const action = actions[actionIndex];
    const actionFunc = action?.func;
    const callback =
      typeof actionFunc === "string" ? callbacks?.[actionFunc] : null;
    if (typeof callback !== "function") {
      const partial = actionIndex
        ? ` The preceding ${actionIndex} ${actionIndex === 1 ? "action may" : "actions may"} already have been applied.`
        : "";
      throw actionError(
        `Action ${actionIndex + 1} has an unknown function: ${String(actionFunc)}.${partial}`,
        { code: "unknown_action", actionIndex, actionFunc },
      );
    }

    try {
      await callback(context, action);
      if (requiresFollowUpSync(actionFunc)) await context.sync();
    } catch (cause) {
      const possiblyApplied = actionIndex + 1;
      const partial = ` Up to ${possiblyApplied} ${possiblyApplied === 1 ? "action may" : "actions may"} already have been applied, including the failing action.`;
      throw actionError(
        `Action ${actionIndex + 1} (${actionFunc}) failed: ${cause?.message || String(cause)}.${partial}`,
        {
          code: "action_failed",
          actionIndex,
          appliedActionCount: possiblyApplied,
          actionFunc,
          cause,
        },
      );
    }
  }
}
