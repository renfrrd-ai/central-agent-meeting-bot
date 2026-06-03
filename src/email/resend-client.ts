import { Resend } from "resend";

export interface ReceivedEmail {
  id: string;
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string | string[]>;
  messageId?: string;
}

export interface ResendReceivingClient {
  getReceivedEmail(emailId: string): Promise<ReceivedEmail | null>;
}

export class ResendReceivingService implements ResendReceivingClient {
  private readonly resend: Resend;

  constructor(apiKey: string) {
    this.resend = new Resend(apiKey);
  }

  async getReceivedEmail(emailId: string): Promise<ReceivedEmail | null> {
    const { data, error } = await this.resend.emails.receiving.get(emailId);

    if (error || !data) {
      return null;
    }

    const to = Array.isArray(data.to)
      ? data.to.map(String)
      : data.to
        ? [String(data.to)]
        : [];

    const headers = data.headers as Record<string, string | string[]> | undefined;
    const messageIdHeader = headers?.["message-id"] ?? headers?.["Message-ID"];
    const messageId = Array.isArray(messageIdHeader)
      ? messageIdHeader[0]
      : messageIdHeader;

    return {
      id: data.id ?? emailId,
      from: data.from ?? "",
      to,
      subject: data.subject ?? "",
      html: data.html ?? undefined,
      text: data.text ?? undefined,
      headers,
      messageId: messageId ? String(messageId) : undefined,
    };
  }
}
