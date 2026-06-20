import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CreditCard, LogOut, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { frontendApi, type FrontendCompanySettings } from "@/lib/frontend-api";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState<FrontendCompanySettings>(null);

  useEffect(() => {
    if (!user) return;
    frontendApi.companySettings().then((data) => {
      if (data && data.user_id === user.id) {
        setCompany(data);
      }
    });
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your organization and account.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Organization</CardTitle>
              <CardDescription>{company?.company_name || "—"}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Website</span>
              <span className="truncate max-w-[200px]">{company?.company_website || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Industry</span>
              <span>{company?.industry || "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Plan</CardTitle>
              <CardDescription>Your current billing plan</CardDescription>
            </div>
            <Badge variant="secondary">Free</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You are on the free starter plan. Upgrade to unlock more documents, advanced analytics, and team seats.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Account</CardTitle>
              <CardDescription>{user?.email}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Signed in as {user?.email}. Manage your account security through your identity provider.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Security</CardTitle>
              <CardDescription>Session and access</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleSignOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
