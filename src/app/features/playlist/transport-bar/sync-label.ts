import { SyncStatus } from '../../../core/music-sync/music-sync.types';
import { SoundGuide } from '../../../core/music-sync/sources/sound-source.types';

/** What the Sync button says and explains for each state of listening. */
export interface SyncLabel {
  readonly text: string;
  readonly hint: string;
  readonly isOn: boolean;
  readonly isUnavailable: boolean;
}

type LabelMaker = (guide: SoundGuide) => SyncLabel;

const LABELS: Readonly<Record<SyncStatus, LabelMaker>> = {
  off: ({ ask }) => ({
    text: 'Sync',
    hint: `Move the sky with the music. ${ask}`,
    isOn: false,
    isUnavailable: false,
  }),
  asking: ({ ask }) => ({ text: 'Sync…', hint: ask, isOn: false, isUnavailable: false }),
  listening: () => ({
    text: 'Synced',
    hint: 'The sky is moving with the music — click to stop listening',
    isOn: true,
    isUnavailable: false,
  }),
  'no-audio': ({ ask, silent }) => ({
    text: 'No audio',
    hint: `${silent}, so the sky can’t hear it. ${ask}`,
    isOn: false,
    isUnavailable: false,
  }),
  denied: ({ ask }) => ({
    text: 'Sync',
    hint: `The request was declined, so the sky is not synced. ${ask}`,
    isOn: false,
    isUnavailable: false,
  }),
  unsupported: () => ({
    text: 'Sync',
    hint: 'This browser can’t capture this sound; pick another source',
    isOn: false,
    isUnavailable: true,
  }),
};

/** The label for `status`, in the words of the source being listened to. */
export const syncLabelOf = (status: SyncStatus, guide: SoundGuide): SyncLabel =>
  LABELS[status](guide);
