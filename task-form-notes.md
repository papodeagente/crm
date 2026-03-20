# Task Form Reference Notes

## Criar Tarefa Dialog (RD Station Model)
- Empresa da negociação (select, optional)
- Negociação * (select, required - linked deal)
- Assunto da tarefa * (text input, required)
- Descrição da tarefa (textarea, optional)
- Responsável * (multi-select with tags, required - CRM users with X to remove)
- "Convidar usuário" button below responsável
- Tipo de tarefa * (select with icon: Tarefa, WhatsApp, Telefone, Email, Vídeo)
- Data do agendamento * (date picker, required)
- Horário da tarefa * (time picker, required)
- Checkbox: "Marcar como concluída ao criar"
- Footer: Cancelar (outline) + Salvar (primary teal)

## Task List Row (RD Station Model)
- Icon (WhatsApp icon), Badge "ATRASADA" (red), Title "Primeiro contato", Prazo: date/time
- Action icons on right: Edit (pencil), Reschedule (clock), Complete (checkmark in light blue circle)
- Footer: "Mostrando 1/1 tarefas" + "+ Criar tarefa" button
