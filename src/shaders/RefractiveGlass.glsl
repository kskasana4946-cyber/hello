// ============================================================================
// src/shaders/RefractiveGlass.glsl
// Physically Based Refractive Laminated Automotive Glass Shader
// Features:
//   - IOR = 1.52 (Schlick Fresnel F0 = ((1 - 1.52)/(1 + 1.52))^2 = 0.042585)
//   - RGB Chromatic Dispersion (IOR_R = 1.515, IOR_G = 1.520, IOR_B = 1.528)
//   - Dual Animated Radial Wiper-Sweep Mask clearing rain droplets & roughness
// ============================================================================

#pragma VERTEX_SHADER
precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying vec3 vLocalPosition;

void main() {
  vUv = uv;
  vLocalPosition = position;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}

#pragma FRAGMENT_SHADER
precision highp float;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying vec3 vLocalPosition;

uniform float uIor;                  // Default: 1.52
uniform float uChromaticDispersion;  // Default: 0.02 (yields 1.515, 1.520, 1.528)
uniform float uGlassRoughness;       // Default: 0.03
uniform vec3 uTintColor;             // Default: vec3(0.86, 0.94, 0.97) laminated green-blue tint
uniform float uTransmission;         // Default: 0.92
uniform float uWetness;              // Default: 0.35 (0.0 dry .. 1.0 heavy rain)
uniform float uWiperAngleRad;        // Animated 0.18 .. 1.42 rad sweep
uniform float uTime;

uniform vec3 uCameraPosition;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uAmbientSkyColor;
uniform vec3 uAmbientGroundColor;

const float PI = 3.141592653589793;

// Hash for procedural rain micro-droplets on unswept glass
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Evaluate single wiper radial sector mask & blade line
vec2 evaluateSingleWiperArc(vec2 uv, vec2 pivot, float currentAngleRad) {
  vec2 delta = uv - pivot;
  float r = length(delta);
  float theta = atan(delta.y, delta.x);
  if (theta < 0.0) theta += 2.0 * PI;

  float radialMask = smoothstep(0.08, 0.11, r) * (1.0 - smoothstep(0.66, 0.70, r));
  float sweptZone = smoothstep(0.15, 0.18, theta) * (1.0 - smoothstep(currentAngleRad, currentAngleRad + 0.04, theta));
  float bladeEdge = radialMask * exp(-abs(theta - currentAngleRad) * 95.0);

  return vec2(radialMask * sweptZone, bladeEdge);
}

// Dual Windshield Wiper Sweep Evaluation (Left + Right Pivots)
vec2 evaluateDualWiperMask(vec2 uv, float wiperAngleRad) {
  vec2 leftWiper = evaluateSingleWiperArc(uv, vec2(0.26, 0.05), wiperAngleRad);
  vec2 rightWiper = evaluateSingleWiperArc(uv, vec2(0.70, 0.05), wiperAngleRad);
  float clearedMask = clamp(max(leftWiper.x, rightWiper.x), 0.0, 1.0);
  float bladeStreak = clamp(leftWiper.y + rightWiper.y, 0.0, 1.0);
  return vec2(clearedMask, bladeStreak);
}

// Procedural Rain Droplet Normal Offset in Unswept Zones
vec3 evaluateRainDropletNormal(vec2 uv, float wetness) {
  if (wetness <= 0.001) return vec3(0.0, 0.0, 1.0);
  vec2 gridUv = uv * 42.0 + vec2(0.0, uTime * 0.35);
  vec2 cell = floor(gridUv);
  vec2 f = fract(gridUv) - 0.5;
  vec2 rnd = hash22(cell);
  vec2 dropCenter = (rnd - 0.5) * 0.45;
  vec2 d = f - dropCenter;
  float dist = length(d);
  float dropRadius = 0.22 * wetness * (0.5 + 0.5 * rnd.x);
  if (dist < dropRadius) {
    vec2 n2 = d / max(dropRadius, 1e-4);
    float z = sqrt(max(1.0 - dot(n2, n2), 0.01));
    return normalize(vec3(n2 * 0.35 * wetness, z));
  }
  return vec3(0.0, 0.0, 1.0);
}

// Analytical HDR Sky + Horizon Environment Sampler for Dispersed Rays
vec3 sampleAnalyticalEnvironment(vec3 rayDir) {
  vec3 dir = normalize(rayDir);
  float sunCos = max(dot(dir, normalize(uSunDirection)), 0.0);
  float horizonFactor = smoothstep(-0.35, 0.65, dir.y);
  vec3 envBase = mix(uAmbientGroundColor, uAmbientSkyColor * 1.45, horizonFactor);
  vec3 sunDisk = uSunColor * (pow(sunCos, 96.0) * 3.5 + pow(sunCos, 8.0) * 0.35);
  return envBase + sunDisk;
}

void main() {
  vec3 N_geom = normalize(vWorldNormal);
  vec3 V = normalize(uCameraPosition - vWorldPosition);
  vec3 L = normalize(uSunDirection);

  // 1. Evaluate Dual Animated Wiper Sweep Mask & Residual Rain Wetness
  vec2 wiperData = evaluateDualWiperMask(vUv, uWiperAngleRad);
  float wiperCleared = wiperData.x;
  float wiperBladeRidge = wiperData.y;

  float residualWetness = clamp(uWetness * (1.0 - 0.90 * wiperCleared), 0.0, 1.0);
  vec3 dropNormalLocal = evaluateRainDropletNormal(vUv, residualWetness);
  vec3 N = normalize(N_geom + vec3(dropNormalLocal.x, dropNormalLocal.y, 0.0) * 0.25);

  float effectiveRoughness = clamp(
    uGlassRoughness + residualWetness * 0.18 + wiperBladeRidge * 0.12,
    0.01,
    0.65
  );

  // 2. Exact Dielectric Schlick Fresnel for IOR = 1.52
  float iorG = max(uIor, 1.01);
  float f0Root = (1.0 - iorG) / (1.0 + iorG);
  float F0 = f0Root * f0Root; // 0.042585 at uIor = 1.52

  float cosTheta = max(dot(N, V), 0.0);
  float F_schlick = F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);

  // 3. RGB Chromatic Dispersion Refraction (R = 1.515, G = 1.520, B = 1.528)
  float disp = clamp(uChromaticDispersion, 0.0, 0.15);
  float iorR = iorG - disp * 0.25; // 1.515 when uIor=1.52, disp=0.02
  float iorB = iorG + disp * 0.40; // 1.528 when uIor=1.52, disp=0.02

  vec3 refractDirR = refract(-V, N, 1.0 / iorR);
  vec3 refractDirG = refract(-V, N, 1.0 / iorG);
  vec3 refractDirB = refract(-V, N, 1.0 / iorB);

  float refrR = sampleAnalyticalEnvironment(refractDirR).r;
  float refrG = sampleAnalyticalEnvironment(refractDirG).g;
  float refrB = sampleAnalyticalEnvironment(refractDirB).b;
  vec3 dispersedRefraction = vec3(refrR, refrG, refrB) * uTintColor * uTransmission;

  // 4. Specular Reflection & Sun Highlight
  vec3 reflectDir = reflect(-V, N);
  vec3 reflectionColor = sampleAnalyticalEnvironment(reflectDir);
  vec3 H = normalize(V + L);
  float specLobe = pow(max(dot(N, H), 0.0), mix(256.0, 24.0, effectiveRoughness));
  reflectionColor += uSunColor * specLobe * 2.2;

  // 5. Composite Reflected + Chromatically Dispersed Refracted Light
  vec3 finalColor = mix(dispersedRefraction, reflectionColor, F_schlick);
  finalColor += vec3(0.18, 0.22, 0.26) * wiperBladeRidge * 0.35;

  // Physical glass opacity increases at grazing Fresnel angles and along wiper ridge
  float alpha = clamp(mix(1.0 - uTransmission * 0.72, 0.96, F_schlick) + wiperBladeRidge * 0.25, 0.18, 0.98);
  gl_FragColor = vec4(finalColor, alpha);
}
