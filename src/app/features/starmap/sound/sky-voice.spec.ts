import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AGENT_SPEECH_API } from '../../../core/agent-speech/agent-speech-api';
import { JevIdle } from '../../../core/assistant/jev-idle';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { PageVisibility } from '../../../core/presence/page-visibility';
import { ViewerSession } from '../../../core/session/viewer-session';
import { ANNOUNCEMENT_VOICE } from '../../../core/voice/announcement-voice';
import { LineClips } from '../../../core/voice/line-clips';
import { SpeakPreference } from '../../../core/voice/speak-preference';
import { SpokenClip, VoiceRole } from '../../../core/voice/voice-protocol';
import { Resolution } from '../memory/departure-company';
import { ExitStart } from '../memory/exits';
import { Undock } from '../memory/undock';
import { GAP_S } from './line-plan';
import { SkyVoice } from './sky-voice';
import { CREW_PREPARED_LINES, FAREWELLS, JEV_PREPARED_LINES, farewellFor } from './sky-lines';

/** A clip one second long, one for each line, so what was played says what it was. */
const clips = new Map<string, SpokenClip>();
const clipOf = (text: string): SpokenClip => {
  const known = clips.get(text) ?? { audio: new Float32Array(10), rate: 10 };
  clips.set(text, known);
  return known;
};

const wall = (): number => performance.now() / 1000;

const resolution = (startAt: number, pr = 1): Resolution => ({ pr, issues: [3], startAt });
const exit = (startAt: number, kind: ExitStart['kind'] = 'merged', pr = 1): ExitStart => ({
  pr,
  kind,
  startAt,
});
const undock = (startAt: number, key: string): Undock => ({
  kind: 'satellite',
  key,
  pr: 1,
  name: key,
  from: { x: 0, y: 0, z: 0 },
  startAt,
});

function setUp() {
  const made = new Set<string>();
  const asked: string[] = [];
  /** The voice each line was asked for in. */
  const askedIn = new Map<string, VoiceRole>();
  const prepare = vi.fn<(texts: readonly string[], role: VoiceRole) => void>();
  const speaker = signal('kokoro');
  const played: { clip: SpokenClip; at: number }[] = [];
  const announceClip = vi.fn((clip: SpokenClip) => played.push({ clip, at: wall() }));
  const isOn = signal(true);
  const isHidden = signal(false);
  const isLocal = signal(true);
  const isStill = signal(false);
  const isIdle = signal(true);
  const isAgentBusy = signal(false);
  const readyLine = (text: string): void => void made.add(text);
  TestBed.configureTestingModule({
    providers: [
      {
        provide: LineClips,
        useValue: {
          speaker,
          prepare,
          clipOf: (text: string, role: VoiceRole) => {
            asked.push(text);
            askedIn.set(text, role);
            return made.has(text) ? clipOf(text) : null;
          },
        },
      },
      { provide: ANNOUNCEMENT_VOICE, useValue: { announce: vi.fn(), announceClip } },
      { provide: JevIdle, useValue: { isIdle } },
      { provide: AGENT_SPEECH_API, useValue: { isBusy: () => of(isAgentBusy()) } },
      { provide: SpeakPreference, useValue: { isOn } },
      { provide: PageVisibility, useValue: { isHidden } },
      { provide: MotionPreference, useValue: { isStill } },
      { provide: ViewerSession, useValue: { isConfirmedLocal: isLocal } },
    ],
  });
  const voice = TestBed.inject(SkyVoice);
  TestBed.tick();
  /** Lets `seconds` go by on the wall clock and the timers. */
  const advance = (seconds: number): void => {
    vi.advanceTimersByTime(seconds * 1000);
  };
  return {
    voice,
    prepare,
    speaker,
    announceClip,
    played,
    asked,
    askedIn,
    readyLine,
    isOn,
    isHidden,
    isLocal,
    isStill,
    isIdle,
    isAgentBusy,
    advance,
  };
}

describe('SkyVoice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clips.clear();
  });
  afterEach(() => vi.useRealTimers());

  describe('"Resolved!"', () => {
    it('is said the instant the planets turn green, not before', () => {
      const { voice, readyLine, advance, announceClip } = setUp();
      readyLine('Resolved!');

      voice.resolved([resolution(wall() + 1)]);
      advance(0.9);
      expect(announceClip).not.toHaveBeenCalled();
      advance(0.2);

      expect(announceClip).toHaveBeenCalledExactlyOnceWith(clipOf('Resolved!'));
    });

    it('is said with motion off too, since the planets still turn green', () => {
      const { voice, readyLine, advance, announceClip, isStill } = setUp();
      readyLine('Resolved!');

      isStill.set(true);
      voice.resolved([resolution(wall() + 0.1)]);
      advance(1);

      expect(announceClip).toHaveBeenCalledTimes(1);
    });

    it('is said once for a refresh whose pull requests all resolve, at the first', () => {
      const { voice, readyLine, advance, played } = setUp();
      readyLine('Resolved!');
      const start = wall();

      voice.resolved([resolution(start + 0.5, 2), resolution(start + 0.3, 1)]);
      advance(2);

      expect(played).toHaveLength(1);
      expect(played[0].at).toBeCloseTo(start + 0.3, 1);
    });

    it('is dropped when its moment has already passed', () => {
      const { voice, readyLine, advance, announceClip } = setUp();
      readyLine('Resolved!');

      voice.resolved([resolution(wall() - 1)]);
      advance(3);

      expect(announceClip).not.toHaveBeenCalled();
    });

    it('says nothing for no resolutions', () => {
      const { voice, asked } = setUp();

      voice.resolved([]);

      expect(asked).toEqual([]);
    });
  });

  describe('the ending', () => {
    it('is one line a refresh, joined when several ended', () => {
      const { voice, readyLine, advance, played } = setUp();
      readyLine('Three merged!');

      voice.exited([
        exit(wall() + 0.1),
        exit(wall() + 0.2, 'merged', 2),
        exit(wall(), 'merged', 3),
      ]);
      advance(1);

      expect(played.map((each) => each.clip)).toEqual([clipOf('Three merged!')]);
    });

    it('has a line for each way to end', () => {
      const { voice, readyLine, advance, played } = setUp();
      [...JEV_PREPARED_LINES, ...CREW_PREPARED_LINES].forEach(readyLine);

      for (const kind of ['merged', 'squashed', 'closed'] as const) {
        voice.exited([exit(wall() + 0.1, kind)]);
        advance(3);
      }

      expect(played.map((each) => each.clip)).toEqual([
        clipOf('Merged!'),
        clipOf('Squashed and shipped!'),
        clipOf('Closed. Into the dark it goes.'),
      ]);
    });
  });

  describe('a farewell', () => {
    it('is the one its ship always says, as it casts off', () => {
      const { voice, readyLine, advance, played } = setUp();
      FAREWELLS.forEach(readyLine);

      voice.undocked([undock(wall() + 0.5, 'crew:7')]);
      advance(1);

      expect(played.map((each) => each.clip)).toEqual([clipOf(farewellFor('crew:7'))]);
    });

    it('is asked for in the crew voice, while Jev’s own lines are asked for in his', () => {
      const { voice, readyLine, advance, askedIn } = setUp();
      [...JEV_PREPARED_LINES, ...CREW_PREPARED_LINES].forEach(readyLine);

      voice.resolved([resolution(wall() + 0.5)]);
      voice.exited([exit(wall() + 1)]);
      voice.undocked([undock(wall() + 2, 'crew:7')]);
      advance(3);

      expect(askedIn.get('Resolved!')).toBe('jev');
      expect(askedIn.get('Merged!')).toBe('jev');
      expect(askedIn.get(farewellFor('crew:7'))).toBe('crew');
    });

    it('is said by at most two of a crowd, one after the other', () => {
      const { voice, readyLine, advance, played } = setUp();
      FAREWELLS.forEach(readyLine);
      const start = wall();

      voice.undocked(
        ['a', 'b', 'c', 'd'].map((key, i) => undock(start + 0.3 + i * 0.18, `agent-${key}`)),
      );
      advance(6);

      expect(played).toHaveLength(2);
      expect(played[1].at - played[0].at).toBeGreaterThanOrEqual(1 + GAP_S - 0.01);
    });

    it('is not said with motion off, since nothing flies home', () => {
      const { voice, readyLine, advance, announceClip, isStill, asked } = setUp();
      FAREWELLS.forEach(readyLine);

      isStill.set(true);
      voice.undocked([undock(wall() + 0.5, 'crew:7')]);
      advance(3);

      expect(asked).toEqual([]);
      expect(announceClip).not.toHaveBeenCalled();
    });

    it('waits its turn behind the ending and the “Resolved!” before it, two at most', () => {
      const { voice, readyLine, advance, played } = setUp();
      [...JEV_PREPARED_LINES, ...CREW_PREPARED_LINES].forEach(readyLine);
      const start = wall();

      voice.resolved([resolution(start)]);
      voice.exited([exit(start + 1.65)]);
      voice.undocked(
        ['a', 'b', 'c'].map((key, i) => undock(start + 1.95 + i * 0.18, `agent-${key}`)),
      );
      advance(10);

      const at = played.map((each) => each.at - start);
      expect(played.map((each) => each.clip)).toEqual([
        clipOf('Resolved!'),
        clipOf('Merged!'),
        clipOf(farewellFor('agent-a')),
        clipOf(farewellFor('agent-b')),
      ]);
      expect(at[0]).toBeCloseTo(0, 1);
      expect(at[1]).toBeCloseTo(1.65, 1);
      expect(at[2]).toBeCloseTo(1.65 + 1 + GAP_S, 1);
      expect(at[3]).toBeCloseTo(1.65 + 2 * (1 + GAP_S), 1);
    });
  });

  describe('a line that cannot be heard', () => {
    it('is dropped, not held, when its clip is not made yet, and is asked for', () => {
      const { voice, advance, announceClip, asked } = setUp();

      voice.resolved([resolution(wall() + 0.1)]);
      advance(5);

      expect(asked).toEqual(['Resolved!']);
      expect(announceClip).not.toHaveBeenCalled();
    });

    it('is not asked for with Speak off, the tab hidden, or on the hosted site', () => {
      const { voice, readyLine, advance, announceClip, asked, isOn, isHidden, isLocal } = setUp();
      readyLine('Resolved!');

      isOn.set(false);
      voice.resolved([resolution(wall())]);
      isOn.set(true);
      isHidden.set(true);
      voice.resolved([resolution(wall())]);
      isHidden.set(false);
      isLocal.set(false);
      voice.resolved([resolution(wall())]);
      advance(2);

      expect(asked).toEqual([]);
      expect(announceClip).not.toHaveBeenCalled();
    });

    it('is dropped if Speak goes off or the tab is hidden before its moment', () => {
      const { voice, readyLine, advance, announceClip, isOn, isHidden } = setUp();
      readyLine('Resolved!');

      voice.resolved([resolution(wall() + 1)]);
      isOn.set(false);
      advance(2);
      expect(announceClip).not.toHaveBeenCalled();

      isOn.set(true);
      voice.resolved([resolution(wall() + 1)]);
      isHidden.set(true);
      advance(2);
      expect(announceClip).not.toHaveBeenCalled();
    });

    it('is dropped, and not said later, while Jev is busy or someone is talking', () => {
      const { voice, readyLine, advance, announceClip, isIdle } = setUp();
      readyLine('Resolved!');

      isIdle.set(false);
      voice.resolved([resolution(wall() + 0.5)]);
      advance(0.7);
      isIdle.set(true);
      advance(5);

      expect(announceClip).not.toHaveBeenCalled();
    });

    it('is dropped while Agent Speak is talking', () => {
      const { voice, readyLine, advance, announceClip, isAgentBusy } = setUp();
      readyLine('Resolved!');

      isAgentBusy.set(true);
      voice.resolved([resolution(wall() + 0.5)]);
      advance(2);

      expect(announceClip).not.toHaveBeenCalled();
    });
  });

  describe('the lines made ahead', () => {
    it('are queued while Speak is on, the tab is in view and this machine speaks', () => {
      const { prepare } = setUp();

      expect(prepare).toHaveBeenCalledTimes(2);
      expect(prepare).toHaveBeenCalledWith(JEV_PREPARED_LINES, 'jev');
      expect(prepare).toHaveBeenCalledWith(CREW_PREPARED_LINES, 'crew');
    });

    it('are not queued with Speak off, and are once it is on', () => {
      const { prepare, isOn } = setUp();
      prepare.mockClear();

      isOn.set(false);
      TestBed.tick();
      expect(prepare).not.toHaveBeenCalled();

      isOn.set(true);
      TestBed.tick();
      expect(prepare).toHaveBeenCalledTimes(2);
    });

    it('are queued again when the voice changes', () => {
      const { prepare, speaker } = setUp();
      prepare.mockClear();

      speaker.set('elevenlabs:rachel');
      TestBed.tick();

      expect(prepare).toHaveBeenCalledTimes(2);
      expect(prepare).toHaveBeenCalledWith(JEV_PREPARED_LINES, 'jev');
      expect(prepare).toHaveBeenCalledWith(CREW_PREPARED_LINES, 'crew');
    });
  });
});
