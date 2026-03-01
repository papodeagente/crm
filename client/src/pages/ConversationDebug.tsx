import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Database, Merge, Search, Shield, Phone, MessageSquare, Users } from "lucide-react";
import { formatFullDateTime } from "../../../shared/dateUtils";
import { useLocation } from "wouter";

export default function ConversationDebug() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedSession, setSelectedSession] = useState("");

  const sessions = trpc.whatsapp.sessions.useQuery();
  const debugData = trpc.whatsapp.debugConversations.useQuery(
    { tenantId: 1, sessionId: selectedSession },
    { enabled: !!selectedSession }
  );

  const migrateMutation = trpc.whatsapp.migrateConversations.useMutation({
    onSuccess: (data) => {
      toast.success(`Migração concluída: ${data.conversationsCreated} conversas criadas, ${data.messagesLinked} mensagens vinculadas, ${data.identitiesCreated} identidades criadas`);
      debugData.refetch();
    },
    onError: (err) => {
      toast.error(`Erro na migração: ${err.message}`);
    },
  });

  const reconcileMutation = trpc.whatsapp.reconcileGhosts.useMutation({
    onSuccess: (data) => {
      toast.success(data.mergedCount > 0
        ? `Reconciliação concluída: ${data.mergedCount} conversas fantasma mescladas`
        : "Reconciliação concluída: Nenhuma conversa fantasma encontrada");
      debugData.refetch();
    },
    onError: (err) => {
      toast.error(`Erro na reconciliação: ${err.message}`);
    },
  });

  // Auto-select first session
  if (sessions.data?.length && !selectedSession) {
    const first = sessions.data[0];
    setSelectedSession(first.sessionId);
  }

  const conversations = debugData.data?.conversations || [];
  const identities = debugData.data?.identities || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-orange-500" />
            Conversation Identity Resolver — Debug
          </h1>
          <p className="text-muted-foreground text-sm">
            Visualize conversas canônicas, identidades WhatsApp e execute migração/reconciliação
          </p>
        </div>
      </div>

      {/* Session Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sessão WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {sessions.data?.map((s) => (
              <Button
                key={s.sessionId}
                variant={selectedSession === s.sessionId ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSession(s.sessionId)}
              >
                {s.sessionId}
                <Badge variant={s.liveStatus === "connected" ? "default" : "secondary"} className="ml-2 text-xs">
                  {s.liveStatus}
                </Badge>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              Migrar Dados Existentes
            </CardTitle>
            <CardDescription>
              Cria wa_conversations a partir de mensagens existentes agrupadas por remoteJid
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => migrateMutation.mutate({ tenantId: 1 })}
              disabled={migrateMutation.isPending}
              className="w-full"
            >
              {migrateMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              Executar Migração
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Merge className="h-4 w-4" />
              Reconciliar Fantasmas
            </CardTitle>
            <CardDescription>
              Mescla conversas duplicadas (mesmo phoneE164, JIDs diferentes)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => selectedSession && reconcileMutation.mutate({ tenantId: 1, sessionId: selectedSession })}
              disabled={reconcileMutation.isPending || !selectedSession}
              variant="outline"
              className="w-full"
            >
              {reconcileMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Merge className="h-4 w-4 mr-2" />
              )}
              Reconciliar Ghosts
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Atualizar Dados
            </CardTitle>
            <CardDescription>
              Recarrega conversas e identidades do banco
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => debugData.refetch()}
              disabled={debugData.isFetching}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${debugData.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-bold">{conversations.length}</div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <MessageSquare className="h-3 w-3" /> Conversas
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-bold">{identities.length}</div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Users className="h-3 w-3" /> Identidades
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-bold text-yellow-500">
              {conversations.filter((c: any) => c.mergedIntoId).length}
            </div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Merge className="h-3 w-3" /> Mescladas
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-bold text-green-500">
              {conversations.filter((c: any) => c.contactId).length}
            </div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Phone className="h-3 w-3" /> Com Contato
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversas Canônicas (wa_conversations)</CardTitle>
          <CardDescription>
            Cada linha é uma conversa única. Conversas mescladas aparecem com status "closed".
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">ID</th>
                  <th className="p-2">ConversationKey</th>
                  <th className="p-2">RemoteJid</th>
                  <th className="p-2">PhoneE164</th>
                  <th className="p-2">ContactId</th>
                  <th className="p-2">PushName</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Unread</th>
                  <th className="p-2">Última Msg</th>
                  <th className="p-2">MergedInto</th>
                </tr>
              </thead>
              <tbody>
                {conversations.map((c: any) => (
                  <tr key={c.id} className={`border-b hover:bg-muted/50 ${c.mergedIntoId ? "opacity-50" : ""}`}>
                    <td className="p-2 font-mono text-xs">{c.id}</td>
                    <td className="p-2 font-mono text-xs max-w-[200px] truncate" title={c.conversationKey}>{c.conversationKey}</td>
                    <td className="p-2 font-mono text-xs">{c.remoteJid}</td>
                    <td className="p-2 font-mono text-xs">{c.phoneE164 || "—"}</td>
                    <td className="p-2">{c.contactId || "—"}</td>
                    <td className="p-2">{c.contactPushName || "—"}</td>
                    <td className="p-2">
                      <Badge variant={c.status === "open" ? "default" : c.status === "closed" ? "secondary" : "outline"}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="p-2">{c.unreadCount || 0}</td>
                    <td className="p-2 max-w-[150px] truncate text-muted-foreground" title={c.lastMessagePreview}>
                      {c.lastMessagePreview || "—"}
                    </td>
                    <td className="p-2">
                      {c.mergedIntoId ? (
                        <Badge variant="destructive" className="text-xs">→ {c.mergedIntoId}</Badge>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
                {conversations.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground">
                      Nenhuma conversa canônica encontrada. Execute a migração para popular os dados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Identities Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identidades WhatsApp (wa_identities)</CardTitle>
          <CardDescription>
            Cada JID mapeado para um contato e telefone E.164.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">ID</th>
                  <th className="p-2">SessionId</th>
                  <th className="p-2">RemoteJid</th>
                  <th className="p-2">WaId</th>
                  <th className="p-2">PhoneE164</th>
                  <th className="p-2">ContactId</th>
                  <th className="p-2">Confiança</th>
                  <th className="p-2">Primeiro Visto</th>
                  <th className="p-2">Último Visto</th>
                </tr>
              </thead>
              <tbody>
                {identities.map((i: any) => (
                  <tr key={i.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-mono text-xs">{i.id}</td>
                    <td className="p-2 font-mono text-xs">{i.sessionId}</td>
                    <td className="p-2 font-mono text-xs">{i.remoteJid || "—"}</td>
                    <td className="p-2 font-mono text-xs">{i.waId || "—"}</td>
                    <td className="p-2 font-mono text-xs">{i.phoneE164 || "—"}</td>
                    <td className="p-2">{i.contactId || "—"}</td>
                    <td className="p-2">
                      <Badge variant={i.confidenceScore >= 80 ? "default" : "outline"}>
                        {i.confidenceScore}%
                      </Badge>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {i.firstSeenAt ? formatFullDateTime(i.firstSeenAt) : "—"}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {i.lastSeenAt ? formatFullDateTime(i.lastSeenAt) : "—"}
                    </td>
                  </tr>
                ))}
                {identities.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      Nenhuma identidade encontrada. Execute a migração para popular os dados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
