import { cn } from "@/lib/utils";

type DocShieldBrandProps = {
  showTagline?: boolean;
  className?: string;
  iconClassName?: string;
  titleClassName?: string;
  taglineClassName?: string;
};

export function DocShieldBrand({
  showTagline = false,
  className,
  iconClassName,
  titleClassName,
  taglineClassName,
}: DocShieldBrandProps) {
  const resolvedTaglineClassName = taglineClassName ?? "opacity-70";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img
        src="/docshield-mark.png"
        alt=""
        aria-hidden="true"
        className={cn("block shrink-0", iconClassName)}
      />
      <div className="leading-tight">
        <div className={cn("text-[14px] font-semibold tracking-tight text-inherit", titleClassName)}>DocShield</div>
        {showTagline && (
          <div className={cn("text-[11px]", resolvedTaglineClassName)}>Signed documents, live in dev</div>
        )}
      </div>
    </div>
  );
}
