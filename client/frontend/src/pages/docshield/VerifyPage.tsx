import { useEffect, useState } from "react";
import { FileCheck2, Loader2, ShieldAlert, ShieldCheck, ShieldX, UploadCloud } from "lucide-react";
import { api, type VerifyResult } from "@/lib/docshield-api";
import { sha256Hex } from "@/lib/docshield-signing";
import { getDocShieldSession } from "@/lib/docshield-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const OPERATIONS = [
  { value: "external_ai_upload", label: "external_ai_upload" },
  { value: "direct_share", label: "direct_share" },
  { value: "download", label: "download" },
];

export default function VerifyPage() {
  const session = getDocShieldSession();
  const activeDocumentId = session.activeDocument?.documentId ?? null;
  const activeDocumentFingerprint = session.activeDocument?.contentFingerprint ?? null;
  const [docId, setDocId] = useState(session.activeDocument?.documentId ?? "doc_7f92ab31");
  const [fp, setFp] = useState(session.activeDocument?.contentFingerprint ?? "sha256:4b9a…e21f");
  const [operation, setOperation] = useState("external_ai_upload");
  const [appName, setAppName] = useState("reference_ai_gateway");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFingerprint, setUploadedFingerprint] = useState<string | null>(null);

  // The persisted session is rebuilt on every render, so we track the active
  // document through stable scalar fields instead of the object reference.
  useEffect(() => {
    if (session.activeDocument) {
      setDocId(session.activeDocument.documentId);
      setFp(session.activeDocument.contentFingerprint);
    }
  }, [activeDocumentId, activeDocumentFingerprint]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session.activeDocument) {
      toast.error("Upload a document first", { description: "The verify page reuses the latest signed manifest and history." });
      return;
    }

    setLoading(true);
    try {
      const response = await api.verify({
        document_id: docId,
        signed_manifest: session.activeDocument.signedManifest,
        history: session.activeDocument.history,
        computed_content_fingerprint: fp,
        usage_context: {
          operation,
          app: appName,
        },
      });
      setResult(response);
    } catch (err) {
      setResult(null);
      toast.error("Verification failed", { description: err instanceof Error ? err.message : "POST /verify not reachable" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="space-y-2">
        <Badge variant="secondary" className="gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          Backend verify
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight">Verify</h1>
        <p className="text-sm text-muted-foreground">
          Uses the last uploaded signed manifest and history chain, then posts the exact verification DTO the backend expects.
        </p>
      </header>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Keep the active document in sync</AlertTitle>
        <AlertDescription>
          Upload a document first so this page can reuse its signed manifest, history, and manifest hash.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Verification request</CardTitle>
            <CardDescription>Minimal controls, but the payload still matches the backend contract.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label>Document ID</Label>
                <Input value={docId} onChange={(e) => setDocId(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Computed content fingerprint</Label>
                <Input value={fp} onChange={(e) => setFp(e.target.value)} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Usage context</Label>
                  <Select value={operation} onValueChange={setOperation}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATIONS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>App</Label>
                  <Input value={appName} onChange={(e) => setAppName(e.target.value)} />
                </div>
              </div>
              <Button type="submit" disabled={loading || !session.activeDocument} className="w-full">
                {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Verify document
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest signed document</CardTitle>
            <CardDescription>This is what gets sent as the nested manifest and history chain.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Tenant" value={session.tenantName} />
            <Row label="Document ID" value={session.activeDocument?.documentId ?? "None"} mono />
            <Row label="Manifest hash" value={session.activeDocument?.manifestHash ?? "None"} mono />
            <Row label="History tip" value={session.activeDocument?.historyTip ?? "None"} mono />
            <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
              The backend uses the stored signed manifest and history to validate the fingerprint and policy decision.
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
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Policy decision</div>
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
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Reasons</div>
          <div className="flex flex-wrap gap-2">
            {result.reasons.map((reason) => (
              <Badge key={reason} variant="outline" className="font-mono text-[10px]">
                {reason}
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
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm font-medium ${value ? "text-emerald-500" : "text-destructive"}`}>
        {value ? "Pass" : "Fail"}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</div>
    </div>
  );
}
