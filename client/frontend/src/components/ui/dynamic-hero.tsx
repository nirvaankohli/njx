import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type NavigationItem = {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void;
  target?: "_blank";
};

type CallToAction = {
  text: string;
  href: string;
  variant: "primary" | "secondary";
};

type DynamicHeroProps = {
  heading?: string;
  tagline?: string;
  buttonText?: string;
  buttonHref?: string;
  imageUrl?: string;
  videoUrl?: string;
  navItems?: NavigationItem[];
  callToActions?: CallToAction[];
};

const defaultNavItems: NavigationItem[] = [
  { id: "home", label: "Home", href: "/" },
  { id: "about", label: "About", href: "#about-section" },
  { id: "pricing", label: "Pricing", href: "#pricing" },
  { id: "get-started-nav", label: "Get Started", href: "/auth" },
];

const parseRgbColor = (colorString: string | null) => {
  if (!colorString) return null;
  const match = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (!match) return null;
  return {
    r: Number.parseInt(match[1], 10),
    g: Number.parseInt(match[2], 10),
    b: Number.parseInt(match[3], 10),
  };
};

const PlayIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 5V19L19 12L8 5Z" />
  </svg>
);

export function DynamicHero({
  heading = "DocShield for signed documents",
  tagline = "Keep manifests, verification, telemetry, and audit exports in one clear homepage flow.",
  buttonText = "Open the console",
  buttonHref = "/auth",
  imageUrl = "/docshield-hero-bg-v2.jpg",
  videoUrl,
  navItems = defaultNavItems,
  callToActions = [
    { text: "Get started", href: "/auth", variant: "primary" },
    { text: "View docs", href: "/app/reference", variant: "secondary" },
  ],
}: DynamicHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetRef = useRef<HTMLAnchorElement | null>(null);
  const mousePosRef = useRef<{ x: number | null; y: number | null }>({ x: null, y: null });
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const canvasStrokeRef = useRef({ r: 128, g: 128, b: 128 });

  useEffect(() => {
    const tempElement = document.createElement("div");
    tempElement.style.display = "none";
    document.body.appendChild(tempElement);

    const updateResolvedColors = () => {
      tempElement.style.color = "var(--foreground)";
      const computedFgColor = getComputedStyle(tempElement).color;
      const parsedFgColor = parseRgbColor(computedFgColor);
      if (parsedFgColor) {
        canvasStrokeRef.current = parsedFgColor;
      } else {
        const isDarkMode = document.documentElement.classList.contains("dark");
        canvasStrokeRef.current = isDarkMode
          ? { r: 250, g: 250, b: 250 }
          : { r: 10, g: 10, b: 10 };
      }
    };

    updateResolvedColors();
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "attributes" && mutation.attributeName === "class" && mutation.target === document.documentElement) {
          updateResolvedColors();
          break;
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });

    return () => {
      observer.disconnect();
      tempElement.remove();
    };
  }, []);

  const drawArrow = useCallback(() => {
    if (!canvasRef.current || !targetRef.current || !ctxRef.current) return;

    const targetEl = targetRef.current;
    const ctx = ctxRef.current;
    const mouse = mousePosRef.current;
    const x0 = mouse.x;
    const y0 = mouse.y;
    if (x0 === null || y0 === null) return;

    const rect = targetEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const a = Math.atan2(cy - y0, cx - x0);
    const x1 = cx - Math.cos(a) * (rect.width / 2 + 12);
    const y1 = cy - Math.sin(a) * (rect.height / 2 + 12);

    const midX = (x0 + x1) / 2;
    const midY = (y0 + y1) / 2;
    const offset = Math.min(200, Math.hypot(x1 - x0, y1 - y0) * 0.5);
    const t = Math.max(-1, Math.min(1, (y0 - y1) / 200));
    const controlX = midX;
    const controlY = midY + offset * t;
    const r = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
    const opacity = Math.min(1, (r - Math.max(rect.width, rect.height) / 2) / 500);

    const arrowColor = canvasStrokeRef.current;
    ctx.strokeStyle = `rgba(${arrowColor.r}, ${arrowColor.g}, ${arrowColor.b}, ${opacity})`;
    ctx.lineWidth = 2;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(controlX, controlY, x1, y1);
    ctx.setLineDash([10, 5]);
    ctx.stroke();
    ctx.restore();

    const angle = Math.atan2(y1 - controlY, x1 - controlX);
    const headLength = 10 * (ctx.lineWidth / 1.5);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - headLength * Math.cos(angle - Math.PI / 6), y1 - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - headLength * Math.cos(angle + Math.PI / 6), y1 - headLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !targetRef.current) return;

    ctxRef.current = canvas.getContext("2d");

    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const handleMouseMove = (event: MouseEvent) => {
      mousePosRef.current = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener("resize", updateCanvasSize);
    window.addEventListener("mousemove", handleMouseMove);
    updateCanvasSize();

    const animateLoop = () => {
      if (ctxRef.current && canvas) {
        ctxRef.current.clearRect(0, 0, canvas.width, canvas.height);
        drawArrow();
      }
      animationFrameIdRef.current = window.requestAnimationFrame(animateLoop);
    };

    animateLoop();

    return () => {
      window.removeEventListener("resize", updateCanvasSize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameIdRef.current) {
        window.cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [drawArrow]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !videoUrl) return;

    const handleVideoEnd = () => {
      setShowVideo(false);
      videoElement.currentTime = 0;
    };

    if (showVideo) {
      videoElement.play().catch(() => {
        setShowVideo(false);
      });
      videoElement.addEventListener("ended", handleVideoEnd);
    } else {
      videoElement.pause();
    }

    return () => {
      videoElement.removeEventListener("ended", handleVideoEnd);
    };
  }, [showVideo, videoUrl]);

  return (
    <div className="relative flex min-h-screen w-screen flex-col overflow-x-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -top-40 -z-10 min-h-screen overflow-hidden blur-3xl sm:-top-80"
      >
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] max-w-none -translate-x-1/2 rotate-[30deg] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
            background: "linear-gradient(to top right, oklch(0.704 0.191 260.31), oklch(0.68 0.169 237.32))",
          }}
        />
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 min-h-screen overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]"
      >
        <div
          className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] max-w-none -translate-x-1/2 opacity-30 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
            background: "linear-gradient(to top right, oklch(0.74 0.15 151.23), oklch(0.7 0.18 330.03))",
          }}
        />
      </div>

      <header className="absolute inset-x-0 top-0 z-10">
        <nav aria-label="Global" className="flex items-center justify-between p-4 sm:p-6 lg:px-8">
          <div className="flex lg:flex-1">
            <a href="/" className="-m-1.5 p-1.5">
              <span className="sr-only">DocShield</span>
              <div className="text-sm font-semibold tracking-[0.18em] text-foreground">DocShield</div>
            </a>
          </div>

          <div className="flex lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="sr-only">Open main menu</span>
              <Menu aria-hidden="true" className="size-6" />
            </button>
          </div>

          {navItems.length > 0 && (
            <div className="hidden lg:flex lg:gap-x-8 xl:gap-x-12">
              {navItems.map((item) => {
                const commonClassName =
                  "text-sm/6 font-semibold text-foreground transition-colors hover:text-muted-foreground";
                if (item.href) {
                  return (
                    <a key={item.id} href={item.href} target={item.target} rel={item.target === "_blank" ? "noopener noreferrer" : undefined} className={commonClassName}>
                      {item.label}
                    </a>
                  );
                }
                return (
                  <button key={item.id} type="button" onClick={item.onClick} className={commonClassName}>
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="hidden lg:flex lg:flex-1 lg:justify-end">
            <a href="/auth" className="text-sm/6 font-semibold text-foreground transition-colors hover:text-muted-foreground">
              Log in <span aria-hidden="true">→</span>
            </a>
          </div>
        </nav>

        <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <DialogContent className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-card px-4 py-4 sm:max-w-sm sm:px-6 sm:py-6 sm:ring-1 sm:ring-border lg:hidden">
            <div className="flex items-center justify-between">
              <a href="/" className="-m-1.5 p-1.5">
                <span className="sr-only">DocShield</span>
                <div className="text-sm font-semibold tracking-[0.18em] text-foreground">DocShield</div>
              </a>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="-m-2.5 rounded-md p-2.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="sr-only">Close menu</span>
                <X aria-hidden="true" className="size-6" />
              </button>
            </div>

            <div className="mt-2 flow-root">
              <div className="-my-6 divide-y divide-border">
                <div className="space-y-2 py-6">
                  {navItems.map((item) => {
                    const className =
                      "-mx-3 block rounded-lg px-3 py-2 text-base/7 font-semibold text-card-foreground transition-colors hover:bg-accent hover:text-accent-foreground";
                    if (item.href) {
                      return (
                        <a key={item.id} href={item.href} target={item.target} rel={item.target === "_blank" ? "noopener noreferrer" : undefined} className={className}>
                          {item.label}
                        </a>
                      );
                    }
                    return (
                      <button key={item.id} type="button" onClick={item.onClick} className={className}>
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                <div className="py-6">
                  <a href="/auth" className="-mx-3 block rounded-lg px-3 py-2.5 text-base/7 font-semibold text-card-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                    Log in
                  </a>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <main className="relative isolate flex min-h-screen flex-col justify-center overflow-hidden px-6 pt-20">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center pt-20 sm:pt-24">
          <div className="text-center">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-7xl">
              {heading}
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-base font-medium text-muted-foreground sm:text-lg md:text-xl">
              {tagline}
            </p>
          </div>

          <div className="mt-8 flex justify-center">
            <Button asChild variant="outline" className="border-foreground/50 bg-transparent">
              <a ref={targetRef} href={buttonHref}>
                {buttonText}
              </a>
            </Button>
          </div>

          <div className="mt-8 flex items-center justify-center gap-x-4 sm:gap-x-6">
            {callToActions.map((cta) =>
              cta.variant === "primary" ? (
                <Button asChild key={cta.text}>
                  <a href={cta.href}>{cta.text}</a>
                </Button>
              ) : (
                <a
                  key={cta.text}
                  href={cta.href}
                  className="text-sm font-semibold text-foreground transition-colors hover:text-muted-foreground"
                >
                  {cta.text} <span aria-hidden="true">→</span>
                </a>
              ),
            )}
          </div>

          <div className="mx-auto mt-12 w-full max-w-screen-sm overflow-hidden px-4 sm:px-2 lg:mt-16">
            <div className="rounded-[2rem] bg-border p-[0.25rem]">
              <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-[1.75rem] bg-card sm:h-72 md:h-80 lg:h-96">
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="DocShield preview"
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${showVideo ? "pointer-events-none opacity-0" : "opacity-100"}`}
                  />
                )}
                {videoUrl && (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    muted
                    playsInline
                    className={`h-full w-full object-cover transition-opacity duration-300 ${showVideo ? "opacity-100" : "pointer-events-none opacity-0"}`}
                  />
                )}
                {!showVideo && videoUrl && imageUrl && (
                  <button
                    type="button"
                    onClick={() => setShowVideo(true)}
                    className="absolute bottom-3 left-3 z-20 rounded-full bg-accent/30 p-2 text-accent-foreground backdrop-blur-sm transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring sm:bottom-4 sm:left-4 sm:p-3"
                    aria-label="Play video"
                  >
                    <PlayIcon className="h-4 w-4 sm:h-6 sm:w-6" />
                  </button>
                )}
                {!imageUrl && !videoUrl && <div className="italic text-muted-foreground">Card Content Area</div>}
              </div>
            </div>
          </div>
        </div>
      </main>

      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-10" />
    </div>
  );
}
