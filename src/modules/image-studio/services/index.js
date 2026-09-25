// Image Generator — the service registry. The ONE place implementations are
// chosen: swap a mock for a real client here and nothing else changes.
//
//   imageGenerationService  brief + brand + style + product + format + text mode → variations
//   brandAnalysisService    URL or files → brand DNA draft
//   copyService             hooks, CTAs, captions, hashtags
//   storageService          CRUD of every entity + blobs

import * as imageGenerationMock from "./mock/image-generation.mock.js?v=1225";
import * as brandAnalysisMock from "./mock/brand-analysis.mock.js?v=1225";
import * as copyMock from "./mock/copy.mock.js?v=1225";
import * as storage from "./storage.js?v=1225";

export const imageGenerationService = imageGenerationMock;
export const brandAnalysisService = brandAnalysisMock;
export const copyService = copyMock;
export const storageService = storage;
export { buildPrompt } from "./prompt.js?v=1225";
