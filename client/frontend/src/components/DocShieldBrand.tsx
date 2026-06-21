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
  const wordmarkViewBox = "0 0 456 125";
  const iconViewBox = "0 0 125 125";

  return (
    <div className={cn("flex flex-col items-start gap-1.5", className)}>
      <svg
        role="img"
        aria-label="DocShield"
        viewBox={variant === "icon" ? iconViewBox : wordmarkViewBox}
        xmlns="http://www.w3.org/2000/svg"
        className={cn("block shrink-0", logoClassName)}
        style={{ color: "hsl(var(--foreground))" }}
      >
        {variant === "icon" ? (
          <>
            <path
              d="M28 18h31c16.569 0 30 13.431 30 30v23c0 17.406-10.185 33.196-26 40.4l-4 1.8-4-1.8C39.185 104.196 29 88.406 29 71V31c0-7.18 5.82-13 13-13Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M57 34h14.5L84 47v9H57z" fill="hsl(var(--primary))" />
          </>
        ) : (
          <>
            <path
              d="M28 18h31c16.569 0 30 13.431 30 30v23c0 17.406-10.185 33.196-26 40.4l-4 1.8-4-1.8C39.185 104.196 29 88.406 29 71V31c0-7.18 5.82-13 13-13Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M57 34h14.5L84 47v9H57z" fill="hsl(var(--primary))" />
            <text
              x="128"
              y="80"
              fill="currentColor"
              fontFamily="Geist, Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
              fontSize="58"
              fontWeight="700"
              letterSpacing="-2.2"
            >
              Doc
            </text>
            <text
              x="240"
              y="80"
              fill="hsl(var(--primary))"
              fontFamily="Geist, Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
              fontSize="58"
              fontWeight="700"
              letterSpacing="-2.2"
            >
              Shield
            </text>
          </>
        )}
      </svg>
      {showTagline && <div className={cn("text-[11px] leading-tight", resolvedTaglineClassName)}>Signed documents, live in dev</div>}
    </div>
  );
}
