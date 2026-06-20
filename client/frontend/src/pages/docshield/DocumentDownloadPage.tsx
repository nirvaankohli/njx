import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, Download, FileSignature, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFileSize } from "@/lib/docshield-file";
import { getDocShieldSession } from "@/lib/docshield-session";

export default function DocumentDownloadPage() {
  const session = getDocShieldSession();
  const { id = "" } = useParams();
  const documentId = decodeURIComponent(id);
  const active = session.activeDocument?.documentId === documentId ? session.activeDocument : null;

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
          }
        : null,
    [active, documentId],
  );

  function handleDownload() {
    if (!active || !packagePayload) return;
    const sourceName = active.sourceFileName ?? documentId;
    const downloadName = `${sourceName.replace(/\.[^.]+$/, "")}.docshield.json`;
    const blob = new Blob([JSON.stringify(packagePayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = downloadName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-6">
      <Link to="/app/documents" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        All documents
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Download className="h-3.5 w-3.5" />
            Download page
          </Badge>
          <Badge variant="outline" className="gap-1">
            <FileSignature className="h-3.5 w-3.5" />
            Signed package
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Download signed document</h1>
        <p className="text-sm text-muted-foreground">
          This page gives you the signed passport bundle, not the raw document. Use it to export the manifest, history,
          and source metadata in one file.
        </p>
      </header>

      {active && packagePayload ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ready to download</CardTitle>
            <CardDescription>
              {active.sourceFileName ?? documentId} · {formatFileSize(active.sourceFileSize ?? 0)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Document ID" value={active.documentId} mono />
              <InfoRow label="Fingerprint" value={active.contentFingerprint} mono />
              <InfoRow label="Manifest hash" value={active.manifestHash} mono />
              <InfoRow label="History events" value={`${active.history.length}`} />
            </div>
            <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              The download contains the signed manifest and the local signing history, so the user gets the passport
              bundle instead of the source document itself.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownload}>
                <Download className="mr-1.5 h-4 w-4" />
                Download signed package
              </Button>
            </div>
          </CardContent>
        </Card>
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

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm ${mono ? "break-all font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}
