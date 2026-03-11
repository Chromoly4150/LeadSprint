export type DispatchableJob = {
  id: string;
  leadId: string;
  channel: string;
  provider: string;
  toAddress: string;
  subject: string | null;
  body: string;
  attemptCount: number;
  payloadJson: string | null;
};

export type SendResult =
  | {
      ok: true;
      providerMessageId: string;
      sentAt: string;
      detail?: string;
    }
  | {
      ok: false;
      errorCode: string;
      errorMessage: string;
      retryable: boolean;
    };

export interface OutboundProvider {
  channel: string;
  providerName: string;
  send(job: DispatchableJob): Promise<SendResult>;
}
