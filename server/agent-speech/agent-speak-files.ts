import { homedir } from 'node:os';
import { join } from 'node:path';

/** Agent Speak's own folder on this machine, where it keeps its state. */
export const AGENT_SPEAK_DIR = join(homedir(), '.claude', 'agent-speak');

/** Agent Speak's files that say what it is doing, named as speak.ps1 names them. */
export const AGENT_SPEAK_FILES = {
  /** `<pid>|<startTicks>|<kind>`: the process playing a line now. */
  player: '.tts.pid',
  /** `play` or `pause`: Anthony's own pause, which only Agent Speak writes. */
  control: '.tts.ctl',
  /** `<pid>|<startTicks>`: the process speaking the queue, line by line. */
  drainer: '.tts.drain.pid',
  /** One `.txt` file per line waiting to be spoken. */
  queue: 'queue',
  /** `<expiryUnixMs>|<token>`: Jev is speaking, so Agent Speak holds its lines. */
  jevSpeaking: '.jev-speaking',
} as const;
