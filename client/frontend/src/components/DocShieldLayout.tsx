import { useEffect, useState } from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { Shield, LayoutDashboard, FileText, ShieldCheck, Activity, Settings2, Download, BookOpen, Building2, LogOut, CreditCard, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

const nav = [
  { to: "/app", end: true, label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/documents", label: "Documents", icon: FileText },
  { to: "/app/verify", label: "Verify", icon: ShieldCheck },
  { to: "/app/access-events", label: "Access events", icon: Activity },
  { to: "/app/reference", label: "Reference", icon: BookOpen },
  { to: "/app/setup", label: "Tenant setup", icon: Settings2 },
];

type CompanySettings = Tables<"company_settings">;

export default function DocShieldLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState<CompanySettings | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("company_settings")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setCompany(data as CompanySettings);
      });
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="w-60 border-r border-border bg-sidebar shrink-0 hidden md:flex flex-col h-screen sticky top-0 self-start">
        <Link to="/" className="flex items-center gap-2 px-5 py-5 border-b border-border">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">DocShield</span>
        </Link>

        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Building2 className="h-3.5 w-3.5" />
            Organization
          </div>
          <div className="font-medium text-sm truncate">
            {company?.company_name || "Loading..."}
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <NavLink
            to="/app/settings"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )
            }
          >
            <User className="h-4 w-4" />
            Account settings
          </NavLink>
          <NavLink
            to="/app/settings"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )
            }
          >
            <CreditCard className="h-4 w-4" />
            View plan
          </NavLink>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.open("/api/audit-export", "_blank");
            }}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-sidebar-foreground transition-colors"
          >
            <Download className="h-4 w-4" />
            Export audit log
          </a>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>

      </aside>
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto p-6 md:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

