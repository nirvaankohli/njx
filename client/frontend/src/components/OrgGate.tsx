import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { frontendApi } from "@/lib/frontend-api";

export function OrgGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [hasOrg, setHasOrg] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const data = await frontendApi.companySettings();
      if (cancelled) return;
      setHasOrg(!!data && data.user_id === user.id);
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, location.pathname]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasOrg && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
