import { DynamicHero } from "@/components/ui/dynamic-hero";

export default function LandingPage() {
  return (
    <DynamicHero
      heading="DocShield keeps signed documents visible, verified, and ready to share."
      tagline="Track manifests, review access signals, and open the audit path from one homepage."
      buttonText="Open DocShield"
      buttonHref="/auth"
      navItems={[
        { id: "home", label: "Home", href: "/" },
        { id: "documents", label: "Documents", href: "/app/documents" },
        { id: "verify", label: "Verify", href: "/app/verify" },
        { id: "signin", label: "Sign in", href: "/auth" },
      ]}
      callToActions={[
        { text: "Open reference", href: "/app/reference", variant: "secondary" },
      ]}
    />
  );
}
