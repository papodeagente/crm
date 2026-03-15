# Runbook de Estabilização — VPS Hostinger

Este documento contém os comandos e procedimentos que devem ser executados **diretamente no VPS** (via SSH) para completar a estabilização do ambiente WhatsApp SaaS. As correções de código já foram aplicadas no deploy; este runbook cobre operações de infraestrutura.

**Ambiente:** Evolution API v2.3.7, PostgreSQL, Redis + BullMQ, VPS Hostinger

---

## 1. Verificar Consumo de Recursos

Antes de qualquer intervenção, diagnosticar o uso de CPU/memória.

```bash
# Visão geral do sistema
top -bn1 | head -20

# Se htop estiver instalado (mais visual)
htop

# Se usando Docker
docker stats --no-stream

# Identificar processos com alto CPU
ps aux --sort=-%cpu | head -15

# Verificar memória
free -h

# Verificar disco
df -h
```

**O que procurar:**
- Processo `node` (Evolution API) com CPU > 50% indica loop de QR code
- Múltiplos processos `chromium` ou `puppeteer` indicam instâncias fantasma
- Redis com alto uso de memória pode indicar fila travada

---

## 2. Corrigir Instâncias Stuck no PostgreSQL da Evolution

A Evolution API v2.3.7 usa PostgreSQL. Conectar ao banco e corrigir instâncias presas.

```bash
# Conectar ao PostgreSQL (ajustar credenciais conforme .env da Evolution)
docker exec -it evolution_postgres psql -U postgres -d evolution

# Ou se PostgreSQL está rodando diretamente:
psql -U postgres -d evolution
```

```sql
-- Ver todas as instâncias e seus status
SELECT "instanceName", "status", "connectionStatus", "ownerJid"
FROM "Instance"
ORDER BY "status";

-- Contar instâncias por status
SELECT "connectionStatus", COUNT(*)
FROM "Instance"
GROUP BY "connectionStatus";

-- CORREÇÃO: Marcar instâncias 'connecting' como 'close'
-- Isso impede loops de reconexão na Evolution API
UPDATE "Instance"
SET "connectionStatus" = 'close'
WHERE "connectionStatus" = 'connecting';

-- Verificar resultado
SELECT "instanceName", "connectionStatus"
FROM "Instance"
WHERE "connectionStatus" IN ('connecting', 'close');
```

**IMPORTANTE:** Não deletar instâncias. Apenas mudar o status para `close`.

---

## 3. Detectar e Corrigir Instâncias Órfãs

Comparar instâncias no banco do SaaS com instâncias ativas na Evolution API.

```bash
# Listar instâncias ativas na Evolution API
curl -s -H "apikey: $EVOLUTION_API_KEY" \
  "$EVOLUTION_API_URL/instance/fetchInstances" | python3 -m json.tool
```

```sql
-- No banco do SaaS (MySQL/TiDB), listar sessões não-deletadas
SELECT sessionId, status, phoneNumber, pushName
FROM whatsapp_sessions
WHERE status != 'deleted'
ORDER BY status;
```

**Comparar as duas listas.** Sessões que existem no banco do SaaS mas **não** na Evolution API são órfãs. Marcar como `disconnected`:

```sql
-- Exemplo: marcar sessões órfãs como disconnected no banco do SaaS
UPDATE whatsapp_sessions
SET status = 'disconnected'
WHERE sessionId IN ('crm-orphan-1', 'crm-orphan-2')
AND status != 'deleted';
```

---

## 4. Verificar Webhook da Evolution

Testar se o endpoint do SaaS está acessível pela Evolution API.

```bash
# Teste básico de conectividade
curl -sv -X POST https://crm.acelerador.tur.br/api/webhooks/evolution \
  -H "Content-Type: application/json" \
  -d '{"event":"connection.update","instance":"test","data":{"state":"open"}}'

# Resposta esperada: HTTP 200 {"received":true}
# Se retornar 403: a correção de apikey já foi aplicada no deploy
# Se retornar 502/504: verificar se o SaaS está rodando
```

**Verificar configuração de webhook em cada instância:**

```bash
# Para cada instância ativa, verificar webhook configurado
curl -s -H "apikey: $EVOLUTION_API_KEY" \
  "$EVOLUTION_API_URL/webhook/find/crm-240006-240006" | python3 -m json.tool
```

**Webhook esperado:**
```json
{
  "enabled": true,
  "url": "https://crm.acelerador.tur.br/api/webhooks/evolution",
  "byEvents": false,
  "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE", "QRCODE_UPDATED", "SEND_MESSAGE", "MESSAGES_DELETE", "CONTACTS_UPSERT"]
}
```

**Se o webhook estiver errado, corrigir:**

```bash
curl -X POST -H "apikey: $EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  "$EVOLUTION_API_URL/webhook/set/crm-240006-240006" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "https://crm.acelerador.tur.br/api/webhooks/evolution",
      "byEvents": false,
      "base64": false,
      "events": ["MESSAGES_UPSERT","MESSAGES_UPDATE","CONNECTION_UPDATE","QRCODE_UPDATED","SEND_MESSAGE","MESSAGES_DELETE","CONTACTS_UPSERT"]
    }
  }'
```

---

## 5. Verificar Redis

```bash
# Verificar se Redis está rodando
redis-cli ping
# Resposta esperada: PONG

# Se usando Docker
docker exec -it redis redis-cli ping

# Verificar uso de memória
redis-cli info memory | grep used_memory_human

# Verificar filas BullMQ
redis-cli keys "bull:whatsapp-messages:*" | head -20

# Contar jobs na fila
redis-cli llen "bull:whatsapp-messages:wait"
redis-cli llen "bull:whatsapp-messages:active"
redis-cli zcard "bull:whatsapp-messages:failed"
redis-cli zcard "bull:whatsapp-messages:delayed"

# Se a fila estiver travada (muitos jobs em wait/active), limpar:
redis-cli del "bull:whatsapp-messages:wait"
redis-cli del "bull:whatsapp-messages:active"
redis-cli del "bull:whatsapp-messages:stalled-check"
```

**Se Redis não estiver respondendo:**

```bash
# Reiniciar Redis
sudo systemctl restart redis
# ou
docker restart redis

# Verificar logs
sudo journalctl -u redis --since "1 hour ago"
# ou
docker logs redis --tail 50
```

**NOTA:** Se Redis estiver indisponível, o SaaS já tem fallback para processamento síncrono. As mensagens continuam sendo processadas, apenas sem a fila async.

---

## 6. Validar Processamento de Eventos WhatsApp

Após aplicar as correções, testar o fluxo completo.

**Teste 1: Enviar mensagem do celular para o SaaS**
1. Enviar mensagem de um celular para um número conectado
2. Verificar no Inbox do SaaS se a mensagem aparece em < 3 segundos
3. Verificar nos logs: `grep "messages.upsert" /path/to/logs`

**Teste 2: Enviar mensagem do SaaS para o celular**
1. Enviar mensagem pelo Inbox do SaaS
2. Verificar se aparece no celular
3. Verificar ticks: ✓ (enviado) → ✓✓ (entregue) → ✓✓ azul (lido)

**Teste 3: Verificar status updates nos logs**
```bash
# Monitorar logs em tempo real para status updates
tail -f /path/to/saas/logs | grep "Status update\|messages.update"
```

**Eventos que devem ser processados:**

| Evento | Descrição | Handler |
|--------|-----------|---------|
| `messages.upsert` | Nova mensagem recebida/enviada | `handleIncomingMessage` / `handleOutgoingMessage` |
| `messages.update` | Status da mensagem (✓ ✓✓ ✓✓azul) | `handleMessageStatusUpdate` |
| `send.message` | Confirmação de envio | `handleOutgoingMessage` |
| `messages.delete` | Mensagem apagada | `handleMessageDelete` |
| `connection.update` | Mudança de conexão | `handleConnectionUpdate` |
| `qrcode.updated` | Novo QR code gerado | Emite via Socket.IO |
| `contacts.upsert` | Contato atualizado | `handleContactsUpsert` |

---

## 7. Reiniciar Serviços com Segurança

**Ordem recomendada de restart:**

```bash
# 1. Redis primeiro (se necessário)
docker restart redis
# Aguardar 5 segundos
sleep 5

# 2. Evolution API
docker restart evolution_api
# Aguardar 15 segundos para inicializar
sleep 15

# 3. SaaS (se rodando como serviço)
# O SaaS já tem auto-restore que reconecta apenas instâncias 'open'
pm2 restart saas
# ou
docker restart saas

# 4. Monitorar logs por 2 minutos
docker logs -f evolution_api --tail 20 &
docker logs -f saas --tail 20 &
```

**Verificar após restart:**

```bash
# CPU deve estabilizar em < 30% após 2 minutos
docker stats --no-stream

# Verificar que auto-restore reconectou apenas instâncias 'open'
grep "AutoRestore" /path/to/saas/logs | tail -10

# Verificar que não há loops de QR code
grep "qrcode\|connecting" /path/to/saas/logs | tail -20
```

---

## 8. Checklist Pós-Estabilização

| Item | Verificação | Status |
|------|-------------|--------|
| CPU < 30% | `docker stats --no-stream` | [ ] |
| Sem loops de QR code | Logs sem "qrcode.updated" repetido | [ ] |
| Webhooks HTTP 200 | Teste curl retorna 200 | [ ] |
| Ticks ✓✓ funcionando | Enviar msg e verificar status | [ ] |
| Mensagens sincronizando | Enviar/receber em < 3s | [ ] |
| Redis respondendo | `redis-cli ping` → PONG | [ ] |
| Auto-restore correto | Apenas instâncias 'open' restauradas | [ ] |
| Nenhuma sessão perdida | Comparar contagem antes/depois | [ ] |

---

## 9. Contatos de Emergência

Se algum problema persistir após seguir este runbook:
- Verificar logs da Evolution API: `docker logs evolution_api --tail 100`
- Verificar logs do SaaS: `grep "Error\|error\|WARN" /path/to/saas/logs | tail -50`
- Se instâncias continuarem em loop: desconectar manualmente via API Evolution e reconectar pelo Inbox do SaaS
