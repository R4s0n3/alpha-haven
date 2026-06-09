import React, { Suspense, useMemo } from "react";
import Sky from "./Sky";
import { Canvas } from "@react-three/fiber";
import NewTerrain from "./NewTerrain";
import { Effects } from "./Effects";
import * as THREE from "three";

type DynamicBackgroundProps = {
  seed: string;
  surfaceTexture?: string;
};

const DynamicBackground = ({
  seed,
  surfaceTexture = "/mars_bg.png",
}: DynamicBackgroundProps) => {
  const cameraCoords = useMemo(() => ({ x: 0, y: 8, z: 230 }), []);

  function stringToSeed(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      // Convert to 32bit integer
      hash |= 0;
    }
    return hash;
  }

  // Example usage:
  const numberSeed: number = stringToSeed(seed);

  return (
    <div className="pointer-events-none absolute left-0 top-0 flex h-full w-full justify-center">
      <Suspense
        fallback={
          <div className="absolute h-screen w-full bg-slate-700 text-rose-200" />
        }
      >
        <Canvas
          shadows
          camera={{
            position: [cameraCoords.x, cameraCoords.y, cameraCoords.z],
            fov: 40,
          }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.08;
            gl.outputColorSpace = THREE.SRGBColorSpace;
          }}
        >
          <hemisphereLight
            color="#e7f6ff"
            groundColor="#70443f"
            intensity={0.48}
          />
          <directionalLight
            color="#ffc27e"
            intensity={1.95}
            position={[-78, 52, 112]}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <Sky seed={numberSeed} />
          <NewTerrain seed={seed} textureSrc={surfaceTexture} />
          <Effects />
        </Canvas>
      </Suspense>
    </div>
  );
};

export default DynamicBackground;
