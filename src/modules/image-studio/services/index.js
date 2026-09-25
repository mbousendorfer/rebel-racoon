// Image Generator — the service registry. The ONE place implementations are
// chosen: swap a mock for a real client here and nothing else changes.
//
//   imageGenerationService  brief + brand + style + product + format + text mode → variations
//   copyService             hooks, CTAs, captions, hashtags
//   ideaService             campaign ideas from the brand, its catalogue and the calendar
//   editService             edit an image in plain words
//   storageService          CRUD of the module's own entities + blobs
//
// Brand analysis (URL or files → brand DNA) is no longer the module's: the brand
// is the Playbook, and analysing a site or files is how a Playbook is CREATED —
// src/context-mock-analysis.js (analyzeWebsite / analyzeBrandFiles).

import * as imageGenerationMock from "./mock/image-generation.mock.js?v=1304";
import * as copyMock from "./mock/copy.mock.js?v=1304";
import * as ideasMock from "./mock/ideas.mock.js?v=1304";
import * as editMock from "./mock/edit.mock.js?v=1304";
import * as storage from "./storage.js?v=1304";

export const imageGenerationService = imageGenerationMock;
export const copyService = copyMock;
export const ideaService = ideasMock;
export const editService = editMock;
export const storageService = storage;
export { buildPrompt } from "./prompt.js?v=1304";
