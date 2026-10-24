import { PROJECT_TABS, guidePartOf, projectTabAt, projectTabLink } from './project-tabs';

describe('projectTabLink', () => {
  it('puts the queue at the project’s own route and every other screen below it', () => {
    const [queue, releases] = PROJECT_TABS;
    expect(projectTabLink('me/app', queue)).toBe('/p/me/app');
    expect(projectTabLink('me/app', releases)).toBe('/p/me/app/releases');
  });
});

describe('projectTabAt', () => {
  it('finds the screen below a project’s route, the Queue at the route itself', () => {
    expect(projectTabAt('')?.id).toBe('queue');
    expect(projectTabAt('security')?.id).toBe('security');
    expect(projectTabAt('nowhere')).toBeUndefined();
  });

  it('counts a pull request’s page as the Queue’s', () => {
    expect(projectTabAt('pull')?.id).toBe('queue');
  });
});

describe('guidePartOf', () => {
  it('names a screen’s part of the Guide after the screen, the Queue’s after the Review Queue', () => {
    const part = (path: string): string | undefined => {
      const tab = projectTabAt(path);
      return tab && guidePartOf(tab);
    };

    expect(part('')).toBe('review-queue');
    expect(part('releases')).toBe('releases');
  });
});
