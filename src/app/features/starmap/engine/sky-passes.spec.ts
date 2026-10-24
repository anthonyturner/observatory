import { Vector2, WebGLRenderer, WebGLRenderTarget } from 'three';
import { FinishPass, SkyBloomPass } from './sky-passes';

describe('SkyBloomPass', () => {
  it('works at half the size it is given, so a quarter of the pixels', () => {
    const bloom = new SkyBloomPass(new Vector2(1, 1), 0.4, 0.5, 0.75);

    bloom.setSize(1600, 900);

    // The stock pass halves it again for its first blur.
    expect(bloom.renderTargetBright.width).toBe(400);
    expect(bloom.renderTargetBright.height).toBe(225);
    expect(bloom.renderTargetsVertical[1].width).toBe(200);
  });
});

describe('FinishPass', () => {
  const setUp = () => {
    const drawn: unknown[] = [];
    const targets: unknown[] = [];
    const renderer = {
      toneMappingExposure: 1.15,
      setRenderTarget: (target: unknown) => targets.push(target),
      render: (...args: unknown[]) => drawn.push(args),
    } as unknown as WebGLRenderer;
    const pass = new FinishPass();
    const uniforms = (pass as unknown as { uniforms: Record<string, { value: unknown }> }).uniforms;
    return {
      pass,
      uniforms,
      renderer,
      drawn,
      targets,
      write: new WebGLRenderTarget(2, 2),
      read: new WebGLRenderTarget(2, 2),
    };
  };

  it('reads the previous pass and draws it once, at the renderer exposure', () => {
    const { pass, uniforms, renderer, drawn, write, read } = setUp();

    pass.render(renderer, write, read);

    expect(drawn).toHaveLength(1);
    expect(uniforms['tDiffuse'].value).toBe(read.texture);
    expect(uniforms['toneMappingExposure'].value).toBe(1.15);
  });

  it('draws to the screen when it is the last pass, and into the write buffer when not', () => {
    const { pass, renderer, targets, write, read } = setUp();

    pass.renderToScreen = true;
    pass.render(renderer, write, read);
    pass.renderToScreen = false;
    pass.render(renderer, write, read);

    expect(targets).toEqual([null, write]);
  });

  it('moves its grain with the time it is given', () => {
    const { pass, uniforms } = setUp();

    pass.time.value = 2.5;

    expect(uniforms['time'].value).toBe(2.5);
  });
});
