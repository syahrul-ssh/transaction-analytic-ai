import { Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import OpenAI from 'openai';

@Injectable()
export class AiProviderService {
  private readonly client: OpenAI;

  constructor(
    private readonly configService: ConfigService,
  ) {
    this.client = new OpenAI({
      apiKey: this.configService.get<string>(
        'ai.apiKey',
      ),
      timeout: this.configService.get<number>(
        'ai.timeoutMs',
      ),
      maxRetries: 2,
    });
  }

  async generateAnalysis(
    systemPrompt: string,
    userPrompt: string,
  ) {
    const response = await this.client.responses.create({
      model: this.configService.get<string>(
        'ai.model',
      )!,
      max_output_tokens:
        this.configService.get<number>(
          'ai.maxOutputTokens',
        ) ?? 3000,

      input: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    return response.output_text;
  }
}