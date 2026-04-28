import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Upload, X, Loader2, Image as ImageIcon, MessageCircle, Palette, FileText } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const MAX_LOGO_BYTES = 800 * 1024; // 800KB raw

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function BrandingSettings() {
  const branding = trpc.tenantBranding.get.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.tenantBranding.update.useMutation({
    onSuccess: () => {
      toast.success("Marca atualizada!");
      utils.tenantBranding.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#5A8A1F");
  const [accentColor, setAccentColor] = useState("#0A0A0A");
  const [fontFamily, setFontFamily] = useState("Inter");
  const [footerText, setFooterText] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [whatsappAutoPaid, setWhatsappAutoPaid] = useState(true);
  const [whatsappAutoOverdue, setWhatsappAutoOverdue] = useState(true);
  const [whatsappAutoFollowup, setWhatsappAutoFollowup] = useState(true);
  const [whatsappFollowupDays, setWhatsappFollowupDays] = useState(3);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (branding.data) {
      const d = branding.data as any;
      setName(d.name || "");
      setLogoUrl(d.logoUrl || null);
      setPrimaryColor(d.primaryColor || "#5A8A1F");
      setAccentColor(d.accentColor || "#0A0A0A");
      setFontFamily(d.fontFamily || "Inter");
      setFooterText(d.footerText || "");
      setAddress(d.address || "");
      setPhone(d.phone || "");
      setWebsite(d.website || "");
      setWhatsappAutoPaid(d.whatsappAutoPaid !== false);
      setWhatsappAutoOverdue(d.whatsappAutoOverdue !== false);
      setWhatsappAutoFollowup(d.whatsappAutoFollowup !== false);
      setWhatsappFollowupDays(typeof d.whatsappFollowupDays === "number" ? d.whatsappFollowupDays : 3);
    }
  }, [branding.data]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem (PNG, JPG ou SVG)"); return; }
    if (file.size > MAX_LOGO_BYTES) { toast.error("Imagem muito grande (máx 800KB)"); return; }
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setLogoUrl(dataUrl);
      toast.success("Logo carregada — clique em Salvar para aplicar.");
    } catch {
      toast.error("Falha ao ler arquivo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeLogo() {
    setLogoUrl(null);
  }

  function save() {
    update.mutate({
      name: name.trim() || undefined,
      logoUrl: logoUrl,
      primaryColor: primaryColor || undefined,
      accentColor: accentColor || undefined,
      fontFamily: fontFamily.trim() || undefined,
      footerText: footerText.trim() || null,
      address: address.trim() || null,
      phone: phone.trim() || null,
      website: website.trim() || null,
      whatsappAutoPaid,
      whatsappAutoOverdue,
      whatsappAutoFollowup,
      whatsappFollowupDays,
    });
  }

  return (
    <div className="p-5 lg:px-8 space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Building2 className="h-5 w-5" /> Marca da Clínica
        </h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Nome e logo aparecem nos PDFs de propostas e mensagens enviadas para o cliente.
        </p>
      </div>

      <Card className="border border-border/40 shadow-none rounded-xl">
        <div className="p-5 space-y-5">
          {/* Clinic name */}
          <div className="space-y-2">
            <Label htmlFor="clinic-name">Nome da clínica</Label>
            <Input
              id="clinic-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Clínica Bem Estar"
              maxLength={255}
            />
            <p className="text-[12px] text-muted-foreground">Aparece no cabeçalho dos PDFs.</p>
          </div>

          {/* Logo */}
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-start gap-4">
              <div className="h-24 w-24 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-center overflow-hidden shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleFile}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="gap-2"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {logoUrl ? "Trocar logo" : "Enviar logo"}
                  </Button>
                  {logoUrl && (
                    <Button variant="ghost" size="sm" onClick={removeLogo} className="gap-2 text-red-600 hover:text-red-700">
                      <X className="h-4 w-4" /> Remover
                    </Button>
                  )}
                </div>
                <p className="text-[12px] text-muted-foreground">PNG, JPG, SVG ou WEBP — até 800KB. Recomendado fundo transparente.</p>
              </div>
            </div>
          </div>

          {/* Cores e fonte (aplicado em propostas e link público) */}
          <div className="space-y-4 pt-4 border-t border-border/30">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4" style={{ color: primaryColor }} />
              <Label className="text-sm font-semibold">Identidade visual</Label>
            </div>
            <p className="text-[12px] text-muted-foreground">
              Aparece no PDF da proposta, no link público e nos comprovantes.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Cor primária</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-12 rounded border cursor-pointer"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#5A8A1F"
                    className="font-mono text-xs flex-1"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cor de acento</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-9 w-12 rounded border cursor-pointer"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    placeholder="#0A0A0A"
                    className="font-mono text-xs flex-1"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fonte (apenas no link público / PDF usa Helvetica)</Label>
              <Input
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                placeholder="Inter"
                className="text-sm"
              />
            </div>

            {/* Preview da identidade */}
            <div className="rounded-xl border p-4" style={{ borderColor: `${primaryColor}40` }}>
              <div className="h-1.5 -mx-4 -mt-4 mb-3" style={{ backgroundColor: primaryColor }} />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Preview</p>
              <p className="text-base font-bold mt-1" style={{ color: accentColor }}>{name || "Nome da empresa"}</p>
              <p className="text-sm mt-2">Total da proposta: <strong style={{ color: primaryColor }}>R$ 2.450,00</strong></p>
            </div>
          </div>

          {/* Dados de contato no PDF/link público */}
          <div className="space-y-3 pt-4 border-t border-border/30">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">Rodapé do PDF</Label>
            </div>
            <p className="text-[12px] text-muted-foreground">Aparece no rodapé das propostas e na página pública.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Endereço</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua X, 123 — Cidade/UF" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 11 ..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Website</Label>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="empresa.com.br" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Texto adicional</Label>
                <Input value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="CNPJ 00.000.000/0001-00" />
              </div>
            </div>
          </div>

          {/* WhatsApp automation */}
          <div className="space-y-3 pt-4 border-t border-border/30">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              <Label className="text-sm font-semibold">Automações WhatsApp</Label>
            </div>
            <p className="text-[12px] text-muted-foreground">
              Mensagens automáticas para o cliente. Requer sessão WhatsApp conectada.
            </p>

            <div className="space-y-3 rounded-lg border border-border/40 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="text-sm">Confirmar pagamento recebido</Label>
                  <p className="text-[12px] text-muted-foreground">
                    Quando o ASAAS confirmar pagamento, envia agradecimento automático.
                  </p>
                </div>
                <Switch checked={whatsappAutoPaid} onCheckedChange={setWhatsappAutoPaid} />
              </div>

              <div className="flex items-start justify-between gap-4 pt-3 border-t border-border/30">
                <div className="space-y-0.5">
                  <Label className="text-sm">Lembrete de pagamento atrasado</Label>
                  <p className="text-[12px] text-muted-foreground">
                    Quando o ASAAS marcar como atrasado, envia lembrete educado com link.
                  </p>
                </div>
                <Switch checked={whatsappAutoOverdue} onCheckedChange={setWhatsappAutoOverdue} />
              </div>

              <div className="flex items-start justify-between gap-4 pt-3 border-t border-border/30">
                <div className="space-y-0.5">
                  <Label className="text-sm">Follow-up de proposta sem resposta</Label>
                  <p className="text-[12px] text-muted-foreground">
                    Após N dias sem pagamento, envia mensagem de acompanhamento.
                  </p>
                </div>
                <Switch checked={whatsappAutoFollowup} onCheckedChange={setWhatsappAutoFollowup} />
              </div>

              {whatsappAutoFollowup && (
                <div className="flex items-center gap-3 pt-3 border-t border-border/30">
                  <Label htmlFor="followup-days" className="text-sm whitespace-nowrap">
                    Dias até o follow-up:
                  </Label>
                  <Input
                    id="followup-days"
                    type="number"
                    min={1}
                    max={30}
                    value={whatsappFollowupDays}
                    onChange={(e) => setWhatsappFollowupDays(Math.max(1, Math.min(30, Number(e.target.value) || 3)))}
                    className="w-20"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end pt-2 border-t border-border/30">
            <Button
              onClick={save}
              disabled={update.isPending}
              className="gap-2"
            >
              {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar alterações
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
