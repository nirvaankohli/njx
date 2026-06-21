import { useEffect, useState } from "react";
import { AlertCircle, BadgeCheck, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/docshield-api";
import type { PolicyTemplate } from "@/lib/docshield-api";
import { ensureDevSigningIdentity } from "@/lib/docshield-signing";
import { getDocShieldSession, updateDocShieldSession } from "@/lib/docshield-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";

type PolicyDraft = {
  policy_id: string;
  name: string;
  policy: PolicyTemplate;
};

type PresetId = "strict" | "balanced" | "open";

const POLICY_PRESETS: Array<{
  id: PresetId;
  label: string;
  description: string;
  policy: PolicyTemplate;
}> = [
  {
    id: "strict",
    label: "Strict",
    description: "Block external AI, forwarding, and public sharing.",
    policy: {
      external_ai_upload: "blocked",
      secure_link_required: true,
      forwarding: "blocked",
      public_sharing: "blocked",
    },
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Keep AI blocked, allow secure collaboration.",
    policy: {
      external_ai_upload: "blocked",
      secure_link_required: true,
      forwarding: "allowed",
      public_sharing: "blocked",
    },
  },
  {
    id: "open",
    label: "Open",
    description: "Allow flexible sharing for low-risk content.",
    policy: {
      external_ai_upload: "allowed",
      secure_link_required: false,
      forwarding: "allowed",
      public_sharing: "allowed",
    },
  },
];

const DEFAULT_POLICY: PolicyDraft = {
  policy_id: "no_external_ai",
  name: "No external AI",
  policy: POLICY_PRESETS[0].policy,
};

function clonePolicyTemplate(policy: PolicyDraft, existingPolicies: PolicyDraft[]) {
  const baseId = `${policy.policy_id || "policy"}-copy`;
  const existingIds = new Set(existingPolicies.map((item) => item.policy_id.toLowerCase().trim()));
  let nextId = baseId;
  let suffix = 2;

  while (existingIds.has(nextId.toLowerCase().trim())) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return {
    policy_id: nextId,
    name: `${policy.name || "Policy"} copy`,
    policy: { ...policy.policy },
  };
}

function createPolicyTemplate(existingPolicies: PolicyDraft[]) {
  const existingIds = new Set(existingPolicies.map((item) => item.policy_id.toLowerCase().trim()));
  let suffix = existingPolicies.length + 1;
  let policyId = `policy_${suffix}`;

  while (existingIds.has(policyId.toLowerCase().trim())) {
    suffix += 1;
    policyId = `policy_${suffix}`;
  }

  return {
    policy_id: policyId,
    name: `Policy ${suffix}`,
    policy: {
      external_ai_upload: "blocked",
      secure_link_required: true,
      forwarding: "blocked",
      public_sharing: "blocked",
    } satisfies PolicyTemplate,
  };
}

function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePolicyId(value: string) {
  return value.trim();
}

function getPresetId(policy: PolicyTemplate): PresetId | "custom" {
  const preset = POLICY_PRESETS.find(
    (item) =>
      item.policy.external_ai_upload === policy.external_ai_upload &&
      item.policy.secure_link_required === policy.secure_link_required &&
      item.policy.forwarding === policy.forwarding &&
      item.policy.public_sharing === policy.public_sharing,
  );

  return preset ? preset.id : "custom";
}

function isDuplicatePolicyId(policies: PolicyDraft[]) {
  const ids = policies.map((item) => item.policy_id.trim().toLowerCase()).filter(Boolean);
  return new Set(ids).size !== ids.length;
}

function ChipEditor({
  label,
  description,
  placeholder,
  items,
  onAdd,
  onRemove,
  normalize,
  inputAriaLabel,
  addButtonLabel,
}: {
  label: string;
  description: string;
  placeholder: string;
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  normalize: (value: string) => string;
  inputAriaLabel: string;
  addButtonLabel: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const next = normalize(draft);
    if (!next) return;
    onAdd(next);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-[12px]">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
        {items.length === 0 ? (
          <span className="text-xs text-muted-foreground">No entries yet.</span>
        ) : (
          items.map((item) => (
            <Badge
              key={item}
              variant="outline"
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px]"
            >
              <span className="max-w-[16rem] truncate">{item}</span>
              <button
                type="button"
                onClick={() => onRemove(item)}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${item}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
          placeholder={placeholder}
          aria-label={inputAriaLabel}
          className="h-8 text-[13px]"
        />
        <Button type="button" size="sm" variant="outline" onClick={commit} className="h-8 shrink-0 gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {addButtonLabel}
        </Button>
      </div>
    </div>
  );
}

function PolicyControls({
  policy,
  onChange,
  onPreset,
  idPrefix,
}: {
  policy: PolicyTemplate;
  onChange: (patch: Partial<PolicyTemplate>) => void;
  onPreset: (presetId: PresetId) => void;
  idPrefix: string;
}) {
  const activePreset = getPresetId(policy);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[12px] font-medium">Policy posture</p>
            <p className="text-xs text-muted-foreground">Start with a preset, then fine tune the individual rules.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {POLICY_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                size="sm"
                variant={activePreset === preset.id ? "default" : "outline"}
                onClick={() => onPreset(preset.id)}
                className="h-7 gap-1.5 text-[12px]"
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
          <div>
            <p className="text-[13px] font-medium">External AI uploads</p>
            <p className="text-xs text-muted-foreground">Decide whether documents can leave the organization.</p>
          </div>
          <ToggleGroup
            type="single"
            value={policy.external_ai_upload}
            onValueChange={(value) => {
              if (!value) return;
              onChange({ external_ai_upload: value as PolicyTemplate["external_ai_upload"] });
            }}
            className="justify-end"
          >
            <ToggleGroupItem
              value="blocked"
              variant="outline"
              size="sm"
              className="h-7 px-3 text-[12px]"
              aria-label="External AI uploads blocked"
            >
              Blocked
            </ToggleGroupItem>
            <ToggleGroupItem
              value="allowed"
              variant="outline"
              size="sm"
              className="h-7 px-3 text-[12px]"
              aria-label="External AI uploads allowed"
            >
              Allowed
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
          <div>
            <p className="text-[13px] font-medium">Secure link required</p>
            <p className="text-xs text-muted-foreground">Require a secure link before forwarding or opening.</p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor={`secure-link-required-${idPrefix}`} className="text-[12px] text-muted-foreground">
              {policy.secure_link_required ? "Required" : "Optional"}
            </Label>
            <Switch
              id={`secure-link-required-${idPrefix}`}
              checked={policy.secure_link_required}
              onCheckedChange={(checked) => onChange({ secure_link_required: checked })}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
          <div>
            <p className="text-[13px] font-medium">Forwarding</p>
            <p className="text-xs text-muted-foreground">Allow or block downstream forwarding.</p>
          </div>
          <ToggleGroup
            type="single"
            value={policy.forwarding}
            onValueChange={(value) => {
              if (!value) return;
              onChange({ forwarding: value as PolicyTemplate["forwarding"] });
            }}
            className="justify-end"
          >
            <ToggleGroupItem
              value="blocked"
              variant="outline"
              size="sm"
              className="h-7 px-3 text-[12px]"
              aria-label="Forwarding blocked"
            >
              Blocked
            </ToggleGroupItem>
            <ToggleGroupItem
              value="allowed"
              variant="outline"
              size="sm"
              className="h-7 px-3 text-[12px]"
              aria-label="Forwarding allowed"
            >
              Allowed
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
          <div>
            <p className="text-[13px] font-medium">Public sharing</p>
            <p className="text-xs text-muted-foreground">Control whether links can be opened outside the org.</p>
          </div>
          <ToggleGroup
            type="single"
            value={policy.public_sharing}
            onValueChange={(value) => {
              if (!value) return;
              onChange({ public_sharing: value as PolicyTemplate["public_sharing"] });
            }}
            className="justify-end"
          >
            <ToggleGroupItem
              value="blocked"
              variant="outline"
              size="sm"
              className="h-7 px-3 text-[12px]"
              aria-label="Public sharing blocked"
            >
              Blocked
            </ToggleGroupItem>
            <ToggleGroupItem
              value="allowed"
              variant="outline"
              size="sm"
              className="h-7 px-3 text-[12px]"
              aria-label="Public sharing allowed"
            >
              Allowed
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
    </div>
  );
}

export default function SetupPage() {
  const session = getDocShieldSession();
  const [tenantId, setTenantId] = useState(session.tenantId);
  const [tenantName, setTenantName] = useState(session.tenantName);
  const [domains, setDomains] = useState(session.domains);
  const [adminEmails, setAdminEmails] = useState(session.adminEmails);
  const [policyTemplates, setPolicyTemplates] = useState<PolicyDraft[]>([DEFAULT_POLICY]);
  const [publicKeyId, setPublicKeyId] = useState(session.issuerKeyId);
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "ready" | "saved">("idle");

  useEffect(() => {
    ensureDevSigningIdentity()
      .then(({ keyId, publicKeyB64 }) => {
        setPublicKeyId(keyId);
        setPublicKey(publicKeyB64);
        updateDocShieldSession({ issuerKeyId: keyId });
        setStatus("ready");
      })
      .catch((err) => {
        toast.error("Could not create signing key", {
          description: err instanceof Error ? err.message : "Ed25519 is not available in this browser.",
        });
      });
  }, []);

  const handleAddDomain = (value: string) => {
    const next = normalizeDomain(value);
    if (!next) return;
    setDomains((current) => (current.includes(next) ? current : [...current, next]));
  };

  const handleRemoveDomain = (value: string) => {
    setDomains((current) => current.filter((item) => item !== value));
  };

  const handleAddEmail = (value: string) => {
    const next = normalizeEmail(value);
    if (!next) return;
    setAdminEmails((current) => (current.includes(next) ? current : [...current, next]));
  };

  const handleRemoveEmail = (value: string) => {
    setAdminEmails((current) => current.filter((item) => item !== value));
  };

  const updatePolicy = (index: number, patch: Partial<PolicyDraft>) => {
    setPolicyTemplates((current) =>
      current.map((item, position) => (position === index ? { ...item, ...patch } : item)),
    );
  };

  const applyPolicyPreset = (index: number, presetId: PresetId) => {
    const preset = POLICY_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    updatePolicy(index, { policy: { ...preset.policy } });
  };

  const addPolicy = () => {
    setPolicyTemplates((current) => [...current, createPolicyTemplate(current)]);
  };

  const duplicatePolicy = (index: number) => {
    setPolicyTemplates((current) => {
      const copy = clonePolicyTemplate(current[index], current);
      const next = [...current];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const removePolicy = (index: number) => {
    setPolicyTemplates((current) => (current.length === 1 ? current : current.filter((_, position) => position !== index)));
  };

  const copyPublicKey = async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey);
      toast.success("Public key copied");
    } catch {
      toast.error("Could not copy public key");
    }
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const nextTenantId = tenantId.trim();
    const nextTenantName = tenantName.trim();

    if (!nextTenantId || !nextTenantName) {
      toast.error("Fill in the organization details first");
      return;
    }

    const normalizedPolicyIds = policyTemplates.map((item) => normalizePolicyId(item.policy_id).toLowerCase());
    if (normalizedPolicyIds.some((value) => !value)) {
      toast.error("Every policy template needs an ID");
      return;
    }

    if (isDuplicatePolicyId(policyTemplates)) {
      toast.error("Duplicate policy IDs are not allowed");
      return;
    }

    if (!publicKey) {
      toast.error("Signing key is not ready yet");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        tenant: {
          tenant_id: nextTenantId,
          org_name: nextTenantName,
          domains,
          admin_emails: adminEmails,
          status: "active" as const,
        },
        policy_templates: policyTemplates.map((item) => ({
          policy_id: normalizePolicyId(item.policy_id),
          name: item.name.trim(),
          policy: item.policy,
        })),
        public_keys: [
          {
            key_id: publicKeyId,
            algorithm: "Ed25519" as const,
            public_key_b64: publicKey,
            status: "active" as const,
          },
        ],
      };

      const response = await api.setup(payload);
      updateDocShieldSession({
        tenantId: nextTenantId,
        tenantName: nextTenantName,
        adminEmails,
        domains,
        issuerKeyId: publicKeyId,
      });
      setStatus("saved");
      toast.success("Tenant configured", {
        description: `${response.registered_policy_templates} policy template(s) and ${response.registered_public_keys} public key(s) saved.`,
      });
    } catch (err) {
      toast.error("Setup failed", { description: err instanceof Error ? err.message : "Post /setup not reachable" });
    } finally {
      setBusy(false);
    }
  }

  const policyCount = policyTemplates.length;

  return (
    <form onSubmit={submit} className="space-y-6 max-w-6xl">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Organization setup</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization details</CardTitle>
              <CardDescription>Keep the setup fields close to the words your team already uses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tenant-id">Tenant ID</Label>
                  <Input
                    id="tenant-id"
                    value={tenantId}
                    onChange={(event) => setTenantId(event.target.value)}
                    required
                    className="h-8 text-[13px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization-name">Organization name</Label>
                  <Input
                    id="organization-name"
                    value={tenantName}
                    onChange={(event) => setTenantName(event.target.value)}
                    required
                    className="h-8 text-[13px]"
                  />
                </div>
              </div>

              <ChipEditor
                label="Domains"
                description="Used to recognize internal traffic and organization-bound access."
                placeholder="acme.com"
                items={domains}
                onAdd={handleAddDomain}
                onRemove={handleRemoveDomain}
                normalize={normalizeDomain}
                inputAriaLabel="Add domain"
                addButtonLabel="Add domain"
              />

              <ChipEditor
                label="Employee emails"
                description="Comma-free, one chip per address, so the list stays easy to scan."
                placeholder="alice@acme.com"
                items={adminEmails}
                onAdd={handleAddEmail}
                onRemove={handleRemoveEmail}
                normalize={normalizeEmail}
                inputAriaLabel="Add employee email"
                addButtonLabel="Add email"
              />

              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-md border border-border bg-background p-2">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[13px] font-medium">Signing key</p>
                    <p className="text-xs text-muted-foreground">
                      The key pair is created locally for dev, then reused by setup, document upload, and verification.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="issuer-key-id">Issuer key ID</Label>
                    <Input
                      id="issuer-key-id"
                      value={publicKeyId}
                      onChange={(event) => setPublicKeyId(event.target.value)}
                      className="h-8 text-[13px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="public-key">Public key</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={copyPublicKey}
                        disabled={!publicKey}
                        className="h-7 gap-1.5 px-2 text-[12px]"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </Button>
                    </div>
                    <Input
                      id="public-key"
                      value={publicKey}
                      readOnly
                      className="h-8 font-mono text-[12px]"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1">
                <CardTitle>Policy templates</CardTitle>
                <CardDescription>
                  Build the document rules with presets, toggles, and direct actions on each template.
                </CardDescription>
              </div>
              <Button type="button" onClick={addPolicy} size="sm" className="h-8 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add template
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {policyTemplates.map((template, index) => (
                <div key={`${template.policy_id}-${index}`} className="space-y-4 rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`policy-id-${index}`}>Policy ID</Label>
                          <Input
                            id={`policy-id-${index}`}
                            value={template.policy_id}
                            onChange={(event) =>
                              updatePolicy(index, { policy_id: normalizePolicyId(event.target.value) })
                            }
                            className="h-8 text-[13px]"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`policy-name-${index}`}>Name</Label>
                          <Input
                            id={`policy-name-${index}`}
                            value={template.name}
                            onChange={(event) => updatePolicy(index, { name: event.target.value })}
                            className="h-8 text-[13px]"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getPresetId(template.policy) === "custom" ? "secondary" : "outline"}>
                          {getPresetId(template.policy) === "custom" ? "Custom posture" : `${template.name || "Policy"} posture`}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => duplicatePolicy(index)}
                        className="h-8 gap-1.5 text-[12px]"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Duplicate
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removePolicy(index)}
                        disabled={policyTemplates.length === 1}
                        className="h-8 gap-1.5 text-[12px] text-muted-foreground"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>

                  <PolicyControls
                    policy={template.policy}
                    onChange={(patch) => updatePolicy(index, { policy: { ...template.policy, ...patch } })}
                    onPreset={(presetId) => applyPolicyPreset(index, presetId)}
                    idPrefix={`${index}`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Current organization</CardTitle>
            <CardDescription>Live preview of what the rest of the DocShield flow will reuse.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="text-xs tracking-[0.16em] text-muted-foreground">Tenant</div>
                <div className="mt-1 text-sm font-medium">{tenantName || "Unnamed organization"}</div>
                <div className="mt-1 text-xs text-muted-foreground">{tenantId || "No tenant ID yet"}</div>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="text-xs tracking-[0.16em] text-muted-foreground">Signing</div>
                <div className="mt-1 text-sm font-medium">{publicKeyId || "No key ID yet"}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {status === "saved" ? "Saved" : status === "ready" ? "Ready" : "Waiting for key"}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs tracking-[0.16em] text-muted-foreground">Audience</div>
                  <div className="mt-1 text-sm font-medium">
                    {domains.length} domain{domains.length === 1 ? "" : "s"}, {adminEmails.length} email
                    {adminEmails.length === 1 ? "" : "s"}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-medium tracking-[0.08em]">
                  Live
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {domains.map((domain) => (
                  <Badge key={domain} variant="secondary" className="text-[10px]">
                    {domain}
                  </Badge>
                ))}
                {adminEmails.map((email) => (
                  <Badge key={email} variant="outline" className="text-[10px]">
                    {email}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs tracking-[0.16em] text-muted-foreground">Policy templates</div>
                  <div className="mt-1 text-sm font-medium">{policyCount} template{policyCount === 1 ? "" : "s"}</div>
                </div>
                <Badge variant={isDuplicatePolicyId(policyTemplates) ? "destructive" : "secondary"} className="text-[10px]">
                  {isDuplicatePolicyId(policyTemplates) ? "Needs attention" : "Healthy"}
                </Badge>
              </div>
              <div className="mt-3 space-y-2">
                {policyTemplates.map((template, index) => (
                  <div
                    key={`${template.policy_id || "policy"}-summary-${index}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{template.name || "Untitled policy"}</p>
                      <p className="truncate text-xs text-muted-foreground">{template.policy_id || "Missing ID"}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-medium tracking-[0.08em]">
                      {getPresetId(template.policy) === "custom" ? "Custom" : getPresetId(template.policy)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              Once this is saved, document upload and verify will reuse the organization, audience list, and signing
              key without any JSON editing.
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                The dev keypair is persisted locally so the next document registration can sign successfully.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy || !publicKey} className="gap-1.5">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save organization
        </Button>
      </div>
    </form>
  );
}
