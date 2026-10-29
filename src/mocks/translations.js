// A draft rewritten in another language from the chat (« Translate post 1 into
// French », draft-rewrite.js). Seed data only — the product asks the model.
// Re-exported by ../mocks.js, which stays the single import path.

// One row per paragraph of the seeded drafts, the same paragraph in each
// language: a draft finds its paragraphs in any column and takes the target's.
export const DRAFT_TRANSLATIONS = [
  {
    English:
      "Your Q2 plan isn't a plan, it's a wish list — unless every objective names the single signal you'll watch weekly.",
    French:
      "Votre plan du T2 n'est pas un plan, c'est une liste de souhaits, sauf si chaque objectif nomme le seul signal que vous suivrez chaque semaine.",
    Spanish:
      "Tu plan del T2 no es un plan, es una lista de deseos, salvo que cada objetivo nombre la única señal que vas a seguir cada semana.",
  },
  {
    English: "Teams who track one weekly proof point ship on cadence.",
    French: "Les équipes qui suivent une preuve par semaine livrent au rythme prévu.",
    Spanish: "Los equipos que siguen una prueba semanal publican a su ritmo.",
  },
  {
    English:
      "Short version of today's offsite: we stopped writing quarterly OKRs. Here's what replaced them and why the team ships faster now.",
    French:
      "Le séminaire d'aujourd'hui en bref : nous avons arrêté d'écrire des OKR trimestriels. Voici ce qui les remplace, et pourquoi l'équipe livre plus vite.",
    Spanish:
      "El offsite de hoy, en corto: dejamos de escribir OKR trimestrales. Esto es lo que los reemplazó y por qué el equipo entrega más rápido.",
  },
  {
    English:
      "The replacement is simple: one weekly operating signal, one owner, and one decision the team can actually make before Friday.",
    French:
      "Le remplaçant est simple : un signal hebdomadaire, un responsable, et une décision que l'équipe peut vraiment prendre avant vendredi.",
    Spanish:
      "El reemplazo es simple: una señal semanal, un responsable y una decisión que el equipo puede tomar de verdad antes del viernes.",
  },
  {
    English:
      "Three constraints killed our first launch: scope, distribution, and onboarding. All three were visible at the offsite — and all three were missing from the retrospective doc.",
    French:
      "Trois contraintes ont tué notre premier lancement : le périmètre, la distribution et l'onboarding. Toutes trois étaient visibles au séminaire, et toutes trois manquaient dans la rétrospective.",
    Spanish:
      "Tres limitaciones mataron nuestro primer lanzamiento: el alcance, la distribución y el onboarding. Las tres se veían en el offsite, y las tres faltaban en la retrospectiva.",
  },
  {
    English: "If your retro doesn't name the constraints, your next launch will hit the same ones.",
    French: "Si votre rétro ne nomme pas les contraintes, votre prochain lancement butera sur les mêmes.",
    Spanish: "Si tu retro no nombra las limitaciones, tu próximo lanzamiento chocará con las mismas.",
  },
  {
    English:
      "Behind-the-scenes on the founder keynote — including the parts that got cut. The cuts are more instructive than the keynote itself.",
    French:
      "Les coulisses de la keynote du fondateur, y compris les passages coupés. Les coupes en disent plus que la keynote elle-même.",
    Spanish:
      "Detrás de escena de la keynote del fundador, incluidas las partes que se cortaron. Los cortes enseñan más que la propia keynote.",
  },
  {
    English:
      "We dropped the product demo, the roadmap slide and the customer logos. What stayed: the three mistakes we made in year one, and what each one cost us.",
    French:
      "Nous avons retiré la démo produit, la slide de roadmap et les logos clients. Ce qui est resté : les trois erreurs de notre première année, et ce que chacune nous a coûté.",
    Spanish:
      "Quitamos la demo del producto, la slide del roadmap y los logos de clientes. Lo que quedó: los tres errores del primer año y lo que nos costó cada uno.",
  },
];

// A draft whose paragraphs aren't in the table (one written in this chat).
// ponytail: one stock post per language; the product translates the draft itself.
export const DRAFT_TRANSLATION_FALLBACK = {
  English: ["One signal, watched every week, beats ten dashboards.", "Which one do you watch?"],
  French: [
    "Un seul signal, suivi chaque semaine, vaut mieux que dix tableaux de bord.",
    "Et vous, lequel suivez-vous ?",
  ],
  Spanish: ["Una sola señal, seguida cada semana, vale más que diez paneles.", "¿Y tú, cuál sigues?"],
};
