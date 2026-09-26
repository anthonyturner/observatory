/** What ElevenLabs said went wrong, as far as its answer says. */
export interface Complaint {
  /** Its own name for the failure, such as `quota_exceeded`; empty when it gives none. */
  readonly status: string;
  readonly message: string;
}

const NO_COMPLAINT: Complaint = { status: '', message: '' };

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

/** The first detail of an error answer: `{ detail: { status, message } }`, a list of them for
 *  a request it could not validate, or a plain string. */
function detailOf(said: string): unknown {
  try {
    const body: unknown = JSON.parse(said);
    const detail = isObject(body) ? body['detail'] : undefined;
    return Array.isArray(detail) ? detail[0] : detail;
  } catch {
    return undefined;
  }
}

/** The complaint in an error answer's body `said`, or none when it is not one. */
export function complaintOf(said: string): Complaint {
  const detail = detailOf(said);
  if (typeof detail === 'string') return { status: '', message: detail };
  if (!isObject(detail)) return NO_COMPLAINT;
  return {
    status: textOf(detail['status']),
    message: textOf(detail['message']) || textOf(detail['msg']),
  };
}
