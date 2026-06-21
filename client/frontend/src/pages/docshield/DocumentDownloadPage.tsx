import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, FileSignature, ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatFileSize } from "@/lib/docshield-file";
import { api } from "@/lib/docshield-api";
import { getDocShieldSession } from "@/lib/docshield-session";
import { sha256Hex } from "@/lib/docshield-signing";
import { toast } from "sonner";

export default function DocumentDownloadPage() {
  const session = getDocShieldSession();
  const { id = "" } = useParams();
  const documentId = decodeURIComponent(id);
  const active = session.activeDocument?.documentId === documentId ? session.activeDocument : null;
  const anyoneWithLink = active?.accessAnyoneWithLink ?? true;
  const accessMethod = active?.accessMethod ?? (anyoneWithLink ? null : "password");
  const passwordRequired = !anyoneWithLink && accessMethod === "password";
  const organizationRequired = !anyoneWithLink && accessMethod === "organization";
  const organizationAllowed = organizationRequired && !!active && session.tenantId === active.signedManifest.manifest.tenant_id;
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(anyoneWithLink || organizationAllowed);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setPassword("");
    setUnlocked(anyoneWithLink || organizationAllowed);
  }, [documentId, anyoneWithLink, organizationAllowed]);

  async function unlock() {
    if (!active) {
      setUnlocked(true);
      return;
    }
    if (anyoneWithLink) {
      setUnlocked(true);
      return;
    }
    if (organizationRequired) {
      if (!organizationAllowed) {
        toast.error("Organization access required", {
          description: "Sign into the right organization to continue.",
        });
        return;
      }
      setUnlocked(true);
      return;
    }
    const hashed = await sha256Hex(password);
    if (hashed !== active.accessPasswordHash) {
      toast.error("Password incorrect", {
        description: "Try the access password you set when signing the file.",
      });
      return;
    }
    setUnlocked(true);
  }

  async function handleDownload() {
    if (!active?.shareLink || (!anyoneWithLink && !unlocked) || downloading) return;
    setDownloading(true);
    try {
      const blob = await api.downloadSharedDocument(active.shareLink.token, {
        passwordHash: passwordRequired ? active.accessPasswordHash ?? undefined : undefined,
        tenantId: organizationRequired ? session.tenantId : undefined,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = active.sourceFileName ?? documentId;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Protected file downloaded", {
        description: "The original file type now contains its encrypted DocShield passport.",
      });
    } catch (error) {
      toast.error("Download failed", {
        description: error instanceof Error ? error.message : "The secure link could not be opened.",
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/app/documents" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        All documents
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Download signed document</h1>
        <p className="text-sm text-muted-foreground">
          Download the original PDF or DOCX with its encrypted verification passport embedded inside.
        </p>
      </header>

      {active?.shareLink ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ready to download</CardTitle>
            <CardDescription>
              {active.sourceFileName ?? documentId} · {formatFileSize(active.sourceFileSize ?? 0)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Document ID" value={active.documentId} />
              <InfoRow label="Fingerprint" value={active.contentFingerprint} />
              <InfoRow label="Manifest hash" value={active.manifestHash} />
              <InfoRow label="History events" value={`${active.history.length}`} />
            </div>

            {passwordRequired && !unlocked ? (
              <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Lock className="h-4 w-4" />
                  Password required
                </div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter the access password"
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void unlock()}>
                    <ShieldCheck className="mr-1.5 h-4 w-4" />
                    Unlock download
                  </Button>
                </div>
              </div>
            ) : organizationRequired && !unlocked ? (
              <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4" />
                  Organization sign-in required
                </div>
                <p className="text-sm text-muted-foreground">
                  Sign into {active.signedManifest.manifest.tenant_id} to open this file.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void unlock()}>
                    <ShieldCheck className="mr-1.5 h-4 w-4" />
                    Check organization access
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                {anyoneWithLink
                  ? "Anyone with the link can open this download."
                  : "The file contains an encrypted signed manifest and signing history."}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleDownload()} disabled={downloading || (!anyoneWithLink && !unlocked)}>
                <Download className="mr-1.5 h-4 w-4" />
                {downloading ? "Downloading…" : `Download ${active.sourceFileName ?? "protected file"}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No secure file in session</CardTitle>
            <CardDescription>
              Upload and sign a PDF or DOCX first. Its secure link will be generated automatically.
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
