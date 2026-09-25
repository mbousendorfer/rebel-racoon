// Image Generator — the demo seed, loaded on the module's first launch only.
// The brands are Archie's seeded Playbooks (Acme · Q2 marketing, PawTrack);
// what is seeded here is the generator's OWN objects for them: custom styles,
// products, campaigns and a few creations. Keyed by Playbook id, so in new-user
// mode (no Playbooks) they simply belong to nobody and never show.

import {
  createAsset,
  createCampaign,
  createCreation,
  createLayer,
  createProduct,
  createStyle,
  createVariation,
  historyEntry,
} from "../model/schema.js?v=1237";
import { productShotSvg } from "../render/product-shot.js?v=1237";

const ACME = "ctx-acme";
const PAWTRACK = "ctx-pawtrack";

function productAsset(brandId, id, name, shape, colors) {
  return createAsset({
    id,
    brandId,
    kind: "product",
    name,
    mime: "image/svg+xml",
    svg: productShotSvg({ shape, colors, label: name }),
    width: 600,
    height: 600,
    source: "upload",
  });
}

// The logo layer names a VERSION, not a file: the render resolves it against
// the Playbook's logos at draw time, so a logo changed on the Playbook follows.
function masterLayers({ headline, layout = "bottom-left", band = false }) {
  const textY = layout === "top-left" ? 0.08 : 0.62;
  return [
    createLayer("image", { x: 0, y: 0, w: 1, h: 1, z: 0, locked: true, props: { source: "variation" } }),
    createLayer("text", {
      x: 0.08,
      y: textY,
      w: 0.84,
      h: 0.2,
      z: 2,
      props: { content: headline, fontRole: "heading", colorRole: "text", size: 0.075, align: "left", band },
    }),
    createLayer("logo", { x: 0.72, y: 0.86, w: 0.2, h: 0.07, z: 3, props: { variant: "color" } }),
  ];
}

export function seedDemoData() {
  const styles = [
    createStyle({
      id: "st_demo_acme_product",
      brandId: ACME,
      label: "Acme product-first",
      description: "Glossy product moments on a strict grid.",
      supportsEmbeddedText: true,
      custom: {
        sources: [
          { type: "preset", ref: "preset-glossy", label: "Glossy product", weight: 0.6 },
          { type: "preset", ref: "preset-swiss", label: "Swiss minimal", weight: 0.4 },
        ],
        fidelity: "composition",
        stylePrompt: "Always a plain navy or white field, one product moment, lots of air.",
      },
    }),
    createStyle({
      id: "st_demo_pawtrack_daylight",
      brandId: PAWTRACK,
      label: "PawTrack daylight",
      description: "Real dogs outside, soft daylight, a violet accent.",
      supportsEmbeddedText: false,
      custom: {
        sources: [
          { type: "preset", ref: "preset-lifestyle", label: "Lifestyle", weight: 0.7 },
          { type: "preset", ref: "preset-flat", label: "Flat", weight: 0.3 },
        ],
        fidelity: "essential",
        stylePrompt: "Outdoors, morning light, the dog is always the hero.",
      },
    }),
  ];

  const acme = { primary: "#1A1F36", text: "#1A1F36", accent: "#FF6726", background: "#FFFFFF", surface: "#EEF0F5" };
  const paw = { primary: "#2F1B54", text: "#241537", accent: "#7C4DFF", background: "#FFFFFF", surface: "#F3EEFF" };
  const assets = [
    productAsset(ACME, "as_demo_p_workspace", "Acme Workspace", "screen", acme),
    productAsset(ACME, "as_demo_p_mobile", "Acme mobile app", "card", acme),
    productAsset(PAWTRACK, "as_demo_p_collar", "PawTrack GPS collar", "bottle", paw),
    productAsset(PAWTRACK, "as_demo_p_app", "PawTrack app", "screen", paw),
  ];
  const products = [
    createProduct({
      id: "pr_demo_workspace",
      brandId: ACME,
      name: "Acme Workspace",
      description: "The operating system for small marketing teams: plans, briefs and approvals in one place.",
      url: "https://acme.example.com/workspace",
      imageAssetId: "as_demo_p_workspace",
    }),
    createProduct({
      id: "pr_demo_mobile",
      brandId: ACME,
      name: "Acme mobile app",
      description: "Approve a brief from anywhere in two taps.",
      imageAssetId: "as_demo_p_mobile",
    }),
    createProduct({
      id: "pr_demo_collar",
      brandId: PAWTRACK,
      name: "PawTrack GPS collar",
      description: "Live location and activity for your dog, with a week of battery.",
      url: "https://pawtrack.example.com/collar",
      imageAssetId: "as_demo_p_collar",
    }),
    createProduct({
      id: "pr_demo_app",
      brandId: PAWTRACK,
      name: "PawTrack app",
      description: "Walks, health and alerts in one app.",
      imageAssetId: "as_demo_p_app",
    }),
  ];

  const year = new Date().getFullYear();
  const creations = [
    createCreation({
      id: "cr_demo_acme_launch",
      brandId: ACME,
      campaignId: "cp_demo_acme_q4",
      title: "Plan the quarter in one place",
      brief: {
        prompt: "The Acme Workspace dashboard floating above a clean desk",
        styleId: "st_demo_acme_product",
        productId: "pr_demo_workspace",
        formatIds: ["li-square", "li-link", "x-landscape"],
        textMode: "layer",
        ideaId: null,
      },
      variations: [createVariation(1203, { id: "va_demo_a1", bgSeed: 11, subjectSeed: 21 })],
      selectedVariationId: "va_demo_a1",
      master: {
        formatId: "li-square",
        layers: masterLayers({ headline: "Plan the quarter in one place", band: true }),
      },
      copy: {
        hooks: ["Plan the quarter in one place", "Your Q4, on one page", "Stop planning in five tabs"],
        ctas: [],
        captions: {},
      },
      favorite: true,
      history: [historyEntry("created"), historyEntry("edited", "Headline changed")],
    }),
    createCreation({
      id: "cr_demo_acme_number",
      brandId: ACME,
      campaignId: "cp_demo_acme_q4",
      title: "3× faster approvals",
      brief: {
        prompt: "Teams on Acme approve briefs 3× faster",
        styleId: "preset-big-number",
        productId: null,
        formatIds: ["li-square", "ig-post"],
        textMode: "embedded",
        ideaId: null,
      },
      variations: [createVariation(9087, { id: "va_demo_b1", bgSeed: 51, subjectSeed: 61 })],
      selectedVariationId: "va_demo_b1",
      master: { formatId: "li-square", layers: masterLayers({ headline: "3× faster approvals" }) },
      history: [historyEntry("created"), historyEntry("adapted", "2 formats")],
    }),
    createCreation({
      id: "cr_demo_paw_walk",
      brandId: PAWTRACK,
      campaignId: "cp_demo_paw_autumn",
      title: "Every walk, remembered",
      brief: {
        prompt: "A dog running through autumn leaves at sunrise, wearing the collar",
        styleId: "st_demo_pawtrack_daylight",
        productId: "pr_demo_collar",
        formatIds: ["ig-portrait", "ig-story", "fb-square"],
        textMode: "layer",
        ideaId: null,
      },
      variations: [createVariation(4471, { id: "va_demo_c1", bgSeed: 31, subjectSeed: 41 })],
      selectedVariationId: "va_demo_c1",
      master: {
        formatId: "ig-portrait",
        layers: masterLayers({ headline: "Every walk, remembered", layout: "top-left" }),
      },
      favorite: true,
      history: [historyEntry("created")],
    }),
  ];
  const campaigns = [
    createCampaign({
      id: "cp_demo_acme_q4",
      brandId: ACME,
      title: "Q4 planning season",
      objective: "Book demos with marketing leads before budgets close",
      angle: "Next year's plan, in one place",
      eventId: "budget-season",
      start: `${year}-10-01`,
      end: `${year}-11-30`,
      creationIds: ["cr_demo_acme_launch", "cr_demo_acme_number"],
    }),
    createCampaign({
      id: "cp_demo_paw_autumn",
      brandId: PAWTRACK,
      title: "Autumn walks",
      objective: "Drive collar pre-orders for the season",
      angle: "The season's first walks",
      eventId: "autumn",
      start: `${year}-09-22`,
      end: `${year}-10-31`,
      creationIds: ["cr_demo_paw_walk"],
    }),
  ];
  return { styles, products, campaigns, creations, assets };
}
