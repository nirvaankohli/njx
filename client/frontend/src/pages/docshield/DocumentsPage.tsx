import { useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, FileText, Loader2, ShieldCheck, Upload, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { api, type AiTag, type SignedHistoryEventPayload, type SignedManifestPayload } from "@/lib/docshield-api";
import {
  buildDocumentId,
  fingerprintDocumentFile,
  formatFileSize,
  inferDocumentMimeType,
  isSupportedDocumentFile,
} from "@/lib/docshield-file";
import {
  canonicalJsonString,
  getDevSigningIdentity,
  sha256Hex,
  signCanonicalPayload,
  toBackendIsoString,
} from "@/lib/docshield-signing";
import { getDocShieldSession, updateDocShieldSession } from "@/lib/docshield-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const ALL_TAGS: AiTag[] = ["NO_EXTERNAL_AI", "SECURE_LINK_ONLY", "NO_FORWARDING", "PUBLIC_SHARING_BLOCKED"];

type SignedDocumentSummary = {
  documentId: string;
  fileName: string;
  fingerprint: string;
};

export default function DocumentsPage() {
  const reducedMotion = useReducedMotion() ?? false;
  const session = getDocShieldSession();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [signedDocument, setSignedDocument] = useState<SignedDocumentSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [blockAi, setBlockAi] = useState(true);
  const [anyoneWithLink, setAnyoneWithLink] = useState(true);
  const [accessMethod, setAccessMethod] = useState<"password" | "organization">("password");
  const [accessPassword, setAccessPassword] = useState("");
  const [accessPasswordConfirm, setAccessPasswordConfirm] = useState("");
  const [tags, setTags] = useState<AiTag[]>(["NO_EXTERNAL_AI", "SECURE_LINK_ONLY"]);

  const privateAccessEnabled = !anyoneWithLink;

  function toggleTag(tag: AiTag) {
    setTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (file && !isSupportedDocumentFile(file)) {
      toast.error("Choose a PDF or DOCX file");
      event.target.value = "";
      return;
    }
    setSelectedFile(file);
    setSignedDocument(null);
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    setSignedDocument(null);
    setAccessPassword("");
    setAccessPasswordConfirm("");
  }

  function handleAnyoneWithLinkChange(value: boolean) {
    setAnyoneWithLink(value);
    if (value) {
      setAccessPassword("");
      setAccessPasswordConfirm("");
    }
  }

  async function signDocument() {
    if (!selectedFile) return;
    if (privateAccessEnabled && accessMethod === "password") {
      if (accessPassword.length < 8) {
        toast.error("Use an access password with at least 8 characters");
        return;
      }
      if (accessPassword !== accessPasswordConfirm) {
        toast.error("The access passwords do not match");
        return;
      }
    }

    setBusy(true);
    try {
      const identity = await getDevSigningIdentity();
      const fingerprint = await fingerprintDocumentFile(selectedFile);
      const createdAt = toBackendIsoString();
      const documentId = buildDocumentId(selectedFile.name, fingerprint);
      const accessPasswordHash =
        privateAccessEnabled && accessMethod === "password" ? await sha256Hex(accessPassword.trim()) : null;
      const manifest = {
        schema_version: "1.0",
        tenant_id: session.tenantId,
        document_id: documentId,
        issuer_key_id: identity.keyId,
        content_fingerprint: fingerprint,
        policy: {
          external_ai_upload: blockAi ? "blocked" : "allowed",
          secure_link_required: true,
          forwarding: privateAccessEnabled ? "blocked" : "allowed",
          public_sharing: anyoneWithLink ? "allowed" : "blocked",
        } as const,
        embedded_ai_tags: tags,
        created_at: createdAt,
      };
      const manifestHash = await sha256Hex(canonicalJsonString(manifest));
      const signedManifest: SignedManifestPayload = {
        manifest,
        manifest_signature: await signCanonicalPayload(manifest),
        signature_algorithm: "Ed25519",
      };
      const eventBody = {
        event_id: `evt_issued_${crypto.randomUUID()}`,
        document_id: documentId,
        event: "issued" as const,
        actor_org: session.tenantName,
        actor_key_id: identity.keyId,
        timestamp: createdAt,
        previous_event_hash: null,
        manifest_hash: manifestHash,
        payload: { file_name: selectedFile.name },
      };
      const issuedEvent: SignedHistoryEventPayload = {
        ...eventBody,
        signature: await signCanonicalPayload(eventBody),
      };

      await api.setup({
        tenant: {
          tenant_id: session.tenantId,
          org_name: session.tenantName,
          domains: session.domains,
          admin_emails: session.adminEmails,
        },
        policy_templates: [],
        public_keys: [{ key_id: identity.keyId, public_key_b64: identity.publicKeyB64 }],
      });
      const response = await api.registerDocument({ signed_manifest: signedManifest, initial_history: [issuedEvent] });

      updateDocShieldSession({
        issuerKeyId: identity.keyId,
        activeDocument: {
          documentId,
          contentFingerprint: fingerprint,
          manifestHash: response.manifest_hash,
          historyTip: response.history_tip,
          signedManifest,
          history: [issuedEvent],
          sourceFileName: selectedFile.name,
          sourceFileType: inferDocumentMimeType(selectedFile),
          sourceFileSize: selectedFile.size,
          accessAnyoneWithLink: anyoneWithLink,
          accessMethod: privateAccessEnabled ? accessMethod : null,
          accessPasswordHash,
        },
      });
      setSignedDocument({ documentId, fileName: selectedFile.name, fingerprint });
      toast.success("Document signed", { description: "Its hash and Ed25519 signature are registered." });
    } catch (error) {
      toast.error("Document signing failed", {
        description: error instanceof Error ? error.message : "The document could not be registered.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Badge variant="secondary" className="gap-1"><BadgeCheck className="h-3.5 w-3.5" />Organization signing</Badge>
        <h1 className="text-2xl font-semibold tracking-tight">Upload and sign a document</h1>
        <p className="text-sm text-muted-foreground">The file hash is signed by your organization and registered for later verification.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <ProcessStep number="1" title="Upload" description="Choose the original PDF or DOCX." />
        <ProcessStep number="2" title="Sign" description="Register its SHA-256 hash and signature." />
        <ProcessStep number="3" title="Share" description="Create a tracked secure link." />
      </div>

      <Card>
        <CardHeader><CardTitle>Document</CardTitle><CardDescription>PDF or DOCX, up to 25 MB.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <label htmlFor="doc-upload" className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-muted/20 p-8 text-center hover:border-primary/50">
            <Upload className="h-10 w-10 text-primary" />
            <span className="mt-4 text-lg font-medium">Choose a document</span>
            <span className="text-sm text-muted-foreground">Its exact bytes become the verifiable fingerprint.</span>
            <Input id="doc-upload" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={handleFileChange} />
          </label>

          {selectedFile && (
            <motion.div initial={reducedMotion ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3"><FileText className="h-5 w-5 text-primary" /><div className="min-w-0"><div className="truncate font-medium">{selectedFile.name}</div><div className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)} · {inferDocumentMimeType(selectedFile)}</div></div></div>
                <Button type="button" variant="ghost" size="icon" onClick={clearSelectedFile} aria-label="Remove selected file"><X className="h-4 w-4" /></Button>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <PolicyRow label="Block external AI tools" value={blockAi} onChange={setBlockAi} />
                  <PolicyRow label="Anyone with the secure link" value={anyoneWithLink} onChange={handleAnyoneWithLinkChange} />
                  <div className="flex flex-wrap gap-2">{ALL_TAGS.map((tag) => <label key={tag} className="flex items-center gap-2 rounded-md border px-3 py-2"><Checkbox checked={tags.includes(tag)} onCheckedChange={() => toggleTag(tag)} /><span className="font-mono text-xs">{tag}</span></label>)}</div>
                </div>
                <div className="space-y-3">
                  {!anyoneWithLink ? (
                    <>
                      <div className="grid grid-cols-2 gap-2"><AccessChoice label="Password" active={accessMethod === "password"} onClick={() => setAccessMethod("password")} /><AccessChoice label="Organization" active={accessMethod === "organization"} onClick={() => setAccessMethod("organization")} /></div>
                      {accessMethod === "password" && <><div><Label>Access password</Label><Input type="password" value={accessPassword} onChange={(event) => setAccessPassword(event.target.value)} /></div><div><Label>Confirm password</Label><Input type="password" value={accessPasswordConfirm} onChange={(event) => setAccessPasswordConfirm(event.target.value)} /></div></>}
                    </>
                  ) : <p className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">The random secure-link token is the access credential.</p>}
                </div>
              </div>
              <Button onClick={() => void signDocument()} disabled={busy} className="w-full sm:w-auto">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}{busy ? "Signing…" : "Sign document"}</Button>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {signedDocument && <Card className="border-emerald-500/30"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-500" />Signature registered</CardTitle><CardDescription>{signedDocument.fileName}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="rounded-xl border p-3 font-mono text-xs break-all">{signedDocument.fingerprint}</div><Button asChild><Link to={`/app/documents/${signedDocument.documentId}`}>Continue to secure sharing</Link></Button></CardContent></Card>}
    </div>
  );
}

function ProcessStep({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="rounded-xl border bg-muted/20 p-4"><Badge variant="outline">{number}</Badge><div className="mt-3 font-medium">{title}</div><div className="text-xs text-muted-foreground">{description}</div></div>;
}

function PolicyRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between rounded-xl border p-3"><Label>{label}</Label><Switch checked={value} onCheckedChange={onChange} /></div>;
}

function AccessChoice({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-xl border p-3 text-left text-sm ${active ? "border-primary bg-primary/10" : "border-border"}`}>{label}</button>;
}
