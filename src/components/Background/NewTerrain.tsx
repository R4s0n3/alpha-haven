import { createNoise3D } from "simplex-noise";
import React, { useEffect, useMemo, useState } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import Alea from "alea";

const NewTerrain = ({
  seed,
  textureSrc,
}: {
  seed: string;
  textureSrc: string;
}) => {
  const [terrainDimensions] = useState({ w: 32, h: 0, d: 9 });

  // Create a simplex noise instance with a seed
  const randomSeed = useMemo(() => Alea(seed), [seed]);
  const noise3D = useMemo(() => createNoise3D(randomSeed), [randomSeed]);
  const texture = useLoader(THREE.TextureLoader, textureSrc);
  const shaderSeed = useMemo(() => stringToUnitSeed(seed), [seed]);
  const size = 100;
  const divisions = 32;
  useEffect(() => {
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(1, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
  }, [texture]);

  // Generate the terrain geometry based on the seed
  const terrainGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(
      size * terrainDimensions.w,
      size * terrainDimensions.d,
      divisions * terrainDimensions.w,
      divisions * terrainDimensions.d,
    );
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    const vertices = position.array;
    const columns = divisions * terrainDimensions.w + 1;
    const rows = divisions * terrainDimensions.d + 1;
    let heights = new Float32Array(columns * rows);

    let scale = 4;
    for (let i = 0; i < vertices.length; i += 3) {
      const quarter = (vertices.length / 4) * 3;
      if (i >= quarter && scale < 160) {
        scale++;
      }
      const x = Number(vertices[i] ?? 0);
      const y = Number(vertices[i + 1] ?? 0);
      const noiseValue =
        0.5 * noise3D(x / scale, y / scale, randomSeed() / scale);

      heights[i / 3] = Math.abs(noiseValue * scale);
    }

    for (let pass = 0; pass < 2; pass += 1) {
      const nextHeights = new Float32Array(heights);

      for (let row = 1; row < rows - 1; row += 1) {
        for (let column = 1; column < columns - 1; column += 1) {
          const index = row * columns + column;
          const center = heights[index] ?? 0;
          const cardinal =
            ((heights[index - 1] ?? 0) +
              (heights[index + 1] ?? 0) +
              (heights[index - columns] ?? 0) +
              (heights[index + columns] ?? 0)) *
            0.1;
          const diagonal =
            ((heights[index - columns - 1] ?? 0) +
              (heights[index - columns + 1] ?? 0) +
              (heights[index + columns - 1] ?? 0) +
              (heights[index + columns + 1] ?? 0)) *
            0.025;
          const weightedAverage = center * 0.5 + cardinal + diagonal;

          nextHeights[index] = center * 0.36 + weightedAverage * 0.64;
        }
      }

      heights = nextHeights;
    }

    for (let i = 0; i < heights.length; i += 1) {
      const height = heights[i] ?? 0;
      const softenedHeight = height > 58 ? 58 + (height - 58) * 0.72 : height;

      vertices[i * 3 + 2] = softenedHeight;
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals(); // Keep toon bands stable on the smoothed terrain.
    return geometry;
  }, [noise3D, randomSeed, terrainDimensions.d, terrainDimensions.w]);

  const terrainMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTexture: { value: texture },
          uSeed: { value: shaderSeed },
          uSunDirection: {
            value: new THREE.Vector3(-0.42, 0.5, 0.76).normalize(),
          },
          uShadowColor: { value: new THREE.Color("#2a243d") },
          uRidgeColor: { value: new THREE.Color("#fff0d4") },
          uFogColor: { value: new THREE.Color("#f0c7ad") },
        },
        vertexShader: `
          varying vec3 vWorldPosition;
          varying vec3 vWorldNormal;
          varying float vHeight;

          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            vHeight = position.z;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform sampler2D uTexture;
          uniform float uSeed;
          uniform vec3 uSunDirection;
          uniform vec3 uShadowColor;
          uniform vec3 uRidgeColor;
          uniform vec3 uFogColor;

          varying vec3 vWorldPosition;
          varying vec3 vWorldNormal;
          varying float vHeight;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }

          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
              u.y
            );
          }

          float fbm(vec2 p) {
            float value = 0.0;
            float amplitude = 0.58;
            mat2 rotate = mat2(0.8, -0.6, 0.6, 0.8);

            for (int i = 0; i < 3; i++) {
              value += noise(p) * amplitude;
              p = rotate * p * 2.0 + 19.17;
              amplitude *= 0.45;
            }

            return value;
          }

          float seededHash(float offset) {
            return hash(vec2(uSeed * 113.17 + offset * 19.19, uSeed * 271.31 - offset * 7.73));
          }

          vec2 seededPaletteUv(float index) {
            vec2 uv = vec2(seededHash(index), seededHash(index + 23.0));
            return mix(vec2(0.12), vec2(0.88), uv);
          }

          float luminance(vec3 color) {
            return dot(color, vec3(0.299, 0.587, 0.114));
          }

          float saturation(vec3 color) {
            float high = max(color.r, max(color.g, color.b));
            float low = min(color.r, min(color.g, color.b));
            return high - low;
          }

          vec3 normalizeBiomeColor(vec3 color) {
            float lightness = luminance(color);
            vec3 gray = vec3(lightness);
            color = mix(gray, color, 1.16);
            color = mix(color, vec3(0.86), smoothstep(0.93, 1.0, lightness) * 0.18);
            color = mix(color, vec3(0.32, 0.31, 0.38), smoothstep(0.22, 0.04, lightness) * 0.36);
            return clamp(color, vec3(0.1), vec3(0.94));
          }

          float dominantScore(vec3 color) {
            return saturation(color) * 1.45 + (1.0 - luminance(color)) * 0.42;
          }

          vec3 dominantBiomeColor() {
            vec3 c0 = normalizeBiomeColor(texture2D(uTexture, seededPaletteUv(1.0)).rgb);
            vec3 c1 = normalizeBiomeColor(texture2D(uTexture, seededPaletteUv(2.0)).rgb);
            vec3 c2 = normalizeBiomeColor(texture2D(uTexture, seededPaletteUv(3.0)).rgb);
            vec3 c3 = normalizeBiomeColor(texture2D(uTexture, seededPaletteUv(4.0)).rgb);
            vec3 c4 = normalizeBiomeColor(texture2D(uTexture, seededPaletteUv(5.0)).rgb);
            vec3 c5 = normalizeBiomeColor(texture2D(uTexture, seededPaletteUv(6.0)).rgb);

            vec3 bestColor = c0;
            float bestScore = dominantScore(c0);
            float score = dominantScore(c1);
            if (score > bestScore) {
              bestColor = c1;
              bestScore = score;
            }
            score = dominantScore(c2);
            if (score > bestScore) {
              bestColor = c2;
              bestScore = score;
            }
            score = dominantScore(c3);
            if (score > bestScore) {
              bestColor = c3;
              bestScore = score;
            }
            score = dominantScore(c4);
            if (score > bestScore) {
              bestColor = c4;
              bestScore = score;
            }
            score = dominantScore(c5);
            if (score > bestScore) {
              bestColor = c5;
            }

            return bestColor;
          }

          float accentScore(vec3 color, vec3 baseColor) {
            return distance(color, baseColor) * 1.15 + luminance(color) * 0.34 + saturation(color) * 0.16;
          }

          vec3 accentBiomeColor(vec3 baseColor) {
            vec3 c0 = normalizeBiomeColor(texture2D(uTexture, seededPaletteUv(8.0)).rgb);
            vec3 c1 = normalizeBiomeColor(texture2D(uTexture, seededPaletteUv(9.0)).rgb);
            vec3 c2 = normalizeBiomeColor(texture2D(uTexture, seededPaletteUv(10.0)).rgb);
            vec3 c3 = normalizeBiomeColor(texture2D(uTexture, seededPaletteUv(11.0)).rgb);
            vec3 c4 = normalizeBiomeColor(texture2D(uTexture, seededPaletteUv(12.0)).rgb);
            vec3 c5 = normalizeBiomeColor(texture2D(uTexture, seededPaletteUv(13.0)).rgb);

            vec3 bestColor = c0;
            float bestScore = accentScore(c0, baseColor);
            float score = accentScore(c1, baseColor);
            if (score > bestScore) {
              bestColor = c1;
              bestScore = score;
            }
            score = accentScore(c2, baseColor);
            if (score > bestScore) {
              bestColor = c2;
              bestScore = score;
            }
            score = accentScore(c3, baseColor);
            if (score > bestScore) {
              bestColor = c3;
              bestScore = score;
            }
            score = accentScore(c4, baseColor);
            if (score > bestScore) {
              bestColor = c4;
              bestScore = score;
            }
            score = accentScore(c5, baseColor);
            if (score > bestScore) {
              bestColor = c5;
            }

            return bestColor;
          }

          vec3 posterizeColor(vec3 color) {
            return floor(clamp(color, 0.0, 1.0) * 10.0 + 0.5) / 10.0;
          }

          vec3 terrainPaletteColor(vec3 worldPosition, float heightMask, float slope) {
            vec3 baseBiome = dominantBiomeColor();
            vec3 accentBiome = accentBiomeColor(baseBiome);
            float baseLightness = luminance(baseBiome);
            vec3 lightTone = mix(baseBiome, vec3(1.0), 0.2 + (1.0 - baseLightness) * 0.18);
            vec3 darkTone = mix(baseBiome, vec3(0.06, 0.06, 0.09), 0.18 + baseLightness * 0.12);
            vec3 fallbackAccent = mix(lightTone, uRidgeColor, 0.16);
            float paletteDistance = distance(baseBiome, accentBiome);
            accentBiome = mix(accentBiome, fallbackAccent, 1.0 - smoothstep(0.08, 0.28, paletteDistance));

            vec2 seedOffset = vec2(seededHash(47.0), seededHash(53.0)) * 360.0;
            vec2 seededUv = worldPosition.xz + seedOffset;
            float broadPatch = fbm(seededUv * 0.006 + vec2(seededHash(31.0), seededHash(37.0)) * 24.0);
            float softPatch = fbm(seededUv * 0.013 + vec2(seededHash(41.0), seededHash(43.0)) * 18.0);
            float toneBand = smoothstep(0.32, 0.72, broadPatch + softPatch * 0.12);
            float patchMask = smoothstep(0.5, 0.66, broadPatch + softPatch * 0.18 - heightMask * 0.06);
            float ridgeMask = smoothstep(0.48, 0.86, heightMask) * smoothstep(0.22, 0.58, slope);

            vec3 color = mix(darkTone, lightTone, 0.34 + toneBand * 0.48);
            color = mix(color, baseBiome, 0.46);
            color = mix(color, accentBiome, patchMask * 0.52);
            color = mix(color, mix(lightTone, uRidgeColor, 0.22), ridgeMask * 0.32);

            return posterizeColor(color);
          }

          void main() {
            vec3 normal = normalize(vWorldNormal);
            float heightMask = smoothstep(0.0, 86.0, vHeight);
            float ridgeMask = smoothstep(54.0, 112.0, vHeight);
            float upness = clamp(dot(normal, vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
            float slope = 1.0 - upness;
            vec3 baseColor = terrainPaletteColor(vWorldPosition, heightMask, slope);
            float diffuse = max(dot(normal, uSunDirection), 0.0);
            float shade = 0.46;
            shade = mix(shade, 0.78, step(0.22, diffuse));
            shade = mix(shade, 1.04, step(0.62, diffuse));
            shade += upness * 0.04;

            vec3 litColor = baseColor * shade;
            vec3 shadowColor = mix(baseColor * 0.42, uShadowColor, 0.36);
            float cliffShadow = step(0.42, slope) * (1.0 - ridgeMask) * 0.24;
            litColor = mix(litColor, shadowColor, cliffShadow);

            float ridgeLight = step(0.7, diffuse) * smoothstep(0.44, 0.95, heightMask) * (0.08 + slope * 0.08);
            litColor = mix(litColor, mix(baseColor * 1.16, uRidgeColor, 0.28), ridgeLight);

            float surfaceBreak = fbm(vWorldPosition.xz * 0.011 + vec2(seededHash(61.0), seededHash(67.0)) * 18.0);
            float brokenShade = smoothstep(0.5, 0.82, surfaceBreak + slope * 0.18);
            litColor = mix(litColor, litColor * 0.84, brokenShade * smoothstep(0.32, 0.74, slope) * 0.16);

            float distanceFog = smoothstep(170.0, 720.0, length(vWorldPosition.xz));
            vec3 biomeHaze = mix(uFogColor, baseColor, 0.22);
            litColor = mix(litColor, biomeHaze, distanceFog * 0.18);
            litColor = posterizeColor(litColor);

            gl_FragColor = vec4(litColor, 1.0);
          }
        `,
      }),
    [shaderSeed, texture],
  );

  return (
    <>
      <mesh
        position={[0, -5, 0]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        geometry={terrainGeometry}
        castShadow={true}
        receiveShadow={true}
      >
        <primitive object={terrainMaterial} attach="material" />
      </mesh>
    </>
  );
};

export default NewTerrain;

const stringToUnitSeed = (value: string) => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
};
