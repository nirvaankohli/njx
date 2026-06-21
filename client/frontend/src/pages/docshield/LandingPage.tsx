import { DynamicHero } from "@/components/ui/dynamic-hero";
import heroPreviewAsset from "@/assets/docshield-hero-bg-v2.jpg";

export default function LandingPage() {
  return (
    <DynamicHero
      heading="DocShield keeps signed documents visible, verified, and ready to share."
      tagline="Track manifests, review access signals, and open the audit path from one homepage."
      buttonText="Open DocShield"
      imageUrl={heroPreviewAsset}
      navItems={[
        { id: "home", label: "Home", href: "/" },
        { id: "documents", label: "Documents", href: "/app/documents" },
        { id: "verify", label: "Verify", href: "/app/verify" },
        { id: "signin", label: "Sign in", href: "/auth" },
      ]}
      callToActions={[
        { text: "Get started", href: "/auth", variant: "primary" },
        { text: "Open reference", href: "/app/reference", variant: "secondary" },
      ]}
    />
  );
}
