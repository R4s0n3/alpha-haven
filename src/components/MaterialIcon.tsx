import React from "react";
import Image from "next/image";
import { CubeIcon } from "@heroicons/react/24/solid";
import millify from "millify";

type MaterialIconProps = {
  id: string;
  amount: number;
  image?: string;
  label?: string;
};

const MaterialIcon = (props: MaterialIconProps) => {
  const { id, amount, image, label } = props;

  return (
    <div className="flex min-w-0 max-w-full items-center gap-2 overflow-hidden rounded border border-slate-800 bg-slate-950/70 px-2 py-1.5 shadow-sm">
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-slate-800">
        {image ? (
          <Image
            className="object-cover"
            alt={id}
            src={image}
            fill
            sizes="32px"
          />
        ) : (
          <CubeIcon className="h-full w-full p-1.5 text-slate-600" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-black leading-4 text-slate-100">
          {millify(amount)}
        </p>
        {label && (
          <p className="truncate text-[0.65rem] uppercase leading-3 tracking-wide text-slate-400">
            {label}
          </p>
        )}
      </div>
    </div>
  );
};

export default MaterialIcon;
