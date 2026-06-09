import { Html, Line, OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { Suspense, useMemo, useRef, useState } from "react";
import { ClampToEdgeWrapping, TextureLoader, Vector3, type Mesh } from "three";

import { api, type RouterOutputs } from "@/utils/api";
import {
  HOME_PLANET_ID,
  getPlanetById,
  planetRoster,
  type PlanetDefinition,
} from "@/utils/gameData";

type ActiveTrade = RouterOutputs["quest"]["getActiveTrades"][number];

const Sun = () => {
  return (
    <mesh>
      <sphereGeometry args={[8, 32, 32]} />
      <meshStandardMaterial
        color="white"
        emissive="yellow"
        emissiveIntensity={2}
      />
    </mesh>
  );
};

const LocationSphere = ({ planet }: { planet: PlanetDefinition }) => {
  const router = useRouter();
  const loadedTexture = useLoader(
    TextureLoader,
    `/assets/3D/${planet.texture}`,
  );
  const texture = useMemo(() => {
    const clonedTexture = loadedTexture.clone();
    clonedTexture.wrapS = ClampToEdgeWrapping;
    clonedTexture.wrapT = ClampToEdgeWrapping;
    clonedTexture.repeat.set(1, 1);
    clonedTexture.offset.set(0, 0);
    clonedTexture.needsUpdate = true;

    return clonedTexture;
  }, [loadedTexture]);
  const [hovered, setHovered] = useState(false);
  const locRef = useRef<Mesh>(null!);
  const radius = 2.6 + (hashString(planet.name) % 18) / 10;

  useFrame(({ clock }) => {
    if (locRef.current) {
      locRef.current.position.copy(
        getPlanetMapPosition(planet, clock.getElapsedTime()),
      );
      locRef.current.rotation.y += 0.004;
    }
  });

  return (
    <mesh
      ref={locRef}
      onClick={() => void router.push(`/game/port?planet=${planet.id}`)}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[radius, 32, 32]} />
      <meshStandardMaterial map={texture} />
      {hovered && (
        <Html distanceFactor={90}>
          <div className="pointer-events-none rounded border border-teal-400 bg-slate-950/90 px-3 py-2 text-center text-sm font-bold text-teal-200 shadow">
            {planet.name}
          </div>
        </Html>
      )}
    </mesh>
  );
};

const ActiveRoutePath = ({
  trade,
  index,
}: {
  trade: ActiveTrade;
  index: number;
}) => {
  const markerRef = useRef<Mesh>(null!);
  const homePlanet = getPlanetById(HOME_PLANET_ID);
  const targetPlanet = getPlanetById(trade.planetId);
  const color = index % 2 === 0 ? "#2dd4bf" : "#fb7185";
  const [points, setPoints] = useState(() =>
    getRouteCurvePoints(
      getPlanetMapPosition(homePlanet, 0),
      getPlanetMapPosition(targetPlanet, 0),
      index,
    ),
  );

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const start = getPlanetMapPosition(homePlanet, elapsed);
    const target = getPlanetMapPosition(targetPlanet, elapsed);
    const points = getRouteCurvePoints(start, target, index);
    const progress = Math.max(0, Math.min(1, trade.routeProgress ?? 0));
    const legProgress =
      progress <= 0.5 ? progress * 2 : Math.max(0, (1 - progress) * 2);

    setPoints(points);

    if (markerRef.current) {
      markerRef.current.position.copy(
        getRouteCurvePoint(start, target, legProgress, index),
      );
    }
  });

  return (
    <group>
      <Line
        points={points}
        color={color}
        transparent
        opacity={0.7}
        lineWidth={1.5}
      />
      <mesh ref={markerRef}>
        <sphereGeometry args={[1.15, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.6}
        />
        <Html distanceFactor={95}>
          <div className="pointer-events-none rounded border border-slate-600 bg-slate-950/90 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-100 shadow">
            {trade.rocketName ?? "Rocket"}
          </div>
        </Html>
      </mesh>
    </group>
  );
};

const MapPage = () => {
  const { status } = useSession();
  const activeTrades = api.quest.getActiveTrades.useQuery(undefined, {
    enabled: status === "authenticated",
    refetchInterval: 5000,
  });
  const routeTrades =
    activeTrades.data?.filter((trade) => trade.status === "IN_ROUTE") ?? [];

  return (
    <>
      <Head>
        <title>Alpha Haven | Star Map</title>
        <meta name="description" content="Space Haven star map" />
      </Head>
      <main className="relative h-screen w-screen overflow-hidden bg-black text-white">
        <div className="absolute left-3 top-3 z-10 rounded border border-slate-700 bg-slate-950/95 px-4 py-3 shadow-2xl ring-1 ring-black/40 backdrop-blur-md">
          <p className="text-xs uppercase tracking-wide text-teal-300">
            Navigation
          </p>
          <h1 className="text-xl font-black">Star Map</h1>
          <Link
            href="/game/port"
            className="mt-2 inline-block text-sm text-slate-300"
          >
            Return to port
          </Link>
        </div>
        <Canvas camera={{ position: [0, 32, 145], fov: 55 }}>
          <Suspense fallback={null}>
            <ambientLight intensity={3.2} />
            <pointLight position={[0, 0, 0]} intensity={18} />
            <Sun />
            <Stars
              radius={6}
              depth={220}
              count={9001}
              factor={4}
              saturation={1}
              fade
              speed={0.75}
            />
            {planetRoster.map((planet) => (
              <LocationSphere key={planet.id} planet={planet} />
            ))}
            {routeTrades.map((trade, index) => (
              <ActiveRoutePath key={trade.id} trade={trade} index={index} />
            ))}
            <OrbitControls
              enablePan={false}
              minDistance={45}
              maxDistance={190}
            />
          </Suspense>
        </Canvas>
      </main>
    </>
  );
};

export default MapPage;

function getPlanetMapPosition(
  planet: PlanetDefinition,
  elapsedSeconds: number,
) {
  const orbitRadius = Math.max(28, Math.abs(planet.zLoc));
  const phaseOffset = hashString(planet.id) / 100;
  const speedFactor = 1.8 / orbitRadius;
  const angle = elapsedSeconds * speedFactor + phaseOffset;
  const x = orbitRadius * Math.cos(angle);
  const z = orbitRadius * Math.sin(angle);

  return new Vector3(x, planet.yLoc / 5, z);
}

function getRouteCurvePoint(
  start: Vector3,
  target: Vector3,
  progress: number,
  index: number,
) {
  const safeProgress = Math.max(0, Math.min(1, progress));
  const control = start.clone().lerp(target, 0.5);
  const lift = Math.max(12, start.distanceTo(target) * 0.22) + index * 3;
  control.y += lift;

  return start
    .clone()
    .multiplyScalar((1 - safeProgress) * (1 - safeProgress))
    .add(control.clone().multiplyScalar(2 * (1 - safeProgress) * safeProgress))
    .add(target.clone().multiplyScalar(safeProgress * safeProgress));
}

function getRouteCurvePoints(start: Vector3, target: Vector3, index: number) {
  return Array.from({ length: 36 }, (_, pointIndex) =>
    getRouteCurvePoint(start, target, pointIndex / 35, index),
  );
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}
