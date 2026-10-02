import { Track } from './playlist.types';

/** Home's trance playlist. Every id was checked against YouTube's oEmbed endpoint,
 *  which answers 401 for a video whose owner forbids embedding. */
export const TRANCE_PLAYLIST: readonly Track[] = [
  {
    videoId: 'Bcf5kzBCdy4',
    title: 'Set You Free',
    artist: 'N-Trance',
  },
  {
    videoId: 'ad9kxOYT5Ko',
    title: 'Take Me Home (Rising Star Extended Remix)',
    artist: 'Armin van Buuren',
  },
  {
    videoId: 'AZn4W9NEDV4',
    title: 'Android Dreams',
    artist: 'Elite Trance Music',
  },
  {
    videoId: 'QwlH-kROB9Q',
    title: 'Echoes',
    artist: 'AEKTrance',
  },
  {
    videoId: 'tE9NcLGSDBE',
    title: 'Trance Top 1000 — The Anthems (Mini Mix)',
    artist: 'Armada Music',
  },
  {
    videoId: 'yEMt9esDe1g',
    title: 'Classic Trance Anthems, 1999 to 2001',
    artist: 'DelasTrance',
  },
  {
    videoId: 'vo_9amEEEhQ',
    title: 'The Best of Anjunabeats: 2000–2004',
    artist: 'Seven Bliss',
  },
  {
    videoId: 'u9tZq5CFE_g',
    title: 'The Best of Anjunabeats: 2005–2006',
    artist: 'Seven Bliss',
  },
  {
    videoId: 'zdUj6dgECh8',
    title: 'Anjunabeats: The Lost Classics, Vol. 1',
    artist: 'Seven Bliss',
  },
  {
    videoId: 'KcU-1fbhgss',
    title: 'Trance Classics, 1997–2005',
    artist: 'Aurora',
  },
  {
    videoId: 'xSyzngZDL8o',
    title: 'Trance Year Mix 2024',
    artist: 'Armada Music',
  },
];
