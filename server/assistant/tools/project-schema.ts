/** The argument naming one project, as each project tool asks for it. */
export const PROJECT_ARG = {
  type: 'string',
  description: 'The project, by its name or its owner/name repository.',
} as const;

/** Arguments that are one required project. */
export const ONE_PROJECT = {
  type: 'object',
  properties: { project: PROJECT_ARG },
  required: ['project'],
} as const;
