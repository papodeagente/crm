import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (branding.data) {
      setName(branding.data.name || "");
      setLogoUrl(branding.data.logoUrl || null);
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
