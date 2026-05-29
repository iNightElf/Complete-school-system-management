import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.EMAIL_FROM || "noreply@localhost";

export async function sendVerificationEmail(
  email: string,
  url: string
): Promise<void> {
  if (!resend) {
    console.log(`[Email Verification] To: ${email} — URL: ${url}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Verify your email — AL RAWA English School",
    html: `
      <h2>Email Verification</h2>
      <p>Click the link below to verify your email address:</p>
      <p><a href="${url}">${url}</a></p>
      <p>This link will expire in 24 hours.</p>
    `,
  });
}
