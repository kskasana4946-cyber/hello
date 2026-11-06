// ============================================================================
// src/shaders/AutomotivePaint.glsl
// Dual-Layer Physically Based Automotive Clearcoat + Sub-Millimeter Metallic
// Flake + Anisotropic Brushed Metal + Twill Carbon Weave + 1000C Brake Glow
// Supports WebGL2 (GLSL ES 3.00) & WebGPU WGSL Node Pipeline
// ============================================================================

#pragma VERTEX_SHADER
precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute vec4 tangent;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vWorldTangent;
varying vec3 vWorldBitangent;
varying vec2 vUv;
varying vec3 vLocalPosition;

void main() {
  vUv = uv;
  vLocalPosition = position;

  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;

  vec3 N = normalize(mat3(modelMatrix) * normal);
  vec3 T = normalize(mat3(modelMatrix) * tangent.xyz);
  T = normalize(T - dot(T, N) * N);
  vec3 B = cross(N, T) * (tangent.w == 0.0 ? 1.0 : tangent.w);

  vWorldNormal = N;
  vWorldTangent = T;
  vWorldBitangent = B;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}

#pragma FRAGMENT_SHADER
precision highp float;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vWorldTangent;
varying vec3 vWorldBitangent;
varying vec2 vUv;
varying vec3 vLocalPosition;

// Primary PBR & Livery Paint Uniforms (12 Presets)
uniform vec3 uBaseColor;
uniform vec3 uSecondaryColor;
uniform vec3 uFlipColor;
uniform float uFlipExponent;
uniform float uMetalness;
uniform float uRoughness;

// Top Clearcoat Layer (F0 = 0.04 polyurethane automotive lacquer)
uniform float uClearcoat;
uniform float uClearcoatRoughness;

// Sub-Millimeter Metallic Flake Parameters
uniform float uFlakeScale;
uniform float uFlakeIntensity;
uniform vec3 uFlakeColor;

// Anisotropic Ward / GGX Brushed Metal Parameters
uniform float uAnisotropy;
uniform float uAnisotropyRotation;

// Exposed 2x2 Twill Carbon Fiber Weave
uniform float uCarbonWeaveScale;

// Carbon-Ceramic Brake Disc Blackbody Glow (20C .. 1000C)
uniform float uBrakeTempCelsius;
uniform float uIsBrakeRotor;

// Lighting & Environment Uniforms
uniform vec3 uCameraPosition;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform float uSunIntensity;
uniform vec3 uAmbientSkyColor;
uniform vec3 uAmbientGroundColor;
uniform float uEnvMapIntensity;
uniform int uLiveryIndex;

const float PI = 3.141592653589793;
const float CLEARCOAT_F0 = 0.04;

// Fast 3D hash for sub-millimeter Voronoi metallic flake orientation
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

// Sub-millimeter cellular flake evaluation returning (dX, dY, sparkleWeight, cellId)
vec4 evaluateMetallicFlakes(vec3 samplePos, float scale) {
  vec3 p = samplePos * max(scale, 1.0);
  vec3 i = floor(p);
  vec3 f = fract(p);

  float minDist = 8.0;
  vec3 bestRandom = vec3(0.0);

  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 neighbor = vec3(float(x), float(y), float(z));
        vec3 rnd = hash33(i + neighbor);
        vec3 diff = neighbor + rnd - f;
        float d2 = dot(diff, diff);
        if (d2 < minDist) {
          minDist = d2;
          bestRandom = rnd;
        }
      }
    }
  }

  vec2 tilt = (bestRandom.xy * 2.0 - 1.0);
  float sparkle = smoothstep(0.65, 0.02, minDist) * bestRandom.z;
  return vec4(tilt, sparkle, bestRandom.z);
}

// 2x2 Twill Carbon Fiber Weave Pattern
vec3 evaluateCarbonTwillWeave(vec2 uvCoord, float weaveScale, out float weaveRoughnessMod, out float weaveAnisoAngle) {
  vec2 p = uvCoord * weaveScale;
  vec2 cell = floor(p);
  vec2 fracP = fract(p);

  // 2x2 twill step pattern: (x + y) mod 4 determines warp vs weft thread
  float patternIdx = mod(cell.x + cell.y, 4.0);
  bool isWarp = patternIdx < 2.0;

  float fiberProfile = isWarp
    ? sin(fracP.x * PI) * (0.85 + 0.15 * cos(fracP.y * PI * 2.0))
    : sin(fracP.y * PI) * (0.85 + 0.15 * cos(fracP.x * PI * 2.0));

  weaveRoughnessMod = mix(0.28, 0.11, fiberProfile);
  weaveAnisoAngle = isWarp ? 0.0 : 1.5707963;
  vec3 darkResin = vec3(0.025, 0.027, 0.032);
  vec3 graphiteFiber = vec3(0.095, 0.102, 0.115);
  return mix(darkResin, graphiteFiber, fiberProfile);
}

// Schlick Fresnel Approximation
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  float t = clamp(1.0 - cosTheta, 0.0, 1.0);
  float t2 = t * t;
  return F0 + (vec3(1.0) - F0) * (t2 * t2 * t);
}

float fresnelSchlickClearcoat(float cosTheta) {
  float t = clamp(1.0 - cosTheta, 0.0, 1.0);
  float t2 = t * t;
  return CLEARCOAT_F0 + (1.0 - CLEARCOAT_F0) * (t2 * t2 * t);
}

// Isotropic GGX NDF for Top Clearcoat Layer
float distributionGGXIsotropic(float NdotH, float alpha) {
  float a2 = alpha * alpha;
  float denom = (NdotH * NdotH) * (a2 - 1.0) + 1.0;
  return a2 / max(PI * denom * denom, 1e-6);
}

// Anisotropic Ward / GGX NDF for Base Metallic / Brushed Layer
float distributionGGXAnisotropic(
  vec3 N, vec3 H, vec3 T, vec3 B, float alphaT, float alphaB
) {
  float TdotH = dot(T, H);
  float BdotH = dot(B, H);
  float NdotH = max(dot(N, H), 0.0);
  float a2 = alphaT * alphaB;
  vec3 v = vec3(alphaB * TdotH, alphaT * BdotH, a2 * NdotH);
  float v2 = dot(v, v);
  float w2 = a2 / max(v2, 1e-6);
  return a2 * w2 * w2 * (1.0 / PI);
}

// Smith-GGX Correlated Visibility Function
float geometrySmithGGX(float NdotV, float NdotL, float roughness) {
  float r = roughness + 1.0;
  float k = (r * r) / 8.0;
  float ggxV = NdotV / max(NdotV * (1.0 - k) + k, 1e-5);
  float ggxL = NdotL / max(NdotL * (1.0 - k) + k, 1e-5);
  return ggxV * ggxL;
}

// Blackbody Thermal Emissive Radiance for Carbon-Ceramic Brake Discs (20C to 1000C)
vec3 evaluateBrakeBlackbodyGlow(float tempCelsius, vec2 uvCoord, vec3 localPos) {
  float heatNorm = clamp((tempCelsius - 250.0) / 750.0, 0.0, 1.0);
  if (heatNorm <= 0.001) return vec3(0.0);

  // Radial rotor band & cross-drilled cooling slot modulation
  float r = length(localPos.yz);
  float angle = atan(localPos.y, localPos.z);
  float drillPattern = 0.78 + 0.22 * sin(angle * 24.0 + r * 45.0);
  float frictionBand = smoothstep(0.08, 0.14, r) * (1.0 - smoothstep(0.32, 0.38, r));

  // Physically inspired blackbody ramp: 300C dull red -> 650C crimson orange -> 1000C bright orange-yellow
  vec3 cLow = vec3(0.55, 0.015, 0.0);
  vec3 cMid = vec3(2.60, 0.38, 0.015);
  vec3 cHigh = vec3(7.20, 2.35, 0.36);

  vec3 thermalColor = heatNorm < 0.5
    ? mix(cLow, cMid, heatNorm * 2.0)
    : mix(cMid, cHigh, (heatNorm - 0.5) * 2.0);

  float intensity = pow(heatNorm, 1.85) * drillPattern * max(frictionBand, 0.45);
  return thermalColor * intensity;
}

void main() {
  vec3 N_macro = normalize(vWorldNormal);
  vec3 T_base = normalize(vWorldTangent);
  vec3 B_base = normalize(vWorldBitangent);
  vec3 V = normalize(uCameraPosition - vWorldPosition);
  vec3 L = normalize(uSunDirection);
  vec3 H_macro = normalize(V + L);

  float NdotV_macro = max(dot(N_macro, V), 1e-4);
  float NdotL_macro = max(dot(N_macro, L), 0.0);
  float NdotH_macro = max(dot(N_macro, H_macro), 0.0);
  float VdotH_macro = max(dot(V, H_macro), 0.0);

  // 1. Base Albedo, Pearlescent Flip & Optional Twill Carbon Weave
  float effectiveRoughness = clamp(uRoughness, 0.02, 0.98);
  float effectiveAnisoRotation = uAnisotropyRotation;
  vec3 baseAlbedo = mix(
    uBaseColor,
    uFlipColor,
    pow(clamp(1.0 - NdotV_macro, 0.0, 1.0), max(uFlipExponent, 0.5))
  );

  // Livery accent stripe modulation along body centerline
  float centerStripe = smoothstep(0.14, 0.11, abs(vLocalPosition.x));
  baseAlbedo = mix(baseAlbedo, uSecondaryColor, centerStripe * 0.25);

  if (uCarbonWeaveScale > 0.5) {
    float weaveRough;
    float weaveAngle;
    vec3 carbonColor = evaluateCarbonTwillWeave(vUv, uCarbonWeaveScale, weaveRough, weaveAngle);
    baseAlbedo = mix(baseAlbedo, carbonColor, 0.88);
    effectiveRoughness = weaveRough;
    effectiveAnisoRotation += weaveAngle;
  }

  // 2. Sub-Millimeter Metallic Flake Normal Perturbation
  vec4 flakeSample = evaluateMetallicFlakes(vLocalPosition, uFlakeScale);
  vec3 N_flake = normalize(
    N_macro + uFlakeIntensity * (flakeSample.x * T_base + flakeSample.y * B_base)
  );
  float NdotV_flake = max(dot(N_flake, V), 1e-4);
  float NdotL_flake = max(dot(N_flake, L), 0.0);
  vec3 H_flake = normalize(V + L);

  // Sparkle micro-glint boost when flake normal aligns with half-vector
  float flakeGlint = pow(max(dot(N_flake, H_flake), 0.0), 48.0) * flakeSample.z * uFlakeIntensity * 3.5;

  // 3. Anisotropic Tangent Frame Rotation
  float cosRot = cos(effectiveAnisoRotation);
  float sinRot = sin(effectiveAnisoRotation);
  vec3 T_aniso = normalize(cosRot * T_base + sinRot * B_base);
  vec3 B_aniso = normalize(-sinRot * T_base + cosRot * B_base);

  float alphaBase = max(effectiveRoughness * effectiveRoughness, 0.002);
  float anisoStrength = clamp(uAnisotropy, 0.0, 0.95);
  float alphaT = max(alphaBase * (1.0 + anisoStrength), 0.002);
  float alphaB = max(alphaBase * (1.0 - 0.85 * anisoStrength), 0.002);

  // 4. Base Coat Cook-Torrance Anisotropic Metallic BRDF
  vec3 F0_base = mix(vec3(0.04), baseAlbedo, clamp(uMetalness, 0.0, 1.0));
  vec3 F_base = fresnelSchlick(max(dot(H_flake, V), 0.0), F0_base);
  float D_base = distributionGGXAnisotropic(N_flake, H_flake, T_aniso, B_aniso, alphaT, alphaB);
  float G_base = geometrySmithGGX(NdotV_flake, NdotL_flake, effectiveRoughness);

  vec3 specBase = (D_base * G_base * F_base) / max(4.0 * NdotV_flake * NdotL_flake, 1e-4);
  vec3 kD = (vec3(1.0) - F_base) * (1.0 - uMetalness);
  vec3 diffBase = kD * baseAlbedo / PI;

  vec3 directRadiance = uSunColor * max(uSunIntensity, 1.0);
  vec3 baseLayerLit = (diffBase + specBase + uFlakeColor * flakeGlint) * directRadiance * NdotL_flake;

  // Hemisphere Ambient & PMREM Environment Approximation for Base Coat
  vec3 R_flake = reflect(-V, N_flake);
  vec3 envIrradiance = mix(uAmbientGroundColor, uAmbientSkyColor, 0.5 * N_flake.y + 0.5);
  vec3 envReflection = mix(uAmbientGroundColor, uAmbientSkyColor * 1.8, smoothstep(-0.2, 0.65, R_flake.y));
  baseLayerLit += kD * baseAlbedo * envIrradiance * 0.55;
  baseLayerLit += F_base * envReflection * (1.0 - 0.6 * effectiveRoughness) * uEnvMapIntensity;

  // 5. Dual-Layer Top Clearcoat BRDF (F0 = 0.04 Dielectric Lacquer)
  float clearcoatWeight = clamp(uClearcoat, 0.0, 1.0);
  float ccRoughness = clamp(uClearcoatRoughness, 0.015, 0.6);
  float alphaCC = max(ccRoughness * ccRoughness, 0.001);

  float D_cc = distributionGGXIsotropic(NdotH_macro, alphaCC);
  float G_cc = geometrySmithGGX(NdotV_macro, NdotL_macro, ccRoughness);
  float F_cc = fresnelSchlickClearcoat(VdotH_macro) * clearcoatWeight;
  float F_cc_view = fresnelSchlickClearcoat(NdotV_macro) * clearcoatWeight;

  float specClearcoat = (D_cc * G_cc * F_cc) / max(4.0 * NdotV_macro * NdotL_macro, 1e-4);
  vec3 R_macro = reflect(-V, N_macro);
  float horizonSpec = pow(clamp(0.5 * R_macro.y + 0.5, 0.0, 1.0), 2.2);
  vec3 ccEnvReflection = mix(uAmbientGroundColor * 0.4, uAmbientSkyColor * 2.4, horizonSpec) * uEnvMapIntensity;

  // Energy-conserving dual-layer composite: attenuate base coat by (1 - F_cc_view)
  vec3 compositeColor = baseLayerLit * (1.0 - F_cc_view)
    + (specClearcoat * directRadiance * NdotL_macro + F_cc_view * ccEnvReflection);

  // 6. Carbon-Ceramic Brake Disc Thermal Glow (20C .. 1000C)
  if (uIsBrakeRotor > 0.5 || uBrakeTempCelsius > 260.0) {
    compositeColor += evaluateBrakeBlackbodyGlow(uBrakeTempCelsius, vUv, vLocalPosition);
  }

  gl_FragColor = vec4(compositeColor, 1.0);
}
