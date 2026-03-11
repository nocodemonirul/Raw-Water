import React, { useEffect, useRef } from 'react';

const vertexShaderSource = `
attribute vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision highp float;
uniform vec2 iResolution;
uniform float iTime;

// Pseudo-random hash function to generate random point locations 
vec2 random2(vec2 p) {
    return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalize pixel coordinates (from 0 to 1) and fix aspect ratio
    vec2 uv = fragCoord/iResolution.y;
    
    // Scale the UVs to create a grid. 
    // Higher number = more points/smaller cells (The video used 36 points).
    float scale = 6.0;
    uv *= scale;
    
    // Get the integer ID of the current grid cell, and the fractional position within it
    vec2 i_st = floor(uv);
    vec2 f_st = fract(uv);
    
    // Initialize the minimum distance to a high number
    float min_dist = 1.0;
    
    // Loop through the 9 neighboring cells (including the one the pixel is inside)
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            
            // Neighbor offset
            vec2 neighbor = vec2(float(x), float(y));
            
            // Random point position within that neighbor cell
            vec2 point = random2(i_st + neighbor);
            
            // ANIMATION: Move the points over time! 
            // (The video creator wanted to do this but couldn't due to frame rate)
            point = 0.5 + 0.5 * sin(iTime + 6.2831 * point);
            
            // Calculate distance from current pixel to the point
            vec2 diff = neighbor + point - f_st;
            float dist = length(diff);
            
            // Keep the shortest distance
            min_dist = min(min_dist, dist);
        }
    }
    
    // --- COLOR MAPPING (Mimicking the video's Desmos math) ---
    // The video creator mapped the shortest distance to an exponential curve
    // to make the centers dark and the edges sharp and bright.
    
    // Video's base light blue color: rgb(44, 169, 225)
    vec3 baseColor = vec3(0.17, 0.66, 0.88); 
    
    // Video's white highlight color
    vec3 highlightColor = vec3(1.0, 1.0, 1.0);
    
    // Apply an exponential curve to the distance (similar to his pow() function)
    // Tweak the 3.0 (exponent) and 1.5 (multiplier) to change the sharpness of the waves
    float pattern = pow(min_dist, 3.0) * 1.5;
    
    // Blend the colors based on the pattern
    vec3 finalColor = mix(baseColor, highlightColor, pattern);

    // Output to screen
    fragColor = vec4(finalColor, 1.0);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

export function ThreeScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    // Compile shader function
    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Set up full screen quad
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const iResolutionLocation = gl.getUniformLocation(program, 'iResolution');
    const iTimeLocation = gl.getUniformLocation(program, 'iTime');

    let animationFrameId: number;
    const startTime = performance.now();

    const resize = () => {
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      }
    };

    const render = () => {
      resize();

      const currentTime = (performance.now() - startTime) / 1000.0;

      gl.uniform2f(iResolutionLocation, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(iTimeLocation, currentTime);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(positionBuffer);
    };
  }, []);

  return (
    <div className="w-full h-screen bg-black">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />
    </div>
  );
}

export default ThreeScene;
