import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type VerifyResult } from "@/lib/docshield-api";
import { humanizeDocShieldLabel } from "@/lib/docshield-labels";
import { getDocShieldSession } from "@/lib/docshield-session";
import { FileCheck2, Loader2, ShieldAlert, ShieldCheck, ShieldX, UploadCloud } from "lucide-react";
import { sha256Hex } from "@/lib/docshield-signing";
import { toast } from "sonner";

export default function VerifyPage() {
  const session = getDocShieldSession();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFingerprint, setUploadedFingerprint] = useState<string | null>(null);

  async function verifyUploadedFile(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Choose a document to verify");
      return;
    }
    if (selectedFile.size > 25 * 1024 * 1024) {
      toast.error("File is too large", { description: "The verification limit is 25 MB." });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const bytes = await selectedFile.arrayBuffer();
      setUploadedFingerprint(await sha256Hex(bytes));
      setResult(await api.verifyFile(selectedFile));
    } catch (err) {
      setResult(null);
      toast.error("Verification failed", {
        description: err instanceof Error ? err.message : "The uploaded document could not be verified.",
      });
    } finally {
      setLoading(false);
    }
  }

  const tenantMatches = !!result?.tenant_id && result.tenant_id === session.tenantId;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">

          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Verify a document</h1>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            Upload a file to compare its fingerprint, manifest signature, and history chain. The result shows which
            tenant registered the file, so cross-tenant documents are easy to spot.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Current workspace</div>
          <div className="mt-1 text-sm font-medium">{session.tenantName}</div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">{session.tenantId}</div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Upload the document</CardTitle>
            <CardDescription>Drop a file or choose one from your device.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={verifyUploadedFile} className="space-y-5">
              <label
                htmlFor="verification-file"
                className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/35"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
                  <UploadCloud className="h-6 w-6 text-primary" />
                </div>
                <div className="mt-5 max-w-md space-y-2">
                  <div className="text-lg font-medium">Upload a file to verify</div>
                  <p className="text-sm text-muted-foreground">PDF or DOCX only, up to 25 MB.</p>
                </div>
              </label>
              <Input
                id="verification-file"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null);
                  setUploadedFingerprint(null);
                  setResult(null);
                }}
                disabled={loading}
              />

              {selectedFile && (
                <div className="rounded-2xl border border-border bg-background/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Selected file</div>
                      <div className="mt-1 truncate text-base font-medium">{selectedFile.name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{formatBytes(selectedFile.size)}</div>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <FileCheck2 className="h-3.5 w-3.5" />
                      Ready
                    </Badge>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  The backend checks the fingerprint, manifest signature, and history chain for the registered tenant.
                </p>
                <Button type="submit" disabled={loading || !selectedFile}>
                  {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  {!loading && <UploadCloud className="mr-1.5 h-4 w-4" />}
                  {loading ? "Checking signatures…" : "Upload and verify"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {result ? (
          <Card className="overflow-hidden">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <ResultToneBadge result={result} />
                <Badge variant={tenantMatches ? "secondary" : "outline"} className="text-[10px] font-medium tracking-[0.08em]">
                  {tenantMatches ? "Same tenant" : "Different tenant"}
                </Badge>
              </div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ResultIcon result={result} className={`h-5 w-5 ${resultToneClass(result)}`} />
                {formatStatus(result.status)}
              </CardTitle>
              <CardDescription>{result.document_id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow label="Source tenant" value={result.tenant_org_name ?? "Unknown tenant"} />
                <InfoRow label="Tenant ID" value={result.tenant_id ?? "Unavailable"} mono />
                <InfoRow label="Current workspace" value={session.tenantName} />
                <InfoRow
                  label="Workspace match"
                  value={tenantMatches ? "Matches current workspace" : "Different workspace"}
                />
                <InfoRow label="Uploaded fingerprint" value={uploadedFingerprint ?? "Calculated on verify"} mono />
                <InfoRow label="Issuer key" value={result.issuer_key_id ?? "Unavailable"} mono />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ResultBadge label="Fingerprint match" value={result.fingerprint_match} />
                <ResultBadge label="Manifest signature" value={result.manifest_signature_valid} />
                <ResultBadge label="History chain" value={result.signature_chain_valid} />
                <ResultBadge label="Revoked" value={result.revoked} />
              </div>

              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Policy decision</div>
                    <div className="mt-1 text-sm font-medium">{result.policy_decision.operation}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {result.policy_decision.allowed ? "Allowed" : "Blocked"}
                    </div>
                  </div>
                  <Badge variant={result.policy_decision.allowed ? "default" : "destructive"}>
                    {result.policy_decision.reason ?? "No reason"}
                  </Badge>
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Reasons</div>
                <div className="flex flex-wrap gap-2">
                  {result.reasons.map((reason) => (
                    <Badge key={reason} variant="outline" className="text-[10px] font-medium tracking-[0.08em]">
                      {humanizeDocShieldLabel(reason)}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden border-dashed">
            <CardContent className="flex min-h-full flex-col justify-center px-6 py-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted/20">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-4 space-y-2">
                <h2 className="text-base font-medium">Verification results will appear here</h2>
                <p className="max-w-md text-sm leading-6 text-muted-foreground">
                  Once a file is checked, we will show the source tenant, document ID, signature checks, and policy
                  decision in one place.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatStatus(status: VerifyResult["status"]) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resultToneClass(result: VerifyResult) {
  return result.revoked || result.status === "tampered"
    ? "text-destructive"
    : result.status === "valid"
      ? "text-emerald-500"
      : "text-muted-foreground";
}

function ResultIcon({ result, className }: { result: VerifyResult; className?: string }) {
  const Icon = result.revoked || result.status === "tampered" ? ShieldX : result.status === "valid" ? ShieldCheck : ShieldAlert;
  return <Icon className={className} />;
}

function ResultToneBadge({ result }: { result: VerifyResult }) {
  const tone =
    result.revoked || result.status === "tampered"
      ? "destructive"
      : result.status === "valid"
        ? "default"
        : "secondary";

  return <Badge variant={tone as "default" | "secondary" | "destructive"}>{formatStatus(result.status)}</Badge>;
}

function ResultBadge({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm font-medium ${value ? "text-emerald-500" : "text-destructive"}`}>
        {value ? "Pass" : "Fail"}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm text-foreground ${mono ? "break-all font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}
