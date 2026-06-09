import React from "react";
import Image from "next/image";
import { api } from "@/utils/api";
import AnimatedCounter from "./AnimatedCounter";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import type { Material } from "@prisma/client";
import { BanknotesIcon, CubeIcon } from "@heroicons/react/24/solid";
import LoadingSpinner from "./LoadingSpinner";
import UserAvatar from "./UserAvatar";

const InventoryHeader = () => {
  const { data: inventoryData, isLoading } = api.user.getInventory.useQuery(
    undefined,
    {
      refetchInterval: 5000,
      refetchOnWindowFocus: true,
    },
  );
  const { data: sessionData } = useSession();
  const rhoons = inventoryData?.rhoons;

  function createCargo(
    cargo: { material: Material; amount: number },
    idx: number,
  ) {
    const { material, amount } = cargo;

    return (
      <div key={idx} className="flex items-center justify-center gap-2">
        {material.image ? (
          <Image
            className="h-6 w-6 rounded-sm"
            src={material.image}
            width={200}
            height={200}
            alt={cargo.material.name}
          />
        ) : (
          <CubeIcon className="h-5 w-5" />
        )}
        <AnimatedCounter value={amount} />
      </div>
    );
  }

  if (isLoading) return <LoadingSpinner />;
  return (
    <div className="z-40 w-full flex-1 text-white">
      <div className="flex h-12 w-full items-center justify-center shadow-sm">
        <div className="relative flex w-full items-center gap-4 bg-slate-950/90 p-1">
          <div className="flex w-[calc(50%-6rem)] min-w-0 items-center gap-5 overflow-x-auto px-2 pr-4">
            {(inventoryData?.cargo ?? []).map(createCargo)}
          </div>

          <div className="absolute w-full flex justify-center items-center">
            <div className="grid min-h-[2.75rem] mt-12  w-[13rem] grid-cols-[2rem_1fr_2rem] items-center rounded border border-amber-300/70 bg-amber-400 px-3 py-1 text-slate-950 shadow">
              <div className="flex items-center justify-start">
                {rhoons?.material.image ? (
                  <Image
                    className="h-7 w-7 rounded-sm"
                    src={rhoons.material.image}
                    width={200}
                    height={200}
                    alt={rhoons.material.name}
                  />
                ) : (
                  <BanknotesIcon className="h-6 w-6" />
                )}
              </div>
              <div className="grid min-w-0 gap-0.5 text-center leading-none">
                <div className="flex items-baseline justify-center gap-1 whitespace-nowrap">
                  <span className="text-base font-black tabular-nums">
                    <LiveRhoonsCounter
                      amount={rhoons?.amount ?? 0}
                      rhoonsPerSecond={inventoryData?.rhoonsPerSecond ?? 0}
                    />
                  </span>
                  <span className="text-xs font-black uppercase">Rhoons</span>
                </div>
                <p className="text-center text-[0.65rem] font-bold tabular-nums text-amber-950/75">
                  +{inventoryData?.rhoonsPerSecond ?? 0} Rhoons/s
                </p>
              </div>
              <div aria-hidden="true" />
            </div>
          </div>

          <div className="ml-auto mr-2 flex shrink-0 items-center justify-center gap-2">
            <Link
              href="/"
              onClick={() => void signOut()}
              className="text-sm text-slate-300"
            >
              Logout
            </Link>
            <UserAvatar
              src={sessionData?.user.image}
              name={sessionData?.user.name}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const LiveRhoonsCounter = ({
  amount,
  rhoonsPerSecond,
}: {
  amount: number;
  rhoonsPerSecond: number;
}) => {
  const [displayAmount, setDisplayAmount] = React.useState(amount);

  React.useEffect(() => {
    const startedAt = Date.now();

    setDisplayAmount(amount);

    const interval = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);

      setDisplayAmount(amount + elapsedSeconds * rhoonsPerSecond);
    }, 250);

    return () => window.clearInterval(interval);
  }, [amount, rhoonsPerSecond]);

  return <AnimatedCounter value={displayAmount} />;
};

export default InventoryHeader;
