import { Link } from "react-router-dom";
import { Fingerprint, FileSignature, Eye, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import heroAsset from "@/assets/docshield-hero-bg-v2.jpg.asset.json";

const features = [
  {
    icon: Fingerprint,
    title: "Zero-content fingerprinting",
    body: "Hashes and signed manifests stay in your environment. DocShield never sees raw PDFs.",
  },
  {
    icon: FileSignature,
    title: "Embedded AI policy tags",
    body: "Attach machine-readable rules: No External AI, Secure Link Only, No Forwarding.",
  },
  {
    icon: Eye,
    title: "Anomaly dashboard",
    body: "Detect off-hours access, geographic outliers, and revoked-document attempts.",
  },
  {
    icon: Lock,
    title: "Layered signing history",
    body: "Append-only chain of issuer, sender, recipient, approver, confirmer signatures.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};


export default function LandingPage() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden">
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border/60 backdrop-blur-md bg-background/40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-semibold tracking-tight text-lg">DocShield</span>
          <nav className="hidden md:flex gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#architecture" className="hover:text-foreground transition-colors">Architecture</a>
            <a href="#tiers" className="hover:text-foreground transition-colors">Tiers</a>
          </nav>
          <Button asChild size="sm">
            <Link to="/app">Get started <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      </header>

      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16 bg-background"
      >
        {/* Background image with parallax */}
        <motion.div
          aria-hidden
          className="absolute inset-0 -top-16 z-0 pointer-events-none"
          style={{ y: heroY, opacity: heroOpacity, scale: heroScale }}
        >
          <img
            src={heroAsset.url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover scale-110"
            width={1920}
            height={1080}
          />
          <div className="absolute inset-0 bg-background/30" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        </motion.div>

        {/* Subtle grid overlay */}
        <div
          aria-hidden
          className="absolute inset-0 z-[1] pointer-events-none opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
          }}
        />


        <div className="relative z-10 max-w-6xl mx-auto px-6 py-28 md:py-40 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-5xl md:text-7xl font-semibold tracking-tight max-w-4xl mx-auto leading-[1.05]">
              A zero-content passport for every document you send.
            </h1>
          </motion.div>
          <motion.p
            className="mt-8 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            DocShield gives enterprises a way to make PDFs verifiable, policy-aware, and trackable — without
            sending document content to DocShield.
          </motion.p>
          <motion.div
            className="mt-12 flex items-center justify-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <Button asChild size="lg">
              <Link to="/app">Open the console <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#features">See how it works</a>
            </Button>
          </motion.div>
        </div>
      </section>

      <section id="features" className="relative border-t border-border bg-secondary/20">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <motion.h2
            className="text-2xl md:text-3xl font-semibold tracking-tight mb-14 max-w-xl"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            Four primitives that follow a document through its lifecycle.
          </motion.h2>
          <motion.div
            className="grid sm:grid-cols-2 gap-6"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={itemVariants}
                className="group rounded-lg border border-border bg-card p-6 hover:border-primary/40 transition-colors"
              >
                <f.icon className="h-5 w-5 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <div className="font-medium mb-1">{f.title}</div>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="tiers" className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-6">
          <motion.div
            className="rounded-lg border border-border p-8"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Tier 1</div>
            <div className="mt-1 text-xl font-semibold">Fingerprinting + Embedded AI Tags</div>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>· Document fingerprint &amp; signed manifest</li>
              <li>· Embedded AI usage tags inside PDFs</li>
              <li>· Tamper verification &amp; layered signing history</li>
            </ul>
          </motion.div>
          <motion.div
            className="rounded-lg border border-primary/40 p-8 bg-primary/5"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="text-xs uppercase tracking-wider text-primary">Tier 2</div>
            <div className="mt-1 text-xl font-semibold">Dashboard + Anomaly Detection</div>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>· Secure-link distribution &amp; access telemetry</li>
              <li>· Rules-based exposure scoring &amp; anomalies</li>
              <li>· Geography summaries &amp; audit views</li>
            </ul>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-border">
        <motion.div
          className="max-w-6xl mx-auto px-6 py-10 flex items-center justify-between text-sm text-muted-foreground"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>DocShield · zero-content document passport</div>
          <Link to="/app" className="hover:text-foreground transition-colors">Get started →</Link>
        </motion.div>
      </footer>
    </div>
  );
}
