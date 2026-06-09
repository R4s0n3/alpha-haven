import type { Rocket as RocketModel } from "@prisma/client";
import React from "react";
import Rocket from "./Rocket";
import Image from "next/image";

type LandingPadProps = {
  rocket?: Partial<RocketModel>;
  animateLaunch?: boolean;
  animateLanding?: boolean;
  autoRouteEnabled?: boolean;
  canUseAutoRoute?: boolean;
  isTogglingAutoRoute?: boolean;
  statusDetail?: string | null;
  onClick?: () => void;
  onToggleAutoRoute?: (enabled: boolean) => void;
};

const statusLabels: Record<string, string> = {
  LOADING: "Loading",
  READY_TO_LAUNCH: "Ready",
  IN_ROUTE: "In Route",
  LANDING: "Landing",
  STOPPED: "Paused",
};

const LandingPad = ({
  rocket,
  animateLaunch = false,
  animateLanding = false,
  autoRouteEnabled = false,
  canUseAutoRoute = false,
  isTogglingAutoRoute = false,
  statusDetail,
  onClick,
  onToggleAutoRoute,
}: LandingPadProps) => {
  const status = rocket?.status ?? "";
  const hasFuelingSmoke =
    status === "LOADING" || status === "READY_TO_LAUNCH" || animateLaunch;
  const statusLabel = rocket
    ? statusLabels[status] ?? rocket.name ?? "Rocket"
    : null;
  const showAutoRouteToggle = Boolean(onToggleAutoRoute);

  const content = (
    <>
      {onClick && (
        <button
          type="button"
          onClick={onClick}
          aria-label="Open jobs"
          className="absolute inset-0 z-20 focus:outline-none focus:ring-2 focus:ring-teal-300"
        />
      )}
      <div className="relative flex w-full items-center justify-center overflow-visible">
        <Rocket
          model={rocket}
          animateLaunch={animateLaunch}
          animateLanding={animateLanding}
        />

        <div className="z-10 w-full">
          <Image
            className="h-full w-full bg-contain"
            src="/landing_pad.png"
            height={636}
            width={636}
            alt="landing pad"
          />
          {hasFuelingSmoke && <FuelingSmoke isLaunching={animateLaunch} />}
        </div>
      </div>

      {Boolean(statusLabel ?? onClick ?? showAutoRouteToggle) && (
        <div className="relative z-30 -mt-2 grid min-h-[1.6rem] w-full justify-items-center gap-1">
          <div className="bg-slate-950/85 flex items-center gap-1 rounded border border-slate-600 px-1.5 py-1 text-center text-[0.65rem] font-bold uppercase tracking-wide text-slate-200 shadow group-hover:border-teal-300/70 sm:text-[0.7rem]">
            {statusLabel ?? "Jobs"}
            {showAutoRouteToggle && (
              <button
                type="button"
                disabled={!canUseAutoRoute || isTogglingAutoRoute}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleAutoRoute?.(!autoRouteEnabled);
                }}
                className={`relative ml-1 h-3.5 w-6 rounded-full border transition disabled:border-slate-700 disabled:bg-slate-800 ${
                  autoRouteEnabled
                    ? "border-teal-200 bg-teal-400"
                    : "border-slate-500 bg-slate-800"
                }`}
                title={
                  canUseAutoRoute
                    ? autoRouteEnabled
                      ? "Disable auto route for this pad"
                      : "Enable auto route for this pad"
                    : "Auto route unlocks on upgraded launch pads"
                }
                aria-label={
                  autoRouteEnabled
                    ? "Disable auto route for this pad"
                    : "Enable auto route for this pad"
                }
              >
                <span
                  className={`absolute top-0.5 block h-2.5 w-2.5 rounded-full bg-white shadow transition-all ${
                    autoRouteEnabled ? "left-[0.7rem]" : "left-0.5"
                  }`}
                />
              </button>
            )}
          </div>
          {statusDetail && (
            <div className="bg-amber-500/15 max-w-[9rem] rounded border border-amber-400/40 px-2 py-1 text-center text-[0.58rem] font-bold leading-tight text-amber-100 shadow">
              {statusDetail}
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <div
      className={`landing-pad group relative flex h-full w-full flex-col items-center justify-center overflow-visible transition-transform md:w-1/4 ${
        onClick ? "hover:-translate-y-1" : ""
      }`}
    >
      {content}
    </div>
  );
};

const FuelingSmoke = ({ isLaunching }: { isLaunching: boolean }) => (
  <div
    className={`fueling-smoke pointer-events-none absolute bottom-[27%] z-[5] h-[42%] w-[86%] overflow-visible ${
      isLaunching ? "fueling-smoke--launching" : ""
    }`}
  >
    <div className="fueling-smoke__steady">
      {Array.from({ length: 11 }, (_, index) => (
        <span key={index} className="fueling-smoke__puff" />
      ))}
    </div>

    {isLaunching && (
      <div className="launch-sequence">
        <span className="launch-sequence__heat" />
        <span className="launch-sequence__glow" />
        <span className="launch-sequence__core" />
        <span className="launch-sequence__ring" />
        <span className="launch-sequence__ring" />
        <span className="launch-sequence__ring" />
        {Array.from({ length: 12 }, (_, index) => (
          <span key={index} className="launch-sequence__burst" />
        ))}
        {Array.from({ length: 14 }, (_, index) => (
          <span key={index} className="launch-sequence__spark" />
        ))}
      </div>
    )}
  </div>
);

export default LandingPad;
