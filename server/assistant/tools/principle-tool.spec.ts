import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { principleOfDay } from '../../principles/principle-of-day.ts';
import { principleOfDayTool } from './principle-tool.ts';

describe('principleOfDayTool', () => {
  it("reads out today's principle: its title, what it means and its question", async () => {
    const now = new Date(2026, 9, 8, 9);
    const { title, idea, question } = principleOfDay(now);

    const result = await principleOfDayTool(() => now).run({}, { projects: [] });

    assert.deepEqual(result, { content: { title, idea, question } });
  });
});
