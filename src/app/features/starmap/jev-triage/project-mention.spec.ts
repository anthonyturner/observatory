import { wordsOf } from '../../../core/assistant/spoken-numbers';
import { NamedProject, withoutProject } from './project-mention';

const OBSERVATORY: NamedProject = { name: 'observatory', repo: 'me/observatory' };
const STARMAP: NamedProject = { name: 'pr-starmap', repo: 'me/pr-starmap' };
const BETA: NamedProject = { name: 'beta', repo: 'me/beta' };
const PROJECTS = [OBSERVATORY, STARMAP, BETA];

const named = (said: string) => withoutProject(wordsOf(said), PROJECTS);

describe('withoutProject', () => {
  it.each<[string, NamedProject, string]>([
    ['blocking in observatory', OBSERVATORY, 'blocking'],
    ['blocking in observatry', OBSERVATORY, 'blocking'],
    ['blocking in observe atory', OBSERVATORY, 'blocking'],
    ['blocking in the observatorie', OBSERVATORY, 'blocking in the'],
    ['next star for pr-starmap', STARMAP, 'next star'],
    ['next star for pr star map', STARMAP, 'next star'],
    ['next star for starmap', STARMAP, 'next star'],
    ['dismiss 12 in beta', BETA, 'dismiss 12'],
  ])('hears %j as naming a project', (said, project, rest) => {
    expect(named(said)).toEqual({ project, rest: rest.split(' ') });
  });

  it('leaves words that name no project as they are', () => {
    for (const said of ['dismiss 412', 'snooze 12 till monday', 'blocking in data', 'next star']) {
      expect(named(said), said).toEqual({ project: null, rest: wordsOf(said) });
    }
  });

  it('names none when two projects are named', () => {
    expect(named('blocking in observatory and beta')).toBeUndefined();
  });

  it('prefers the project whose whole name was said', () => {
    const starmap: NamedProject = { name: 'starmap', repo: 'me/starmap' };
    expect(withoutProject(wordsOf('next in pr starmap'), [starmap, STARMAP])).toEqual({
      project: STARMAP,
      rest: ['next'],
    });
    expect(withoutProject(wordsOf('next in starmap'), [starmap, STARMAP])).toEqual({
      project: starmap,
      rest: ['next'],
    });
  });

  it('names none when the words fit two projects equally', () => {
    const alpha: NamedProject = { name: 'alphas', repo: 'me/alphas' };
    const alphb: NamedProject = { name: 'alphat', repo: 'me/alphat' };
    expect(withoutProject(wordsOf('next in alpha'), [alpha, alphb])).toBeUndefined();
  });
});
