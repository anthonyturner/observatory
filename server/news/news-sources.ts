import type { NewsSource } from './news-types.ts';

/** Headlines about AI in a feed that covers more than AI. */
const ABOUT_AI = /\b(AI|LLMs?|GPT|Claude|Gemini|Copilot|agents?|agentic|models?|MCP)\b/i;

/** Free public feeds, read without a key. The AI ones lean to tools for building software. */
export const NEWS_SOURCES: readonly NewsSource[] = [
  { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', topic: 'ai' },
  {
    name: 'GitHub Changelog',
    url: 'https://github.blog/changelog/feed/',
    topic: 'ai',
    only: ABOUT_AI,
  },
  { name: 'Hacker News AI', url: 'https://hnrss.org/newest?q=AI&points=100', topic: 'ai' },
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', topic: 'ai' },
  { name: 'OpenAI', url: 'https://openai.com/news/rss.xml', topic: 'ai' },
  { name: 'Google AI', url: 'https://blog.google/technology/ai/rss/', topic: 'ai' },
  {
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    topic: 'ai',
  },
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    topic: 'ai',
  },
  { name: 'Hacker News', url: 'https://news.ycombinator.com/rss', topic: 'engineering' },
  { name: 'Lobsters', url: 'https://lobste.rs/rss', topic: 'engineering' },
  { name: 'GitHub Blog', url: 'https://github.blog/feed/', topic: 'engineering' },
  { name: 'InfoQ', url: 'https://feed.infoq.com/', topic: 'engineering' },
  {
    name: 'The Pragmatic Engineer',
    url: 'https://newsletter.pragmaticengineer.com/feed',
    topic: 'engineering',
  },
  { name: 'Martin Fowler', url: 'https://martinfowler.com/feed.atom', topic: 'engineering' },
  { name: 'Stack Overflow Blog', url: 'https://stackoverflow.blog/feed/', topic: 'engineering' },
];
