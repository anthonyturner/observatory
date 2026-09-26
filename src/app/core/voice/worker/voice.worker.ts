/// <reference lib="webworker" />

import { kindOf, messageOf } from '../voice-error';
import { VoiceCall, VoiceModelId, VoiceReply, VoiceRequest, VoiceResult } from '../voice-protocol';
import { KOKORO_MODEL } from './kokoro-model';
import { LoadRegistry } from './load-registry';
import { ModelEntry } from './model-entry';
import { TransformersLibrary } from './transformers-library';
import { WHISPER_MODEL } from './whisper-model';
import { WorkerOps } from './worker-ops';

/* Runs the speech models off the page, so a transcription on the processor
   never stops the sky or the buttons. The page says which device and number
   format to use, because only it can see the graphics card's features. */

const MODELS: Readonly<Record<VoiceModelId, ModelEntry>> = {
  listen: WHISPER_MODEL,
  speak: KOKORO_MODEL,
};

const loads = new LoadRegistry({ listen: MODELS.listen.id, speak: MODELS.speak.id });
const ops = new WorkerOps({
  models: MODELS,
  loads,
  library: new TransformersLibrary(loads),
  onLost: (model) => post({ op: 'lost', model }),
});

addEventListener('message', (event: MessageEvent<VoiceCall>) => void answer(event.data));

async function answer({ id, request }: VoiceCall): Promise<void> {
  try {
    const result = await perform(id, request);
    post({ op: 'done', id, result }, 'audio' in result ? [result.audio.buffer] : []);
  } catch (error: unknown) {
    post({ op: 'failed', id, kind: kindOf(error), message: messageOf(error) });
  }
}

async function perform(id: number, request: VoiceRequest): Promise<VoiceResult> {
  switch (request.op) {
    case 'load':
      await ops.load(request.model, request, (loaded, total) =>
        post({ op: 'progress', id, loaded, total }),
      );
      return {};
    case 'unload':
      await ops.unload(request.model);
      return {};
    case 'cached':
      return ops.cached(request.model, request.dtype);
    case 'run':
      return ops.run(request);
  }
}

function post(reply: VoiceReply, transfer: Transferable[] = []): void {
  postMessage(reply, transfer);
}
