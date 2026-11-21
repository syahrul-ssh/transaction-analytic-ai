import { Processor, WorkerHost } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "../../../infrastructure/queues/queue.constants";
import { Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TransactionAnalysis } from "../../../entities/transaction-analysis.entity";
import { Repository } from "typeorm";
import { AnalysisDatasetService } from "../services/analytics-dataset.service";
import { AiProviderService } from "../../ai/ai-provider.service";
import { Job } from "bullmq";
import { AnalysisStatus, AnalysisType } from "../../../utils/enums/analysis.enum";
import { ConfigService } from "@nestjs/config";


interface AnalysisJobData {
  analysisId: string;
}

@Processor(QUEUE_NAMES.TRANSACTION_ANALYSIS)
export class AnalyticsProcessor extends WorkerHost {
  private readonly logger = new Logger(
    AnalyticsProcessor.name,
  );

  constructor(
    @InjectRepository(TransactionAnalysis)
    private readonly analysisRepository: Repository<TransactionAnalysis>,

    private readonly datasetService: AnalysisDatasetService,

    private readonly aiProviderService: AiProviderService,

    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(
    job: Job<AnalysisJobData>,
  ): Promise<void> {
    if (job.name !== 'run-analysis') {
      throw new Error(
        `Unsupported job: ${job.name}`,
      );
    }

    const { analysisId } = job.data;

    this.logger.log(
      `Processing analysis ${analysisId}`,
    );

    const analysis =
      await this.analysisRepository.findOne({
        where: {
          id: analysisId,
        },
      });

    if (!analysis) {
      throw new Error(
        `Analysis ${analysisId} not found`,
      );
    }

    // Prevent accidental processing of already completed jobs.
    if (
      analysis.status === AnalysisStatus.COMPLETED
    ) {
      this.logger.warn(
        `Analysis ${analysisId} already completed`,
      );

      return;
    }

    try {
      await this.analysisRepository.update(
        analysisId,
        {
          status: AnalysisStatus.PROCESSING,
          startedAt: new Date(),
          errorMessage: null,
        },
      );

      await job.updateProgress(10);

      // 1. Prepare analysis dataset
      const dataset =
        await this.datasetService.buildDataset(
          analysis.parameters ?? {},
        );

      await this.analysisRepository.update(
        analysisId,
        {
          datasetSummary: dataset as Record<string, any>,
        },
      );

      await job.updateProgress(35);

      // 2. Build prompts
      const systemPrompt =
        this.buildSystemPrompt(
          analysis.analysisType,
        );

      const userPrompt =
        this.buildUserPrompt(
          analysis.analysisType,
          dataset,
        );

      // 3. Call AI
      const rawResponse =
        await this.aiProviderService.generateAnalysis(
          systemPrompt,
          userPrompt,
        );

      await job.updateProgress(75);

      // 4. Validate/parse AI output
      const result =
        this.parseAiResponse(rawResponse);

      // 5. Persist result
      await this.analysisRepository.update(
        analysisId,
        {
          result,
          status: AnalysisStatus.COMPLETED,
          completedAt: new Date(),
          model: this.configService.get<string>('ai.model') || 'unknown',
          promptVersion: 'v1',
          errorMessage: null,
        },
      );

      await job.updateProgress(100);

      this.logger.log(
        `Analysis ${analysisId} completed successfully`,
      );
    } catch (error) {
      this.logger.error(
        `Analysis ${analysisId} failed: ${(error as unknown as any).message}`,
        (error as unknown as any).stack,
      );

      await this.analysisRepository.update(
        analysisId,
        {
          status: AnalysisStatus.FAILED,
          retryCount: job.attemptsMade + 1,
          errorMessage: (error as unknown as any).message,
        },
      );

      // Important: rethrow so BullMQ can retry.
      throw error;
    }
  }

  private buildSystemPrompt(
    analysisType: AnalysisType,
  ): string {
    return `
You are a financial transaction analysis assistant.

Analyze the provided transaction dataset carefully.

Rules:
- Use only facts supported by the supplied dataset.
- Do not invent transactions, amounts, trends, or explanations.
- Treat transfers separately from income and expenses.
- Never combine different currencies.
- Distinguish observed facts from hypotheses.
- If the dataset is insufficient, clearly state limitations.
- Do not provide investment, tax, or legal advice.
- Recommendations should be practical and based on evidence.
- Return valid JSON only.
- Do not include markdown fences.

Analysis type: ${analysisType}

Return this JSON structure:

{
  "summary": "string",
  "insights": [
    {
      "title": "string",
      "description": "string",
      "severity": "INFO | WARNING | CRITICAL",
      "metric": {
        "name": "string",
        "value": "number or string",
        "currency": "string"
      }
    }
  ],
  "recommendations": [
    {
      "title": "string",
      "description": "string",
      "priority": "LOW | MEDIUM | HIGH"
    }
  ],
  "anomalies": [
    {
      "transactionId": "optional string",
      "description": "string",
      "reason": "string",
      "severity": "LOW | MEDIUM | HIGH"
    }
  ],
  "limitations": [
    "string"
  ]
}
`.trim();
  }

  private buildUserPrompt(
    analysisType: AnalysisType,
    dataset: Record<string, any>,
  ): string {
    return `
Analysis type: ${analysisType}

Analyze this structured transaction dataset.

Dataset:
${JSON.stringify(dataset, null, 2)}

Provide insights relevant to this analysis type:
${analysisType}

Remember:
- Every numeric claim must be supported by the dataset.
- Do not compare amounts from different currencies.
- Explain the evidence for anomalies.
- Return valid JSON only.
`.trim();
  }

  private parseAiResponse(
    rawResponse: string,
  ): Record<string, any> {
    if (!rawResponse?.trim()) {
      throw new Error(
        'AI returned an empty response',
      );
    }

    try {
      const parsed = JSON.parse(rawResponse);

      if (
        typeof parsed.summary !== 'string' ||
        !Array.isArray(parsed.insights) ||
        !Array.isArray(parsed.recommendations) ||
        !Array.isArray(parsed.anomalies) ||
        !Array.isArray(parsed.limitations)
      ) {
        throw new Error(
          'AI response does not match expected schema',
        );
      }

      return parsed;
    } catch (error) {
      throw new Error(
        `Invalid AI response: ${(error as unknown as any).message}`,
      );
    }
  }
}