import { useEffect, useRef } from 'react'

/**
 * Animated "sunlight on water" background: a web of caustic light lines drawn with a small WebGL shader.
 * Rendered at reduced resolution, ~30 fps, paused while the tab is hidden, and a still frame when the
 * system asks for reduced motion. If WebGL isn't available the plain black background is kept.
 */
const VERT = `
attribute vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }
`

const FRAG = `
precision mediump float;
uniform vec2 res;
uniform float time;
uniform float lightMode;  // 1.0 = light theme (pale base, tinted ripples), 0.0 = dark theme (glowing light on black)

// Domain-warped sine field; its zero crossings form a moving web of light lines (caustics).
// \`sharp\` sets line width: high = thin crisp lines, low = wide soft (blurred) bands.
float causticLayer(vec2 p, float t, float sharp) {
  for (int i = 0; i < 5; i++) {
    float k = float(i) + 1.0;
    p += vec2(sin(p.y * 1.1 + t * 0.5 * k + k), cos(p.x * 0.95 - t * 0.42 * k + 2.0 * k)) * (0.9 / k);
  }
  float a = sin(p.x * 1.15) * sin(p.y * 1.15);
  return pow(1.0 - abs(a), sharp);
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 uv = gl_FragCoord.xy / res.y;          // aspect-correct, height = 1
  float t = time * 0.35;

  // Two soft layers at different scales and angles: irregular, blurred light cells.
  float soft = lightMode > 0.5 ? 0.55 : 1.0;  // light theme: wider, blurrier ripple lines
  float c = causticLayer(rot(0.35) * uv * 5.0, t, 6.0 * soft) * 0.6 + causticLayer(rot(-0.9) * uv * 7.5 + 3.7, t * 1.25, 5.0 * soft) * 0.45;
  c += c * c * 0.5;                           // brighter where lines cross, like focused light

  // "Black light": wide dark ripples moving the other way, like shadows of waves passing over the light.
  float darkRipples = causticLayer(rot(1.9) * uv * 3.2 + 8.1, -t * 0.8, 3.0);
  // Large soft shadow patches drifting slowly across (swells / clouds over the water).
  vec2 q = uv * 1.3 + vec2(time * 0.025, -time * 0.018);
  float patches = 0.5 + 0.5 * sin(q.x * 2.3 + sin(q.y * 1.7 + time * 0.05) * 1.6) * sin(q.y * 1.9 - sin(q.x * 1.3 - time * 0.04) * 1.4);
  float shadow = clamp(darkRipples * 0.75 + smoothstep(0.45, 0.95, patches) * 0.6, 0.0, 0.9);
  c *= 1.0 - shadow;

  // Sunlight comes from above: brighter near the top, fading toward the bottom.
  float y = gl_FragCoord.y / res.y;           // 0 bottom .. 1 top
  float sun = 0.25 + 0.75 * smoothstep(0.0, 1.0, y);

  // Soft slanted light shafts drifting slowly.
  float shafts = 0.5 + 0.5 * sin((uv.x * 1.6 + uv.y * 0.6) * 3.2 + time * 0.12);
  shafts = mix(0.75, 1.0, shafts);

  // Light colour: large, slowly drifting regions cycling green -> sky blue -> purple -> red -> yellow.
  float field = sin(uv.x * 1.3 + time * 0.05) * 1.1 + sin(uv.y * 1.7 - time * 0.04) * 0.9 + sin((uv.x + uv.y) * 0.9 + time * 0.03) * 0.8;
  float h = fract(field * 0.3 + uv.x * 0.42 - uv.y * 0.15 + time * 0.01) * 5.0;
  vec3 pal0 = vec3(0.40, 1.00, 0.55);   // green
  vec3 pal1 = vec3(0.45, 0.80, 1.00);   // sky blue
  vec3 pal2 = vec3(0.72, 0.45, 1.00);   // purple
  vec3 pal3 = vec3(1.00, 0.38, 0.40);   // red
  vec3 pal4 = vec3(1.00, 0.86, 0.40);   // yellow
  float f = smoothstep(0.2, 0.8, fract(h));   // soft blend between neighbouring colours
  vec3 a = pal0, b = pal1;
  if (h >= 1.0) { a = pal1; b = pal2; }
  if (h >= 2.0) { a = pal2; b = pal3; }
  if (h >= 3.0) { a = pal3; b = pal4; }
  if (h >= 4.0) { a = pal4; b = pal0; }
  vec3 light = mix(a, b, f);

  vec3 col = light * c * sun * shafts * 0.5;
  col += light * 0.035 * sun;                 // faint coloured underwater haze
  if (lightMode > 0.5) {
    // Light theme: soft coloured ripples tinting a pale background.
    vec3 base = vec3(0.933, 0.949, 0.961);
    vec3 tint = light * 0.78;
    col = mix(base, tint, clamp(c * sun * shafts * 0.42 + 0.03, 0.0, 0.6));
  }
  gl_FragColor = vec4(col, 1.0);
}
`

export default function Caustics({ light = false }: { light?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const lightRef = useRef(light)
  const redraw = useRef<() => void>(() => {})
  useEffect(() => {
    lightRef.current = light
    redraw.current() // repaint right away (matters when motion is reduced and nothing animates)
  }, [light])

  useEffect(() => {
    const canvas = ref.current
    const gl = canvas?.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
    if (!canvas || !gl) return

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null
    }
    const vs = compile(gl.VERTEX_SHADER, VERT)
    const fs = compile(gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const uRes = gl.getUniformLocation(prog, 'res')
    const uTime = gl.getUniformLocation(prog, 'time')
    const uLight = gl.getUniformLocation(prog, 'lightMode')

    const SCALE = 0.5 // render at half resolution; the soft light doesn't need more
    const resize = () => {
      canvas.width = Math.max(1, Math.round(window.innerWidth * SCALE))
      canvas.height = Math.max(1, Math.round(window.innerHeight * SCALE))
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uRes, canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    let lastSeconds = 12
    const draw = (seconds: number) => {
      lastSeconds = seconds
      gl.uniform1f(uLight, lightRef.current ? 1 : 0)
      gl.uniform1f(uTime, seconds)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let last = 0
    let clock = 12
    let prevNow = performance.now()

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden || now - last < 33) return // ~30 fps, nothing while hidden
      last = now
      // Own clock: light theme runs at half speed; switching themes doesn't jump the animation.
      const dt = Math.min(0.1, (now - prevNow) / 1000)
      prevNow = now
      clock += dt * (lightRef.current ? 0.5 : 1)
      draw(clock)
    }
    redraw.current = () => draw(lastSeconds)
    draw(12) // first frame right away (and the only one with reduced motion)
    if (!reduceMotion) raf = requestAnimationFrame(loop)

    // Don't force-lose the context here: React (dev/StrictMode) re-runs this effect on the same canvas,
    // and a lost context can't be reused. The browser frees it when the canvas goes away.
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className="caustics" aria-hidden />
}
