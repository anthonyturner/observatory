import { RawShaderMaterial, WebGLRenderer, WebGLRenderTarget } from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputShader } from 'three/addons/shaders/OutputShader.js';

/** The bloom is worked at this share of the size it is given. */
const BLOOM_SCALE = 0.5;

/** Bloom on luminous cores, worked at half the size: it is a blur of blurs, so
 *  the detail of a larger one is thrown away at once, and it needs a quarter of
 *  the pixels. */
export class SkyBloomPass extends UnrealBloomPass {
  override setSize(width: number, height: number): void {
    super.setSize(width * BLOOM_SCALE, height * BLOOM_SCALE);
  }
}

/**
 * The sky's last pass, one read of the picture: tone mapping and the colour
 * space the screen wants, then a vignette that darkens the edges and a grain
 * that hides the banding of large soft gradients. The tone mapping is
 * Reinhard, at the renderer's exposure, which is what this sky's renderer uses.
 */
export class FinishPass extends Pass {
  /** Seconds, which the grain moves with. */
  readonly time = { value: 0 };
  private readonly uniforms = {
    tDiffuse: { value: null as WebGLRenderTarget['texture'] | null },
    toneMappingExposure: { value: 1 },
    time: this.time,
  };
  private readonly material = new RawShaderMaterial({
    uniforms: this.uniforms,
    vertexShader: OutputShader.vertexShader,
    fragmentShader: `precision highp float;
      uniform sampler2D tDiffuse;
      uniform float time;
      #include <tonemapping_pars_fragment>
      #include <colorspace_pars_fragment>
      varying vec2 vUv;
      void main() {
        vec3 c = ReinhardToneMapping(texture2D(tDiffuse, vUv).rgb);
        c = sRGBTransferOETF(vec4(c, 1.)).rgb;
        float vignette = 1. - .72 * smoothstep(.2, .8, length(vUv - .5));
        float grain = fract(sin(dot(gl_FragCoord.xy + floor(time * 24.), vec2(12.9898, 78.233))) * 43758.5453) - .5;
        gl_FragColor = vec4(max(vec3(0.), c * vignette + grain * .018), 1.);
      }`,
  });
  private readonly quad = new FullScreenQuad(this.material);

  override render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
  ): void {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    this.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  override dispose(): void {
    this.material.dispose();
    this.quad.dispose();
  }
}
