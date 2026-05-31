import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.EMAIL_FROM || "AL RAWA <noreply@localhost>";

export async function verifySMTP(): Promise<void> {
  try {
    await transporter.verify();
  } catch (err) {
    throw err;
  }
}

export async function sendVerificationEmail(
  email: string,
  url: string
): Promise<void> {
  try {
    await transporter.sendMail({
      from: FROM,
      to: email,
      subject: "Verify your email — AL RAWA English School",
      html: `
        <h2>Email Verification</h2>
        <p>Click the link below to verify your email address:</p>
        <p><a href="${url}">${url}</a></p>
        <p>This link will expire in 24 hours.</p>
        <br/>
        <p style="color:#888;font-size:12px;">AL RAWA English School — Do not share this email.</p>
      `,
    });
  } catch (err) {
    throw err;
  }
}
