/** One of the voices on the owner's ElevenLabs account. */
export interface CatalogVoice {
  readonly id: string;
  readonly name: string;
}

/** What the site says of ElevenLabs. `unavailable` is a site that will not
 *  say, such as the hosted preview for a visitor: not an error, just no
 *  ElevenLabs. */
export type CatalogState =
  | { readonly status: 'reading' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'off' }
  | {
      readonly status: 'on';
      readonly voices: readonly CatalogVoice[];
      readonly defaultVoice: string | null;
      /** Why the voices could not be listed, in the site's words. */
      readonly failed: string | null;
    };
