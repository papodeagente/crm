import { trpc } from "@/lib/trpc";
import { useState, useCallback } from "react";
import { Building2, X, Check, ChevronsUpDown, Plus, ArrowLeft, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface AccountComboboxProps {
  value: number | null | undefined;
  onChange: (accountId: number | null) => void;
}

function formatCnpj(val: string) {
  const d = val.replace(/\D/g, "").substring(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.substring(0, 2)}.${d.substring(2)}`;
  if (d.length <= 8) return `${d.substring(0, 2)}.${d.substring(2, 5)}.${d.substring(5)}`;
  if (d.length <= 12) return `${d.substring(0, 2)}.${d.substring(2, 5)}.${d.substring(5, 8)}/${d.substring(8)}`;
  return `${d.substring(0, 2)}.${d.substring(2, 5)}.${d.substring(5, 8)}/${d.substring(8, 12)}-${d.substring(12)}`;
}

export default function AccountCombobox({ value, onChange }: AccountComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCnpj, setNewCnpj] = useState("");

  const utils = trpc.useUtils();
  const accountsQuery = trpc.crm.accounts.search.useQuery(
    { search: search || "" },
    { enabled: open && !creating, placeholderData: (prev: any) => prev },
  );
  const selectedAccount = trpc.crm.accounts.get.useQuery(
    { id: value! },
    { enabled: !!value },
  );
  const createMut = trpc.crm.accounts.create.useMutation({
    onSuccess: (result) => {
      utils.crm.accounts.list.invalidate();
      utils.crm.accounts.search.invalidate();
      toast.success("Empresa criada!");
      onChange((result as any)?.id);
      setCreating(false);
      setNewName("");
      setNewCnpj("");
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const accounts = accountsQuery.data || [];
  const selectedName = selectedAccount.data?.name;

  const handleCreate = useCallback(() => {
    if (!newName.trim()) { toast.error("Nome é obrigatório"); return; }
    (createMut.mutate as any)({ name: newName.trim(), cnpj: newCnpj || undefined });
  }, [newName, newCnpj, createMut]);

  const startCreating = useCallback(() => {
    setNewName(search);
    setNewCnpj("");
    setCreating(true);
  }, [search]);

  const cancelCreating = useCallback(() => {
    setCreating(false);
    setNewName("");
    setNewCnpj("");
  }, []);

  return (
    <div className="flex items-center gap-1.5">
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setCreating(false); setSearch(""); } }}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between h-9 text-sm font-normal">
            {value && selectedName ? (
              <span className="flex items-center gap-1.5 truncate">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {selectedName}
              </span>
            ) : (
              <span className="text-muted-foreground">Selecionar empresa...</span>
            )}
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          {creating ? (
            /* ── Inline create form ── */
            <div className="p-3 space-y-3">
              <button onClick={cancelCreating} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3" /> Voltar
              </button>
              <p className="text-sm font-semibold">Nova Empresa</p>
              <div>
                <label className="text-xs text-muted-foreground">Nome *</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome da empresa" className="h-8 text-sm mt-1" autoFocus />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">CNPJ</label>
                <Input value={newCnpj} onChange={(e) => setNewCnpj(formatCnpj(e.target.value))} placeholder="00.000.000/0000-00" className="h-8 text-sm mt-1" />
              </div>
              <Button size="sm" className="w-full h-8 text-xs" onClick={handleCreate} disabled={createMut.isPending}>
                {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                {createMut.isPending ? "Criando..." : "Criar Empresa"}
              </Button>
            </div>
          ) : (
            /* ── Search & select ── */
            <>
              <div className="p-2">
                <Input
                  placeholder="Buscar por nome ou CNPJ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 text-center">
                    {search ? "Nenhuma empresa encontrada" : "Digite para buscar"}
                  </p>
                ) : (
                  accounts.map((a: any) => (
                    <button
                      key={a.id}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                      onClick={() => { onChange(a.id); setOpen(false); setSearch(""); }}
                    >
                      <Check className={`h-3.5 w-3.5 shrink-0 ${a.id === value ? "opacity-100" : "opacity-0"}`} />
                      <div className="truncate">
                        <span className="font-medium">{a.name}</span>
                        {a.cnpj && <span className="text-muted-foreground ml-1.5 text-xs">{a.cnpj}</span>}
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="border-t p-1.5">
                <button
                  onClick={startCreating}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-accent rounded-md"
                >
                  <Plus className="h-3.5 w-3.5" /> Nova Empresa
                </button>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
      {value && (
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onChange(null)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
