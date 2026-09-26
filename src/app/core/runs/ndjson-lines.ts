/** Calls `onLine` with each non-empty line of `body` as it arrives, and
 *  settles when the stream ends. A last line with no newline still counts. */
export async function readLines(
  body: ReadableStream<Uint8Array<ArrayBuffer>>,
  onLine: (line: string) => void,
): Promise<void> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffered = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered = emitWholeLines(buffered + value, onLine);
  }
  if (buffered) onLine(buffered);
}

/** Sends each whole line of `text` to `onLine`; returns the part after the last newline. */
function emitWholeLines(text: string, onLine: (line: string) => void): string {
  const lines = text.split('\n');
  const rest = lines.pop() ?? '';
  for (const line of lines) if (line) onLine(line);
  return rest;
}
