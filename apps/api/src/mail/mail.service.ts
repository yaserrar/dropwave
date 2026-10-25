import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type Email = { subject: string; text: string; html: string };

// Credentials come from the same default AWS chain as S3Service: access keys locally,
// the instance's IAM role on EC2. Either needs ses:SendEmail.
@Injectable()
export class MailService {
  private readonly client: SESv2Client;
  private readonly from: string;

  constructor(config: ConfigService) {
    // The sending domain (asrar.software) is verified in SES in this region.
    this.client = new SESv2Client({
      region: config.getOrThrow<string>('AWS_REGION'),
    });
    this.from = config.getOrThrow<string>('MAIL_FROM');
  }

  /** Sends to one recipient and returns SES's message id. */
  async send(to: string, email: Email): Promise<string | undefined> {
    const { MessageId } = await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.from,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: email.subject, Charset: 'UTF-8' },
            Body: {
              Text: { Data: email.text, Charset: 'UTF-8' },
              Html: { Data: email.html, Charset: 'UTF-8' },
            },
          },
        },
      }),
    );
    return MessageId;
  }
}
