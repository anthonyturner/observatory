/** Called with each line to send, then with null to end the response. */
export type LineSink = (line: string | null) => void;

/** Starts sending lines to `sink`; returns the way to stop. */
export type LineSource = (sink: LineSink) => () => void;

const NDJSON_HEADERS = {
  'content-type': 'application/x-ndjson; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

/**
 * A response that sends each line from `subscribe` as it comes, one JSON value
 * per line. Plain NDJSON over a streamed `fetch`, not Server-Sent Events:
 * EventSource cannot send the header a write needs, nor any other.
 */
export function ndjsonResponse(subscribe: LineSource): Response {
  const encoder = new TextEncoder();
  let unsubscribe = (): void => undefined;
  let isOpen = true;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      unsubscribe = subscribe((line) => {
        if (!isOpen) return;
        if (line === null) {
          isOpen = false;
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(`${line}\n`));
      });
    },
    cancel() {
      isOpen = false;
      unsubscribe();
    },
  });
  return new Response(stream, { headers: NDJSON_HEADERS });
}
