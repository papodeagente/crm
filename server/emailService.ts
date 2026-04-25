import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL = process.env.EMAIL_FROM || "Clinilucro <noreply@clinilucro.app>";
const APP_NAME = "Clinilucro";

// ═══════════════════════════════════════
// SEND EMAIL HELPER
// ═══════════════════════════════════════

async function sendEmail(opts: { to: string; subject: string; html: string }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not configured, skipping email to:", opts.to);
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    console.log("[Email] Sent to:", opts.to, "subject:", opts.subject);
    return { success: true, data: result };
  } catch (error) {
    console.error("[Email] Failed to send to:", opts.to, error);
    return { success: false, error: String(error) };
  }
}

// ═══════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════

function baseTemplate(content: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);border-radius:12px;padding:10px 12px;">
        <span style="color:#fff;font-size:18px;font-weight:700;">✈ ${APP_NAME}</span>
      </div>
    </div>
    <!-- Content Card -->
    <div style="background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      ${content}
    </div>
    <!-- Footer -->
    <div style="text-align:center;margin-top:24px;color:#94a3b8;font-size:12px;">
      <p>${APP_NAME} — CRM inteligente para agências de viagens</p>
    </div>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════
// INVITE EMAIL
// ═══════════════════════════════════════

export async function sendInviteEmail(opts: {
  to: string;
  inviterName: string;
  companyName: string;
  tempPassword: string;
  loginUrl: string;
}) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Você foi convidado!</h2>
    <p style="color:#64748b;margin:0 0 24px;font-size:14px;line-height:1.6;">
      <strong>${opts.inviterName}</strong> convidou você para fazer parte da equipe 
      <strong>${opts.companyName}</strong> no ${APP_NAME}.
    </p>
    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#475569;font-size:13px;font-weight:600;">Seus dados de acesso:</p>
      <p style="margin:0 0 4px;color:#64748b;font-size:13px;">Email: <strong style="color:#1e293b;">${opts.to}</strong></p>
      <p style="margin:0;color:#64748b;font-size:13px;">Senha temporária: <strong style="color:#7c3aed;">${opts.tempPassword}</strong></p>
    </div>
    <p style="color:#64748b;font-size:13px;margin:0 0 24px;line-height:1.5;">
      Recomendamos que altere sua senha após o primeiro acesso.
    </p>
    <div style="text-align:center;">
      <a href="${opts.loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">
        Acessar ${APP_NAME}
      </a>
    </div>
  `);

  return sendEmail({
    to: opts.to,
    subject: `${opts.inviterName} convidou você para o ${APP_NAME}`,
    html,
  });
}

// ═══════════════════════════════════════
// PASSWORD RESET EMAIL
// ═══════════════════════════════════════

export async function sendPasswordResetEmail(opts: {
  to: string;
  userName: string;
  resetUrl: string;
  expiresInMinutes: number;
}) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Redefinir senha</h2>
    <p style="color:#64748b;margin:0 0 24px;font-size:14px;line-height:1.6;">
      Olá <strong>${opts.userName}</strong>, recebemos uma solicitação para redefinir sua senha.
    </p>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${opts.resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">
        Redefinir minha senha
      </a>
    </div>
    <p style="color:#94a3b8;font-size:12px;margin:0 0 8px;line-height:1.5;">
      Este link expira em <strong>${opts.expiresInMinutes} minutos</strong>.
    </p>
    <p style="color:#94a3b8;font-size:12px;margin:0;line-height:1.5;">
      Se você não solicitou esta redefinição, ignore este email. Sua senha permanecerá a mesma.
    </p>
  `);

  return sendEmail({
    to: opts.to,
    subject: `Redefinir senha — ${APP_NAME}`,
    html,
  });
}

// ═══════════════════════════════════════
// BIRTHDAY & WEDDING DATE EMAILS
// ═══════════════════════════════════════

export async function sendBirthdayNotificationEmail(opts: {
  to: string;
  contacts: { name: string; birthDate: string; phone?: string | null }[];
  daysAhead: number;
}) {
  const contactRows = opts.contacts.map(c =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;">${c.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#64748b;">${c.birthDate}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#64748b;">${c.phone || '-'}</td>
    </tr>`
  ).join("");

  const html = baseTemplate(`
    <h2 style="color:#1e293b;font-size:20px;font-weight:600;margin:0 0 8px;">🎂 Aniversariantes</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 20px;line-height:1.5;">
      ${opts.contacts.length} contato(s) fazem aniversário nos próximos ${opts.daysAhead} dias:
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Nome</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Data</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Telefone</th>
        </tr>
      </thead>
      <tbody>
        ${contactRows}
      </tbody>
    </table>
    <p style="color:#94a3b8;font-size:12px;margin:0;line-height:1.5;">
      Aproveite para enviar uma mensagem especial para seus clientes!
    </p>
  `);

  return sendEmail({
    to: opts.to,
    subject: `🎂 ${opts.contacts.length} aniversariante(s) nos próximos ${opts.daysAhead} dias — ${APP_NAME}`,
    html,
  });
}

export async function sendWeddingNotificationEmail(opts: {
  to: string;
  contacts: { name: string; weddingDate: string; phone?: string | null }[];
  daysAhead: number;
}) {
  const contactRows = opts.contacts.map(c =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;">${c.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#64748b;">${c.weddingDate}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#64748b;">${c.phone || '-'}</td>
    </tr>`
  ).join("");

  const html = baseTemplate(`
    <h2 style="color:#1e293b;font-size:20px;font-weight:600;margin:0 0 8px;">💍 Aniversários de Casamento</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 20px;line-height:1.5;">
      ${opts.contacts.length} contato(s) celebram aniversário de casamento nos próximos ${opts.daysAhead} dias:
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Nome</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Data</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Telefone</th>
        </tr>
      </thead>
      <tbody>
        ${contactRows}
      </tbody>
    </table>
    <p style="color:#94a3b8;font-size:12px;margin:0;line-height:1.5;">
      Aproveite para parabenizar seus clientes!
    </p>
  `);

  return sendEmail({
    to: opts.to,
    subject: `💍 ${opts.contacts.length} aniversário(s) de casamento nos próximos ${opts.daysAhead} dias — ${APP_NAME}`,
    html,
  });
}

// ═══════════════════════════════════════
// WELCOME EMAIL (Hotmart purchase)
// ═══════════════════════════════════════

export async function sendWelcomeEmail(opts: {
  to: string;
  userName: string;
  companyName: string;
  password: string;
  planName: string;
  loginUrl: string;
}) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Bem-vindo ao ${APP_NAME}!</h2>
    <p style="color:#64748b;margin:0 0 24px;font-size:14px;line-height:1.6;">
      Olá <strong>${opts.userName}</strong>, sua conta foi criada com sucesso!
      Você adquiriu o plano <strong>${opts.planName}</strong> e já pode começar a usar o sistema.
    </p>
    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#475569;font-size:13px;font-weight:600;">Seus dados de acesso:</p>
      <p style="margin:0 0 4px;color:#64748b;font-size:13px;">Empresa: <strong style="color:#1e293b;">${opts.companyName}</strong></p>
      <p style="margin:0 0 4px;color:#64748b;font-size:13px;">Email: <strong style="color:#1e293b;">${opts.to}</strong></p>
      <p style="margin:0;color:#64748b;font-size:13px;">Senha: <strong style="color:#7c3aed;">${opts.password}</strong></p>
    </div>
    <p style="color:#64748b;font-size:13px;margin:0 0 24px;line-height:1.5;">
      Recomendamos que altere sua senha após o primeiro acesso.
    </p>
    <div style="text-align:center;">
      <a href="${opts.loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">
        Acessar ${APP_NAME}
      </a>
    </div>
  `);

  return sendEmail({
    to: opts.to,
    subject: `Bem-vindo ao ${APP_NAME} — Sua conta está pronta!`,
    html,
  });
}

export async function sendMonthlyBirthdayReport(opts: {
  to: string;
  month: number;
  year: number;
  birthdayContacts: { name: string; birthDate: string; phone?: string | null }[];
  weddingContacts: { name: string; weddingDate: string; phone?: string | null }[];
}) {
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const monthName = monthNames[opts.month - 1] || `Mês ${opts.month}`;

  const birthdayRows = opts.birthdayContacts.map(c =>
    `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;">${c.name}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;">${c.birthDate}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;">${c.phone || '-'}</td>
    </tr>`
  ).join("");

  const weddingRows = opts.weddingContacts.map(c =>
    `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;">${c.name}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;">${c.weddingDate}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;">${c.phone || '-'}</td>
    </tr>`
  ).join("");

  const html = baseTemplate(`
    <h2 style="color:#1e293b;font-size:20px;font-weight:600;margin:0 0 8px;">📅 Relatório Mensal — ${monthName} ${opts.year}</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 20px;line-height:1.5;">
      Confira os aniversariantes e datas de casamento do mês.
    </p>

    ${opts.birthdayContacts.length > 0 ? `
    <h3 style="color:#1e293b;font-size:16px;font-weight:600;margin:0 0 8px;">🎂 Aniversariantes (${opts.birthdayContacts.length})</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:6px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;">Nome</th>
          <th style="padding:6px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;">Data</th>
          <th style="padding:6px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;">Telefone</th>
        </tr>
      </thead>
      <tbody>${birthdayRows}</tbody>
    </table>
    ` : '<p style="color:#94a3b8;font-size:13px;">Nenhum aniversariante neste mês.</p>'}

    ${opts.weddingContacts.length > 0 ? `
    <h3 style="color:#1e293b;font-size:16px;font-weight:600;margin:0 0 8px;">💍 Aniversários de Casamento (${opts.weddingContacts.length})</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:6px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;">Nome</th>
          <th style="padding:6px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;">Data</th>
          <th style="padding:6px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;">Telefone</th>
        </tr>
      </thead>
      <tbody>${weddingRows}</tbody>
    </table>
    ` : '<p style="color:#94a3b8;font-size:13px;">Nenhum aniversário de casamento neste mês.</p>'}
  `);

  return sendEmail({
    to: opts.to,
    subject: `📅 Aniversariantes de ${monthName} ${opts.year} — ${APP_NAME}`,
    html,
  });
}
