import Image from "next/image";
import React from "react";

type UserAvatarProps = {
  src?: string | null;
  name?: string | null;
  size?: "sm" | "md";
};

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-14 w-14 text-lg",
};

const imageSizes = {
  sm: 64,
  md: 112,
};

function getSafeImageSrc(src?: string | null) {
  if (!src) {
    return null;
  }

  if (src.startsWith("/") || src.startsWith("https://")) {
    return src;
  }

  if (src.startsWith("http://")) {
    return src.replace("http://", "https://");
  }

  return null;
}

function getInitials(name?: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const initials = parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "C";
}

const UserAvatar = ({ src, name, size = "sm" }: UserAvatarProps) => {
  const [imageFailed, setImageFailed] = React.useState(false);
  const imageSrc = getSafeImageSrc(src);
  const dimension = imageSizes[size];

  React.useEffect(() => {
    setImageFailed(false);
  }, [imageSrc]);

  return (
    <div
      className={`${sizeClasses[size]} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-900 font-black text-teal-100`}
      title={name ?? "Commander"}
    >
      {imageSrc && !imageFailed ? (
        <Image
          src={imageSrc}
          alt={name ?? "Commander"}
          width={dimension}
          height={dimension}
          sizes={`${dimension}px`}
          className="h-full w-full object-cover"
          unoptimized={imageSrc.startsWith("https://")}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
};

export default UserAvatar;
