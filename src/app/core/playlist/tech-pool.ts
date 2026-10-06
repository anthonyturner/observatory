import { Genre, Track } from './playlist.types';

const video = (videoId: string, artist: string, title: string, genre: Genre): Track => ({
  videoId,
  title,
  artist,
  genre,
});
const ai = (videoId: string, artist: string, title: string) => video(videoId, artist, title, 'ai');
const git = (videoId: string, artist: string, title: string) =>
  video(videoId, artist, title, 'git');
const learn = (videoId: string, artist: string, title: string) =>
  video(videoId, artist, title, 'learn');

/** Talks and tutorials for the tech stations. Every id was checked against YouTube's
 *  oEmbed endpoint, which answers 401 for a video whose owner forbids embedding. */
export const TECH_POOL: readonly Track[] = [
  ai('PeMlggyqz0Y', 'Fireship', 'Machine Learning Explained in 100 Seconds'),
  ai('iO1mwxPNP5A', 'Fireship', 'Masterclass: AI-driven Development for Programmers'),
  ai('zjkBMFhNj_g', 'Andrej Karpathy', 'Intro to Large Language Models'),
  ai('7xTGNNLPyMI', 'Andrej Karpathy', 'Deep Dive into LLMs like ChatGPT'),
  ai('EWvNQjAaOHw', 'Andrej Karpathy', 'How I use LLMs'),
  ai('kCc8FmEb1nY', 'Andrej Karpathy', "Let's build GPT: from scratch, in code, spelled out"),
  ai('aircAruvnKk', '3Blue1Brown', 'But what is a neural network?'),
  ai('eMlx5fFNoYc', '3Blue1Brown', 'Attention in transformers, step-by-step'),
  ai('9-Jl0dxWQs8', '3Blue1Brown', 'How might LLMs store facts'),
  ai('gh2_PhgZGsM', 'freeCodeCamp.org', 'Claude Code for Beginners (Full Course)'),
  ai('C2GpeepcmYs', 'Traversy Media', 'Claude Code Crash Course For Developers'),
  git('hwP7WQkmECE', 'Fireship', 'Git Explained in 100 Seconds'),
  git('HkdAHXoRtos', 'Fireship', 'Git It? How to use Git and GitHub'),
  git('8lGpZkjnkt4', 'Fireship', 'GitHub Pull Request in 100 Seconds'),
  git('r8jQ9hVA2qs', 'GitHub', 'A brief introduction to Git for beginners'),
  git('pBy1zgt0XPc', 'GitHub', 'What is GitHub?'),
  git('e9lnsKot_SQ', 'ByteByteGo', 'How Git Works: Explained in 4 Minutes'),
  git('0chZFIZLR_0', 'ByteByteGo', 'Git Merge vs Rebase: Everything You Need to Know'),
  git('lG90LZotrpo', 'CS50', 'Git Internals by John Britton of GitHub'),
  git('bSA91XTzeuA', 'Computerphile', 'Inside the Hidden Git Folder'),
  git('R8_veQiYBjI', 'TechWorld with Nana', 'GitHub Actions Tutorial: Basic Concepts and CI/CD'),
  git('zTjRZNkhiEU', 'freeCodeCamp.org', 'Learn Git: Full Course for Beginners'),
  learn('zQnBQ4tB3ZA', 'Fireship', 'TypeScript in 100 Seconds'),
  learn('RvYYCGs45L4', 'Fireship', 'JavaScript Promise in 100 Seconds'),
  learn('2LCo926NFLI', 'Fireship', 'RxJS Quick Start with Practical Examples'),
  learn('scEDHsr3APg', 'Fireship', 'DevOps CI/CD Explained in 100 Seconds'),
  learn('oqYQG7QMdzw', 'Deborah Kurata', 'Angular Signals: What? Why? and How?'),
  learn('C_xXv27_gHg', 'Joshua Morony', 'How to deeply understand Angular signals'),
  learn('Byttv3YpjQk', 'Joshua Morony', 'I only ever use these RxJS operators to code reactively'),
  learn('kF7rQmSRlq0', 'Alex Hyett', 'SOLID Principles: Do You Really Understand Them?'),
  learn('Wibk0IfjfaI', 'Clean Coders', 'Clean Code with Uncle Bob, Episode 1'),
  learn('Qd9tJ3H_hPE', 'ByteByteGo', '7 System Design Concepts Explained in 10 Minutes'),
  learn('BTjxUS_PylA', 'ByteByteGo', '8 Most Important System Design Concepts'),
];
