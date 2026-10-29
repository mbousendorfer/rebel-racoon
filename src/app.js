import { navigate, route, setAfterRender, start } from "./router.js?v=2552";
import { initArchieLoader } from "./archie-loader.js?v=2552";
import { renderInsights } from "./screens/insights/shell.js?v=2552";
import { init as initObjectiveModal } from "./components/objective-modal.js?v=2552";
import { init as initObjectiveCatalogPanel } from "./components/objective-catalog-panel.js?v=2552";
import { initTopbar, renderTopbar } from "./components/topbar.js?v=2552";
import { initSidebar, renderSidebar } from "./components/sidebar.js?v=2552";
import { isAccountScope } from "./active-playbook.js?v=2552";
import { isFlagOn } from "./feature-flags.js?v=2552";
import { init as initRightPanel } from "./components/right-panel.js?v=2552";
import { init as initScheduleModal } from "./components/schedule-modal.js?v=2552";
import { init as initLegacyScheduleModal } from "./components/schedule-modal-legacy.js?v=2552";
import { init as initBugReportModal } from "./components/bug-report-modal.js?v=2552";
import { init as initFeedbackModal } from "./components/feedback-modal.js?v=2552";
import { init as initVideoClipsModal } from "./components/video-clips-modal.js?v=2552";
import { init as initChatPickerModal } from "./components/chat-picker-modal.js?v=2552";
import { init as initAddSourceModal } from "./components/add-source-modal.js?v=2552";
import { init as initConnectorsModal } from "./components/connectors-modal.js?v=2552";
import { init as initTopicIgnoreModal } from "./components/topic-ignore-modal.js?v=2552";
import { init as initTopicHistoryModal } from "./components/topic-history-modal.js?v=2552";
import { init as initTopicPickerModal } from "./components/topic-picker-modal.js?v=2552";
import { init as initConfirmModal } from "./components/confirm-modal.js?v=2552";
import { init as initRenameModal } from "./components/rename-modal.js?v=2552";
import { init as initSaveFolderModal } from "./components/save-folder-modal.js?v=2552";
import { init as initSharePlaybookModal } from "./components/share-playbook-modal.js?v=2552";
import { init as initAssignModal } from "./components/assign-modal.js?v=2552";
import { init as initAnalyzeProfilesModal } from "./components/analyze-profiles-modal.js?v=2552";
import { init as initConnectAccountModal } from "./components/connect-account-modal.js?v=2552";
import { init as initVoiceIntro, maybeOpenVoiceIntro } from "./components/voice-intro-modal.js?v=2552";
import { init as initFillDocumentModal } from "./components/fill-document-modal.js?v=2552";
import { init as initSearchModal } from "./components/search-modal.js?v=2552";
import { init as initTooltip } from "./components/tooltip.js?v=2552";
import { init as initRefPreview } from "./components/ref-preview.js?v=2552";
import {
  init as initConversationStatusCard,
  render as renderConversationStatusCard,
} from "./components/conversation-status-card.js?v=2552";
import { renderDashboard } from "./screens/dashboard.js?v=2552";
import { renderSession } from "./screens/session.js?v=2552";
import { renderHome, renderContextsRoute } from "./screens/home.js?v=2552";
import { renderTopics } from "./screens/topics.js?v=2552";
import { renderTopicsSettings } from "./screens/topics-settings.js?v=2552";
import { renderClipsLibrary } from "./screens/clips/library.js?v=2552";
import { renderClipsProject } from "./screens/clips/project.js?v=2552";
import { renderClipEditor } from "./screens/clips/editor.js?v=2552";
import { renderConnectors } from "./screens/connectors.js?v=2552";
import { renderWelcomeAlt } from "./screens/welcome-alt.js?v=2552";
// Settings route removed — the prototype Admin controls moved to the sidebar
// cog popover (see admin-menu.js + sidebar.js); Social accounts page dropped.
import { renderWelcomeAltRecap, renderWelcomeAltVoice } from "./screens/welcome-alt-recap.js?v=2552";
import { renderWelcomeAltIntro } from "./screens/welcome-alt-intro.js?v=2552";
import {
  renderWelcomeAltBrand,
  renderWelcomeAltInterview,
  renderWelcomeAltLanguage,
  renderWelcomeAltDocuments,
  renderWelcomeAltVoiceFrom,
} from "./screens/welcome-alt-steps.js?v=2552";
import { renderWelcomeAltReady } from "./screens/welcome-alt-ready.js?v=2552";
import { renderPlaybook } from "./screens/playbook.js?v=2552";
import { initFigmaCapture } from "./figma-capture.js?v=2552";
import { initDemoMode } from "./demo-flow.js?v=2552";
import { ROUTES as IMAGE_GENERATOR_ROUTES } from "./modules/image-studio/index.js?v=2552";

// Route table.
// Every screen is responsible for calling renderTopbar() itself so the crumb
// stays in sync with the active context.
route("/", renderDashboard);
route("/session/:id", renderSession);
// The account home (flag `playbookWorkspace`) and the Playbooks catalogue are
// one screen, screens/home.js, entered by two routes. Each gates itself and
// bounces to the other's model, so a stale deep link always lands: /home is the
// hero + the two tabs, /contexts the catalogue on its own.
route("/home", renderHome);
route("/contexts", renderContextsRoute);
route("/playbook/:id", renderPlaybook);
route("/connectors", renderConnectors);
// Insights — the active brand's objectives, read two ways. ONE route: the two
// layouts are a control inside the screen, not URLs. /insights/:tab exists only
// so links from the older tabbed hub land, query kept, and it is gated by the
// same flag as the screen (which bounces home when the switch is off).
route("/insights", renderInsights);
route("/insights/:tab", () => {
  const query = window.location.hash.split("?")[1];
  navigate(query ? `/insights?${query}` : "/insights");
});
// The Topic Feed. Gated on `topicFeed` inside the screen rather than here, so a
// stale deep link bounces to / instead of rendering a dead route.
route("/topics", renderTopics);
// route() anchors its regex (^…$), so this is a distinct sibling of /topics — no
// ordering concern. The config is a settings PAGE rather than a tab on the feed:
// you set your listening sources once and then read Topics for months.
route("/topics/settings", renderTopicsSettings);
// The Clips space (flag clipsSpace): the Playbook's videos, one video's
// project, one clip's editor. Each screen bounces to / while the flag is off.
route("/clips", renderClipsLibrary);
route("/clips/:id", renderClipsProject);
route("/clips/:id/edit/:clipId", renderClipEditor);
// The first-time run, as screens — the plan, the brand, the account, the
// reveal, the reviews. /welcome-alt only redirects to its intro.
route("/welcome-alt", renderWelcomeAlt);
route("/welcome-alt/recap", renderWelcomeAltRecap);
route("/welcome-alt/intro", renderWelcomeAltIntro);
route("/welcome-alt/brand", renderWelcomeAltBrand);
route("/welcome-alt/interview", renderWelcomeAltInterview);
route("/welcome-alt/language", renderWelcomeAltLanguage);
route("/welcome-alt/documents", renderWelcomeAltDocuments);
route("/welcome-alt/voice-from", renderWelcomeAltVoiceFrom);
route("/welcome-alt/voice", renderWelcomeAltVoice);
route("/welcome-alt/ready", renderWelcomeAltReady);
// Image Generator (flag `sexySquirrel`) — a standalone module that owns its own
// sub-routes; each handler gates itself. See docs/audits/image-studio-integration.md.
for (const r of IMAGE_GENERATOR_ROUTES) route(r.pattern, r.handler);

// Boot.
// Swap every spinner in the app for the animated network-assemble mark
// (sweeps the DOM now + watches for loaders added by later renders).
initArchieLoader();
// The thread's restyle since Monday 2026-10-05 lives behind this flag; OFF,
// styles/chat-legacy.css puts the Monday values back (body:not(.conv-new)).
document.body.classList.toggle("conv-new", isFlagOn("newConversationStyles"));
// Flag uiIdeaCard — the idea card's scoped rules in styles/components/right-panel.css.
document.body.classList.toggle("ui-idea-card", isFlagOn("uiIdeaCard"));
// Document-delegated, so every `[data-tooltip]` rendered by any screen — now or
// after the next route change — is live without registering anything.
initTooltip();
// Same, for the hover preview of Archie's inline references (chat-refs.js).
initRefPreview();
initTopbar();
initDemoMode();
renderTopbar();
initSidebar();
renderSidebar();
initRightPanel();
initScheduleModal();
initLegacyScheduleModal(); // behind the "New SM" flag (OFF)
// Inject modal DOM once so the topbar buttons can just toggle open/close
// without worrying about init ordering.
initBugReportModal();
initVoiceIntro();
initFeedbackModal();
initVideoClipsModal();
initChatPickerModal();
initAddSourceModal();
initConnectorsModal();
initTopicIgnoreModal();
initTopicHistoryModal();
initTopicPickerModal();
initConfirmModal();
initRenameModal();
initSaveFolderModal();
initObjectiveModal();
initObjectiveCatalogPanel();
initSharePlaybookModal();
initAssignModal();
initAnalyzeProfilesModal();
initConnectAccountModal();
initFillDocumentModal();
initSearchModal();
initConversationStatusCard();

// Re-render the sidebar on every route change so the active conversation row
// stays highlighted. The conversation status card also re-renders here so it
// hides when navigating away from /session/:id.
//
// The onboarding class flip is centralized here so the /welcome-alt screens
// get a full-bleed shell without each screen having to add/remove the class.
setAfterRender((path) => {
  renderSidebar();
  renderConversationStatusCard();
  // A returning user's « Create a Playbook » runs the same screens inside the
  // app's chrome — sidebar and topbar kept (2026-10-29, asked: « l'expérience
  // create a new playbook devrait proposer cette interface, mais dans le chrome
  // existant »). Only the first time is full-bleed.
  let integrated = false;
  try {
    integrated = window.sessionStorage.getItem("welcomeAltIntegrated") === "1";
  } catch {
    /* ignore */
  }
  document.body.classList.toggle("onboarding", path.startsWith("/welcome-alt") && !integrated);
  // Account scope — the routes that live ABOVE the workspaces (the Playbooks
  // catalogue, and another brand's fiche opened from it). The shell steps back
  // to a single column with no rail: a page listing eight brands must not wear
  // the chrome of one. See active-playbook.js § Above the workspaces.
  document.body.classList.toggle("account-scope", isAccountScope(path));
  // The clip editor works full-bleed: the rail steps aside, like an editor's.
  document.body.classList.toggle("clips-editing", /^\/clips\/[^/]+\/edit\//.test(path));
  // Each network, its own voice — once, on arrival (flag voicePerNetwork).
  maybeOpenVoiceIntro(path);
});

start();

// Deep links that open a modal or a panel for the Figma screen capture.
initFigmaCapture();
