import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileSignature, Lock, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatFileSize } from "@/lib/docshield-file";
import { triggerBrowserDownload } from "@/lib/download";
import { getDocShieldSession } from "@/lib/docshield-session";
import { sha256Hex } from "@/lib/docshield-signing";

export default function DocumentDownloadPage() {
  const session = getDocShieldSession();
  const { id = "" } = useParams();
  const documentId = decodeURIComponent(id);
  const active = session.activeDocument?.documentId === documentId ? session.activeDocument : null;
  const anyoneWithLink = active?.accessAnyoneWithLink ?? true;
  const accessMethod = active?.accessMethod ?? (anyoneWithLink ? null : "password");
  const passwordRequired = !anyoneWithLink && accessMethod === "password";
  const organizationRequired = !anyoneWithLink && accessMethod === "organization";
  const organizationAllowed = useMemo(
    () => !organizationRequired || !active || session.tenantId === active.signedManifest.manifest.tenant_id,
    [active, organizationRequired, session.tenantId],
  );
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(anyoneWithLink || organizationAllowed);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPassword("");
    setUnlocked(anyoneWithLink || organizationAllowed);
    setDownloading(false);
    setDownloaded(false);
    setError(null);
  }, [documentId, anyoneWithLink, organizationAllowed]);

  const packagePayload = useMemo(
    () =>
      active
        ? {
            source_file: {
              name: active.sourceFileName ?? `${documentId}.pdf`,
              type: active.sourceFileType ?? "application/octet-stream",
              size: active.sourceFileSize ?? 0,
            },
            signed_manifest: active.signedManifest,
            history: active.history,
            manifest_hash: active.manifestHash,
            document_id: active.documentId,
            access_method: accessMethod ?? "anyone_with_link",
          }
        : null,
    [active, documentId, accessMethod],
  );

  const downloadPackage = useCallback(async () => {
    if (!active || !packagePayload) return;
    setDownloading(true);
    setError(null);
    try {
      const blob = new Blob([JSON.stringify(packagePayload, null, 2)], { type: "application/json" });
      triggerBrowserDownload(blob, `${documentId}.docshield.json`);
      setDownloaded(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The download could not be prepared.");
    } finally {
      setDownloading(false);
    }
  }, [active, documentId, packagePayload]);

  async function unlock() {
    if (!active) return;
    if (anyoneWithLink) {
      setUnlocked(true);
      return;
    }
    if (organizationRequired) {
      if (!organizationAllowed) {
        setError("Organization access required");
        return;
      }
      setUnlocked(true);
      return;
    }

    const hashed = await sha256Hex(password);
    if (hashed !== active.accessPasswordHash) {
      setError("Password incorrect");
      return;
    }
    setUnlocked(true);
  }

  useEffect(() => {
    if (!active || downloading || downloaded || error) return;
    if (passwordRequired && !unlocked) return;
    if (organizationRequired && !organizationAllowed) {
      setError("Organization access required");
      return;
    }
    void downloadPackage();
  }, [active, downloading, downloaded, error, passwordRequired, unlocked, organizationRequired, organizationAllowed, downloadPackage]);

  return (
    <div className="space-y-6">
      <Link to="/app/documents" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        All documents
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Download signed document</h1>
        <p className="text-sm text-muted-foreground">
          This page starts the download automatically once access is confirmed.
        </p>
      </header>

      {active && packagePayload ? (
        downloaded ? (
          <Card>
            <CardHeader>
              <div className="mb-2 flex w-fit items-center gap-1 rounded-full border border-border bg-muted/20 px-2.5 py-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground">
                <FileSignature className="h-3.5 w-3.5" />
                Download ready
              </div>
              <CardTitle>Download started</CardTitle>
              <CardDescription>The browser should save the signed package automatically.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow label="Document ID" value={active.documentId} />
                <InfoRow label="Download name" value={`${documentId}.docshield.json`} />
                <InfoRow label="Manifest hash" value={active.manifestHash} />
                <InfoRow label="History events" value={`${active.history.length}`} />
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                If the download shelf did not open, check your browser's download history.
              </div>
            </CardContent>
          </Card>
        ) : passwordRequired && !unlocked ? (
          <Card>
            <CardHeader>
              <div className="mb-2 flex w-fit items-center gap-1 rounded-full border border-border bg-muted/20 px-2.5 py-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                Password required
              </div>
              <CardTitle>Unlock download</CardTitle>
              <CardDescription>{formatFileSize(active.sourceFileSize ?? 0)} · signed bundle</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow label="Document ID" value={active.documentId} />
                <InfoRow label="Manifest hash" value={active.manifestHash} />
                <InfoRow label="History events" value={`${active.history.length}`} />
                <InfoRow label="Access mode" value="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="download-password">Access password</Label>
                <Input
                  id="download-password"
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
              <Button onClick={() => void unlock()} disabled={downloading || !password}>
                {downloading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1.5 h-4 w-4" />}
                {downloading ? "Unlocking…" : "Unlock and download"}
              </Button>
            </CardContent>
          </Card>
        ) : organizationRequired && !organizationAllowed ? (
          <Card>
            <CardHeader>
              <div className="mb-2 flex w-fit items-center gap-1 rounded-full border border-border bg-muted/20 px-2.5 py-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Organization access
              </div>
              <CardTitle>Sign-in required</CardTitle>
              <CardDescription>{active.signedManifest.manifest.tenant_id} must match your current organization session.</CardDescription>
            </CardHeader>
            <CardContent className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Sign in to the correct organization, then reload this page to trigger the download.
            </CardContent>
          </Card>
        ) : downloading ? (
          <Card>
            <CardHeader>
              <CardTitle>Preparing download</CardTitle>
              <CardDescription>{formatFileSize(active.sourceFileSize ?? 0)} · signed bundle</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              The browser download is being prepared now.
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardHeader>
              <CardTitle>Download blocked</CardTitle>
              <CardDescription>{active.documentId}</CardDescription>
            </CardHeader>
            <CardContent className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Starting download</CardTitle>
              <CardDescription>{formatFileSize(active.sourceFileSize ?? 0)} · signed bundle</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Preparing the browser download now.
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No signed package in session</CardTitle>
            <CardDescription>
              Upload and sign a PDF or DOCX first, then return here to download the generated package.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              The download page only works for the active signed document stored in this browser session.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3">
      <div className="text-[11px] tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 break-all text-sm text-foreground">{value}</div>
    </div>
  );
}
