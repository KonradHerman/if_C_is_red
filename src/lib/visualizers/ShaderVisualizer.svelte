<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { activeColorMap } from '../colorMappings';
  import { pitchClass } from '../noteGeometry';
  import type { ActiveNote } from '../stores';

  export let activeNotes: Map<string | number, ActiveNote> = new Map();

  // A fragment-shader flow field. The 12 pitch-class intensities + a palette
  // of 12 colors are passed as uniforms; the shader mixes them into a
  // continuous chromesthetic soup.

  let canvas: HTMLCanvasElement;
  let gl: WebGLRenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let raf = 0;
  let start = performance.now();

  // Pitch-class intensity (0..1) with exponential decay so notes glow and fade.
  const intensity = new Float32Array(12);

  const VERT = `
    attribute vec2 a_pos;
    void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;
    uniform vec2  u_res;
    uniform float u_time;
    uniform float u_intens[12];
    uniform vec3  u_colors[12];

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    float noise(vec2 p){
      vec2 i = floor(p); vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    float fbm(vec2 p){
      float v = 0.0;
      float amp = 0.5;
      for (int i = 0; i < 5; i++){ v += amp * noise(p); p *= 2.0; amp *= 0.5; }
      return v;
    }

    void main(){
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
      float t = u_time * 0.05;

      vec3 col = vec3(0.0);
      float totalI = 0.001;
      for (int i = 0; i < 12; i++){
        float ang = float(i) / 12.0 * 6.2831 + t;
        vec2 c = vec2(cos(ang), sin(ang)) * 0.6;
        float d = length(uv - c);
        float w = u_intens[i] / (0.4 + d * d * 4.0);
        col += u_colors[i] * w;
        totalI += w;
      }
      col /= totalI;

      // Flow field distortion
      vec2 flow = vec2(
        fbm(uv * 2.0 + t),
        fbm(uv * 2.0 + t + 10.0)
      );
      float n = fbm(uv * 3.0 + flow * 1.5 + t * 0.5);
      col *= 0.35 + n * 0.9;

      // Vignette
      float vig = smoothstep(1.4, 0.25, length(uv));
      col *= vig;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      throw new Error('shader compile: ' + log);
    }
    return s;
  }

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width  = window.innerWidth  * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width  = window.innerWidth  + 'px';
    canvas.style.height = window.innerHeight + 'px';
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
  }

  onMount(() => {
    gl = canvas.getContext('webgl');
    if (!gl) return;
    try {
      const v = compile(gl, gl.VERTEX_SHADER, VERT);
      const f = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      program = gl.createProgram()!;
      gl.attachShader(program, v);
      gl.attachShader(program, f);
      gl.linkProgram(program);
      gl.useProgram(program);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, 'a_pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    } catch (e) {
      console.warn('ShaderVisualizer: WebGL setup failed', e);
      return;
    }

    resize();
    window.addEventListener('resize', resize);

    const uRes     = gl.getUniformLocation(program!, 'u_res');
    const uTime    = gl.getUniformLocation(program!, 'u_time');
    const uIntens  = gl.getUniformLocation(program!, 'u_intens[0]');
    const uColors  = gl.getUniformLocation(program!, 'u_colors[0]');

    function hexToRgb(hex: string): [number, number, number] {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!m) return [0.5, 0.5, 0.5];
      return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
    }

    const loop = () => {
      // Decay intensities.
      for (let i = 0; i < 12; i++) intensity[i] *= 0.94;
      activeNotes.forEach((n) => {
        const pc = pitchClass(n.noteNumber);
        intensity[pc] = Math.max(intensity[pc], 0.3 + n.velocity * 0.7);
      });

      // Always bleed a gentle base so it's never fully black.
      const maxI = Math.max(...intensity);
      const floor = Math.max(0.05, 0.15 - maxI * 0.15);
      for (let i = 0; i < 12; i++) intensity[i] = Math.max(intensity[i], floor);

      if (gl && program) {
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, (performance.now() - start) / 1000);
        gl.uniform1fv(uIntens, intensity);

        const cols = new Float32Array(36);
        const palette = $activeColorMap;
        for (let i = 0; i < 12; i++) {
          const rgb = hexToRgb(palette[i] || '#888');
          cols[i * 3]     = rgb[0];
          cols[i * 3 + 1] = rgb[1];
          cols[i * 3 + 2] = rgb[2];
        }
        gl.uniform3fv(uColors, cols);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  });

  onDestroy(() => cancelAnimationFrame(raf));
</script>

<div class="container">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .container {
    width: 100vw;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    overflow: hidden;
    background: #000;
  }
  canvas { display: block; width: 100%; height: 100%; }
</style>
