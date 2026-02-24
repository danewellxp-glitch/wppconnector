import { Controller, Get, Param, Res, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as http from 'http';
import * as https from 'https';

@Controller('files')
export class WahaFilesController {
  private readonly logger = new Logger(WahaFilesController.name);

  constructor(private configService: ConfigService) {}

  @Get(':session/:filename')
  proxyFile(
    @Param('session') session: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const wahaUrl =
      this.configService.get('WAHA_API_URL') || 'http://localhost:3101';
    const wahaApiKey = this.configService.get('WAHA_API_KEY') || '';
    const decodedFilename = decodeURIComponent(filename);
    const targetUrl = `${wahaUrl}/api/files/${session}/${decodedFilename}`;

    this.logger.debug(`Proxying WAHA file: ${targetUrl}`);

    const headers: Record<string, string> = {};
    if (wahaApiKey) {
      headers['X-Api-Key'] = wahaApiKey;
    }

    const protocol = targetUrl.startsWith('https') ? https : http;

    const req = protocol.get(targetUrl, { headers }, (proxyRes) => {
      res.status(proxyRes.statusCode || 200);
      if (proxyRes.headers['content-type']) {
        res.setHeader('content-type', proxyRes.headers['content-type']);
      }
      if (proxyRes.headers['content-length']) {
        res.setHeader('content-length', proxyRes.headers['content-length']);
      }
      res.setHeader('cache-control', 'public, max-age=3600');
      proxyRes.pipe(res);
    });

    req.on('error', (err) => {
      this.logger.error(`Proxy error for ${targetUrl}: ${err.message}`);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Failed to proxy media file' });
      }
    });
  }
}
