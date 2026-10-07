/** A JSON body's fields, or none when the body is not an object. */
export const fieldsOf = (body: unknown): Readonly<Record<string, unknown>> =>
  typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
