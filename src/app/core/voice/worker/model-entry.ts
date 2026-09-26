import {
  DevicePath,
  RunRequest,
  SpokenClip,
  Transcript,
  WeightChoice,
  WeightFormat,
} from '../voice-protocol';
import { ProgressCallback, Transformers } from './transformers-api';

/** A model loaded and ready to run. */
export interface ReadyModel {
  run(request: RunRequest): Promise<Transcript | SpokenClip>;
  dispose(): Promise<void>;
}

/** A model the worker can run: where its weights are, and how to load it. */
export interface ModelEntry {
  readonly id: string;
  /** The weights' commit, so a change on Hugging Face cannot change them
   *  under the page; the browser caches them under this address. */
  readonly revision: string;
  /** The weight files a number format downloads, at the address
   *  transformers.js fetches and caches them under. */
  files(dtype: WeightChoice): readonly string[];
  load(lib: Transformers, path: DevicePath, progress: ProgressCallback): Promise<ReadyModel>;
}

export interface PinnedModel {
  readonly id: string;
  readonly revision: string;
}

/** The address of one of a model's ONNX files, `name` without `.onnx`. */
export function weightUrl({ id, revision }: PinnedModel, name: string): string {
  return `https://huggingface.co/${id}/resolve/${revision}/onnx/${name}.onnx`;
}

/** The format a weight file downloads in, where each file can have its own. */
export function formatOf(dtype: WeightChoice, file: string): WeightFormat {
  return typeof dtype === 'string' ? dtype : (dtype[file] ?? 'fp32');
}
