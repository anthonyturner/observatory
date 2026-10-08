import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scanSource } from './source-scan.ts';

const membersOf = (body: string) => {
  const [found] = scanSource(
    'clock.ts',
    `@Component({}) export class Dial { ${body} }`,
  ).declarations;
  assert.ok(found);
  return found.members.map(({ name, kind, visibility }) => `${visibility} ${kind} ${name}`);
};

describe('class members', () => {
  it('lists methods and properties with their visibility, public by default', () => {
    assert.deepEqual(
      membersOf(`
        label = 'dial';
        private tick = 0;
        protected reset(): void {}
        #secret = 1;
        draw(): void {}
      `),
      [
        'public property label',
        'private property tick',
        'protected method reset',
        'private property #secret',
        'public method draw',
      ],
    );
  });

  it('tells signals, inputs and outputs from plain properties by what initialises them', () => {
    assert.deepEqual(
      membersOf(`
        readonly count = signal(0);
        readonly double = computed(() => this.count() * 2);
        readonly size = input(3);
        readonly name = input.required<string>();
        readonly open = model(false);
        readonly closed = output<void>();
        readonly plain = [];
      `),
      [
        'public signal count',
        'public signal double',
        'public input size',
        'public input name',
        'public input open',
        'public output closed',
        'public property plain',
      ],
    );
  });

  it('reads the Input and Output decorators, on a field or a setter', () => {
    assert.deepEqual(
      membersOf(`
        @Input() radius = 1;
        @Input({ required: true }) set label(value: string) {}
        @Output() picked = new EventEmitter<number>();
      `),
      ['public input radius', 'public input label', 'public output picked'],
    );
  });

  it('lists a getter and a setter of one name once, and the constructor’s parameter properties', () => {
    assert.deepEqual(
      membersOf(`
        constructor(private readonly http: HttpClient, zone: string) {}
        get size(): number { return 1; }
        set size(value: number) {}
      `),
      ['private property http', 'public accessor size'],
    );
  });
});
