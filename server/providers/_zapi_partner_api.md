# Z-API Partner API - Mapeamento

## Autenticação
- Header: `Authorization: Bearer {partner_token}` em todas as chamadas da Partner API
- Nota: `Client-Token` é usado apenas para security token de instância individual, NÃO para Partner API
- URL base: `https://api.z-api.io`

## Endpoints

### 1. Criar Instância
- **POST** `https://api.z-api.io/instances/integrator/on-demand`
- Headers: `Authorization: Bearer {partner_token}`, `Content-Type: application/json`
- Body: `{ "name": "string", "deliveryCallbackUrl": "...", "receivedCallbackUrl": "...", ... }`
- Response 200: `{ "id": "string", "token": "string", "due": timestamp }`
- Nota: Instância criada tem 2 dias de trial. Precisa chamar subscribe para ativar.

### 2. Assinar Instância (Subscribe)
- **POST** `https://api.z-api.io/instances/{id}/token/{token}/integrator/on-demand/subscription`
- Headers: `Authorization: Bearer {partner_token}`
- Nota: Só funciona para instâncias criadas via API

### 3. Cancelar Instância
- **POST** `https://api.z-api.io/instances/{id}/token/{token}/integrator/on-demand/cancel`
- Headers: `Authorization: Bearer {partner_token}`
- Nota: Instância continua ativa até expirar (30 dias do ciclo)

### 4. Listar Instâncias
- **GET** (método correto a confirmar - GET retorna 405)
- Headers: `Authorization: Bearer {partner_token}`
- Response: `{ total, totalPage, pageSize, page, content: [{ id, token, name, due, paymentStatus, phoneConnected, whatsappConnected, ... }] }`

## Fluxo de Provisionamento
1. Criar instância via POST /instances/integrator/on-demand
2. Receber id + token na resposta
3. Configurar webhooks na instância (via update-every-webhooks)
4. Assinar instância via POST /subscription (para ativar pós-trial Z-API)
5. Salvar id, token no banco vinculado ao tenant
6. Sessão WhatsApp do tenant usa o provider Z-API com essas credenciais

## Webhook URLs a configurar na criação
- deliveryCallbackUrl: mensagens enviadas
- receivedCallbackUrl: mensagens recebidas
- disconnectedCallbackUrl: desconexão
- connectedCallbackUrl: conexão
- messageStatusCallbackUrl: status de mensagem
