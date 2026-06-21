import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Download, Loader2, LockKeyhole } from "lucide-react";
import { api, type SharedDocument } from "@/lib/docshield-api";
import { getDocShieldSession } from "@/lib/docshield-session";
import { sha256Hex } from "@/lib/docshield-signing";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { triggerBrowserDownload } from "@/lib/download";

export default function SharedDocumentPage() {
  const { token = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const session = getDocShieldSession();
  const [document, setDocument] = useState<SharedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setDocument(null);
    setDownloading(false);
    setDownloaded(false);
    setPassword("");
    setError(null);
    api
      .sharedDocument(token)
      .then((next) => setDocument(next))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "This secure link is unavailable."))
      .finally(() => setLoading(false));
  }, [token]);

  const organizationAllowed = useMemo(
    () => !document || document.access_method !== "organization" || document.tenant_id === session.tenantId,
    [document, session.tenantId],
  );

  const accessPath = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    if (!document || loading || authLoading || document.access_method !== "organization" || user || !organizationAllowed) {
      return;
    }
    navigate("/auth", { replace: true, state: { from: accessPath } });
  }, [accessPath, authLoading, document, loading, navigate, organizationAllowed, user]);

  const download = useCallback(
    async (passwordHash?: string) => {
      if (!document || downloading) return;
      setDownloading(true);
      setError(null);
      try {
        const blob = await api.downloadSharedDocument(token, {
          passwordHash,
          tenantId: document.access_method === "organization" ? session.tenantId : undefined,
        });
        triggerBrowserDownload(blob, document.file_name);
        setDownloaded(true);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Access could not be verified.");
      } finally {
        setDownloading(false);
      }
    },
    [document, downloading, session.tenantId, token],
  );

  useEffect(() => {
    if (!document || loading || authLoading || downloading || downloaded || error) return;
    if (document.password_required) return;
    if (document.access_method === "organization" && !user) return;
    if (document.access_method === "organization" && !organizationAllowed) return;
    void download();
  }, [authLoading, downloading, downloaded, document, download, error, loading, organizationAllowed, user]);

  async function unlock() {
    if (!document || downloading) return;
    if (document.password_required) {
      const hashed = await sha256Hex(password);
      await download(hashed);
      return;
    }
    await download();
  }

  if (loading || authLoading || (!user && document?.access_method === "organization")) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <div className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </div>
      </main>
    );
  }

  if (!document) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <div className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background">
            <LockKeyhole className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm text-muted-foreground">{error ?? "Secure link unavailable."}</div>
        </div>
      </main>
    );
  }

  if (downloaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <div className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background">
            <Download className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm text-muted-foreground">Download started</div>
        </div>
      </main>
    );
  }

  if (document.password_required) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background">
              <LockKeyhole className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2 text-center">
            <p className="text-sm text-muted-foreground">Locked download</p>
            <h1 className="text-lg font-medium">Enter password</h1>
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="share-password" className="sr-only">
                Access password
              </Label>
              <Input
                id="share-password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError(null);
                }}
                placeholder="Password"
              />
            </div>
            <Button className="w-full" onClick={() => void unlock()} disabled={downloading || !password}>
              {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Unlock and download
            </Button>
            {error && <div className="text-center text-sm text-destructive">{error}</div>}
          </div>
        </div>
      </main>
    );
  }

  if (!organizationAllowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <div className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background">
            <LockKeyhole className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm text-muted-foreground">Organization access required</div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <div className="space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    </main>
  );
}
