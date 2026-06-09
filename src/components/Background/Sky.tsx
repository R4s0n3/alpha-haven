import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Clouds, Cloud, Sky as SkyImpl, Stars } from "@react-three/drei";

const Sky = ({ seed }: { seed: number }) => {
  const [sunPosition, setSunPosition] = useState<SunPosition>({
    x: 0,
    y: 1,
    z: 0,
  });

  function isNight(): boolean {
    const currentTime = new Date();
    const targetHours = { pre: 22, after: 6 }; // 10 PM in 24-hour time format

    // Get the current hour using getHours() method which returns hour in 24-hour time
    const currentHour = currentTime.getHours();
    // Check if the current hour is greater than or equal to the target hour
    return currentHour >= targetHours.pre || currentHour <= targetHours.after;
  }

  // Example usage:
  const timeCheck = isNight();
  const cloudConfigs = useMemo(() => createCloudConfigs(seed), [seed]);

  useEffect(() => {
    const position = calculateSunPosition(new Date());
    setSunPosition(position);
  }, []);

  return (
    <>
      {timeCheck && (
        <Stars
          radius={222}
          depth={444}
          count={42069}
          factor={5}
          saturation={1}
          fade
          speed={0.75}
        />
      )}
      <SkyImpl
        distance={420069}
        sunPosition={[sunPosition.x, sunPosition.y, sunPosition.z]}
        inclination={0}
        azimuth={0.25}
      />
      <Clouds material={THREE.MeshBasicMaterial} limit={260}>
        {cloudConfigs.map((config) => (
          <DriftingCloud key={config.id} config={config} />
        ))}
      </Clouds>
    </>
  );
};

export default Sky;

type SunPosition = {
  x: number;
  y: number;
  z: number;
};

// Function to calculate the day of the year
const getDayOfYear = (date: Date): number => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
};

const calculateSunPosition = (date: Date): SunPosition => {
  // Simplified calculation assuming a circular orbit and ignoring tilt and eccentricity
  const hoursSinceMidnight =
    date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const solarDeclination =
    23.44 * Math.cos((360 / 365) * (getDayOfYear(date) + 10) * (Math.PI / 180));
  const hourAngle = (hoursSinceMidnight / 24) * 360 - 180;

  // For simplicity, we place the sun at a fixed distance and vary its position in a circle
  const distance = 100; // Arbitrary distance
  const x =
    distance *
    Math.cos(hourAngle * (Math.PI / 180)) *
    Math.cos(solarDeclination * (Math.PI / 180));
  const y =
    distance *
    Math.sin(hourAngle * (Math.PI / 180)) *
    Math.cos(solarDeclination * (Math.PI / 180));
  const z = distance * Math.sin(solarDeclination * (Math.PI / 180));

  return { x, y, z };
};

type CloudConfig = {
  id: string;
  seed: number;
  segments: number;
  bounds: [number, number, number];
  opacity: number;
  speed: number;
  drift: number;
  phase: number;
  wrapMin: number;
  wrapMax: number;
  position: [number, number, number];
  volume: number;
  growth: number;
  fade: number;
};

const DriftingCloud = ({ config }: { config: CloudConfig }) => {
  const cloudRef = useRef<THREE.Group>(null);

  useFrame(({ clock }, delta) => {
    if (cloudRef.current) {
      cloudRef.current.position.x -= config.speed * delta;
      cloudRef.current.position.y =
        config.position[1] +
        Math.sin(clock.elapsedTime * config.drift + config.phase) * 4;

      if (cloudRef.current.position.x < config.wrapMin) {
        cloudRef.current.position.x = config.wrapMax;
      }
    }
  });

  return (
    <Cloud
      ref={cloudRef}
      seed={config.seed}
      segments={config.segments}
      bounds={config.bounds}
      concentrate="inside"
      color="#f8fbff"
      opacity={config.opacity}
      position={config.position}
      volume={config.volume}
      smallestVolume={0.2}
      growth={config.growth}
      fade={config.fade}
    />
  );
};

const createCloudConfigs = (seed: number): CloudConfig[] => {
  const random = seededRandom(seed);
  const weatherRoll = random();
  const cloudCount =
    weatherRoll < 0.26
      ? 1 + Math.floor(random() * 2)
      : weatherRoll < 0.84
        ? 2 + Math.floor(random() * 4)
        : 6 + Math.floor(random() * 3);
  const weatherDensity =
    weatherRoll < 0.26 ? 0.62 : weatherRoll < 0.84 ? 0.76 : 0.94;

  return Array.from({ length: cloudCount }, (_, index) => {
    const depth = -250 - random() * 210;
    const layer = index % 3;
    const baseY = 198 + layer * 34 + random() * 42;
    const x = -760 + (1520 / cloudCount) * index + random() * 220;
    const size = (0.56 + random() * 0.46) * weatherDensity;
    const speed = 1.5 + random() * 3.4 + layer * 0.58;
    const segments = 9 + Math.floor(random() * 5 + size * 4);

    return {
      id: `cloud-${index}`,
      seed: Math.floor(seed + index * 997 + random() * 10000),
      segments,
      bounds: [
        1.9 + size * 0.95,
        4.6 + size * 3.8,
        0.22 + size * 0.2,
      ],
      opacity: (0.22 + random() * 0.1) * weatherDensity,
      speed,
      drift: 0.03 + random() * 0.05,
      phase: random() * Math.PI * 2,
      wrapMin: -980,
      wrapMax: 980 + random() * 180,
      position: [x, baseY, depth],
      volume: 94 + size * 126,
      growth: 5 + size * 10,
      fade: 90,
    };
  });
};

const seededRandom = (seed: number) => {
  let state = Math.abs(Math.trunc(seed)) || 1;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};
