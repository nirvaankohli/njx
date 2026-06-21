import { useState } from "react";
import { FileCheck2, Loader2, ShieldAlert, ShieldCheck, ShieldX, UploadCloud } from "lucide-react";
import { api, type VerifyResult } from "@/lib/docshield-api";
import { humanizeDocShieldLabel } from "@/lib/docshield-labels";
import { getDocShieldSession } from "@/lib/docshield-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { sha256Hex } from "@/lib/docshield-signing";

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

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="space-y-2">
        <Badge variant="secondary" className="gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          Ed25519 authenticity check
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight">Verify a document</h1>
        <p className="text-sm text-muted-foreground">
          Select a file to confirm that its exact contents match a document signed by a trusted issuer key.
        </p>
      </header>

      <Alert>
        <FileCheck2 className="h-4 w-4" />
        <AlertTitle>Your file stays private</AlertTitle>
        <AlertDescription>
          DocShield streams the file to calculate its SHA-256 fingerprint. It does not store the uploaded bytes.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upload the document</CardTitle>
            <CardDescription>Choose the file whose authenticity you want to check.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={verifyUploadedFile} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="verification-file">Document file</Label>
                <Input
                  id="verification-file"
                  type="file"
                  onChange={(event) => {
                    setSelectedFile(event.target.files?.[0] ?? null);
                    setUploadedFingerprint(null);
                    setResult(null);
                  }}
                />
              </div>
              {selectedFile && (
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-3">
                    <FileCheck2 className="h-5 w-5 text-primary" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{selectedFile.name}</div>
                      <div className="text-xs text-muted-foreground">{formatBytes(selectedFile.size)}</div>
                    </div>
                  </div>
                </div>
              )}
              <Button type="submit" disabled={loading || !selectedFile} className="w-full">
                {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {!loading && <UploadCloud className="mr-1.5 h-4 w-4" />}
                {loading ? "Checking signatures…" : "Upload and verify"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What DocShield checks</CardTitle>
            <CardDescription>The uploaded file is compared with the trusted registry.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Tenant" value={session.tenantName} />
            <Row label="File fingerprint" value={uploadedFingerprint ?? "Calculated after upload"} mono />
            <Row label="Registered document" value={result?.document_id ?? "Pending verification"} mono />
            <Row label="Issuer key" value={result?.issuer_key_id ?? "Pending verification"} mono />
            <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
              The backend validates the exact SHA-256 fingerprint, Ed25519 manifest signature, issuer key status, and every
              signature in the document history chain.
            </div>
          </CardContent>
        </Card>
      </div>

      {result && <VerifyResultCard result={result} />}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function VerifyResultCard({ result }: { result: VerifyResult }) {
  const Icon = result.revoked ? ShieldX : result.status === "valid" ? ShieldCheck : ShieldAlert;
  const tone =
    result.revoked || result.status === "tampered"
      ? "text-destructive"
      : result.status === "valid"
        ? "text-emerald-500"
        : "text-muted-foreground";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${tone}`} />
          {result.status.replace("_", " ")}
        </CardTitle>
        <CardDescription>{result.document_id}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ResultBadge label="Fingerprint match" value={result.fingerprint_match} />
          <ResultBadge label="Manifest signature" value={result.manifest_signature_valid} />
          <ResultBadge label="History chain" value={result.signature_chain_valid} />
          <ResultBadge label="Revoked" value={result.revoked} />
        </div>

        <div>
          <div className="mb-2 text-xs tracking-[0.16em] text-muted-foreground">Policy decision</div>
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{result.policy_decision.operation}</div>
                <div className="text-xs text-muted-foreground">
                  {result.policy_decision.allowed ? "Allowed" : "Blocked"}
                </div>
              </div>
              <Badge variant={result.policy_decision.allowed ? "default" : "destructive"}>
                {result.policy_decision.reason ?? "No reason"}
              </Badge>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs tracking-[0.16em] text-muted-foreground">Reasons</div>
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
  );
}

function ResultBadge({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="text-xs tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm font-medium ${value ? "text-emerald-500" : "text-destructive"}`}>
        {value ? "Pass" : "Fail"}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xs text-foreground ${mono ? "break-all font-mono" : ""}`}>{value}</div>
    </div>
  );
}
