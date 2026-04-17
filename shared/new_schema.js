import { z } from 'zod'

const categoryEnum = z.enum(['technology', 'application', 'policy', 'capital'])
const nonEmptyShortArray = z.array(z.string()).min(1).max(4)

export const newsInsightSchema = z.object({
  contextNewsId: z.string(),
  summary: z.string(),
  category: categoryEnum,
  entities: z.array(z.string()).max(5),
  signals: nonEmptyShortArray,
  importanceHint: z.number().int().min(1).max(5),
  evidence: z.array(z.string()).min(1).max(3),
})

export const newsInsightBatchSchema = z.object({
  insights: z.array(newsInsightSchema).min(1).max(5),
})

export const NEWS_INSIGHT_BATCH_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['insights'],
  properties: {
    insights: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['contextNewsId', 'summary', 'category', 'entities', 'signals', 'importanceHint', 'evidence'],
        properties: {
          contextNewsId: { type: 'string' },
          summary: { type: 'string' },
          category: {
            type: 'string',
            enum: ['technology', 'application', 'policy', 'capital'],
          },
          entities: {
            type: 'array',
            maxItems: 5,
            items: { type: 'string' },
          },
          signals: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: { type: 'string' },
          },
          importanceHint: {
            type: 'integer',
            minimum: 1,
            maximum: 5,
          },
          evidence: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: { type: 'string' },
          },
        },
      },
    },
  },
}

export const topEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  whyImportant: z.string(),
  category: categoryEnum,
  contextNewsIds: z.array(z.string()).min(1).max(4),
  evidence: z.array(z.string()).min(1).max(3),
})

export const deepDiveSchema = z.object({
  eventId: z.string(),
  title: z.string(),
  background: z.string(),
  impact: z.string(),
  riskOrOpportunity: z.string(),
  contextNewsIds: z.array(z.string()).min(1).max(4),
  evidence: z.array(z.string()).min(1).max(3),
})

export const trendJudgmentSchema = z.object({
  dimension: categoryEnum,
  judgment: z.string(),
  signals: z.array(z.string()).min(1).max(4),
  relatedEventIds: z.array(z.string()).max(5),
})

export const dailyReportSchema = z.object({
  generatedAt: z.string(),
  reportTitle: z.string(),
  executiveSummary: z.string(),
  topEvents: z.array(topEventSchema).min(3).max(5),
  deepDives: z.array(deepDiveSchema).min(2).max(3),
  trendJudgments: z.array(trendJudgmentSchema).length(4),
})

export const DAILY_REPORT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['generatedAt', 'reportTitle', 'executiveSummary', 'topEvents', 'deepDives', 'trendJudgments'],
  properties: {
    generatedAt: { type: 'string' },
    reportTitle: { type: 'string' },
    executiveSummary: { type: 'string' },
    topEvents: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'summary', 'whyImportant', 'category', 'contextNewsIds', 'evidence'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          whyImportant: { type: 'string' },
          category: {
            type: 'string',
            enum: ['technology', 'application', 'policy', 'capital'],
          },
          contextNewsIds: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: { type: 'string' },
          },
          evidence: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: { type: 'string' },
          },
        },
      },
    },
    deepDives: {
      type: 'array',
      minItems: 2,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['eventId', 'title', 'background', 'impact', 'riskOrOpportunity', 'contextNewsIds', 'evidence'],
        properties: {
          eventId: { type: 'string' },
          title: { type: 'string' },
          background: { type: 'string' },
          impact: { type: 'string' },
          riskOrOpportunity: { type: 'string' },
          contextNewsIds: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: { type: 'string' },
          },
          evidence: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: { type: 'string' },
          },
        },
      },
    },
    trendJudgments: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['dimension', 'judgment', 'signals', 'relatedEventIds'],
        properties: {
          dimension: {
            type: 'string',
            enum: ['technology', 'application', 'policy', 'capital'],
          },
          judgment: { type: 'string' },
          signals: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: { type: 'string' },
          },
          relatedEventIds: {
            type: 'array',
            maxItems: 5,
            items: { type: 'string' },
          },
        },
      },
    },
  },
}
