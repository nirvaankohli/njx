import { cn } from "@/lib/utils";

type DocShieldBrandProps = {
  showTagline?: boolean;
  variant?: "wordmark" | "icon";
  className?: string;
  logoClassName?: string;
  taglineClassName?: string;
};

export function DocShieldBrand({
  showTagline = false,
  variant = "wordmark",
  className,
  logoClassName,
  taglineClassName,
}: DocShieldBrandProps) {
  const resolvedTaglineClassName = taglineClassName ?? "opacity-70";
  const logoSrc = variant === "icon" ? "/docshield-mark.png" : "/docshield-wordmark.png";

  return (
    <div className={cn("flex flex-col items-start gap-1.5", className)}>
      <img
        src={logoSrc}
        alt="DocShield"
        className={cn("block shrink-0 object-contain", logoClassName)}
      />
      {showTagline && <div className={cn("text-[11px] leading-tight", resolvedTaglineClassName)}>Signed documents, live in dev</div>}
    </div>
  );
}
