/** How the charts colour agents: the playbook's pipeline in order, each its own
 *  hue, and every other agent together as Other. The order is fixed so a colour
 *  follows its agent in every chart; the colours are tokens (--agent-*). */
export interface AgentGroup {
  readonly id: string;
  readonly label: string;
  readonly colour: string;
}

export const AGENT_GROUPS: readonly AgentGroup[] = [
  { id: 'pm', label: 'pm', colour: 'var(--agent-pm)' },
  { id: 'refine', label: 'refine', colour: 'var(--agent-refine)' },
  { id: 'ux-design', label: 'ux-design', colour: 'var(--agent-ux)' },
  { id: 'dev', label: 'dev', colour: 'var(--agent-dev)' },
  { id: 'qa', label: 'qa', colour: 'var(--agent-qa)' },
  { id: 'other', label: 'other', colour: 'var(--agent-other)' },
];

export const OTHER_GROUP = AGENT_GROUPS[AGENT_GROUPS.length - 1];

/** The group an agent is charted under: its own, or Other. */
export const groupOf = (agent: string): AgentGroup =>
  AGENT_GROUPS.find((group) => group.id === agent) ?? OTHER_GROUP;
