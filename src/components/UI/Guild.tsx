import React from "react";
import millify from "millify";
import {
  BanknotesIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/solid";

import LoadingSpinner from "@/components/LoadingSpinner";
import MaterialIcon from "@/components/MaterialIcon";
import UserAvatar from "@/components/UserAvatar";
import { api } from "@/utils/api";

const Guild = () => {
  const overview = api.user.getOverview.useQuery(undefined, {
    refetchInterval: 15000,
  });

  if (overview.isLoading) {
    return <LoadingSpinner />;
  }

  const data = overview.data;

  if (!data?.user) {
    return (
      <div className="rounded border border-dashed border-slate-700 bg-slate-900/60 p-5 text-center text-sm text-slate-400">
        No command data.
      </div>
    );
  }

  const nextLevelProgress = Math.min(
    100,
    (data.user.experiencePoints % 1000) / 10,
  );

  return (
    <div className="grid w-full gap-5">
      <header className="flex items-center gap-3">
        <UserAvatar src={data.user.image} name={data.user.name} size="md" />
        <div>
          <p className="text-xs uppercase tracking-wide text-teal-300">
            Command
          </p>
          <h2 className="text-2xl font-black">
            {data.user.name ?? "Commander"}
          </h2>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Metric
          icon={<BuildingOffice2Icon className="h-5 w-5" />}
          label="Industry"
          value={`${data.buildingCount} units`}
        />
        <Metric
          icon={<RocketLaunchIcon className="h-5 w-5" />}
          label="Fleet"
          value={`${data.rocketCount} ships`}
        />
        <Metric
          icon={<BanknotesIcon className="h-5 w-5" />}
          label="Power"
          value={millify(data.productionPower)}
        />
        <Metric
          icon={<CheckCircleIcon className="h-5 w-5" />}
          label="Delivered"
          value={millify(data.completedTrades)}
        />
      </section>

      <section className="bg-slate-900/85 grid gap-3 rounded border border-slate-700 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Trade Rank</h3>
            <p className="text-sm text-slate-400">
              Lvl {data.user.level} · {millify(data.user.experiencePoints)} XP
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-bold text-teal-300">
              {data.activeTrades} active
            </p>
            <p className="text-slate-400">{data.expiredTrades} expired</p>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded bg-slate-950">
          <div
            className="h-full bg-teal-400"
            style={{ width: `${nextLevelProgress}%` }}
          />
        </div>
      </section>

      <section className="grid gap-3">
        <h3 className="border-b border-slate-700 pb-2 text-sm font-black uppercase tracking-wide text-slate-200">
          Stores
        </h3>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {data.user.cargo.map((cargo) => (
            <MaterialIcon
              key={cargo.material.id}
              id={cargo.material.id}
              amount={cargo.amount}
              image={cargo.material.image ?? undefined}
              label={cargo.material.name}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

const Metric = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) => (
  <div className="bg-slate-900/85 flex min-h-[4.75rem] flex-col justify-between rounded border border-slate-700 p-3">
    <div className="flex items-center gap-2 text-slate-400">
      {icon}
      <span className="text-xs uppercase tracking-wide">{label}</span>
    </div>
    <div className="text-sm font-bold text-slate-100">{value}</div>
  </div>
);

export default Guild;
