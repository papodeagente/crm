/**
 * BusinessProfileManager — Manage WhatsApp Business Profile via Z-API
 * Includes: profile info, privacy settings, business hours, categories
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Save, Building2, Globe, Mail, MapPin, Clock, Eye, EyeOff, Shield } from "lucide-react";
import { toast } from "sonner";

interface BusinessProfileManagerProps {
  sessionId: string;
}

export default function BusinessProfileManager({ sessionId }: BusinessProfileManagerProps) {
  const [activeSection, setActiveSection] = useState<"profile" | "privacy">("profile");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([
          { key: "profile" as const, icon: Building2, label: "Perfil Comercial" },
          { key: "privacy" as const, icon: Shield, label: "Privacidade" },
        ]).map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === s.key ? "bg-wa-tint text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            <s.icon className="w-4 h-4" /> {s.label}
          </button>
        ))}
      </div>
      {activeSection === "profile" && <ProfileSection sessionId={sessionId} />}
      {activeSection === "privacy" && <PrivacySection sessionId={sessionId} />}
    </div>
  );
}

function ProfileSection({ sessionId }: { sessionId: string }) {
  const profileQ = trpc.whatsapp.getBusinessProfileInfo.useQuery({ sessionId }, { retry: 1 });
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [websites, setWebsites] = useState("");

  useEffect(() => {
    if (profileQ.data) {
      const d = profileQ.data as any;
      setAddress(d?.address || "");
      setEmail(d?.email || "");
      setDescription(d?.description || "");
      setWebsites((d?.websites || []).join(", "));
    }
  }, [profileQ.data]);

  const updateAddressMut = trpc.whatsapp.updateCompanyAddress.useMutation({
    onSuccess: () => toast.success("Endereço atualizado"),
    onError: (e) => toast.error(e.message || "Erro"),
  });
  const updateEmailMut = trpc.whatsapp.updateCompanyEmail.useMutation({
    onSuccess: () => toast.success("Email atualizado"),
    onError: (e) => toast.error(e.message || "Erro"),
  });
  const updateBioMut = trpc.whatsapp.updateCompanyBio.useMutation({
    onSuccess: () => toast.success("Descrição atualizada"),
    onError: (e) => toast.error(e.message || "Erro"),
  });
  const updateWebsitesMut = trpc.whatsapp.updateCompanyWebsites.useMutation({
    onSuccess: () => toast.success("Sites atualizados"),
    onError: (e) => toast.error(e.message || "Erro"),
  });

  if (profileQ.isLoading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando perfil...</div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Endereço</label>
          <div className="flex gap-2">
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Endereço da empresa"
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
            <button onClick={() => updateAddressMut.mutate({ sessionId, address })} disabled={updateAddressMut.isPending}
              className="px-3 py-2 bg-wa-tint text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50"><Save className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> Email</label>
          <div className="flex gap-2">
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@empresa.com" type="email"
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
            <button onClick={() => updateEmailMut.mutate({ sessionId, email })} disabled={updateEmailMut.isPending}
              className="px-3 py-2 bg-wa-tint text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50"><Save className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" /> Descrição</label>
          <div className="flex gap-2">
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Sobre a empresa" rows={3}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint resize-none" />
            <button onClick={() => updateBioMut.mutate({ sessionId, description })} disabled={updateBioMut.isPending}
              className="px-3 py-2 bg-wa-tint text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50 self-start"><Save className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" /> Sites (separados por vírgula)</label>
          <div className="flex gap-2">
            <input value={websites} onChange={e => setWebsites(e.target.value)} placeholder="https://site1.com, https://site2.com"
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
            <button onClick={() => updateWebsitesMut.mutate({ sessionId, websites: websites.split(",").map(w => w.trim()).filter(Boolean) })}
              disabled={updateWebsitesMut.isPending}
              className="px-3 py-2 bg-wa-tint text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50"><Save className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrivacySection({ sessionId }: { sessionId: string }) {
  const setPrivacyMut = trpc.whatsapp.setPrivacySetting.useMutation({
    onSuccess: () => toast.success("Privacidade atualizada"),
    onError: (e) => toast.error(e.message || "Erro"),
  });

  const settings = [
    { key: "last-seen", label: "Visto por último", icon: Clock, options: [{ v: "all", l: "Todos" }, { v: "contacts", l: "Contatos" }, { v: "none", l: "Ninguém" }] },
    { key: "photo-visualization", label: "Foto do perfil", icon: Eye, options: [{ v: "all", l: "Todos" }, { v: "contacts", l: "Contatos" }, { v: "none", l: "Ninguém" }] },
    { key: "description", label: "Recado", icon: Building2, options: [{ v: "all", l: "Todos" }, { v: "contacts", l: "Contatos" }, { v: "none", l: "Ninguém" }] },
    { key: "online", label: "Status online", icon: Eye, options: [{ v: "all", l: "Todos" }, { v: "match_last_seen", l: "Igual ao visto por último" }] },
    { key: "read-receipts", label: "Confirmação de leitura", icon: Eye, options: [{ v: "all", l: "Ativado" }, { v: "none", l: "Desativado" }] },
    { key: "group-add-permission", label: "Quem pode me adicionar em grupos", icon: Eye, options: [{ v: "all", l: "Todos" }, { v: "contacts", l: "Contatos" }, { v: "contacts_except", l: "Contatos exceto..." }] },
  ];

  return (
    <div className="space-y-3">
      {settings.map(s => (
        <div key={s.key} className="flex items-center justify-between p-3 rounded-lg border border-border">
          <div className="flex items-center gap-2">
            <s.icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{s.label}</span>
          </div>
          <div className="flex gap-1">
            {s.options.map(opt => (
              <button key={opt.v}
                onClick={() => setPrivacyMut.mutate({ sessionId, setting: s.key as any, value: opt.v })}
                disabled={setPrivacyMut.isPending}
                className="px-2 py-1 rounded text-xs bg-muted text-muted-foreground hover:bg-wa-tint hover:text-white transition-colors disabled:opacity-50">
                {opt.l}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
