// Image Generator — the demo seed, loaded on the module's first launch only.
// Two complete, credible brands (each with a regional / sub-brand), their
// custom styles, products, campaigns and a few creations. Nothing here reads
// or mirrors Archie's own mocks.

import {
  createAsset,
  createBrand,
  createCampaign,
  createCreation,
  createLayer,
  createProduct,
  createStyle,
  createVariation,
  historyEntry,
} from "../model/schema.js?v=1225";
import { logoSvg } from "../render/logo.js?v=1225";
import { productShotSvg } from "../render/product-shot.js?v=1225";

const HARBOR = "br_demo_harbor";
const HARBOR_BAR = "br_demo_harbor_bar";
const LEDGERLY = "br_demo_ledgerly";
const LEDGERLY_UK = "br_demo_ledgerly_uk";

function logoAssets(brandId, spec) {
  return ["color", "white", "black", "icon"].map((variant) =>
    createAsset({
      id: `as_${brandId}_logo_${variant}`,
      brandId,
      kind: "logo",
      name: `${spec.name} — ${variant}`,
      mime: "image/svg+xml",
      svg: logoSvg({ ...spec, variant }),
      source: "upload",
    }),
  );
}

function logosOf(assets) {
  return assets.map((a) => ({ variant: a.id.split("_logo_")[1], assetId: a.id }));
}

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

function masterLayers({ headline, logoAssetId, layout = "bottom-left", band = false }) {
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
    createLayer("logo", {
      x: 0.72,
      y: 0.86,
      w: 0.2,
      h: 0.07,
      z: 3,
      props: { assetId: logoAssetId, variant: "color" },
    }),
  ];
}

export function seedDemoData() {
  // ── Harbor & Hearth Coffee — an independent roaster ───────────────────────
  const harborPalette = [
    { hex: "#B5652B", name: "Copper", role: "primary" },
    { hex: "#5F7361", name: "Sage", role: "secondary" },
    { hex: "#D9A441", name: "Honey", role: "accent" },
    { hex: "#F5EDE1", name: "Crema", role: "background" },
    { hex: "#2A1C14", name: "Espresso", role: "text" },
  ];
  const harborLogos = logoAssets(HARBOR, {
    name: "Harbor & Hearth",
    mark: "bean",
    primary: "#B5652B",
    text: "#2A1C14",
    background: "#F5EDE1",
    font: "Georgia, serif",
  });
  const harbor = createBrand({
    id: HARBOR,
    name: "Harbor & Hearth Coffee",
    websiteUrl: "https://harborandhearth.coffee",
    sectorKey: "coffee",
    isDefault: true,
    logos: logosOf(harborLogos),
    palette: harborPalette,
    fonts: [
      { family: "Georgia", role: "heading" },
      { family: "Helvetica Neue", role: "body" },
    ],
    imageStyle: {
      moods: ["warm", "morning light", "tactile", "unhurried"],
      referenceAssetIds: [],
      preferredStyleIds: ["st_demo_harbor_morning", "preset-lifestyle", "preset-flat-lay", "preset-editorial"],
    },
    voice: {
      tone: "Warm, unhurried and a little nerdy about the craft. We talk like the person behind the counter who remembers your order — never salesy.",
      examples: [
        "This week's roast just came out of the drum. Smells like cocoa and a slow Saturday.",
        "Grind it right before you brew. Your cup will know.",
        "Meet Tadesse, who grew the Guji lot we can't stop drinking.",
        "No, we won't tell you it's the best coffee in the world. We'll tell you where it's from.",
      ],
      avoid: ["cheap", "best coffee in the world", "hack", "caffeine fix"],
    },
    positioning: {
      sector: "Food & drink — specialty coffee",
      audience: "Home brewers and neighbourhood regulars, 25–45, who care where things come from",
      values: ["Craft", "Traceability", "Hospitality"],
      valueProp: "Coffee roasted this week, for people who notice.",
    },
    rules: {
      dos: [
        "Let the product breathe: one hero object per visual",
        "Warm, natural light — morning, not neon",
        "Crema or wood as the main surface",
      ],
      donts: ["No stock-photo smiles", "Never recolour the bean mark", "No text over the cup itself"],
      logoMinPx: 56,
      clearSpace: 0.5,
      noLogoDistortion: true,
      forbiddenPairs: [["#D9A441", "#F5EDE1"]],
    },
  });
  const harborBar = createBrand({
    id: HARBOR_BAR,
    parentId: HARBOR,
    name: "Harbor & Hearth — Café Bar",
    sectorKey: "coffee",
    overriddenFields: ["voice", "palette"],
    palette: [
      { hex: "#2A1C14", name: "Espresso", role: "primary" },
      { hex: "#B5652B", name: "Copper", role: "secondary" },
      { hex: "#E07A5F", name: "Terracotta", role: "accent" },
      { hex: "#FBF7F2", name: "Milk", role: "background" },
      { hex: "#2A1C14", name: "Espresso", role: "text" },
    ],
    voice: {
      tone: "Same warmth, more evening: the café bar speaks to people meeting up after work. Playful, a touch cheeky.",
      examples: [
        "Espresso tonic season is open. Bring a friend, we'll bring the ice.",
        "Tuesday latte-art throwdown. Bring your worst heart.",
        "Open until 10 on Fridays. Decaf is a valid life choice.",
      ],
      avoid: ["cheap", "hack", "party"],
    },
  });

  // ── Ledgerly — spend management for finance teams ────────────────────────
  const ledgerlyLogos = logoAssets(LEDGERLY, {
    name: "Ledgerly",
    mark: "ledger",
    primary: "#3B5BFD",
    text: "#0B1F3A",
    background: "#FFFFFF",
    font: "Avenir Next, Helvetica, sans-serif",
  });
  const ledgerly = createBrand({
    id: LEDGERLY,
    name: "Ledgerly",
    websiteUrl: "https://ledgerly.io",
    sectorKey: "finance",
    logos: logosOf(ledgerlyLogos),
    palette: [
      { hex: "#3B5BFD", name: "Ledger Blue", role: "primary" },
      { hex: "#12B5A6", name: "Teal", role: "secondary" },
      { hex: "#FFB547", name: "Signal", role: "accent" },
      { hex: "#F4F6FB", name: "Cloud", role: "background" },
      { hex: "#0B1F3A", name: "Midnight", role: "text" },
    ],
    fonts: [
      { family: "Avenir Next", role: "heading" },
      { family: "Helvetica Neue", role: "body" },
    ],
    imageStyle: {
      moods: ["clear", "confident", "calm", "precise"],
      referenceAssetIds: [],
      preferredStyleIds: ["st_demo_ledgerly_clean3d", "preset-big-number", "preset-infographic", "preset-swiss"],
    },
    voice: {
      tone: "Clear, confident and calm. We explain money like a good accountant friend: no jargon, no hype, always a number to back it up.",
      examples: [
        "Month-end shouldn't mean late nights. Here's how three teams got it down to two days.",
        "Every card, every receipt, one place.",
        "Budgets are plans. We help you keep them.",
        "87% of our customers close their books in under five days.",
      ],
      avoid: ["disrupt", "revolutionary", "guaranteed", "to the moon"],
    },
    positioning: {
      sector: "B2B financial software",
      audience: "CFOs and finance leads at 50–500 person companies",
      values: ["Clarity", "Control", "Trust"],
      valueProp: "Close the month in days, not weeks.",
    },
    rules: {
      dos: ["One number, big, when there is one", "Cloud or white backgrounds", "Straight angles, a strict grid"],
      donts: ["No piles of cash or coins", "No handshake photos", "Never put Signal yellow on white text"],
      logoMinPx: 40,
      clearSpace: 0.75,
      noLogoDistortion: true,
      forbiddenPairs: [
        ["#FFB547", "#FFFFFF"],
        ["#12B5A6", "#3B5BFD"],
      ],
    },
  });
  const ledgerlyUk = createBrand({
    id: LEDGERLY_UK,
    parentId: LEDGERLY,
    name: "Ledgerly UK",
    sectorKey: "finance",
    overriddenFields: ["voice", "positioning"],
    voice: {
      tone: "The same calm clarity, in British English: organise, colour, VAT, and a drier sense of humour.",
      examples: [
        "Quarter-end, without the queue for the kettle.",
        "Every VAT receipt, matched before you've finished your tea.",
        "Budgets are plans. We help you stick to them.",
      ],
      avoid: ["disrupt", "revolutionary", "guaranteed", "awesome"],
    },
    positioning: {
      sector: "B2B financial software — UK",
      audience: "Finance directors at UK scale-ups",
      values: ["Clarity", "Control", "Trust"],
      valueProp: "Close the month in days, VAT included.",
    },
  });

  // ── Custom styles ─────────────────────────────────────────────────────────
  const styles = [
    createStyle({
      id: "st_demo_harbor_morning",
      brandId: HARBOR,
      label: "Harbor morning",
      description: "Warm window light over wood and crema.",
      supportsEmbeddedText: false,
      render: { generator: "blend", variant: "custom" },
      custom: {
        sources: [
          { type: "preset", ref: "preset-lifestyle", label: "Lifestyle", weight: 0.7 },
          { type: "preset", ref: "preset-editorial", label: "Editorial", weight: 0.3 },
        ],
        fidelity: "essential",
        stylePrompt: "Soft morning light from the left, always a warm wooden surface, steam visible.",
      },
    }),
    createStyle({
      id: "st_demo_ledgerly_clean3d",
      brandId: LEDGERLY,
      label: "Ledgerly clean 3D",
      description: "Glossy objects on a strict Swiss grid.",
      supportsEmbeddedText: true,
      render: { generator: "blend", variant: "custom" },
      custom: {
        sources: [
          { type: "preset", ref: "preset-glossy", label: "Glossy product", weight: 0.6 },
          { type: "preset", ref: "preset-swiss", label: "Swiss minimal", weight: 0.4 },
        ],
        fidelity: "composition",
        stylePrompt: "Always a plain Cloud background, one object, lots of air.",
      },
    }),
  ];

  // ── Products ──────────────────────────────────────────────────────────────
  const hColors = { primary: "#B5652B", text: "#2A1C14", accent: "#D9A441", background: "#F5EDE1", surface: "#EFE6D8" };
  const lColors = { primary: "#3B5BFD", text: "#0B1F3A", accent: "#FFB547", background: "#FFFFFF", surface: "#F4F6FB" };
  const productAssets = [
    productAsset(HARBOR, "as_demo_p_nightshift", "Night Shift Espresso", "bag", hColors),
    productAsset(HARBOR, "as_demo_p_guji", "Ethiopia Guji — single origin", "bag", { ...hColors, primary: "#5F7361" }),
    productAsset(HARBOR, "as_demo_p_kettle", "Gooseneck pour-over kettle", "kettle", hColors),
    productAsset(LEDGERLY, "as_demo_p_cards", "Ledgerly corporate cards", "card", lColors),
    productAsset(LEDGERLY, "as_demo_p_dashboard", "Spend dashboard", "screen", lColors),
  ];
  const products = [
    createProduct({
      id: "pr_demo_nightshift",
      brandId: HARBOR,
      name: "Night Shift Espresso",
      description: "Our house espresso: dark chocolate, molasses, a long sweet finish. 250 g bag.",
      url: "https://harborandhearth.coffee/shop/night-shift",
      imageAssetId: "as_demo_p_nightshift",
    }),
    createProduct({
      id: "pr_demo_guji",
      brandId: HARBOR,
      name: "Ethiopia Guji",
      description: "Washed single origin from the Guji zone: peach, jasmine, black tea.",
      url: "https://harborandhearth.coffee/shop/guji",
      imageAssetId: "as_demo_p_guji",
    }),
    createProduct({
      id: "pr_demo_kettle",
      brandId: HARBOR,
      name: "Gooseneck kettle",
      description: "A precise pour for filter coffee. Matte copper finish.",
      imageAssetId: "as_demo_p_kettle",
    }),
    createProduct({
      id: "pr_demo_cards",
      brandId: LEDGERLY,
      name: "Corporate cards",
      description: "Physical and virtual cards with limits per team, receipts captured automatically.",
      url: "https://ledgerly.io/cards",
      imageAssetId: "as_demo_p_cards",
    }),
    createProduct({
      id: "pr_demo_dashboard",
      brandId: LEDGERLY,
      name: "Spend dashboard",
      description: "Real-time spend by team, vendor and budget line.",
      url: "https://ledgerly.io/dashboard",
      imageAssetId: "as_demo_p_dashboard",
    }),
  ];

  // ── Campaigns + creations ─────────────────────────────────────────────────
  const year = new Date().getFullYear();
  const creations = [
    createCreation({
      id: "cr_demo_autumn_roast",
      brandId: HARBOR,
      campaignId: "cp_demo_autumn",
      title: "Autumn roast is here",
      brief: {
        prompt: "A bag of our autumn roast on a wooden table, morning light, falling leaves outside",
        styleId: "st_demo_harbor_morning",
        productId: "pr_demo_nightshift",
        formatIds: ["ig-post", "ig-story", "fb-link"],
        textMode: "layer",
        ideaId: null,
      },
      variations: [createVariation(1203, { id: "va_demo_a1", bgSeed: 11, subjectSeed: 21 })],
      selectedVariationId: "va_demo_a1",
      master: {
        formatId: "ig-post",
        layers: masterLayers({ headline: "Autumn roast is here", logoAssetId: `as_${HARBOR}_logo_color` }),
      },
      copy: {
        hooks: ["Autumn roast is here", "The season's first bag", "Slow mornings are back"],
        ctas: [],
        captions: {},
      },
      favorite: true,
      history: [historyEntry("created"), historyEntry("edited", "Headline changed")],
    }),
    createCreation({
      id: "cr_demo_coffee_day",
      brandId: HARBOR,
      campaignId: "cp_demo_coffee_day",
      title: "The people who grow it",
      brief: {
        prompt: "Hands holding ripe coffee cherries, Ethiopian hillside",
        styleId: "preset-editorial",
        productId: "pr_demo_guji",
        formatIds: ["ig-portrait", "li-square"],
        textMode: "layer",
        ideaId: null,
      },
      variations: [createVariation(4471, { id: "va_demo_b1", bgSeed: 31, subjectSeed: 41 })],
      selectedVariationId: "va_demo_b1",
      master: {
        formatId: "ig-portrait",
        layers: masterLayers({
          headline: "The people who grow it",
          logoAssetId: `as_${HARBOR}_logo_color`,
          layout: "top-left",
        }),
      },
      history: [historyEntry("created")],
    }),
    createCreation({
      id: "cr_demo_close",
      brandId: LEDGERLY,
      campaignId: "cp_demo_q_close",
      title: "Close in 5 days",
      brief: {
        prompt: "87% of customers close their books in under five days",
        styleId: "preset-big-number",
        productId: null,
        formatIds: ["li-link", "li-square", "x-landscape"],
        textMode: "embedded",
        ideaId: null,
      },
      variations: [createVariation(9087, { id: "va_demo_c1", bgSeed: 51, subjectSeed: 61 })],
      selectedVariationId: "va_demo_c1",
      master: {
        formatId: "li-square",
        layers: masterLayers({
          headline: "Close the month in days, not weeks",
          logoAssetId: `as_${LEDGERLY}_logo_color`,
          band: true,
        }),
      },
      favorite: true,
      history: [historyEntry("created"), historyEntry("adapted", "3 formats")],
    }),
    createCreation({
      id: "cr_demo_cards",
      brandId: LEDGERLY,
      campaignId: null,
      title: "Every card, one place",
      brief: {
        prompt: "Corporate cards floating above a clean dashboard",
        styleId: "st_demo_ledgerly_clean3d",
        productId: "pr_demo_cards",
        formatIds: ["li-square"],
        textMode: "layer",
        ideaId: null,
      },
      variations: [createVariation(3310, { id: "va_demo_d1", bgSeed: 71, subjectSeed: 81 })],
      selectedVariationId: "va_demo_d1",
      master: {
        formatId: "li-square",
        layers: masterLayers({ headline: "Every card, one place", logoAssetId: `as_${LEDGERLY}_logo_color` }),
      },
      history: [historyEntry("created")],
    }),
  ];
  const campaigns = [
    createCampaign({
      id: "cp_demo_autumn",
      brandId: HARBOR,
      title: "Autumn roast launch",
      objective: "Launch the seasonal blend and drive pre-orders",
      angle: "The season's first bag",
      eventId: "autumn",
      start: `${year}-09-22`,
      end: `${year}-10-20`,
      creationIds: ["cr_demo_autumn_roast"],
    }),
    createCampaign({
      id: "cp_demo_coffee_day",
      brandId: HARBOR,
      title: "International Coffee Day",
      objective: "Tell the origin story of our Guji lot",
      angle: "The people who grow it",
      eventId: "coffee-day",
      start: `${year}-09-28`,
      end: `${year}-10-02`,
      creationIds: ["cr_demo_coffee_day"],
    }),
    createCampaign({
      id: "cp_demo_q_close",
      brandId: LEDGERLY,
      title: "Quarter-close season",
      objective: "Book demos with finance leads before quarter end",
      angle: "Closing the books without the chaos",
      eventId: "q3-close",
      start: `${year}-09-15`,
      end: `${year}-10-05`,
      creationIds: ["cr_demo_close"],
    }),
  ];

  return {
    brands: [harbor, harborBar, ledgerly, ledgerlyUk],
    styles,
    products,
    campaigns,
    creations,
    assets: [...harborLogos, ...ledgerlyLogos, ...productAssets],
    activeBrandId: HARBOR,
  };
}
