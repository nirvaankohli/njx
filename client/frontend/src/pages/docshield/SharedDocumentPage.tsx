import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileCheck2, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useParams } from "react-router-dom";
import { api, type SharedDocument } from "@/lib/docshield-api";
import { formatFileSize } from "@/lib/docshield-file";
import { getDocShieldSession } from "@/lib/docshield-session";
import { sha256Hex } from "@/lib/docshield-signing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { triggerBrowserDownload } from "@/lib/download";

export default function SharedDocumentPage() {
  const { token = "" } = useParams();
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
    api.sharedDocument(token)
      .then((next) => setDocument(next))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "This secure link is unavailable."))
      .finally(() => setLoading(false));
  }, [token]);

  const organizationAllowed = useMemo(
    () => !document || document.access_method !== "organization" || document.tenant_id === session.tenantId,
    [document, session.tenantId],
  );

  const download = useCallback(async () => {
    if (!document) return;
    setDownloading(true);
    setError(null);
    try {
      const credentials: { passwordHash?: string; tenantId?: string } = {};
      if (document.password_required) credentials.passwordHash = await sha256Hex(password);
      if (document.access_method === "organization") credentials.tenantId = session.tenantId;
      const blob = await api.downloadSharedDocument(token, credentials);
      triggerBrowserDownload(blob, document.file_name);
      setDownloaded(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Access could not be verified.");
    } finally {
      setDownloading(false);
    }
  }, [document, password, session.tenantId, token]);

  useEffect(() => {
    if (!document || loading || downloading || downloaded || error) return;
    if (document.password_required) return;
    if (!organizationAllowed) {
      setError("Organization access required");
      return;
    }
    void download();
  }, [document, loading, downloading, downloaded, error, organizationAllowed, download]);

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-6 w-6 text-primary" />
          DocShield
        </div>
        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </CardContent>
          </Card>
        ) : !document ? (
          <Alert variant="destructive">
            <LockKeyhole className="h-4 w-4" />
            <AlertTitle>Secure link unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : downloaded ? (
          <Card>
            <CardHeader>
              <BadgeRow />
              <CardTitle>Download started</CardTitle>
              <CardDescription>The browser should save the file automatically.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Document ID" value={document.document_id} />
                <Info label="Tenant" value={document.tenant_id} />
                <Info label="File name" value={document.file_name} />
                <Info label="Size" value={formatFileSize(document.size_bytes)} />
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                If the download shelf did not open, use your browser's download history.
              </div>
            </CardContent>
          </Card>
        ) : document.password_required ? (
          <Card>
            <CardHeader>
              <BadgeRow />
              <CardTitle>Unlock download</CardTitle>
              <CardDescription>{formatFileSize(document.size_bytes)} · signed by {document.issuer_key_id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Document ID" value={document.document_id} />
                <Info label="Tenant" value={document.tenant_id} />
                <Info label="File name" value={document.file_name} />
                <Info label="Link expires" value={document.expires_at ? new Date(document.expires_at).toLocaleString() : "No expiry"} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="share-password">Access password</Label>
                <Input
                  id="share-password"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                  }}
                  placeholder="Enter the access password"
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <Button onClick={() => void download()} disabled={downloading || !password}>
                {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {downloading ? "Unlocking…" : "Unlock and download"}
              </Button>
            </CardContent>
          </Card>
        ) : !organizationAllowed ? (
          <Alert variant="destructive">
            <LockKeyhole className="h-4 w-4" />
            <AlertTitle>Organization access required</AlertTitle>
            <AlertDescription>
              Sign in with the organization that owns this link, then try the download again.
            </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <BadgeRow />
              <CardTitle>Starting download</CardTitle>
              <CardDescription>{formatFileSize(document.size_bytes)} · signed by {document.issuer_key_id}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Preparing the browser download now.
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

function BadgeRow() {
  return (
    <div className="mb-2 flex w-fit items-center gap-1 rounded-full border border-border bg-muted/20 px-2.5 py-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground">
      <FileCheck2 className="h-3.5 w-3.5" />
      Signed original
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 break-all font-mono text-xs">{value}</div>
    </div>
  );
}
