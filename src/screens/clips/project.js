// /clips/:id — one video's project in the Clips space (flag clipsSpace).
//
// Prod's order, as screens instead of chips (content/studio … video-clips.ts):
// the analysis runs as soon as the video is added; then the moments, which the
// user reviews and picks; the options of the whole video (format, subtitles —
// set_clip_options) apply live to every preview; then the accounts and the
// CTA, and one draft per clip × account, written here and scheduled from here.
// Tabs: Clips · Drafts (?tab=drafts).

import { navigate } from "../../router.js?v=2129";
import { isFlagOn } from "../../feature-flags.js?v=2129";
import { parseHashParams, setHashQuery } from "../../url-state.js?v=2129";
import { renderTopbar, setTopbarActions, renderIconBack } from "../../components/topbar.js?v=2129";
import { showToast } from "../../components/toast.js?v=2129";
import { renderPostCard } from "../../components/post-card.js?v=2129";
import { open as openScheduleModal } from "../../components/schedule-modal.js?v=2129";
import { open as openConnectAccountModal } from "../../components/connect-account-modal.js?v=2129";
import { connectableNetworkCards, accountIdsForNetwork } from "../../connect-profiles-flow.js?v=2129";
import { getConnectedProfiles, renderProfileTag } from "../../social-profiles.js?v=2129";
import { getContextById } from "../../contexts-store.js?v=2129";
import {
  getPosts,
  addPostDraft,
  removePost,
  insertPost,
  updatePostContent,
  subscribe as subscribePosts,
} from "../../posts-store.js?v=2129";
import { escapeHtml } from "../../utils.js?v=2129";
import {
  getVideo,
  draftKey,
  updateSettings,
  setSelection,
  addClip,
  removeClip,
  restoreClip,
  ANALYSIS_STAGES,
  subscribe as subscribeVideos,
} from "../../videos-store.js?v=2129";
import {
  fmtMs,
  formatSelect,
  subtitleSelect,
  previewMarkup,
  mountPreviews,
  bindSelectDismiss,
  clipRatioId,
  clipCaptionState,
  formatLabel,
  presetLabel,
  CTA_OPTIONS,
} from "./shared.js?v=2129";

let target = null;
let videoId = null;
let signature = "";
let disposePreviews = null;
const disposers = [];
// The Drafts tab's own state: the account / CTA picks, and whether the setup
// is showing over drafts that already exist ("Write more drafts").
const draftSetup = { accounts: null, cta: "none", open: false, writing: false };

// The editor's "Create draft": land on the Drafts tab with the setup open for
// the clip just edited (the editor has already selected it alone).
export function primeDraftSetup(id) {
  videoId = id;
  Object.assign(draftSetup, { accounts: null, cta: "none", open: true, writing: false });
}

export function renderClipsProject(params, el) {
  if (!isFlagOn("clipsSpace")) {
    navigate("/");
    return undefined;
  }
  const video = getVideo(params.id);
  if (!video) {
    navigate("/clips");
    return undefined;
  }
  target = el;
  if (videoId !== video.id) Object.assign(draftSetup, { accounts: null, cta: "none", open: false, writing: false });
  videoId = video.id;
  renderTopbar();
  setTopbarActions(window.location.hash.replace(/^#/, "").split("?")[0], `<span></span>`, {
    left: `${renderIconBack("/clips", "Back to Clips")}<h1 class="app-topbar__title clips-topbar-title">${escapeHtml(video.name)}</h1>`,
  });
  paint();
  el.addEventListener("click", onClick);
  el.addEventListener("change", onChange);
  disposers.push(
    subscribeVideos(onStore),
    subscribePosts(draftKey(video.id), () => tab() === "drafts" && paint()),
    bindSelectDismiss(el),
  );
  return () => {
    el.removeEventListener("click", onClick);
    el.removeEventListener("change", onChange);
    disposers.splice(0).forEach((d) => d());
    disposePreviews?.();
    disposePreviews = null;
    target = null;
  };
}

const tab = () => (parseHashParams().get("tab") === "drafts" ? "drafts" : "clips");
const path = () => `/clips/${videoId}`;
const sig = (v) =>
  `${v.status}:${v.clips.map((c) => `${c.id}${c.selected ? 1 : 0}${c.startMs}${c.endMs}`).join()}:${JSON.stringify(v.settings)}`;

function onStore() {
  const v = getVideo(videoId);
  if (!target || !v) return;
  if (sig(v) !== signature) return paint();
  if (v.status !== "analyzing") return;
  const pct = Math.round(v.progress * 100);
  const fill = target.querySelector(".clips-analyzing .clips-progress__fill");
  if (fill) fill.style.width = `${pct}%`;
  const label = target.querySelector(".clips-analyzing .clips-progress__label");
  if (label) label.textContent = `${pct}%`;
  const at = ANALYSIS_STAGES.indexOf(v.stage);
  target.querySelectorAll("[data-clips-stage]").forEach((li, i) => {
    li.classList.toggle("is-done", i < at);
    li.classList.toggle("is-current", i === at);
  });
}

function paint() {
  const v = getVideo(videoId);
  if (!target || !v) return;
  signature = sig(v);
  disposePreviews?.();
  disposePreviews = null;
  if (v.status === "analyzing") {
    target.innerHTML = renderAnalyzing(v);
    return;
  }
  const posts = getPosts(draftKey(v.id));
  const t = tab();
  target.innerHTML = `
    <div class="clips-view">
      <div class="clips-view__page clips-project">
        ${renderOverview(v)}
        <div class="ap-tabs clips-project__tabs">
          <div class="ap-tabs-nav" role="tablist" aria-label="Clips and drafts">
            ${tabButton("clips", "ap-icon-video", "Clips", v.clips.length, t)}
            ${tabButton("drafts", "ap-icon-file--text", "Drafts", posts.length, t)}
          </div>
        </div>
        ${t === "drafts" ? renderDrafts(v, posts) : renderClips(v)}
      </div>
    </div>`;
  if (t === "drafts") swapPlayers(v, posts);
  disposePreviews = mountPreviews(target, v);
}

// The post card draws a faux player (a chat draft has no footage). Here the
// clip is real: put its reframed preview in the card, at the draft's format.
function swapPlayers(v, posts) {
  for (const post of posts) {
    const clip = v.clips.find((c) => c.id === post.clipRef?.clipId);
    const player = target.querySelector(`[data-post-id="${CSS.escape(post.id)}"] .posts__card-clip-player`);
    if (!clip || !player) continue;
    player.outerHTML = `<div class="clips-drafts__player">
      ${previewMarkup(v, { ...clip, ratio: post.format || clipRatioId(v, clip) })}
      <a class="ap-button stroked grey clips-drafts__edit" href="#/clips/${v.id}/edit/${clip.id}">
        <i class="ap-icon-pen" aria-hidden="true"></i><span>Edit clip</span>
      </a>
    </div>`;
  }
}

function tabButton(id, icon, label, count, current) {
  const on = id === current;
  return `<button type="button" class="ap-tabs-tab${on ? " active" : ""}" role="tab" aria-selected="${on}" data-clips-tab="${id}">
    <i class="${icon}" aria-hidden="true"></i><span>${label}</span>
    <span class="ap-counter normal ${on ? "blue" : "grey"}">${count}</span>
  </button>`;
}

// ── Analysis ─────────────────────────────────────────────────────────

function renderAnalyzing(v) {
  const at = Math.max(0, ANALYSIS_STAGES.indexOf(v.stage));
  const pct = Math.round(v.progress * 100);
  const steps = ANALYSIS_STAGES.map(
    (
      s,
      i,
    ) => `<li class="clips-analyzing__step${i < at ? " is-done" : ""}${i === at ? " is-current" : ""}" data-clips-stage>
      <span class="clips-analyzing__dot" aria-hidden="true"><i class="ap-icon-check"></i></span>${s}
    </li>`,
  ).join("");
  return `
    <div class="clips-view">
      <div class="clips-view__page">
        <section class="clips-analyzing" aria-live="polite">
          <div class="clips-analyzing__player">
            <video src="${escapeHtml(v.url)}#t=${(v.posterMs || 0) / 1000}" preload="metadata" muted playsinline></video>
          </div>
          <div class="clips-analyzing__text">
            <h2 class="clips-analyzing__title">Finding the best moments</h2>
            <p class="clips-analyzing__sub">
              ${fmtMs(v.durationMs)} of video — I'll cut ${v.durationMs > 600000 ? "10 clips" : "3 clips"}. You can leave this
              page: the analysis keeps going and the video waits for you in Clips.
            </p>
            <span class="clips-progress">
              <span class="clips-progress__track"><span class="clips-progress__fill" style="width:${pct}%"></span></span>
              <span class="clips-progress__label">${pct}%</span>
            </span>
            <ol class="clips-analyzing__steps">${steps}</ol>
          </div>
        </section>
      </div>
    </div>`;
}

// ── The whole video, at a glance ─────────────────────────────────────

function renderOverview(v) {
  const pct = (ms) => `${(ms / v.durationMs) * 100}%`;
  const marks = v.clips
    .map(
      (
        c,
        i,
      ) => `<button type="button" class="clips-overview__clip${c.selected ? " is-selected" : ""}" style="left:${pct(c.startMs)};width:max(4px, ${pct(c.endMs - c.startMs)})"
        data-clips-jump="${c.id}" data-tooltip="${i + 1}. ${escapeHtml(c.title)} · ${fmtMs(c.startMs)}" aria-label="Clip ${i + 1}: ${escapeHtml(c.title)}"></button>`,
    )
    .join("");
  return `
    <section class="clips-overview" aria-label="Where the clips sit in the video">
      <div class="clips-overview__track">${marks}</div>
      <div class="clips-overview__scale"><span>0:00</span><span>${fmtMs(v.durationMs)}</span></div>
    </section>`;
}

// ── Clips ────────────────────────────────────────────────────────────

function renderClips(v) {
  const selected = v.clips.filter((c) => c.selected).length;
  const all = selected === v.clips.length && selected > 0;
  return `
    <div class="clips-toolbar">
      <label class="ap-checkbox-container clips-toolbar__all">
        <input type="checkbox" data-clips-select-all ${all ? "checked" : ""} ${selected && !all ? 'data-indeterminate="true"' : ""} />
        <i></i><span>${selected} of ${v.clips.length} selected</span>
      </label>
      <div class="clips-toolbar__options">
        ${formatSelect(v.settings.ratio)}
        ${subtitleSelect(v.settings.subtitlePreset)}
      </div>
      <div class="clips-toolbar__actions">
        <button type="button" class="ap-button stroked grey" data-clips-add-clip>
          <i class="ap-icon-plus" aria-hidden="true"></i><span>Add a clip</span>
        </button>
        <button type="button" class="ap-button primary orange" data-clips-to-drafts ${selected ? "" : "disabled"}>
          <i class="ap-icon-archie-official" aria-hidden="true"></i><span>Create drafts${selected ? ` (${selected})` : ""}</span>
        </button>
      </div>
    </div>
    ${
      v.clips.length
        ? `<ol class="clips-list">${v.clips.map((c, i) => renderClip(v, c, i)).join("")}</ol>`
        : `<p class="clips-list__none">No clips left. Add one from the video's timeline.</p>`
    }`;
}

function renderClip(v, c, i) {
  const own = [
    c.ratio ? formatLabel(c.ratio) : "",
    c.captionCustom ? `Subtitles: ${presetLabel(clipCaptionState(v, c).presetId)}` : "",
    c.segments?.some((s) => s.origin === "USER") ? "Reframed" : "",
  ].filter(Boolean);
  return `
    <li class="clips-clip${c.selected ? " is-selected" : ""}" id="clip-${c.id}">
      <label class="ap-checkbox-container clips-clip__check" aria-label="Select clip ${i + 1}">
        <input type="checkbox" data-clips-select="${c.id}" ${c.selected ? "checked" : ""} /><i></i>
      </label>
      <a class="clips-clip__preview" href="#/clips/${v.id}/edit/${c.id}" aria-label="Edit clip ${i + 1}">${previewMarkup(v, c)}</a>
      <div class="clips-clip__body">
        <p class="clips-clip__meta">
          <span>Clip ${i + 1}</span><span>${fmtMs(c.endMs - c.startMs)}</span><span>${fmtMs(c.startMs)} → ${fmtMs(c.endMs)}</span>
        </p>
        <h3 class="clips-clip__title">${escapeHtml(c.title)}</h3>
        ${c.summary ? `<p class="clips-clip__summary">${escapeHtml(c.summary)}</p>` : ""}
        ${c.why ? `<p class="clips-clip__why"><span class="clips-clip__why-label">Why this clip</span> ${escapeHtml(c.why)}</p>` : ""}
        ${own.length ? `<p class="clips-clip__own">${own.map((o) => `<span class="ap-tag grey">${escapeHtml(o)}</span>`).join("")}</p>` : ""}
        <div class="clips-clip__actions">
          <a class="ap-button stroked grey" href="#/clips/${v.id}/edit/${c.id}"><i class="ap-icon-pen" aria-hidden="true"></i><span>Edit</span></a>
          <button type="button" class="ap-icon-button transparent" data-clips-remove="${c.id}" aria-label="Remove clip ${i + 1}" data-tooltip="Remove clip">
            <i class="ap-icon-trash" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </li>`;
}

// ── Drafts ───────────────────────────────────────────────────────────

function renderDrafts(v, posts) {
  if (draftSetup.writing) {
    return `<div class="clips-drafts__writing"><span class="ap-loader" aria-hidden="true"></span><p>Writing your drafts…</p></div>`;
  }
  if (!posts.length || draftSetup.open) return renderDraftSetup(v, posts.length > 0);
  const toSchedule = posts.filter((p) => p.status !== "scheduled");
  return `
    <div class="clips-toolbar">
      <p class="clips-toolbar__count">${posts.length} draft${posts.length === 1 ? "" : "s"}${
        posts.length - toSchedule.length ? ` · ${posts.length - toSchedule.length} scheduled` : ""
      }</p>
      <div class="clips-toolbar__actions">
        <button type="button" class="ap-button stroked grey" data-clips-more-drafts>
          <i class="ap-icon-plus" aria-hidden="true"></i><span>Write more drafts</span>
        </button>
        <button type="button" class="ap-button primary blue" data-clips-schedule-all ${toSchedule.length ? "" : "disabled"}>
          <i class="ap-icon-calendar" aria-hidden="true"></i><span>Schedule ${toSchedule.length || ""}</span>
        </button>
      </div>
    </div>
    <div class="clips-drafts posts">
      ${posts.map(renderDraft).join("")}
    </div>`;
}

// A scheduled draft stays in the list, said so above its card — this space is
// where the video's whole output is read, scheduled or not.
function renderDraft(p) {
  const scheduled = p.status === "scheduled";
  const when =
    scheduled && p.scheduledFor
      ? new Date(p.scheduledFor).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "";
  return `<div class="clips-drafts__item">
    ${scheduled ? `<p class="clips-drafts__status"><span class="ap-status green">Scheduled${when ? ` · ${escapeHtml(when)}` : ""}</span></p>` : ""}
    ${renderPostCard(p, { railActions: scheduled ? ["delete"] : ["schedule", "delete"] })}
  </div>`;
}

function renderDraftSetup(v, hasDrafts) {
  const clips = v.clips.filter((c) => c.selected);
  const profiles = getConnectedProfiles();
  if (draftSetup.accounts === null) draftSetup.accounts = new Set(profiles.slice(0, 1).map((p) => p.id));
  const accounts = profiles.filter((p) => draftSetup.accounts.has(p.id));
  const pb = getContextById(v.contextId);
  const count = clips.length * accounts.length;
  const accountBlock = profiles.length
    ? `<div class="clips-setup__accounts">${profiles
        .map(
          (p) => `<label class="ap-checkbox-container clips-setup__account">
            <input type="checkbox" data-clips-account="${escapeHtml(p.id)}" ${draftSetup.accounts.has(p.id) ? "checked" : ""} /><i></i>
            ${renderProfileTag(p)}
          </label>`,
        )
        .join("")}</div>`
    : `<p class="clips-setup__hint">Connect an account first — the network sets the length and the format of each draft. Nothing publishes yet.</p>
       <div class="clips-setup__connect">${connectableNetworkCards()
         .map(
           (n) => `<button type="button" class="ap-button stroked grey" data-clips-connect="${escapeHtml(n.value)}">
             ${n.preview}<span>${escapeHtml(n.label)}</span></button>`,
         )
         .join("")}</div>`;
  const ctas = CTA_OPTIONS.map(
    (o) => `<label class="ap-radio-card card clips-setup__cta">
      <input type="radio" name="clips-cta" value="${o.id}" data-clips-cta ${draftSetup.cta === o.id ? "checked" : ""} />
      <div><span>${escapeHtml(o.label)}</span><p class="clips-setup__cta-hint">${escapeHtml(o.hint)}</p></div>
    </label>`,
  ).join("");
  return `
    <section class="clips-setup" aria-labelledby="clips-setup-title">
      <header class="clips-setup__head">
        <h2 class="clips-setup__title" id="clips-setup-title">Where should I post these?</h2>
        <p class="clips-setup__sub">
          ${clips.length} clip${clips.length === 1 ? "" : "s"} selected · ${escapeHtml(formatLabel(v.settings.ratio))} ·
          ${escapeHtml(presetLabel(v.settings.subtitlePreset))}. One draft per clip and account${pb ? `, written in ${escapeHtml(pb.name)}'s voice` : ""}.
        </p>
      </header>
      <div class="clips-setup__group">
        <h3 class="clips-setup__label">Accounts</h3>
        ${accountBlock}
      </div>
      <div class="clips-setup__group">
        <h3 class="clips-setup__label">Call to action</h3>
        <div class="clips-setup__ctas">${ctas}</div>
        ${
          draftSetup.cta !== "none" && pb?.cta
            ? `<p class="clips-setup__hint">From the Playbook: “${escapeHtml(pb.cta)}”</p>`
            : draftSetup.cta !== "none"
              ? `<p class="clips-setup__hint">This Playbook has no call to action yet — I'll leave it out.</p>`
              : ""
        }
      </div>
      <footer class="clips-setup__foot">
        ${
          hasDrafts
            ? `<button type="button" class="ap-button ghost grey" data-clips-setup-cancel>Cancel</button>`
            : `<button type="button" class="ap-button ghost grey" data-clips-tab="clips">Back to clips</button>`
        }
        <button type="button" class="ap-button primary orange" data-clips-write ${count ? "" : "disabled"}>
          <i class="ap-icon-archie-official" aria-hidden="true"></i><span>Write ${count || ""} draft${count === 1 ? "" : "s"}</span>
        </button>
      </footer>
    </section>`;
}

function writeDrafts() {
  const v = getVideo(videoId);
  const clips = v.clips.filter((c) => c.selected);
  const accounts = getConnectedProfiles().filter((p) => draftSetup.accounts?.has(p.id));
  if (!clips.length || !accounts.length) return;
  const pb = getContextById(v.contextId);
  const key = draftKey(v.id);
  draftSetup.writing = true;
  paint();
  setTimeout(() => {
    for (const clip of clips) {
      for (const a of accounts) {
        const d = addPostDraft(key, {
          network: a.platform,
          text: [clip.title, clip.summary].filter(Boolean),
          hashtags: (clip.tags || []).slice(0, 3),
          clipRef: {
            start: clip.startMs / 1000,
            end: clip.endMs / 1000,
            sourceName: v.name,
            sourceId: v.id,
            clipId: clip.id,
          },
          format: clipRatioId(v, clip),
          subtitleStyle: clipCaptionState(v, clip).presetId,
        });
        if (pb?.cta && draftSetup.cta === "in_post") d.cta = pb.cta;
        if (pb?.cta && draftSetup.cta === "first_comment") d.firstComment = pb.cta;
      }
    }
    Object.assign(draftSetup, { writing: false, open: false });
    paint();
    const n = clips.length * accounts.length;
    showToast(`${n} draft${n === 1 ? "" : "s"} written`);
  }, 1600);
}

// ── Events ───────────────────────────────────────────────────────────

function onClick(e) {
  const v = getVideo(videoId);
  if (!v) return;
  const t = e.target;

  const tabBtn = t.closest("[data-clips-tab]");
  if (tabBtn) return setHashQuery(path(), tabBtn.dataset.clipsTab === "drafts" ? { tab: "drafts" } : {});

  const ratio = t.closest("[data-clips-ratio]");
  if (ratio) {
    ratio.closest("details")?.removeAttribute("open");
    return updateSettings(v.id, { ratio: ratio.dataset.clipsRatio });
  }
  const preset = t.closest("[data-clips-preset]");
  if (preset) {
    preset.closest("details")?.removeAttribute("open");
    return updateSettings(v.id, { subtitlePreset: preset.dataset.clipsPreset });
  }

  const jump = t.closest("[data-clips-jump]");
  if (jump) {
    if (tab() !== "clips") return setHashQuery(path(), {});
    const row = target.querySelector(`#clip-${CSS.escape(jump.dataset.clipsJump)}`);
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
    row?.classList.add("is-flash");
    setTimeout(() => row?.classList.remove("is-flash"), 1200);
    return undefined;
  }

  if (t.closest("[data-clips-add-clip]")) {
    // A 30 s range in the first gap after the last clip, opened on Trim.
    const last = v.clips[v.clips.length - 1];
    const startMs = Math.min(v.durationMs - 30000, last ? last.endMs + 5000 : 0);
    const clip = addClip(v.id, { startMs: Math.max(0, startMs), endMs: Math.max(0, startMs) + 30000 });
    return navigate(`/clips/${v.id}/edit/${clip.id}?tool=trim`);
  }

  const rm = t.closest("[data-clips-remove]");
  if (rm) {
    const gone = removeClip(v.id, rm.dataset.clipsRemove);
    if (gone) showToast(`Clip removed`, { action: { label: "Undo", onClick: () => restoreClip(v.id, gone) } });
    return undefined;
  }

  if (t.closest("[data-clips-to-drafts]")) {
    draftSetup.open = true;
    return setHashQuery(path(), { tab: "drafts" });
  }
  if (t.closest("[data-clips-more-drafts]")) {
    draftSetup.open = true;
    return paint();
  }
  if (t.closest("[data-clips-setup-cancel]")) {
    draftSetup.open = false;
    return paint();
  }
  if (t.closest("[data-clips-write]")) return writeDrafts();

  const connect = t.closest("[data-clips-connect]");
  if (connect) {
    const platform = connect.dataset.clipsConnect;
    openConnectAccountModal({
      network: platform,
      preselected: accountIdsForNetwork(platform),
      onConfirm: (accounts) => {
        if (!accounts.length) return;
        draftSetup.accounts = new Set(accounts.map((a) => a.id));
        paint();
      },
    });
    return undefined;
  }

  const key = draftKey(v.id);
  const schedule = t.closest("[data-post-schedule]");
  if (schedule) {
    const post = getPosts(key).find((p) => p.id === schedule.dataset.postSchedule);
    if (post) scheduleDrafts(v, [post]);
    return undefined;
  }
  if (t.closest("[data-clips-schedule-all]")) {
    return scheduleDrafts(
      v,
      getPosts(key).filter((p) => p.status !== "scheduled"),
    );
  }
  const del = t.closest("[data-post-delete]");
  if (del) {
    const posts = getPosts(key);
    const index = posts.findIndex((p) => p.id === del.dataset.postDelete);
    const removed = removePost(key, del.dataset.postDelete);
    if (removed)
      showToast("Draft deleted", { action: { label: "Undo", onClick: () => insertPost(key, removed, index) } });
    return undefined;
  }
  const clipEdit = t.closest("[data-post-clip-edit]");
  if (clipEdit) {
    const post = getPosts(key).find((p) => p.id === clipEdit.dataset.postClipEdit);
    if (post?.clipRef?.clipId) navigate(`/clips/${v.id}/edit/${post.clipRef.clipId}`);
  }
  return undefined;
}

function scheduleDrafts(v, posts) {
  if (!posts.length) return;
  openScheduleModal({
    posts,
    playbookId: v.contextId,
    onConfirm: (slots) => {
      for (const s of slots) updatePostContent(draftKey(v.id), s.postId, { status: "scheduled", scheduledFor: s.when });
    },
  });
}

function onChange(e) {
  const v = getVideo(videoId);
  if (!v) return;
  const t = e.target;
  if (t.matches("[data-clips-select-all]")) return setSelection(v.id, t.checked ? v.clips.map((c) => c.id) : []);
  if (t.matches("[data-clips-select]")) {
    const ids = v.clips.filter((c) => (c.id === t.dataset.clipsSelect ? t.checked : c.selected)).map((c) => c.id);
    return setSelection(v.id, ids);
  }
  if (t.matches("[data-clips-account]")) {
    draftSetup.accounts = draftSetup.accounts || new Set();
    if (t.checked) draftSetup.accounts.add(t.dataset.clipsAccount);
    else draftSetup.accounts.delete(t.dataset.clipsAccount);
    return paint();
  }
  if (t.matches("[data-clips-cta]")) {
    draftSetup.cta = t.value;
    return paint();
  }
  return undefined;
}
