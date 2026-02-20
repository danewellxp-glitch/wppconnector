import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly metaBaseUrl = 'https://graph.facebook.com/v21.0';
  private readonly provider: string;
  private readonly wahaApiUrl: string;
  private readonly wahaApiKey: string;
  private readonly wahaSession: string;

  constructor(private configService: ConfigService) {
    this.provider =
      this.configService.get<string>('WHATSAPP_PROVIDER') || 'META';
    this.wahaApiUrl =
      this.configService.get<string>('WAHA_API_URL') ||
      'http://192.168.10.156:3101';
    this.wahaApiKey = this.configService.get<string>('WAHA_API_KEY') || '';
    this.wahaSession =
      this.configService.get<string>('WAHA_SESSION') || 'default';
    this.logger.log(`WhatsApp provider: ${this.provider}`);
  }

  private isWaha(): boolean {
    return this.provider === 'WAHA';
  }

  async sendTextMessage(
    accessToken: string,
    phoneNumberId: string,
    to: string,
    text: string,
  ) {
    if (this.isWaha()) {
      return this.wahaSendText(to, text);
    }
    return this.metaSendText(accessToken, phoneNumberId, to, text);
  }

  async markAsRead(
    accessToken: string,
    phoneNumberId: string,
    messageId: string,
  ) {
    if (this.isWaha()) {
      return this.wahaMarkAsRead(messageId);
    }
    return this.metaMarkAsRead(accessToken, phoneNumberId, messageId);
  }

  async retrieveMedia(
    accessToken: string,
    mediaId: string,
  ): Promise<{ url: string; mimeType: string } | null> {
    if (this.isWaha()) {
      // WAHA provides media URL directly in webhook payload
      // mediaId in WAHA context is already the full URL
      return { url: mediaId, mimeType: 'application/octet-stream' };
    }
    return this.metaRetrieveMedia(accessToken, mediaId);
  }

  async getMediaUrl(
    accessToken: string,
    mediaId: string,
  ): Promise<string | null> {
    if (this.isWaha()) {
      return mediaId; // Already a URL
    }
    return this.metaGetMediaUrl(accessToken, mediaId);
  }

  async downloadMedia(
    accessToken: string,
    mediaUrl: string,
  ): Promise<Buffer | null> {
    if (this.isWaha()) {
      return this.wahaDownloadMedia(mediaUrl);
    }
    return this.metaDownloadMedia(accessToken, mediaUrl);
  }

  /**
   * Resolve a WAHA chatId (LID or @c.us) to real contact info.
   * Returns null if resolution fails.
   */
  async getContactInfo(contactId: string): Promise<{
    number: string;
    pushname: string | null;
    name: string | null;
    isBusiness: boolean;
    profilePictureURL: string | null;
  } | null> {
    if (!this.isWaha()) return null;
    try {
      const res = await axios.get(`${this.wahaApiUrl}/api/contacts`, {
        params: { session: this.wahaSession, contactId },
        headers: this.wahaHeaders(),
      });
      const d = res.data;
      // Try profile picture in a separate call (non-blocking)
      let profilePictureURL: string | null = null;
      try {
        const picRes = await axios.get(
          `${this.wahaApiUrl}/api/contacts/profile-picture`,
          {
            params: { session: this.wahaSession, contactId },
            headers: this.wahaHeaders(),
          },
        );
        profilePictureURL = picRes.data?.profilePictureURL || null;
      } catch {
        // ignore - some contacts don't have profile pictures
      }
      return {
        number: d.number || null,
        pushname: d.pushname || null,
        name: d.name || d.shortName || null,
        isBusiness: d.isBusiness || false,
        profilePictureURL,
      };
    } catch (error: any) {
      this.logger.warn(
        `[WAHA] Failed to resolve contact ${contactId}: ${error.message}`,
      );
      return null;
    }
  }

  async sendMediaMessage(
    _accessToken: string,
    _phoneNumberId: string,
    to: string,
    base64Data: string,
    filename: string,
    caption?: string,
  ) {
    if (this.isWaha()) {
      return this.wahaSendFile(to, base64Data, filename, caption);
    }
    throw new Error('Media sending is only supported with WAHA provider');
  }

  // ===== WAHA Methods =====

  private wahaHeaders() {
    return this.wahaApiKey
      ? { 'X-Api-Key': this.wahaApiKey, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  }

  private getMimetype(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      mp3: 'audio/mpeg',
      ogg: 'audio/ogg',
      mp4: 'video/mp4',
    };
    return map[ext] || 'application/octet-stream';
  }

  private async wahaSendFile(
    to: string,
    base64Data: string,
    filename: string,
    caption?: string,
  ) {
    const chatId = to.includes('@') ? to : `${to}@c.us`;
    const mimetype = this.getMimetype(filename);
    const isImage = mimetype.startsWith('image/');
    const endpoint = isImage ? '/api/sendImage' : '/api/sendFile';
    try {
      const response = await axios.post(
        `${this.wahaApiUrl}${endpoint}`,
        {
          session: this.wahaSession,
          chatId,
          file: { mimetype, filename, data: base64Data },
          caption: caption || '',
        },
        { headers: this.wahaHeaders() },
      );
      const data = response.data;
      const rawId = data?.id;
      const messageId =
        typeof rawId === 'string'
          ? rawId
          : rawId?._serialized ||
            rawId?.id ||
            data?.key?.id ||
            `waha_${Date.now()}`;
      return { messages: [{ id: messageId }] };
    } catch (error: any) {
      this.logger.error(
        `[WAHA] Failed to send file to ${to}`,
        error.response?.status,
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  private async wahaSendText(to: string, text: string) {
    const chatId = to.includes('@') ? to : `${to}@c.us`;
    try {
      const response = await axios.post(
        `${this.wahaApiUrl}/api/sendText`,
        { session: this.wahaSession, chatId, text },
        { headers: this.wahaHeaders() },
      );

      const data = response.data;
      this.logger.log(`[WAHA] Response for ${to}: ${JSON.stringify(data)}`);

      // WAHA returns id as object { fromMe, remote, id, _serialized } or as string
      const rawId = data?.id;
      const messageId =
        typeof rawId === 'string'
          ? rawId
          : rawId?._serialized ||
            rawId?.id ||
            data?.key?.id ||
            `waha_${Date.now()}`;

      return { messages: [{ id: messageId }] };
    } catch (error: any) {
      this.logger.error(
        `[WAHA] Failed to send message to ${to}`,
        error.response?.status,
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  private async wahaMarkAsRead(messageId: string) {
    try {
      // Extract chatId from messageId (format: true_phone@c.us_ID)
      const parts = messageId.split('_');
      const chatId = parts.length >= 2 ? parts[1] : messageId;

      await axios.post(
        `${this.wahaApiUrl}/api/sendSeen`,
        { session: this.wahaSession, chatId },
        { headers: this.wahaHeaders() },
      );
    } catch (error: any) {
      this.logger.error('[WAHA] Failed to mark as read', error.message);
    }
  }

  private async wahaDownloadMedia(mediaUrl: string): Promise<Buffer | null> {
    try {
      const response = await axios.get(mediaUrl, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error: any) {
      this.logger.error('[WAHA] Failed to download media', error.message);
      return null;
    }
  }

  // ===== Meta Methods =====

  private async metaSendText(
    accessToken: string,
    phoneNumberId: string,
    to: string,
    text: string,
  ) {
    try {
      const response = await axios.post(
        `${this.metaBaseUrl}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(
        `Message sent to ${to}: ${response.data.messages?.[0]?.id}`,
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Failed to send message to ${to}`,
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  private async metaMarkAsRead(
    accessToken: string,
    phoneNumberId: string,
    messageId: string,
  ) {
    try {
      await axios.post(
        `${this.metaBaseUrl}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (error: any) {
      this.logger.error('Failed to mark message as read', error.message);
    }
  }

  private async metaGetMediaUrl(
    accessToken: string,
    mediaId: string,
  ): Promise<string | null> {
    try {
      const response = await axios.get(`${this.metaBaseUrl}/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return response.data.url || null;
    } catch (error: any) {
      this.logger.error(
        `Failed to get media URL for ${mediaId}`,
        error.response?.data || error.message,
      );
      return null;
    }
  }

  private async metaDownloadMedia(
    accessToken: string,
    mediaUrl: string,
  ): Promise<Buffer | null> {
    try {
      const response = await axios.get(mediaUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error: any) {
      this.logger.error(
        'Failed to download media',
        error.response?.data || error.message,
      );
      return null;
    }
  }

  private async metaRetrieveMedia(
    accessToken: string,
    mediaId: string,
  ): Promise<{ url: string; mimeType: string } | null> {
    try {
      const metaResponse = await axios.get(`${this.metaBaseUrl}/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const { url, mime_type } = metaResponse.data;
      if (!url) return null;

      return { url, mimeType: mime_type || 'application/octet-stream' };
    } catch (error: any) {
      this.logger.error(
        `Failed to retrieve media ${mediaId}`,
        error.response?.data || error.message,
      );
      return null;
    }
  }
}
