import nodemailer from "nodemailer";
import { env } from "./env.js";

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpSecure,
  auth: env.smtpUser && env.smtpPass ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
});

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  text: string;
}): Promise<void> {
  await transporter.sendMail({
    from: env.smtpFrom,
    to: params.to,
    subject: params.subject,
    text: params.text,
  });
}
