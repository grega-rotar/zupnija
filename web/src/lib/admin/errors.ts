/** Errors server actions turn into user-facing Slovenian messages. */
export class ForbiddenError extends Error {
  constructor(message = "forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** A message meant for the person using the editor, already in Slovenian. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string; forbidden?: boolean };

/** Wrap a server action body so UI code always gets an ActionResult. */
export async function toResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: e.message, forbidden: true };
    if (e instanceof UserError) return { ok: false, error: e.message };
    throw e;
  }
}
