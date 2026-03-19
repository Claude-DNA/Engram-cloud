// Extraction pipeline — Area 4.2
// Orchestrates the full AI-powered extraction from ImportChunk → ExtractedEngramItem[]

import type { AIProvider } from '../ai/AIProvider';
import type { CostGovernor } from '../ai/CostGovernor';
import type { ImportChunk, ExtractedEngramItem } from '../import/types';
import { RecoveryManager } from '../recovery/RecoveryManager';
import { buildLearnedRulesText } from '../learning/PromptTuner';
import { findDuplicates } from '../dedup/SemanticDeduper';
import { diffStates } from '../state/StateDiffEngine';
import { generateUUIDv7 as generateId } from '../../lib/uuid';

import {
  extractionSystemPrompt,
  extractionPass1Prompt,
  extractionPass2Prompt,
  quickExtractPrompt,
} from '../prompts/extraction';
import { redactionSystemPrompt, redactionPrompt } from '../prompts/redaction';
import { classificationSystemPrompt, classificationPrompt } from '../prompts/classification';
import { temporalSystemPrompt, temporalPrompt } from '../prompts/temporal';
import { stateSystemPrompt, statePrompt } from '../prompts/state';
import { transformationSystemPrompt, transformationPrompt } from '../prompts/transformation';
import { relationshipSystemPrompt, relationshipPrompt } from '../prompts/relationship';
import { taggingSystemPrompt, taggingPrompt } from '../prompts/tagging';
import { confidenceSystemPrompt, confidencePrompt } from '../prompts/confidence';
import { qaSystemPrompt, qaPrompt } from '../prompts/qa';

export interface PipelineOptions {
  quickMode: boolean;
  provider: AIProvider;
  model: string;
  governor: CostGovernor;
  onProgress?: (stage: string, percent: number) => void;
}

export interface PipelineResult {
  items: ExtractedEngramItem[];
  rawImportFallback: boolean;
  stagesCompleted: string[];
}

const MODEL_TEMPERATURE = 0.3;
const MAX_TOKENS = 4096;

export class ExtractionPipeline {
  private recovery = new RecoveryManager();

  constructor(private opts: PipelineOptions) {}

  async process(chunk: ImportChunk): Promise<PipelineResult> {
    const { quickMode, provider, model, governor, onProgress } = this.opts;

    if (quickMode) {
      return this.runQuickMode(chunk, provider, model, governor, onProgress);
    }
    return this.runFullMode(chunk, provider, model, governor, onProgress);
  }

  // ── Quick mode (~3 AI calls) ────────────────────────────────────────────────

  private async runQuickMode(
    chunk: ImportChunk,
    provider: AIProvider,
    model: string,
    governor: CostGovernor,
    onProgress?: (stage: string, percent: number) => void,
  ): Promise<PipelineResult> {
    const stagesCompleted: string[] = [];
    const learnedRules = await buildLearnedRulesText();

    // 1. Quick extract (extraction + classification + temporal combined)
    onProgress?.('Extracting', 10);
    const decision = governor.canProceed(chunk.tokenEstimate, 800, provider.name);
    if (!decision.proceed) {
      return this.rawFallback(chunk, ['governor_blocked']);
    }

    let rawItems: Array<{
      title: string; content: string; cloudType: string;
      date: string | null; tags: string[]; confidence: number;
    }> = [];

    try {
      const resp = await provider.sendPrompt(
        extractionSystemPrompt(),
        quickExtractPrompt(chunk.text, learnedRules),
        model,
        MODEL_TEMPERATURE,
        MAX_TOKENS,
      );
      governor.recordUsage(resp.usage.inputTokens, resp.usage.outputTokens, provider.name);
      rawItems = safeParseArray(resp.content);
      stagesCompleted.push('quick_extract');
    } catch (err) {
      console.error('[QuickExtract]', err);
      return this.rawFallback(chunk, ['quick_extract_failed']);
    }

    if (rawItems.length === 0) {
      return { items: [], rawImportFallback: false, stagesCompleted: ['quick_extract_empty'] };
    }

    // 2. Auto-redact
    onProgress?.('Redacting', 40);
    const redactedItems = await this.runRedaction(rawItems.map((i) => i.content), provider, model, governor);
    stagesCompleted.push('redaction');

    // 3. Deduplication
    onProgress?.('Deduplicating', 70);
    const dedupItems = rawItems.map((item, idx) => ({
      id: generateId(),
      title: item.title,
      content: redactedItems[idx] ?? item.content,
      date: item.date ?? undefined,
    }));
    const dupes = findDuplicates(dedupItems);
    stagesCompleted.push('dedup');

    onProgress?.('Finalising', 90);

    const items: ExtractedEngramItem[] = dedupItems.map((item, idx) => {
      const raw = rawItems[idx];
      const dupeResult = dupes.find((d) => d.itemId === item.id);
      return {
        id: item.id,
        chunkId: chunk.id,
        title: item.title,
        content: item.content,
        cloudType: raw.cloudType,
        date: raw.date ?? undefined,
        tags: raw.tags,
        confidence: raw.confidence,
        selected: raw.confidence >= 0.5,
        isDuplicate: !!dupeResult,
        duplicateOf: dupeResult?.possibleDuplicateOf,
        isTransformationCandidate: dupeResult?.isTransformationCandidate,
      } as ExtractedEngramItem;
    });

    return { items, rawImportFallback: false, stagesCompleted };
  }

  // ── Full mode (~9 AI calls) ─────────────────────────────────────────────────

  private async runFullMode(
    chunk: ImportChunk,
    provider: AIProvider,
    model: string,
    governor: CostGovernor,
    onProgress?: (stage: string, percent: number) => void,
  ): Promise<PipelineResult> {
    const stagesCompleted: string[] = [];
    const learnedRules = await buildLearnedRulesText();

    // Stage 1: Auto-redact the raw chunk text
    onProgress?.('Redacting', 5);
    let workingText = chunk.text;
    const redactionMapGlobal: Record<string, string> = {};

    try {
      const canRedact = governor.canProceed(chunk.tokenEstimate, 400, provider.name);
      if (canRedact.proceed) {
        const resp = await provider.sendPrompt(
          redactionSystemPrompt(),
          redactionPrompt(chunk.text),
          model,
          0.1,
          1024,
        );
        governor.recordUsage(resp.usage.inputTokens, resp.usage.outputTokens, provider.name);
        const redacted = safeParse<{ redactedText: string; tokenTypes: Record<string, string> }>(resp.content);
        if (redacted?.redactedText) {
          workingText = redacted.redactedText;
          Object.assign(redactionMapGlobal, redacted.tokenTypes ?? {});
        }
        stagesCompleted.push('redaction');
      }
    } catch (err) {
      console.warn('[Redaction] failed, continuing with raw text:', err);
    }

    // Stage 2a: Extraction pass 1
    onProgress?.('Extracting (pass 1)', 15);
    const canExtract = governor.canProceed(chunk.tokenEstimate, 1200, provider.name);
    if (!canExtract.proceed) {
      return this.rawFallback(chunk, [...stagesCompleted, 'governor_blocked']);
    }

    let pass1Items: Array<{ title: string; content: string; rawDate?: string; cloudTypeHint?: string }> = [];
    try {
      const resp = await provider.sendPrompt(
        extractionSystemPrompt(),
        extractionPass1Prompt(workingText, learnedRules),
        model,
        MODEL_TEMPERATURE,
        MAX_TOKENS,
      );
      governor.recordUsage(resp.usage.inputTokens, resp.usage.outputTokens, provider.name);
      pass1Items = safeParseArray(resp.content);
      stagesCompleted.push('extraction_pass1');
    } catch (err) {
      console.error('[ExtractionPass1]', err);
      return this.rawFallback(chunk, [...stagesCompleted, 'extraction_pass1_failed']);
    }

    if (pass1Items.length === 0) {
      return { items: [], rawImportFallback: false, stagesCompleted: [...stagesCompleted, 'empty'] };
    }

    // Stage 2b: Extraction pass 2 (refinement)
    onProgress?.('Refining', 25);
    let refinedItems = pass1Items;
    try {
      const canRefine = governor.canProceed(chunk.tokenEstimate, 800, provider.name);
      if (canRefine.proceed) {
        const resp = await provider.sendPrompt(
          extractionSystemPrompt(),
          extractionPass2Prompt(JSON.stringify(pass1Items), workingText),
          model,
          MODEL_TEMPERATURE,
          MAX_TOKENS,
        );
        governor.recordUsage(resp.usage.inputTokens, resp.usage.outputTokens, provider.name);
        refinedItems = safeParseArray(resp.content) ?? pass1Items;
        stagesCompleted.push('extraction_pass2');
      }
    } catch (err) {
      console.warn('[ExtractionPass2] failed, using pass1 results:', err);
    }

    // Assign temp IDs
    const itemsWithIds = refinedItems.map((item) => ({
      ...item,
      id: generateId(),
    }));

    // Stage 3: Parallel enrichment
    onProgress?.('Enriching', 40);
    const canEnrich = governor.canProceed(chunk.tokenEstimate * 2, 2000, provider.name);

    let classifications: Array<{ id: string; cloudType: string; confidence: number }> = [];
    let temporals: Array<{ id: string; date: string | null; dateConfidence: number }> = [];
    let states: Array<{ id: string; stateData: Record<string, unknown> }> = [];
    let relationships: Array<{ itemAId: string; itemBId: string; relationshipType: string }> = [];
    let tags: Array<{ id: string; tags: string[] }> = [];

    if (canEnrich.proceed) {
      const enrichPromises = [
        this.runClassification(itemsWithIds, provider, model, governor).then((r) => { classifications = r; }),
        this.runTemporal(itemsWithIds, provider, model, governor).then((r) => { temporals = r; }),
        this.runState(itemsWithIds, provider, model, governor).then((r) => { states = r; }),
        this.runRelationships(itemsWithIds, provider, model, governor).then((r) => { relationships = r; }),
        this.runTagging(itemsWithIds, provider, model, governor).then((r) => { tags = r; }),
      ];
      await Promise.allSettled(enrichPromises);
      stagesCompleted.push('enrichment');
    }

    // Stage 4: Transformation detection
    onProgress?.('Detecting transformations', 65);
    let transformations: Array<{ sourceId: string; targetId: string; type: string; confidence: number; description: string }> = [];
    try {
      const canTransform = governor.canProceed(1000, 400, provider.name);
      if (canTransform.proceed && itemsWithIds.length >= 2) {
        const itemsForTransform = itemsWithIds.map((item) => {
          const state = states.find((s) => s.id === item.id);
          return { id: item.id, title: item.title, content: item.content, stateData: state?.stateData };
        });
        const resp = await provider.sendPrompt(
          transformationSystemPrompt(),
          transformationPrompt(itemsForTransform),
          model,
          0.2,
          1024,
        );
        governor.recordUsage(resp.usage.inputTokens, resp.usage.outputTokens, provider.name);
        transformations = safeParseArray(resp.content) ?? [];
        stagesCompleted.push('transformation_detection');
      }
    } catch (err) {
      console.warn('[TransformationDetection] failed:', err);
    }

    // Stage 5: Confidence scoring
    onProgress?.('Scoring confidence', 75);
    let confidences: Array<{ id: string; confidence: number; qualityIssues: string[] }> = [];
    try {
      const canScore = governor.canProceed(1000, 400, provider.name);
      if (canScore.proceed) {
        const itemsForConf = itemsWithIds.map((item) => {
          const cls = classifications.find((c) => c.id === item.id);
          const temp = temporals.find((t) => t.id === item.id);
          const tgs = tags.find((t) => t.id === item.id);
          return {
            id: item.id,
            title: item.title,
            content: item.content,
            cloudType: cls?.cloudType,
            date: temp?.date ?? undefined,
            tags: tgs?.tags,
          };
        });
        const resp = await provider.sendPrompt(
          confidenceSystemPrompt(),
          confidencePrompt(itemsForConf),
          model,
          0.1,
          1024,
        );
        governor.recordUsage(resp.usage.inputTokens, resp.usage.outputTokens, provider.name);
        confidences = safeParseArray(resp.content) ?? [];
        stagesCompleted.push('confidence_scoring');
      }
    } catch (err) {
      console.warn('[ConfidenceScoring] failed:', err);
    }

    // Stage 6: Quality assurance
    onProgress?.('Quality check', 85);
    const keptIds = new Set(itemsWithIds.map((i) => i.id));
    const mergeMap = new Map<string, string>();
    const retitleMap = new Map<string, string>();
    const reclassMap = new Map<string, string>();

    try {
      const canQA = governor.canProceed(1000, 400, provider.name);
      if (canQA.proceed) {
        const itemsForQA = itemsWithIds.map((item) => {
          const cls = classifications.find((c) => c.id === item.id);
          const temp = temporals.find((t) => t.id === item.id);
          const conf = confidences.find((c) => c.id === item.id);
          const tgs = tags.find((t) => t.id === item.id);
          return {
            id: item.id,
            title: item.title,
            content: item.content,
            cloudType: cls?.cloudType,
            date: temp?.date ?? undefined,
            confidence: conf?.confidence ?? 0.5,
            tags: tgs?.tags,
          };
        });
        const resp = await provider.sendPrompt(
          qaSystemPrompt(),
          qaPrompt(itemsForQA),
          model,
          0.1,
          1024,
        );
        governor.recordUsage(resp.usage.inputTokens, resp.usage.outputTokens, provider.name);
        const qaResults: Array<{
          id: string; action: string; mergeWithId?: string;
          suggestedCloudType?: string; suggestedTitle?: string;
        }> = safeParseArray(resp.content) ?? [];

        for (const qa of qaResults) {
          if (qa.action === 'reject') keptIds.delete(qa.id);
          if (qa.action === 'merge' && qa.mergeWithId) mergeMap.set(qa.id, qa.mergeWithId);
          if (qa.action === 'retitle' && qa.suggestedTitle) retitleMap.set(qa.id, qa.suggestedTitle);
          if (qa.action === 'reclassify' && qa.suggestedCloudType) reclassMap.set(qa.id, qa.suggestedCloudType);
        }
        stagesCompleted.push('qa');
      }
    } catch (err) {
      console.warn('[QA] failed:', err);
    }

    // Semantic dedup
    onProgress?.('Deduplicating', 90);
    const dedupInput = itemsWithIds
      .filter((i) => keptIds.has(i.id))
      .map((item) => {
        const temp = temporals.find((t) => t.id === item.id);
        const state = states.find((s) => s.id === item.id);
        return {
          id: item.id,
          title: item.title,
          content: item.content,
          date: temp?.date,
          stateData: state?.stateData ?? null,
        };
      });
    const dupes = findDuplicates(dedupInput);
    stagesCompleted.push('dedup');

    // Assemble final items
    onProgress?.('Finalising', 95);
    const items: ExtractedEngramItem[] = [];

    for (const item of itemsWithIds) {
      if (!keptIds.has(item.id)) continue;
      if (mergeMap.has(item.id)) continue; // merged away

      const cls = classifications.find((c) => c.id === item.id);
      const temp = temporals.find((t) => t.id === item.id);
      const conf = confidences.find((c) => c.id === item.id);
      const tgs = tags.find((t) => t.id === item.id);
      const dupeResult = dupes.find((d) => d.itemId === item.id);
      const finalCloudType = reclassMap.get(item.id) ?? cls?.cloudType ?? item.cloudTypeHint;
      const finalTitle = retitleMap.get(item.id) ?? item.title;
      const finalConfidence = conf?.confidence ?? cls?.confidence ?? 0.5;

      // StateDiff pre-computation for transformation candidates
      const itemState = states.find((s) => s.id === item.id);
      const relatedId = transformations.find(
        (t) => t.sourceId === item.id || t.targetId === item.id,
      );
      let stateDiffEvidence: unknown = null;
      if (relatedId && itemState) {
        const partnerId = relatedId.sourceId === item.id ? relatedId.targetId : relatedId.sourceId;
        const partnerState = states.find((s) => s.id === partnerId);
        if (partnerState) {
          stateDiffEvidence = diffStates(
            itemState.stateData as never,
            partnerState.stateData as never,
          );
        }
      }

      items.push({
        id: item.id,
        chunkId: chunk.id,
        title: finalTitle,
        content: item.content,
        cloudType: finalCloudType,
        date: temp?.date ?? undefined,
        tags: tgs?.tags ?? [],
        redactionMap: redactionMapGlobal,
        confidence: finalConfidence,
        selected: finalConfidence >= 0.5,
        isDuplicate: !!dupeResult,
        duplicateOf: dupeResult?.possibleDuplicateOf,
        isTransformationCandidate: dupeResult?.isTransformationCandidate || !!relatedId,
        stateData: itemState?.stateData,
        stateDiffEvidence,
        relationships: relationships.filter(
          (r) => r.itemAId === item.id || r.itemBId === item.id,
        ),
        detectedTransformations: transformations.filter(
          (t) => t.sourceId === item.id || t.targetId === item.id,
        ),
      } as ExtractedEngramItem);
    }

    return { items, rawImportFallback: false, stagesCompleted };
  }

  // ── Enrichment helpers ──────────────────────────────────────────────────────

  private async runClassification(
    items: Array<{ id: string; title: string; content: string }>,
    provider: AIProvider,
    model: string,
    governor: CostGovernor,
  ): Promise<Array<{ id: string; cloudType: string; confidence: number }>> {
    try {
      const can = governor.canProceed(items.length * 100, 400, provider.name);
      if (!can.proceed) return [];
      const resp = await provider.sendPrompt(
        classificationSystemPrompt(),
        classificationPrompt(items),
        model,
        0.2,
        1024,
      );
      governor.recordUsage(resp.usage.inputTokens, resp.usage.outputTokens, provider.name);
      return safeParseArray(resp.content) ?? [];
    } catch {
      return [];
    }
  }

  private async runTemporal(
    items: Array<{ id: string; title: string; content: string; rawDate?: string }>,
    provider: AIProvider,
    model: string,
    governor: CostGovernor,
  ): Promise<Array<{ id: string; date: string | null; dateConfidence: number }>> {
    try {
      const can = governor.canProceed(items.length * 100, 400, provider.name);
      if (!can.proceed) return [];
      const resp = await provider.sendPrompt(
        temporalSystemPrompt(),
        temporalPrompt(items),
        model,
        0.1,
        1024,
      );
      governor.recordUsage(resp.usage.inputTokens, resp.usage.outputTokens, provider.name);
      return safeParseArray(resp.content) ?? [];
    } catch {
      return [];
    }
  }

  private async runState(
    items: Array<{ id: string; title: string; content: string }>,
    provider: AIProvider,
    model: string,
    governor: CostGovernor,
  ): Promise<Array<{ id: string; stateData: Record<string, unknown> }>> {
    try {
      const can = governor.canProceed(items.length * 100, 400, provider.name);
      if (!can.proceed) return [];
      const resp = await provider.sendPrompt(
        stateSystemPrompt(),
        statePrompt(items),
        model,
        0.2,
        1024,
      );
      governor.recordUsage(resp.usage.inputTokens, resp.usage.outputTokens, provider.name);
      return safeParseArray(resp.content) ?? [];
    } catch {
      return [];
    }
  }

  private async runRelationships(
    items: Array<{ id: string; title: string; content: string }>,
    provider: AIProvider,
    model: string,
    governor: CostGovernor,
  ): Promise<Array<{ itemAId: string; itemBId: string; relationshipType: string }>> {
    try {
      const can = governor.canProceed(items.length * 150, 400, provider.name);
      if (!can.proceed) return [];
      const resp = await provider.sendPrompt(
        relationshipSystemPrompt(),
        relationshipPrompt(items),
        model,
        0.2,
        1024,
      );
      governor.recordUsage(resp.usage.inputTokens, resp.usage.outputTokens, provider.name);
      return safeParseArray(resp.content) ?? [];
    } catch {
      return [];
    }
  }

  private async runTagging(
    items: Array<{ id: string; title: string; content: string; cloudType?: string }>,
    provider: AIProvider,
    model: string,
    governor: CostGovernor,
  ): Promise<Array<{ id: string; tags: string[] }>> {
    try {
      const can = governor.canProceed(items.length * 100, 300, provider.name);
      if (!can.proceed) return [];
      const resp = await provider.sendPrompt(
        taggingSystemPrompt(),
        taggingPrompt(items),
        model,
        0.3,
        512,
      );
      governor.recordUsage(resp.usage.inputTokens, resp.usage.outputTokens, provider.name);
      return safeParseArray(resp.content) ?? [];
    } catch {
      return [];
    }
  }

  private async runRedaction(
    texts: string[],
    provider: AIProvider,
    model: string,
    governor: CostGovernor,
  ): Promise<string[]> {
    return Promise.all(
      texts.map(async (text) => {
        try {
          const can = governor.canProceed(text.length / 4, 300, provider.name);
          if (!can.proceed) return text;
          const resp = await provider.sendPrompt(
            redactionSystemPrompt(),
            redactionPrompt(text),
            model,
            0.1,
            512,
          );
          governor.recordUsage(resp.usage.inputTokens, resp.usage.outputTokens, provider.name);
          const parsed = safeParse<{ redactedText: string }>(resp.content);
          return parsed?.redactedText ?? text;
        } catch {
          return text;
        }
      }),
    );
  }

  private rawFallback(chunk: ImportChunk, stagesCompleted: string[]): PipelineResult {
    return {
      items: [
        {
          id: generateId(),
          chunkId: chunk.id,
          title: `Raw import — chunk ${chunk.index + 1}`,
          content: chunk.text,
          cloudType: 'memory',
          confidence: 0.2,
          selected: false,
        } as ExtractedEngramItem,
      ],
      rawImportFallback: true,
      stagesCompleted,
    };
  }
}

// ── JSON helpers ──────────────────────────────────────────────────────────────

function safeParse<T>(text: string): T | null {
  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

function safeParseArray<T>(text: string): T[] {
  const result = safeParse<T | T[]>(text);
  if (Array.isArray(result)) return result;
  return [];
}
