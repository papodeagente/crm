import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  Trash2,
  User,
  Lock,
  Calendar,
  Mail,
  Shield,
  Check,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  Unlink,
  RefreshCw,
  CloudUpload,
  CloudDownload,
  CalendarCheck,
  CalendarX,
  Zap,
} from "lucide-react";

export default function Profile() {
  const [, setLocation] = useLocation();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Queries ───
  const { data: profile, isLoading, refetch } = trpc.profile.getProfile.useQuery();

  // ─── Profile Update ───
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const updateProfile = trpc.profile.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado — suas informações foram salvas.");
      setIsEditingProfile(false);
      refetch();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const startEditProfile = useCallback(() => {
    if (profile) {
      setEditName(profile.name);
      setEditPhone(profile.phone || "");
      setIsEditingProfile(true);
    }
  }, [profile]);

  // ─── Avatar ───
  const uploadAvatar = trpc.profile.uploadAvatar.useMutation({
    onSuccess: () => {
      toast.success("Foto de perfil atualizada.");
      refetch();
    },
    onError: (err) => toast.error(`Erro ao enviar foto: ${err.message}`),
  });

  const removeAvatar = trpc.profile.removeAvatar.useMutation({
    onSuccess: () => {
      toast.success("Foto removida.");
      refetch();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande — a imagem deve ter no máximo 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadAvatar.mutate({ base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [uploadAvatar]);

  // ─── Password ───
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const changePassword = trpc.profile.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso.");
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handlePasswordSubmit = useCallback(() => {
    if (newPassword !== confirmPassword) {
      toast.error("Senhas não conferem — a nova senha e a confirmação devem ser iguais.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Senha muito curta — deve ter pelo menos 6 caracteres.");
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  }, [currentPassword, newPassword, confirmPassword, changePassword]);

  // ─── Google Calendar ───
  const connectGCal = trpc.profile.connectGoogleCalendar.useMutation({
    onSuccess: () => {
      toast.success("Google Calendar conectado com sucesso!");
      refetch();
    },
    onError: (err) => toast.error(`Erro ao conectar: ${err.message}`),
  });

  const disconnectGCal = trpc.profile.disconnectGoogleCalendar.useMutation({
    onSuccess: () => {
      toast.success("Google Calendar desconectado.");
      refetch();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const syncAllTasks = trpc.profile.syncAllTasksToCalendar.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
    },
    onError: (err) => toast.error(`Erro ao sincronizar: ${err.message}`),
  });

  const handleConnectGoogleCalendar = useCallback(() => {
    connectGCal.mutate({});
  }, [connectGCal]);

  const handleSyncAllTasks = useCallback(() => {
    syncAllTasks.mutate();
  }, [syncAllTasks]);

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Não foi possível carregar o perfil.</p>
      </div>
    );
  }

  const initials = profile.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
            <p className="text-muted-foreground text-sm">Gerencie suas informações pessoais e integrações</p>
          </div>
        </div>

        {/* ═══ AVATAR SECTION ═══ */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Camera className="h-5 w-5 text-primary" />
              Foto de Perfil
            </CardTitle>
            <CardDescription>Sua foto será exibida no sistema e nas conversas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {/* Avatar Preview */}
              <div className="relative group">
                <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-semibold text-muted-foreground">{initials}</span>
                  )}
                </div>
                {/* Overlay on hover */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                >
                  <Camera className="h-6 w-6 text-white" />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadAvatar.isPending}
                  >
                    {uploadAvatar.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Camera className="h-4 w-4 mr-2" />
                    )}
                    Alterar foto
                  </Button>
                  {profile.avatarUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAvatar.mutate()}
                      disabled={removeAvatar.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      {removeAvatar.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Remover
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">JPG, PNG, WebP ou GIF. Máximo 5MB.</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* ═══ PERSONAL INFO SECTION ═══ */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5 text-primary" />
                  Informações Pessoais
                </CardTitle>
                <CardDescription>Seus dados de identificação no sistema</CardDescription>
              </div>
              {!isEditingProfile && (
                <Button variant="outline" size="sm" onClick={startEditProfile}>
                  Editar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditingProfile ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nome</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Telefone</Label>
                  <Input
                    id="edit-phone"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => updateProfile.mutate({ name: editName, phone: editPhone })}
                    disabled={updateProfile.isPending || !editName.trim()}
                    size="sm"
                  >
                    {updateProfile.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Salvar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingProfile(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">{profile.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">E-mail</p>
                    <p className="font-medium">{profile.email}</p>
                  </div>
                </div>
                {profile.phone && (
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone</p>
                      <p className="font-medium">{profile.phone}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Função</p>
                    <Badge variant={profile.role === "admin" ? "default" : "secondary"}>
                      {profile.role === "admin" ? "Administrador" : "Usuário"}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ PASSWORD SECTION ═══ */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lock className="h-5 w-5 text-primary" />
                  Segurança
                </CardTitle>
                <CardDescription>Gerencie sua senha de acesso</CardDescription>
              </div>
              {!showPasswordForm && (
                <Button variant="outline" size="sm" onClick={() => setShowPasswordForm(true)}>
                  Alterar senha
                </Button>
              )}
            </div>
          </CardHeader>
          {showPasswordForm && (
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-pw">Senha atual</Label>
                  <div className="relative">
                    <Input
                      id="current-pw"
                      type={showCurrentPw ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Digite sua senha atual"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-pw">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="new-pw"
                      type={showNewPw ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-pw">Confirmar nova senha</Label>
                  <Input
                    id="confirm-pw"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">As senhas não conferem</p>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handlePasswordSubmit}
                    disabled={changePassword.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
                    size="sm"
                  >
                    {changePassword.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Alterar senha
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ═══ GOOGLE CALENDAR SECTION ═══ */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-primary" />
              Google Calendar
            </CardTitle>
            <CardDescription>
              Sincronize suas tarefas do CRM com o Google Calendar automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profile.googleCalendar.connected ? (
              <div className="space-y-5">
                {/* Connected Status */}
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                    <CalendarCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-green-800 dark:text-green-200">Google Calendar Conectado</p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {profile.googleCalendar.message}
                    </p>
                    {profile.googleCalendar.email && (
                      <p className="text-xs text-green-500 dark:text-green-500 mt-0.5">{profile.googleCalendar.email}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnectGCal.mutate()}
                    disabled={disconnectGCal.isPending}
                    className="text-destructive hover:text-destructive shrink-0"
                  >
                    {disconnectGCal.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Unlink className="h-4 w-4 mr-2" />
                    )}
                    Desconectar
                  </Button>
                </div>

                {/* Sync Actions */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">Sincronização</h4>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="outline"
                      onClick={handleSyncAllTasks}
                      disabled={syncAllTasks.isPending}
                      className="flex-1"
                    >
                      {syncAllTasks.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CloudUpload className="h-4 w-4 mr-2" />
                      )}
                      Sincronizar Tarefas Pendentes
                    </Button>
                  </div>

                  {syncAllTasks.data && (
                    <div className="p-3 bg-muted/50 rounded-lg text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="h-4 w-4 text-primary" />
                        <span className="font-medium">Resultado da sincronização</span>
                      </div>
                      <p className="text-muted-foreground">{syncAllTasks.data.message}</p>
                      {syncAllTasks.data.synced > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          {syncAllTasks.data.synced} tarefa(s) enviada(s) para o Google Calendar
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* How it works */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-sm font-medium text-foreground">Como funciona</h4>
                  <div className="grid gap-2 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <CalendarCheck className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                      <span>Tarefas com data de vencimento são automaticamente criadas como eventos no Google Calendar</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <RefreshCw className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                      <span>Ao editar uma tarefa, o evento correspondente é atualizado automaticamente</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CalendarX className="h-4 w-4 mt-0.5 text-orange-500 shrink-0" />
                      <span>Ao concluir ou cancelar uma tarefa, o evento é marcado no calendário</span>
                    </div>
                  </div>
                </div>

                {profile.googleCalendar.connectedAt && (
                  <p className="text-xs text-muted-foreground pt-2">
                    Conectado em {new Date(profile.googleCalendar.connectedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* MCP Available but not connected */}
                {profile.googleCalendar.mcpAvailable ? (
                  <>
                    <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-blue-800 dark:text-blue-200">Pronto para conectar</p>
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                          O Google Calendar está disponível e pronto para sincronização
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleConnectGoogleCalendar}
                      disabled={connectGCal.isPending}
                      className="w-full sm:w-auto"
                    >
                      {connectGCal.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ExternalLink className="h-4 w-4 mr-2" />
                      )}
                      Conectar Google Calendar
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Não disponível</p>
                      <p className="text-sm text-muted-foreground">
                        A integração com o Google Calendar não está configurada no momento.
                        Verifique as configurações do sistema.
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Ao conectar, suas tarefas com data de vencimento serão sincronizadas automaticamente
                  com o Google Calendar. Você pode desconectar a qualquer momento.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator className="my-6" />

        <div className="text-center text-xs text-muted-foreground pb-8">
          ID do usuário: {profile.id} &middot; Tenant: {profile.tenantId}
        </div>
      </div>
    </div>
  );
}
