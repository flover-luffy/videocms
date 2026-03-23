import nodemailer from "nodemailer";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * 发送电子邮件
 */
export async function sendEmail({ to, subject, html, text }: EmailOptions) {
  // 检查环境变量
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass) {
    console.warn("SMTP 尚未配置，邮件将仅在开发模式下输出到控制台。");
    console.info(`[Email Preview] To: ${to}, Subject: ${subject}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 为加密，587 通常为 STARTTLS
    auth: {
      user,
      pass,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || "Video CMS"}" <${from}>`,
      to,
      subject,
      text: text || "请在支持 HTML 的客户端查看此邮件",
      html,
    });

    console.info(`[Email Sent] MessageID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("[Email Error] 发送失败:", error);
    throw error;
  }
}
