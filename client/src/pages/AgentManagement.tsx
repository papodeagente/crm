import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { AdminOnlyGuard } from "@/components/AdminOnlyGuard";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  UserPlus,
  Shield,
  Settings,
  Search,
  Plus,
  Trash2,
  Edit3,
  ChevronLeft,
  MoreHorizontal,
  Zap,
  RefreshCw,
  UserCheck,
  UserX,
  Crown,
  Shuffle,
  Target,
  Hand,
  Clock,
  ToggleLeft,
  Star,
  ArrowUpDown,
  MessageSquare,

  Lock,
} from "lucide-react";
import { formatDateShort, formatDate } from "../../../shared/dateUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { useTenantId } from "@/hooks/useTenantId";


// ─── Types ───
type Tab = "agents" | "teams" | "rules";

interface Agent {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  status: string;
  role: string;
  lastLoginAt: number | null;
  createdAt: number;
  openAssignments: number;
  teams: { id: number; name: string; color: string }[];
}

interface TeamData {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  color: string | null;
  maxMembers: number | null;
  createdAt: any;
  updatedAt: any;
}

interface Rule {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  strategy: string;
  teamId: number | null;
  teamName: string | null;
  teamColor: string | null;
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  configJson: any;
  createdAt: number;
  updatedAt: number;
}

// ─── Strategy Labels ───
const strategyLabels: Record<string, { label: string; icon: any; description: string }> = {
  round_robin: { label: "Round Robin", icon: RefreshCw, description: "Distribui conversas igualmente entre agentes disponíveis, alternando a cada nova conversa." },
  least_busy: { label: "Menos Ocupado", icon: Target, description: "Atribui ao agente com menos conversas abertas no momento." },
  manual: { label: "Manual", icon: Hand, description: "Conversas não são atribuídas automaticamente. Um supervisor deve atribuir manualmente." },
  team_round_robin: { label: "Round Robin por Equipe", icon: Shuffle, description: "Distribui conversas entre membros de uma equipe específica, alternando a cada nova conversa." },
};

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: "Ativo", color: "bg-emerald-500" },
  inactive: { label: "Inativo", color: "bg-zinc-400" },
  invited: { label: "Convidado", color: "bg-amber-500" },
};

const TEAM_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316",
  "#eab308", "#84cc16", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#2563eb", "#1d4ed8",
];

// ─── Avatar Component ───
function AgentAvatar({ name, avatarUrl, size = 40 }: { name: string; avatarUrl?: string | null; size?: number }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-white shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.35,
        background: "linear-gradient(135deg, oklch(0.55 0.25 270), oklch(0.60 0.20 320))",
      }}
    >
      {initials}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB: AGENTS
// ════════════════════════════════════════════════════════════

function AgentsTab() {
  const TENANT_ID = useTenantId();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "user">("user");
  const utils = trpc.useUtils();

  // Current user info to check if admin
  const saasMe = trpc.saasAuth.me.useQuery(undefined, { retry: 1, refetchOnWindowFocus: false, refetchOnMount: false, staleTime: 5 * 60 * 1000 });
  const currentUserRole = saasMe.data?.role || "user";
  const currentUserId = saasMe.data?.userId;
  const isCurrentAdmin = currentUserRole === "admin";

  const { data: agents = [], isLoading } = trpc.teamManagement.listAgents.useQuery({ tenantId: TENANT_ID });

  const updateStatus = trpc.teamManagement.updateAgentStatus.useMutation({
    onSuccess: () => {
      utils.teamManagement.listAgents.invalidate();
      toast.success("Status do agente atualizado");
    },
    onError: (err) => toast.error(err.message || "Erro ao atualizar status"),
  });

  const updateRole = trpc.teamManagement.updateAgentRole.useMutation({
    onSuccess: () => {
      utils.teamManagement.listAgents.invalidate();
      toast.success("Permissão atualizada com sucesso");
    },
    onError: (err) => toast.error(err.message || "Erro ao atualizar permissão"),
  });

  const inviteAgent = trpc.teamManagement.inviteAgent.useMutation({
    onSuccess: () => {
      utils.teamManagement.listAgents.invalidate();
      setShowInvite(false);
      setInviteName("");
      setInviteEmail("");
      setInvitePhone("");
      setInviteRole("user");
      toast.success("Convite enviado com sucesso! O agente receberá um email com as credenciais.");
    },
    onError: (err) => toast.error(err.message || "Erro ao convidar agente"),
  });

  const filtered = useMemo(() => {
    let list = agents as Agent[];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      list = list.filter(a => a.status === statusFilter);
    }
    return list;
  }, [agents, search, statusFilter]);

  const counts = useMemo(() => ({
    total: (agents as Agent[]).length,
    active: (agents as Agent[]).filter(a => a.status === "active").length,
    inactive: (agents as Agent[]).filter(a => a.status === "inactive").length,
    invited: (agents as Agent[]).filter(a => a.status === "invited").length,
  }), [agents]);

  const roleLabels: Record<string, { label: string; color: string; bg: string }> = {
    admin: { label: "Administrador", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30" },
    user: { label: "Usuário", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.total, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Ativos", value: counts.active, icon: UserCheck, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Inativos", value: counts.inactive, icon: UserX, color: "text-zinc-400", bg: "bg-zinc-500/10" },
          { label: "Convidados", value: counts.invited, icon: UserPlus, color: "text-amber-400", bg: "bg-amber-500/10" },
        ].map(s => (
          <div key={s.label} className="surface p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Invite Button + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {isCurrentAdmin && (
          <Button
            onClick={() => setShowInvite(true)}
            className="gap-2 shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            Convidar Agente
          </Button>
        )}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar agente por nome ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="invited">Convidados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invite Agent Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center"><UserPlus className="h-4 w-4 text-primary" /></div>
              Convidar Agente
            </DialogTitle>
            <DialogDescription>O agente receberá um email com login e senha temporária.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-[12px] font-medium text-foreground">Nome *</label>
              <Input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Nome completo" className="mt-1.5" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-foreground">Email *</label>
              <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@exemplo.com" type="email" className="mt-1.5" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-foreground">Telefone</label>
              <Input value={invitePhone} onChange={e => setInvitePhone(e.target.value)} placeholder="(11) 99999-9999" className="mt-1.5" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-foreground">Permissão *</label>
              <Select value={inviteRole} onValueChange={v => setInviteRole(v as "admin" | "user")}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-blue-500" />
                      <span>Usuário</span>
                      <span className="text-[10px] text-muted-foreground ml-1">— Vê apenas seus dados</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Crown className="h-3.5 w-3.5 text-amber-500" />
                      <span>Administrador</span>
                      <span className="text-[10px] text-muted-foreground ml-1">— Acesso total</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancelar</Button>
            <Button
              disabled={!inviteName.trim() || !inviteEmail.trim() || inviteAgent.isPending}
              onClick={() => inviteAgent.mutate({
                tenantId: TENANT_ID,
                name: inviteName,
                email: inviteEmail,
                phone: invitePhone || undefined,
                role: inviteRole,
                origin: window.location.origin,
              })}
            >
              {inviteAgent.isPending ? "Enviando..." : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agent List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="surface p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-3 w-48 bg-muted rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface p-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum agente encontrado</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{isCurrentAdmin ? "Clique em \"Convidar Agente\" para adicionar membros" : "Solicite ao administrador para adicionar agentes"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(agent => {
            const st = statusLabels[agent.status] || statusLabels.inactive;
            const rl = roleLabels[agent.role] || roleLabels.user;
            const isSelf = agent.id === currentUserId;
            return (
              <div key={agent.id} className="surface p-4 hover:bg-accent/5 transition-colors">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="relative">
                    <AgentAvatar name={agent.name} avatarUrl={agent.avatarUrl} />
                    <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${st.color}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-semibold text-foreground truncate">{agent.name}</p>
                      {isSelf && <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-emerald-500/30 text-emerald-500">Você</Badge>}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{st.label}</Badge>
                      {/* Inline role selector for admins editing other users */}
                      {isCurrentAdmin && !isSelf ? (
                        <Select
                          value={agent.role || "user"}
                          onValueChange={(newRole) => updateRole.mutate({ tenantId: TENANT_ID, userId: agent.id, role: newRole as "admin" | "user" })}
                        >
                          <SelectTrigger className="h-6 w-[140px] rounded-full text-[10px] font-medium border-border/40 bg-transparent hover:bg-muted/30 transition-colors px-2 py-0 gap-1 [&>svg]:h-3 [&>svg]:w-3 [&>span]:flex [&>span]:items-center [&>span]:gap-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-1.5">
                                <Crown className="h-3 w-3 text-amber-500" />
                                <span className="font-medium">Administrador</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="user">
                              <div className="flex items-center gap-1.5">
                                <Shield className="h-3 w-3 text-blue-500" />
                                <span className="font-medium">Usuário</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : agent.role === "admin" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium border border-amber-500/30 bg-amber-500/10 text-amber-500">
                          <Crown className="h-3 w-3" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium border border-blue-500/30 bg-blue-500/10 text-blue-500">
                          <Shield className="h-3 w-3" /> Usuário
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-muted-foreground truncate">{agent.email}</p>
                    {agent.teams.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {agent.teams.map(t => (
                          <span
                            key={t.id}
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: t.color + "20", color: t.color }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="hidden sm:flex items-center gap-6 shrink-0">
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{agent.openAssignments}</p>
                      <p className="text-[10px] text-muted-foreground">Conversas</p>
                    </div>
                    {agent.lastLoginAt && (
                      <div className="text-center">
                        <p className="text-[12px] text-muted-foreground">
                          {formatDateShort(agent.lastLoginAt)}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60">Último login</p>
                      </div>
                    )}
                  </div>

                  {/* Actions - only for admins */}
                  {isCurrentAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {/* Role management */}
                        {!isSelf && (
                          <>
                            {agent.role !== "admin" && (
                              <DropdownMenuItem onClick={() => updateRole.mutate({ tenantId: TENANT_ID, userId: agent.id, role: "admin" })}>
                                <Crown className="h-4 w-4 mr-2 text-amber-500" /> Tornar Administrador
                              </DropdownMenuItem>
                            )}
                            {agent.role === "admin" && (
                              <DropdownMenuItem onClick={() => updateRole.mutate({ tenantId: TENANT_ID, userId: agent.id, role: "user" })}>
                                <Shield className="h-4 w-4 mr-2" /> Tornar Usuário
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {/* Status management */}
                        {agent.status !== "active" && (
                          <DropdownMenuItem onClick={() => updateStatus.mutate({ tenantId: TENANT_ID, userId: agent.id, status: "active" })}>
                            <UserCheck className="h-4 w-4 mr-2" /> Ativar
                          </DropdownMenuItem>
                        )}
                        {agent.status === "active" && !isSelf && (
                          <DropdownMenuItem onClick={() => updateStatus.mutate({ tenantId: TENANT_ID, userId: agent.id, status: "inactive" })}>
                            <UserX className="h-4 w-4 mr-2" /> Desativar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB: TEAMS
// ════════════════════════════════════════════════════════════

function TeamsTab() {
  const TENANT_ID = useTenantId();
  const [showCreate, setShowCreate] = useState(false);
  const [editTeam, setEditTeam] = useState<TeamData | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", description: "", color: "#6366f1" });
  const utils = trpc.useUtils();

  const { data: teamsList = [], isLoading } = trpc.teamManagement.listTeams.useQuery({ tenantId: TENANT_ID });
  const { data: agents = [] } = trpc.teamManagement.listAgents.useQuery({ tenantId: TENANT_ID });
  const { data: selectedTeam } = trpc.teamManagement.getTeam.useQuery(
    { tenantId: TENANT_ID, teamId: selectedTeamId! },
    { enabled: !!selectedTeamId }
  );

  const createTeamMut = trpc.teamManagement.createTeam.useMutation({
    onSuccess: () => {
      utils.teamManagement.listTeams.invalidate();
      setShowCreate(false);
      setNewTeam({ name: "", description: "", color: "#6366f1" });
      toast.success("Equipe criada com sucesso");
    },
    onError: () => toast.error("Erro ao criar equipe"),
  });

  const updateTeamMut = trpc.teamManagement.updateTeam.useMutation({
    onSuccess: () => {
      utils.teamManagement.listTeams.invalidate();
      if (selectedTeamId) utils.teamManagement.getTeam.invalidate({ tenantId: TENANT_ID, teamId: selectedTeamId });
      setEditTeam(null);
      toast.success("Equipe atualizada");
    },
    onError: () => toast.error("Erro ao atualizar equipe"),
  });

  const deleteTeamMut = trpc.teamManagement.deleteTeam.useMutation({
    onSuccess: () => {
      utils.teamManagement.listTeams.invalidate();
      setSelectedTeamId(null);
      toast.success("Equipe excluída");
    },
    onError: () => toast.error("Erro ao excluir equipe"),
  });

  const addMemberMut = trpc.teamManagement.addMember.useMutation({
    onSuccess: (data) => {
      if (data && "alreadyMember" in data) {
        toast.info("Este agente já é membro da equipe");
      } else {
        toast.success("Membro adicionado");
      }
      utils.teamManagement.getTeam.invalidate({ tenantId: TENANT_ID, teamId: selectedTeamId! });
      utils.teamManagement.listAgents.invalidate();
      setShowAddMember(false);
    },
    onError: () => toast.error("Erro ao adicionar membro"),
  });

  const removeMemberMut = trpc.teamManagement.removeMember.useMutation({
    onSuccess: () => {
      utils.teamManagement.getTeam.invalidate({ tenantId: TENANT_ID, teamId: selectedTeamId! });
      utils.teamManagement.listAgents.invalidate();
      toast.success("Membro removido");
    },
    onError: () => toast.error("Erro ao remover membro"),
  });

  const updateRoleMut = trpc.teamManagement.updateMemberRole.useMutation({
    onSuccess: () => {
      utils.teamManagement.getTeam.invalidate({ tenantId: TENANT_ID, teamId: selectedTeamId! });
      toast.success("Papel atualizado");
    },
    onError: () => toast.error("Erro ao atualizar papel"),
  });

  // Team detail view
  if (selectedTeamId && selectedTeam) {
    const team = selectedTeam as any;
    const members = team.members || [];
    const availableAgents = (agents as Agent[]).filter(a => !members.some((m: any) => m.userId === a.id));

    return (
      <div className="space-y-6">
        {/* Back + Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedTeamId(null)} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (team.color || "#6366f1") + "20" }}>
            <Users className="h-5 w-5" style={{ color: team.color || "#6366f1" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground">{team.name}</h3>
            {team.description && <p className="text-[12px] text-muted-foreground">{team.description}</p>}
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditTeam(team)}>
            <Edit3 className="h-3.5 w-3.5 mr-1.5" /> Editar
          </Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => {
            if (confirm("Tem certeza que deseja excluir esta equipe?")) {
              deleteTeamMut.mutate({ tenantId: TENANT_ID, id: selectedTeamId });
            }
          }}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
          </Button>
        </div>

        {/* Members */}
        <div className="flex items-center justify-between">
          <h4 className="text-[14px] font-semibold text-foreground">Membros ({members.length})</h4>
          <Button size="sm" onClick={() => setShowAddMember(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Adicionar Membro
          </Button>
        </div>

        {members.length === 0 ? (
          <div className="surface p-8 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Nenhum membro nesta equipe</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((m: any) => (
              <div key={m.userId} className="surface p-3 flex items-center gap-3">
                <AgentAvatar name={m.name} avatarUrl={m.avatarUrl} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-foreground truncate">{m.name}</p>
                    {m.role === "leader" && (
                      <Badge className="text-[9px] px-1 py-0 bg-amber-500/15 text-amber-500 border-amber-500/30">
                        <Crown className="h-2.5 w-2.5 mr-0.5" /> Líder
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {m.role === "member" ? (
                      <DropdownMenuItem onClick={() => updateRoleMut.mutate({ tenantId: TENANT_ID, teamId: selectedTeamId, userId: m.userId, role: "leader" })}>
                        <Crown className="h-4 w-4 mr-2" /> Promover a Líder
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => updateRoleMut.mutate({ tenantId: TENANT_ID, teamId: selectedTeamId, userId: m.userId, role: "member" })}>
                        <Users className="h-4 w-4 mr-2" /> Rebaixar a Membro
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => removeMemberMut.mutate({ tenantId: TENANT_ID, teamId: selectedTeamId, userId: m.userId })}>
                      <Trash2 className="h-4 w-4 mr-2" /> Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}

        {/* Add Member Dialog */}
        <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Membro</DialogTitle>
              <DialogDescription>Selecione um agente para adicionar à equipe</DialogDescription>
            </DialogHeader>
            {availableAgents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Todos os agentes já são membros desta equipe</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {availableAgents.map(a => (
                  <button
                    key={a.id}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent/10 transition-colors text-left"
                    onClick={() => addMemberMut.mutate({ tenantId: TENANT_ID, teamId: selectedTeamId, userId: a.id })}
                  >
                    <AgentAvatar name={a.name} avatarUrl={a.avatarUrl} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{a.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{a.email}</p>
                    </div>
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Team Dialog */}
        <Dialog open={!!editTeam} onOpenChange={() => setEditTeam(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Equipe</DialogTitle>
            </DialogHeader>
            {editTeam && (
              <div className="space-y-4">
                <div>
                  <label className="text-[12px] font-medium text-muted-foreground mb-1 block">Nome</label>
                  <Input value={editTeam.name} onChange={e => setEditTeam({ ...editTeam, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-muted-foreground mb-1 block">Descrição</label>
                  <Textarea value={editTeam.description || ""} onChange={e => setEditTeam({ ...editTeam, description: e.target.value })} rows={2} />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Cor</label>
                  <div className="flex flex-wrap gap-2">
                    {TEAM_COLORS.map(c => (
                      <button
                        key={c}
                        className={`h-7 w-7 rounded-full transition-all ${editTeam.color === c ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : "hover:scale-105"}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setEditTeam({ ...editTeam, color: c })}
                      />
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditTeam(null)}>Cancelar</Button>
                  <Button onClick={() => updateTeamMut.mutate({
                    tenantId: TENANT_ID,
                    id: editTeam.id,
                    name: editTeam.name,
                    description: editTeam.description || undefined,
                    color: editTeam.color || undefined,
                  })}>Salvar</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Teams list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">Equipes</h3>
          <p className="text-[12px] text-muted-foreground">Organize seus agentes em equipes para distribuição de conversas</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova Equipe
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2].map(i => (
            <div key={i} className="surface p-5 animate-pulse">
              <div className="h-5 w-32 bg-muted rounded mb-2" />
              <div className="h-3 w-48 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : (teamsList as TeamData[]).length === 0 ? (
        <div className="surface p-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma equipe criada</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Crie equipes para organizar seus agentes</p>
          <Button size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Criar Primeira Equipe
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(teamsList as TeamData[]).map(team => (
            <button
              key={team.id}
              className="surface p-5 text-left hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 group"
              onClick={() => setSelectedTeamId(team.id)}
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (team.color || "#6366f1") + "20" }}>
                  <Users className="h-5 w-5" style={{ color: team.color || "#6366f1" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-foreground group-hover:text-primary transition-colors">{team.name}</p>
                  {team.description && <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">{team.description}</p>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create Team Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Equipe</DialogTitle>
            <DialogDescription>Crie uma equipe para organizar seus agentes</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1 block">Nome *</label>
              <Input placeholder="Ex: Vendas, Suporte, Marketing..." value={newTeam.name} onChange={e => setNewTeam({ ...newTeam, name: e.target.value })} />
            </div>
            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1 block">Descrição</label>
              <Textarea placeholder="Descreva o objetivo desta equipe..." value={newTeam.description} onChange={e => setNewTeam({ ...newTeam, description: e.target.value })} rows={2} />
            </div>
            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Cor</label>
              <div className="flex flex-wrap gap-2">
                {TEAM_COLORS.map(c => (
                  <button
                    key={c}
                    className={`h-7 w-7 rounded-full transition-all ${newTeam.color === c ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewTeam({ ...newTeam, color: c })}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button disabled={!newTeam.name.trim()} onClick={() => createTeamMut.mutate({ tenantId: TENANT_ID, ...newTeam })}>
              Criar Equipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB: DISTRIBUTION RULES
// ════════════════════════════════════════════════════════════

function DistributionTab() {
  const TENANT_ID = useTenantId();
  const [showCreate, setShowCreate] = useState(false);
  const [editRule, setEditRule] = useState<Rule | null>(null);
  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    strategy: "round_robin" as string,
    teamId: null as number | null,
    isDefault: false,
    priority: 0,
    configJson: { maxOpenPerAgent: 10, businessHoursOnly: false } as any,
  });
  const utils = trpc.useUtils();

  const { data: rules = [], isLoading } = trpc.teamManagement.listRules.useQuery({ tenantId: TENANT_ID });
  const { data: teamsList = [] } = trpc.teamManagement.listTeams.useQuery({ tenantId: TENANT_ID });

  const createRuleMut = trpc.teamManagement.createRule.useMutation({
    onSuccess: () => {
      utils.teamManagement.listRules.invalidate();
      setShowCreate(false);
      setNewRule({ name: "", description: "", strategy: "round_robin", teamId: null, isDefault: false, priority: 0, configJson: { maxOpenPerAgent: 10, businessHoursOnly: false } });
      toast.success("Regra criada com sucesso");
    },
    onError: () => toast.error("Erro ao criar regra"),
  });

  const updateRuleMut = trpc.teamManagement.updateRule.useMutation({
    onSuccess: () => {
      utils.teamManagement.listRules.invalidate();
      setEditRule(null);
      toast.success("Regra atualizada");
    },
    onError: () => toast.error("Erro ao atualizar regra"),
  });

  const deleteRuleMut = trpc.teamManagement.deleteRule.useMutation({
    onSuccess: () => {
      utils.teamManagement.listRules.invalidate();
      toast.success("Regra excluída");
    },
    onError: () => toast.error("Erro ao excluir regra"),
  });

  const toggleRuleMut = trpc.teamManagement.toggleRule.useMutation({
    onSuccess: () => {
      utils.teamManagement.listRules.invalidate();
    },
    onError: () => toast.error("Erro ao alterar status da regra"),
  });

  function RuleForm({ data, onChange, teams }: { data: typeof newRule; onChange: (d: typeof newRule) => void; teams: TeamData[] }) {
    const strat = strategyLabels[data.strategy];
    return (
      <div className="space-y-4">
        <div>
          <label className="text-[12px] font-medium text-muted-foreground mb-1 block">Nome *</label>
          <Input placeholder="Ex: Distribuição Vendas, Suporte Noturno..." value={data.name} onChange={e => onChange({ ...data, name: e.target.value })} />
        </div>
        <div>
          <label className="text-[12px] font-medium text-muted-foreground mb-1 block">Descrição</label>
          <Textarea placeholder="Descreva quando esta regra se aplica..." value={data.description} onChange={e => onChange({ ...data, description: e.target.value })} rows={2} />
        </div>
        <div>
          <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Estratégia de Distribuição</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(strategyLabels).map(([key, val]) => {
              const Icon = val.icon;
              const selected = data.strategy === key;
              return (
                <button
                  key={key}
                  className={`p-3 rounded-lg border text-left transition-all ${selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/30"}`}
                  onClick={() => onChange({ ...data, strategy: key })}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`h-4 w-4 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-[12px] font-semibold ${selected ? "text-primary" : "text-foreground"}`}>{val.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">{val.description}</p>
                </button>
              );
            })}
          </div>
        </div>
        {(data.strategy === "team_round_robin") && (
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1 block">Equipe</label>
            <Select value={data.teamId?.toString() || "none"} onValueChange={v => onChange({ ...data, teamId: v === "none" ? null : Number(v) })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma equipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {teams.map(t => (
                  <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-[12px] font-medium text-muted-foreground mb-1 block">Prioridade</label>
            <Input type="number" min={0} max={100} value={data.priority} onChange={e => onChange({ ...data, priority: Number(e.target.value) })} />
          </div>
          <div className="flex-1">
            <label className="text-[12px] font-medium text-muted-foreground mb-1 block">Máx. conversas/agente</label>
            <Input type="number" min={1} max={999} value={data.configJson?.maxOpenPerAgent || 10} onChange={e => onChange({ ...data, configJson: { ...data.configJson, maxOpenPerAgent: Number(e.target.value) } })} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-foreground">Regra padrão</p>
            <p className="text-[11px] text-muted-foreground">Será usada quando nenhuma outra regra se aplicar</p>
          </div>
          <Switch checked={data.isDefault} onCheckedChange={v => onChange({ ...data, isDefault: v })} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-foreground">Apenas horário comercial</p>
            <p className="text-[11px] text-muted-foreground">Distribuir apenas durante o expediente</p>
          </div>
          <Switch checked={data.configJson?.businessHoursOnly || false} onCheckedChange={v => onChange({ ...data, configJson: { ...data.configJson, businessHoursOnly: v } })} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">Regras de Distribuição</h3>
          <p className="text-[12px] text-muted-foreground">Configure como novas conversas são atribuídas automaticamente aos agentes</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova Regra
        </Button>
      </div>

      {/* Info Card */}
      <div className="surface p-4 border-l-4 border-l-primary/50">
        <div className="flex items-start gap-3">
          <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-medium text-foreground">Como funciona a distribuição automática</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              Quando uma nova conversa chega no WhatsApp, o sistema verifica as regras ativas em ordem de prioridade.
              A primeira regra que se aplica determina como a conversa será atribuída. Se nenhuma regra se aplicar,
              a conversa fica sem atribuição até que um agente a assuma manualmente.
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="surface p-5 animate-pulse">
              <div className="h-5 w-40 bg-muted rounded mb-2" />
              <div className="h-3 w-64 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : (rules as Rule[]).length === 0 ? (
        <div className="surface p-12 text-center">
          <Shuffle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma regra de distribuição</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Crie regras para distribuir conversas automaticamente</p>
          <Button size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Criar Primeira Regra
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {(rules as Rule[]).map(rule => {
            const strat = strategyLabels[rule.strategy] || strategyLabels.manual;
            const Icon = strat.icon;
            return (
              <div key={rule.id} className={`surface p-5 transition-all ${!rule.isActive ? "opacity-50" : ""}`}>
                <div className="flex items-start gap-4">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${rule.isActive ? "bg-primary/10" : "bg-muted"}`}>
                    <Icon className={`h-5 w-5 ${rule.isActive ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[14px] font-semibold text-foreground">{rule.name}</p>
                      {rule.isDefault && (
                        <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/15 text-amber-500 border-amber-500/30">
                          <Star className="h-2.5 w-2.5 mr-0.5" /> Padrão
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{strat.label}</Badge>
                      {rule.teamName && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: rule.teamColor || undefined, color: rule.teamColor || undefined }}>
                          {rule.teamName}
                        </Badge>
                      )}
                    </div>
                    {rule.description && <p className="text-[12px] text-muted-foreground">{rule.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><ArrowUpDown className="h-3 w-3" /> Prioridade: {rule.priority}</span>
                      {rule.configJson?.maxOpenPerAgent && (
                        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Máx: {rule.configJson.maxOpenPerAgent}/agente</span>
                      )}
                      {rule.configJson?.businessHoursOnly && (
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Horário comercial</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={v => toggleRuleMut.mutate({ tenantId: TENANT_ID, id: rule.id, isActive: v })}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditRule(rule)}>
                          <Edit3 className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => {
                          if (confirm("Excluir esta regra?")) deleteRuleMut.mutate({ tenantId: TENANT_ID, id: rule.id });
                        }}>
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Rule Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Regra de Distribuição</DialogTitle>
            <DialogDescription>Configure como novas conversas serão distribuídas</DialogDescription>
          </DialogHeader>
          <RuleForm data={newRule} onChange={setNewRule} teams={teamsList as TeamData[]} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button disabled={!newRule.name.trim()} onClick={() => createRuleMut.mutate({
              tenantId: TENANT_ID,
              name: newRule.name,
              description: newRule.description || undefined,
              strategy: newRule.strategy as any,
              teamId: newRule.teamId,
              isDefault: newRule.isDefault,
              priority: newRule.priority,
              configJson: newRule.configJson,
            })}>
              Criar Regra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Rule Dialog */}
      <Dialog open={!!editRule} onOpenChange={() => setEditRule(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Regra</DialogTitle>
          </DialogHeader>
          {editRule && (
            <>
              <RuleForm
                data={{
                  name: editRule.name,
                  description: editRule.description || "",
                  strategy: editRule.strategy,
                  teamId: editRule.teamId,
                  isDefault: editRule.isDefault,
                  priority: editRule.priority,
                  configJson: editRule.configJson || { maxOpenPerAgent: 10, businessHoursOnly: false },
                }}
                onChange={d => setEditRule({ ...editRule, ...d })}
                teams={teamsList as TeamData[]}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditRule(null)}>Cancelar</Button>
                <Button onClick={() => updateRuleMut.mutate({
                  tenantId: TENANT_ID,
                  id: editRule.id,
                  name: editRule.name,
                  description: editRule.description || undefined,
                  strategy: editRule.strategy as any,
                  teamId: editRule.teamId,
                  isDefault: editRule.isDefault,
                  priority: editRule.priority,
                  configJson: editRule.configJson,
                })}>
                  Salvar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// (UsersTab removed - unified into AgentsTab)
// All user management functionality is now part of AgentsTab above.



// ════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════

export default function AgentManagement() {
  const TENANT_ID = useTenantId();
  const [tab, setTab] = useState<Tab>("agents");
  const [, setLocation] = useLocation();

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "agents", label: "Agentes", icon: Users },
    { id: "teams", label: "Equipes", icon: Shield },
    { id: "rules", label: "Distribuição", icon: Shuffle },
  ];

  return (
    <AdminOnlyGuard pageTitle="Agentes & Equipes">
    <div className="page-content max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation("/settings")} style={{ pointerEvents: "auto" }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{
              background: "linear-gradient(135deg, oklch(0.55 0.25 270), oklch(0.60 0.25 320), oklch(0.65 0.20 200))"
            }}>
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Agentes & Equipes</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">Gerencie agentes, equipes e regras de distribuição de conversas</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-muted/30 rounded-xl w-fit">
          {tabs.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setTab(t.id)}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {tab === "agents" && <AgentsTab />}
      {tab === "teams" && <TeamsTab />}
      {tab === "rules" && <DistributionTab />}
    </div>
    </AdminOnlyGuard>
  );
}
