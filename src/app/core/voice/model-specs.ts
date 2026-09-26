import { LISTEN_PATHS, ModelPaths, SPEAK_PATHS } from './model-paths';
import { VoiceControlId } from './voice-status';
import { VoiceModelId } from './voice-protocol';

/** A model the worker runs, and what the page says of it. */
export interface ModelSpec {
  readonly model: VoiceModelId;
  /** "speech model" or "voice model", as in "Downloading the …". */
  readonly what: string;
  /** Said before the first download. */
  readonly privacy: string;
  readonly paths: ModelPaths;
  /** The button its loading ring goes round, and focus goes back to. */
  readonly control: VoiceControlId;
  /** The ready line once the card failed it and it moved to the processor. */
  readonly fellBackReady: string;
}

export const LISTEN_SPEC: ModelSpec = {
  model: 'listen',
  what: 'speech model',
  privacy: 'Speech is turned into text in this browser; no audio leaves it.',
  paths: LISTEN_PATHS,
  control: 'mic',
  fellBackReady:
    'The graphics card couldn’t run the speech model, so voice runs on the processor: slower, but it works.',
};

export const SPEAK_SPEC: ModelSpec = {
  model: 'speak',
  what: 'voice model',
  privacy: 'Replies are spoken by this browser; no text leaves it.',
  paths: SPEAK_PATHS,
  control: 'speak',
  fellBackReady:
    'The graphics card couldn’t run the voice model, so replies are spoken from the processor: slower, but it works.',
};
