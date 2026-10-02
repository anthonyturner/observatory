import { SyncStatus } from '../../../core/music-sync/music-sync.types';

/** What the Sync button says and explains for each state of listening. */
export interface SyncLabel {
  readonly text: string;
  readonly hint: string;
  readonly isOn: boolean;
  readonly isUnavailable: boolean;
}

const ASK =
  'Chrome asks to share this tab: pick it and tick “Share tab audio”. Nothing is recorded or sent.';

const LABELS: Readonly<Record<SyncStatus, SyncLabel>> = {
  off: {
    text: 'Sync',
    hint: `Move the sky with the music. ${ASK}`,
    isOn: false,
    isUnavailable: false,
  },
  asking: { text: 'Sync…', hint: ASK, isOn: false, isUnavailable: false },
  listening: {
    text: 'Synced',
    hint: 'The sky is moving with the music — click to stop listening',
    isOn: true,
    isUnavailable: false,
  },
  'no-audio': {
    text: 'No audio',
    hint: `The tab was shared without its sound, so the sky can’t hear it. ${ASK}`,
    isOn: false,
    isUnavailable: false,
  },
  denied: {
    text: 'Sync',
    hint: `Sharing was declined, so the sky is not synced. ${ASK}`,
    isOn: false,
    isUnavailable: false,
  },
  unsupported: {
    text: 'Sync',
    hint: 'This browser can’t share a tab’s audio with the page; Chrome or Edge can',
    isOn: false,
    isUnavailable: true,
  },
};

export const syncLabelOf = (status: SyncStatus): SyncLabel => LABELS[status];
