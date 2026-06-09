import {
  Bloom,
  DepthOfField,
  EffectComposer,
  Vignette,
} from "@react-three/postprocessing";
export const Effects: React.FC = () => {
  return (
    <EffectComposer>
      <DepthOfField
        focusDistance={0.16}
        focalLength={0.035}
        bokehScale={0.38}
        height={420}
      />
      <Bloom
        luminanceThreshold={0.62}
        luminanceSmoothing={0.34}
        intensity={0.28}
        height={220}
      />
      <Vignette eskil={false} offset={0.22} darkness={0.28} />
    </EffectComposer>
  );
};
