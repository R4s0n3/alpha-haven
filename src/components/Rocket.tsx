import type { Rocket as RocketModel } from "@prisma/client";
import Image from "next/image";
import React from "react";

type RocketProps = {
  model?: Partial<RocketModel>;
  animateLaunch?: boolean;
  animateLanding?: boolean;
};

const Rocket = ({
  model,
  animateLaunch = false,
  animateLanding = false,
}: RocketProps) => {
  if (!model) {
    return null;
  }

  const status = model.status ?? "";
  const isInRoute = status === "IN_ROUTE";

  if (isInRoute && !animateLaunch && !animateLanding) {
    return null;
  }

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-[clamp(8%,2.4vw,12%)] z-20 flex items-center justify-center transition-transform ${
        animateLaunch ? "animate-rocketLaunch" : ""
      } ${animateLanding ? "animate-rocketLanding" : ""}`}
    >
      <div className="relative flex w-[clamp(4.8rem,42%,13rem)] flex-col sm:w-[clamp(5.5rem,44%,15rem)] md:w-[clamp(6rem,48%,17rem)]">
        <Image
          className="h-full w-full object-contain drop-shadow-[0_18px_24px_rgba(15,23,42,0.35)]"
          src={model.image ?? "/rocket_01.png"}
          alt={model.name ?? "Rocket"}
          width={610}
          height={1512}
        />
        {animateLaunch && (
          <Image
            className="flex-1 w-full"
            src="/rocket_flame.gif"
            alt=""
            width={1512}
            height={610}
          />
        )}
      </div>
    </div>
  );
};

export default Rocket;
