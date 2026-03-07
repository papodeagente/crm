import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "");

const FROM_EMAIL = process.env.EMAIL_FROM || "Entur OS <noreply@acelerador.tur.br>";
const APP_NAME = "Entur OS";

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
