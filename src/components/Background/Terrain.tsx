import { useFrame, useLoader } from "@react-three/fiber";
import React, { useMemo, useRef } from "react";
import * as THREE from "three";

const Terrain = ({ seed }: { seed: string }) => {
  const mesh = useRef<THREE.Mesh>(null!);
  const texture = useLoader(THREE.TextureLoader, "/bg_bottom.png");

  useMemo(() => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1000, 100);
  }, [texture]);

  useFrame(() => {
    if (mesh.current) {
      mesh.current.rotation.x = -Math.PI / 2;
      mesh.current.rotation.z = -Math.PI / 2;
    }
  });

  const terrainGeometry = useMemo(() => {
    const size = 100;
    const divisions = 100;
    const seedOffset = hashString(seed) / 1000;
    const geometry = new THREE.PlaneGeometry(
      size,
      size * 10,
      divisions,
      divisions * 10,
    );
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    const vertices = position.array;

    for (let index = 0; index < vertices.length; index += 3) {
      const x = Number(vertices[index] ?? 0);
      vertices[index + 2] = defineShape(x + seedOffset, size);
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }, [seed]);

  const solidMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffbbcc",
        map: texture,
      }),
    [texture],
  );

  return (
    <mesh
      ref={mesh}
      geometry={terrainGeometry}
      material={solidMaterial}
      receiveShadow
    />
  );
};

export default Terrain;

const defineShape = (x: number, depth: number) => {
  const normalizedX = (x + depth / 2) / depth;
  const peakHeight = 25;
  const slope = peakHeight / (0.25 * depth);

  if (normalizedX < 0.25) {
    return normalizedX * slope;
  }

  if (normalizedX < 0.5) {
    return peakHeight - (normalizedX - 0.25) * slope;
  }

  return 0;
};

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}
