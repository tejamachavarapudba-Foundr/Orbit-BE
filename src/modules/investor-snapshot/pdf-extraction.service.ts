import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PDFParse } from 'pdf-parse';

import { PrismaService } from '../../prisma/prisma.service';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';
const MAX_EXTRACTED_TEXT_CHARS = 30000;
const MIN_EXTRACTED_TEXT_CHARS = 200;

// Every field a pitch deck could plausibly state or imply. Deliberately
// excludes document-URL fields (pitchDeckUrl, govtIdDocUrl, etc — those are
// uploaded files, not inferable text), social links, and app-managed flags
// (completionPercentage, isCompleted, isInvestorReady, ...) — none of those
// are ever requested from the model, so there's no path for them to leak
// through this feature.
const STRING_FIELDS = [
  'targetCustomers',
  'businessModel',
  'revenueStreams',
  'marketOpportunity',
  'startupVision',
  'problemStatement',
  'solutionSummary',
  'keyPartnerships',
  'majorAchievements',
  'currentRound',
  'topRisks',
  'competition',
  'operationalChallenges',
  'regulatoryRisks',
  'mitigationPlan',
  'keyAssumptions',
] as const;

const INT_FIELDS = [
  'totalUsers',
  'activeUsers',
  'payingCustomers',
  'enterpriseCustomers',
  'projectedCustomers',
  'projectedTeamSize',
] as const;

const FLOAT_FIELDS = [
  'customerGrowthRate',
  'revenueGrowthRate',
  'mrr',
  'arr',
  'cashBalance',
  'burnRate',
  'runwayMonths',
  'grossMargin',
  'cac',
  'ltv',
  'ltvCacRatio',
  'churnRate',
  'ebitda',
  'ebitdaPercent',
  'amountRaising',
  'equityOffered',
  'minimumCheckSize',
  'maximumCheckSize',
  'founderOwnership',
  'employeeEsop',
  'investorOwnership',
  'availablePool',
  'year1Revenue',
  'year2Revenue',
  'year3Revenue',
  'expectedRunwayAfterRaise',
] as const;

const ALL_FIELDS: string[] = [...STRING_FIELDS, ...INT_FIELDS, ...FLOAT_FIELDS, 'useOfFunds'];

function buildJsonSchema() {
  const properties: Record<string, unknown> = {};

  for (const field of STRING_FIELDS) {
    properties[field] = {
      type: ['string', 'null'],
      description: `The deck's ${field}, verbatim or closely summarized. null if not present in the text.`,
    };
  }
  for (const field of INT_FIELDS) {
    properties[field] = { type: ['integer', 'null'] };
  }
  for (const field of FLOAT_FIELDS) {
    properties[field] = { type: ['number', 'null'] };
  }
  properties.useOfFunds = {
    type: 'array',
    items: { type: 'string' },
    description: 'Short bullet points on how the raised funds will be used. Empty array if not mentioned.',
  };

  return {
    name: 'investor_snapshot_extraction',
    strict: true,
    schema: {
      type: 'object',
      properties,
      required: Object.keys(properties),
      additionalProperties: false,
    },
  };
}

@Injectable()
export class PdfExtractionService {
  private readonly logger = new Logger(PdfExtractionService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get apiKey() {
    return process.env.OPENAI_API_KEY ?? '';
  }

  async extractFromPdf(projectId: string, userId: string, file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Please upload a PDF file.');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.ownerId !== userId) {
      throw new ForbiddenException('You do not own this project');
    }

    if (!this.apiKey) {
      this.logger.error('OPENAI_API_KEY not set — cannot extract pitch deck');
      throw new BadRequestException('Automatic extraction is not available right now. Please fill in the details manually.');
    }

    const text = await this.extractText(file.buffer);
    if (text.trim().length < MIN_EXTRACTED_TEXT_CHARS) {
      throw new UnprocessableEntityException(
        "Couldn't read text from this PDF — it may be a scanned document. Please fill in the details manually.",
      );
    }

    const truncated = text.slice(0, MAX_EXTRACTED_TEXT_CHARS);
    const extracted = await this.callModelWithRetry(truncated);

    return { extracted };
  }

  private async extractText(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text ?? '';
    } finally {
      await parser.destroy();
    }
  }

  private async callModelWithRetry(deckText: string): Promise<Record<string, unknown>> {
    try {
      return await this.callModel(deckText);
    } catch (error) {
      this.logger.warn(`Pitch deck extraction failed once, retrying: ${error}`);
      try {
        return await this.callModel(deckText);
      } catch (retryError) {
        this.logger.error(`Pitch deck extraction failed on retry: ${retryError}`);
        throw new BadRequestException('Automatic extraction failed — please fill in the details manually.');
      }
    }
  }

  private async callModel(deckText: string): Promise<Record<string, unknown>> {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'You extract structured facts from startup pitch decks. Only use values explicitly stated or directly ' +
              'calculable from the provided text. Never estimate, guess, or invent a number or fact. If a field is not ' +
              'present in the text, return null for it (or an empty array for list fields).',
          },
          {
            role: 'user',
            content: `Extract the requested fields from this pitch deck text:\n\n${deckText}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: buildJsonSchema(),
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`OpenAI extraction call failed: ${res.status} ${body}`);
      throw new Error(`OpenAI call failed with status ${res.status}`);
    }

    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI response had no content');
    }

    const parsed = JSON.parse(content);

    // Defensive filter: only forward fields we actually asked for, even
    // though strict mode should already guarantee this shape.
    const filtered: Record<string, unknown> = {};
    for (const field of ALL_FIELDS) {
      if (field in parsed) filtered[field] = parsed[field];
    }
    return filtered;
  }
}
