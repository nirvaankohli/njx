import { useState } from "react";
import { api, type VerifyResult } from "@/lib/docshield-api";
import { mockVerify } from "@/lib/docshield-mock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

export default function VerifyPage() {
  const [docId, setDocId] = useState("doc_7f92ab31");
  const [fp, setFp] = useState("sha256:4b9a…e21f");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.verify({ document_id: docId, content_fingerprint: fp });
      setResult(r);
    } catch {
      setResult(mockVerify(docId, fp));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Verify</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send a document ID and locally-computed fingerprint to <code>POST /verify</code>.
        </p>
      </header>

      <form onSubmit={submit} className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="space-y-2">
          <Label>Document ID</Label>
          <Input value={docId} onChange={(e) => setDocId(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Content fingerprint (computed inside your environment)</Label>
          <Input value={fp} onChange={(e) => setFp(e.target.value)} required />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>{loading ? "Verifying…" : "Verify"}</Button>
        </div>
      </form>

      {result && <VerifyResultCard result={result} />}
    </div>
  );
}

function VerifyResultCard({ result }: { result: VerifyResult }) {
  const Icon = result.revoked ? ShieldX : result.tampered ? ShieldAlert : result.authentic ? ShieldCheck : ShieldAlert;
  const tone = result.revoked
    ? "text-destructive"
    : result.tampered
    ? "text-warning"
    : result.authentic
    ? "text-success"
    : "text-muted-foreground";
  const headline = result.revoked
    ? "Revoked"
    : result.tampered
    ? "Tampered"
    : result.authentic
    ? "Authentic"
    : "Unknown";

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Icon className={`h-6 w-6 ${tone}`} />
        <div>
          <div className={`text-lg font-semibold ${tone}`}>{headline}</div>
          <div className="text-xs text-muted-foreground font-mono">{result.document_id}</div>
        </div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Reason codes</div>
        <div className="flex flex-wrap gap-2">
          {result.reason_codes.map((c) => (
            <Badge key={c} variant="secondary" className="font-mono text-[10px]">{c}</Badge>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Enforced policy</div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">external_ai: {result.policy.external_ai_upload}</Badge>
          <Badge variant="outline">secure_link: {String(result.policy.secure_link_required)}</Badge>
          <Badge variant="outline">forwarding: {result.policy.forwarding}</Badge>
          <Badge variant="outline">public_sharing: {result.policy.public_sharing}</Badge>
        </div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Embedded AI tags</div>
        <div className="flex flex-wrap gap-2">
          {result.embedded_ai_tags.map((t) => (
            <Badge key={t} className="font-mono text-[10px]">{t}</Badge>
          ))}
          {result.embedded_ai_tags.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
        </div>
      </div>
    </div>
  );
}
