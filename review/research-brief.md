# Research Brief: Improving the Swahili Spaced-Repetition Learning App

_Date: 2026-06-15. Author: language-learning product research pass._

This brief goes **beyond** the existing `PLAN.md` action items (accessibility, session robustness, stats clarity, the basic TTS-on-reveal feature, etc.), which are treated here as already-scoped engineering work. The focus is on pedagogy and product direction grounded in the SLA/SRS research literature and leading-practice competitor scans. Effort estimates are rough and assume the current stack: React 18 + TS, sql.js/IndexedDB, FSRS, scaffolded exercise picker, unit lessons, grammar track.

Key facts about the current app that shape these recommendations:
- The card schema **already stores `example_sentences` (Array<{swahili, english}>)** and a `noun_class` field (`src/types.ts`). Much of the sentence-level and concord work is therefore a UI/scheduling change, not a data-generation project.
- Exercise selection (`afm.ts` `scaffoldLevel`) maps skill mastery → support level → exercise type. The clamp logic at depth ≤ 3 means most cards stay at multiple-choice; there is room to add new exercise *types* into this ladder.
- FSRS is already the scheduler; desired retention and parameter optimisation are tunable knobs that are likely using defaults today.

---

## 1. Executive Summary

The app is built on a sound foundation (FSRS, scaffolded exercises, a dedicated grammar track, noun-class awareness). The highest-leverage improvements are about **moving from word-level to sentence-level practice** and **teaching the noun-class concord system as a productive pattern rather than per-word facts** — both of which the research strongly supports and which the existing data model already enables.

Top themes:

1. **Sentence-level / cloze practice is the single biggest pedagogical upgrade.** Words learned in isolation stay in isolation; cloze-in-context (à la Clozemaster) simultaneously delivers comprehensible input, retrieval practice, and grammatical exposure. The `example_sentences` data is already present.
2. **The noun-class system should be taught as a *generative pattern* with explicit concord practice**, not memorised word-by-word. Research and well-designed Swahili courses converge on: semantic grouping, paired singular/plural, and drilling agreement (adjective/verb/possessive) across classes.
3. **Add listening (and eventually light speaking) as first-class skills.** Vocabulary apps systematically over-index on receptive recognition; audio in/out is where Memrise and Duolingo pull ahead. Browser TTS gets you audio cheaply; native-speaker clips are the gold standard.
4. **Lean into intrinsic-motivation mechanics (autonomy/competence/relatedness) and treat streaks as anxiety-relieving, not anxiety-creating.** Self-Determination Theory, not raw gamification, predicts durable retention.
5. **Tune FSRS desired retention deliberately** (0.85–0.90) and expose interleaving — both are cheap, evidence-backed knobs.

---

## 2. Pedagogy & SRS

### 2.1 Spacing, retrieval, interleaving — the app does the first two, should add the third
The "desirable difficulties" trio (spacing, retrieval practice, interleaving) is the best-established finding in the vocabulary-learning literature, and 2024 work shows **interleaving layered on top of spaced repetition produces significantly larger gains and better long-term retention** than spaced repetition alone (CALL-EJ 2024 study; Eton CIRL summary). The app already spaces (FSRS) and retrieves (active exercises). What's missing is *deliberate* interleaving: mixing skill types (nouns vs verbs vs grammar concord vs listening) within a session rather than blocking by card type.
- Evidence: https://callej.org/index.php/journal/article/view/87 ; https://cirl.etoncollege.com/strategies-for-making-learning-last-retrieval-practice-spaced-practice-and-interleaving/
- Action: ensure `sessionAssembly` interleaves card *categories* (it weights by depth/due, but should avoid long runs of the same skill tag). **Effort: low–medium** (add an anti-clustering pass to the weighted draw).

### 2.2 Tune FSRS desired retention; it's the most important knob
FSRS's single most impactful setting is desired retention. Consensus: **0.85–0.90 minimises total study time while keeping mastery high**; going to 0.95 roughly doubles daily reviews, 0.97 quadruples them. For a self-study app where burnout is the main churn risk, 0.85–0.90 is the sweet spot, and "compute minimum recommended retention" can be surfaced as an adaptive setting.
- Evidence: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-optimal-retention ; https://faqs.ankiweb.net/frequently-asked-questions-about-fsrs.html
- Action: verify the value currently passed into `fsrs.ts`; expose it (or auto-tune) and default to ~0.88. **Effort: low.**

### 2.3 Comprehensible input + light explicit grammar (not either/or)
The research consensus is nuanced: comprehensible input (~90–98% known, "i+1") drives implicit acquisition of grammar that learners are never explicitly taught, but **brief explicit instruction plus rich input outperforms either alone**, especially for adults and for opaque systems like Swahili concord. The app's dedicated grammar track is the right instinct; the gap is *input volume* — learners need far more meaning-focused sentence exposure than isolated cards provide.
- Evidence: https://gianfrancoconti.com/2025/02/27/why-the-input-we-give-our-learners-must-be-95-98-comprehensible-in-order-to-enhance-language-acquisition-the-theory-and-the-research-evidence/ ; https://www.cambridge.org/core/services/aop-cambridge-core/content/view/90596BB3C4297189FC221117F1E8B25F/S0272263100013103a.pdf/comprehensible_input_and_second_language_acquisition.pdf
- Action: see 3.1 (cloze) — the same feature delivers both. **Effort: medium.**

### 2.4 Feedback design: make wrong-answer feedback elaborative, not just verification
The feedback literature distinguishes *verification* (right/wrong) from *correction* (the right answer) from *elaboration/scaffolding* (why, with an example). Elaborative feedback and feedback delivered close to the communicative moment produce better outcomes; bare red/green borders are the weakest form. `PLAN.md` D-2 already nudges this; the research backs going further — on errors, show the concord rule and the example sentence as the *primary* content, and consider eliciting self-correction for already-learned forms rather than just revealing.
- Evidence: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9995700/ ; https://www.cambridge.org/core/journals/language-teaching/article/timing-of-corrective-feedback-in-second-language-learning/0E8856852D0183E9DD91EDB4C249E245
- Action: enrich the reveal state with rule + example + audio. **Effort: low–medium.**

### 2.5 Receptive-first, then productive
Words are acquired receptively before they become productive; forcing production too early adds cognitive load without payoff. The current scaffold ladder (flashcard → MC → type-answer) already encodes this ordering, which is correct. The recommendation is to make the *receptive* rungs richer (listening recognition, see 4) before the productive ones, rather than collapsing too fast to typing.
- Evidence: https://files.eric.ed.gov/fulltext/EJ1077387.pdf
- Action: add a listening-recognition exercise as an early rung. **Effort: medium** (depends on audio, §4).

---

## 3. Swahili-Specific

### 3.1 Sentence-level cloze is the marquee feature (data already exists)
Clozemaster's core thesis — *words learned in isolation stay in isolation*; cloze-in-context delivers i+1 comprehensible input plus retrieval in one exercise — is exactly what the app is positioned to add cheaply because `example_sentences` is already on every card. A `fill_blank` exercise type already exists; generalising it from grammar cards to **vocabulary-in-sentence cloze** would be the single most pedagogically valuable change.
- Evidence: https://www.clozemaster.com/blog/comprehensible-input-clozemaster-mirrors-natural-acquisition/ ; https://www.clozemaster.com/blog/sentence-mining/
- Action: add a `sentence_cloze` exercise that blanks the target word inside `example_sentences[0].swahili`, shows the English gloss, and accepts the word. Slot it into the scaffold ladder between MC and type-answer. **Effort: medium** (new exercise component + picker wiring; no new data).

### 3.2 Teach noun classes as a generative concord *system*, not per-word facts
The noun-class system is the central difficulty of Swahili, and every serious pedagogy source converges on the same advice: **start with the most frequent classes (1/2, 3/4, 5/6, 7/8), group semantically, always pair singular+plural, and drill *agreement* (adjective, verb subject prefix, possessive) across classes** rather than memorising nouns one at a time. The app stores `noun_class`; the opportunity is a dedicated concord-pattern exercise — e.g. "kitabu kizuri / vitabu __" — that makes the learner *generate* the concord, which is where mastery actually lives.
- Evidence (university courses + guides): https://openbooks.library.baylor.edu/elementaryswahili1/chapter/lesson-1-noun-classes-and-number-agreements/ ; https://wisc.pb.unizin.org/lctlresources/chapter/noun-classes-an-introduction-and-practicing-possessive-agreements/ ; https://talkpal.ai/mastering-swahili-noun-classes-a-complete-guide-to-language-success/
- Action: a `concord` exercise type generating "fill the agreeing prefix" items grouped by class, plus a class-overview reference (chart) in the grammar tab. A `noun_class` exercise type already exists in `ExerciseType` — verify/extend it. **Effort: medium** (needs a concord-rule table keyed by class; partially derivable from existing data).

### 3.3 Dialect: keep Standard Swahili (Kiunguja-based) as the target — it's correct
Standard Swahili is codified from the Kiunguja (Zanzibar coastal) dialect and is the form used in education, media, and across the region. For a general learner app, this is the right default; no change needed beyond *labelling* it so learners know what variety they're acquiring, and optionally noting coastal vs inland differences in cultural notes.
- Evidence: https://en.wikipedia.org/wiki/Standard_Swahili_language ; https://wisc.pb.unizin.org/lctlresources/chapter/swahili-dialects/
- Action: a one-line note in onboarding/grammar ("You're learning Standard Swahili, based on the Zanzibar coastal dialect"). **Effort: trivial.**

### 3.4 Pronunciation: Swahili is phonetically regular and *not* tonal — lean on it
Swahili spelling is highly phonemic and the language is non-tonal, which is a major pedagogical gift: TTS and simple syllable/stress rules (penultimate-syllable stress) are reliable. The existing pronunciation-guide utility and `PLAN.md` D-3 (syllable breakdown on first exposure) are well-aimed; the main missing piece is *audio*, not transcription. (Phonetic regularity is why the `lang="sw"` TTS approach in §4 is viable.)
- Action: pair syllable breakdown with audio on first-exposure cards. **Effort: low** (combines with §4).

---

## 4. Audio / TTS

### 4.1 Browser `SpeechSynthesis` (`lang="sw"`) is a viable v1, with caveats
`window.speechSynthesis` is exposed in all major browsers and **Swahili is among Chrome desktop's supported voices**, so the `PLAN.md` Stream E SpeakButton will work for many users with zero backend. Because Swahili is phonetically regular, even a generic voice produces usable pronunciation. Caveats from the research: voice availability is **OS/browser-dependent** (Windows = Microsoft engine, macOS = Apple, Android variable), and many devices will have *no* `sw` voice installed, in which case the browser silently falls back or fails.
- Evidence: https://www.testmuai.com/learning-hub/speech-synthesis-api-browser-support/ ; https://atlasaidev.com/docs/text-to-speech/usage-setup/supported-languages-and-browser-compatibility/
- Action: ship the SpeakButton, but **detect availability** (`speechSynthesis.getVoices().some(v => v.lang.startsWith('sw'))`) and hide/disable the control when no Swahili voice exists rather than playing an English-accented fallback. **Effort: low.**

### 4.2 For consistent quality, pre-generate audio with a cloud TTS and ship as assets
The reliable path to *uniform* pronunciation is to pre-generate audio files offline using a higher-quality engine and serve them as static assets (fits the Vercel static-site model and the PWA cache). **Google Cloud TTS supports Swahili** (WaveNet/Neural2; less-resourced languages can have minor artefacts but are intelligible). Azure Neural TTS is the other candidate (140+ languages; verify current Swahili coverage before committing). Pre-generating per-card audio is a one-time batch job against the curriculum, cached by the service worker.
- Evidence: https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types ; https://www.speechmatics.com/company/articles-and-news/best-tts-apis-in-2025-top-12-text-to-speech-services-for-developers
- Action: batch-generate MP3s for each card's word + first example sentence; store under `public/audio/`, fall back to browser TTS when missing. **Effort: medium** (batch script + asset pipeline + cache config; no runtime backend).

### 4.3 Native-speaker clips are the gold standard (later)
Memrise's differentiator is **real native-speaker video/audio clips** ("Learn with locals"), which beat synthetic audio for listening-skill transfer and accent exposure. This is a content-acquisition project, not an engineering one, so it's a longer-horizon bet — but worth noting as the ceiling.
- Evidence: https://www.fluentu.com/blog/reviews/memrise/
- Action: sourcing project for a small set of high-frequency words/phrases. **Effort: high (content), low (playback).**

---

## 5. Competitive Insights

| Competitor | What it does well → what to borrow |
|---|---|
| **Clozemaster** | Cloze-in-context as the *primary* exercise; frequency-ordered sentences. → Adopt sentence cloze (§3.1). https://www.clozemaster.com/blog/comprehensible-input-clozemaster-mirrors-natural-acquisition/ |
| **Language Transfer (Swahili)** | The "thinking method": teacher *builds* grammar by eliciting answers the learner reasons out, rather than presenting rules. Highly regarded specifically for Swahili. → Frame concord/grammar exercises as guided derivation ("you know -zuri means good and ki- is the class prefix, so 'good book' is…") instead of rule dumps. https://www.languagetransfer.org/swahili ; https://www.alllanguageresources.com/language-transfer/ |
| **Memrise** | Native-speaker video clips + mnemonics. → Audio/clips (§4.3); allow user mnemonics on cards. https://www.fluentu.com/blog/reviews/memrise/ |
| **Drops** | Visual word↔image association, 5-minute sessions, strong visual design. → Image association for concrete nouns; honour the existing "reviews per day" cap as a *quick session* mode. https://www.clozemaster.com/blog/clozemaster-vs-drops/ |
| **Anki / FSRS** | Best-in-class scheduling + user control. → Already adopted; tune retention (§2.2) and expose stats honestly. https://faqs.ankiweb.net/frequently-asked-questions-about-fsrs.html |
| **Duolingo** | Habit-forming streaks, but with anxiety-relieving safety valves (streak freeze cut churn 21%). → Streaks *with* freeze/repair, not punitive streaks (§6). https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification |

The strategic gap vs. these competitors: **the app is strong on scheduling and grammar structure but thin on (a) sentence-level input and (b) audio** — precisely the two dimensions where Clozemaster and Memrise respectively win.

---

## 6. Motivation & Retention

### 6.1 Design for Self-Determination Theory, not points-for-points'-sake
The motivation research is unambiguous: durable engagement comes from satisfying **autonomy, competence, and relatedness**. Gamification *helps* when it delivers competence feedback, meaningful choices, and social connection — and *backfires* (undermines intrinsic motivation) when points/badges become controlling "do X to get Y" mechanics. There's a documented case study of gamification *misuse* reducing motivation in a language app.
- Evidence: https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1295709/full ; https://arxiv.org/pdf/2203.16175 ; https://www.nngroup.com/articles/autonomy-relatedness-competence/
- Design implications:
  - **Competence:** honest progress visualisation (the `PLAN.md` C-1 fix — replace the alarming "New: 25,362" with personal progress — is exactly right). Show mastery growth, not curriculum size.
  - **Autonomy:** let learners choose focus (goals already exist via `goalWeights`); surface "study what you choose today."
  - **Relatedness:** cultural notes already exist; lean into connecting learning to real Swahili-speaking contexts rather than leaderboards (a single-user PWA can't easily do social, so don't force it).

### 6.2 Streaks: include the safety valve from day one
Streaks measurably drive retention (Duolingo: streak restoration +8% retention; streak freeze −21% churn) **because the freeze relieves anxiety** — the same study shows streaks without relief produce burnout and "streak creep." If the app adds streaks (Settings already has a "Streaks & XP" toggle), ship streak-freeze/repair simultaneously and keep it forgiving (e.g. weekend grace, repair tokens).
- Evidence: https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification ; https://www.trypropel.ai/resources/duolingo-customer-retention-strategy
- Action: wire the existing streak setting into Home (`PLAN.md` C-2 daily progress) + add a freeze mechanic. **Effort: low–medium.**

### 6.3 Daily goal & progress on Home (already planned, strongly supported)
`PLAN.md` C-2 (daily goal progress bar on Home) is directly endorsed by the competence pillar of SDT and Duolingo's retention data — visible daily progress against a self-set goal is a competence + autonomy win. Keep goals modest and learner-set, not imposed.

---

## 7. Prioritized Opportunities

Ordered by (pedagogical impact ÷ effort). "Effort" assumes the current stack and existing data.

| # | Opportunity | Rationale | Evidence URL | Effort |
|---|---|---|---|---|
| 1 | **Sentence-level cloze exercise** (blank target word in `example_sentences`) | Highest-impact pedagogy change; delivers comprehensible input + retrieval in context; data already exists | https://www.clozemaster.com/blog/sentence-mining/ | Medium |
| 2 | **Tune FSRS desired retention to ~0.88 / auto-tune** | Most impactful SRS knob; balances mastery vs burnout | https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-optimal-retention | Low |
| 3 | **Noun-class concord exercise** (generate agreeing prefix; grouped by class) | Concord is *the* Swahili challenge; mastery lives in generating agreement, not memorising nouns | https://openbooks.library.baylor.edu/elementaryswahili1/chapter/lesson-1-noun-classes-and-number-agreements/ | Medium |
| 4 | **Browser TTS SpeakButton with voice-availability detection** | Cheap audio v1; Swahili is phonetically regular; fixes Stream E's silent-fallback risk | https://www.testmuai.com/learning-hub/speech-synthesis-api-browser-support/ | Low |
| 5 | **Elaborative wrong-answer feedback** (rule + example + audio as primary content) | Elaboration > verification in the CF literature; goes beyond PLAN D-2 | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9995700/ | Low–Med |
| 6 | **Interleave skill categories within a session** | Interleaving + SRS beats SRS alone (2024) | https://callej.org/index.php/journal/article/view/87 | Low–Med |
| 7 | **Honest progress visualisation + daily goal on Home** (PLAN C-1/C-2) | SDT competence pillar; the "25,362" number actively demotivates | https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1295709/full | Low–Med |
| 8 | **Streaks *with* freeze/repair from launch** | Streaks drive retention only when paired with anxiety relief | https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification | Low–Med |
| 9 | **Pre-generated cloud-TTS audio assets** (Google/Azure) | Uniform pronunciation quality; static-asset/PWA-friendly | https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types | Medium |
| 10 | **Listening-recognition exercise rung** (hear → pick) | Apps neglect receptive listening; receptive precedes productive | https://files.eric.ed.gov/fulltext/EJ1077387.pdf | Medium |
| 11 | **Language-Transfer-style guided grammar derivation** | Best-regarded Swahili method; raises grammar engagement | https://www.languagetransfer.org/swahili | Medium |
| 12 | **Standard-dialect labelling + cultural relatedness** | Sets learner expectations; SDT relatedness; low cost | https://en.wikipedia.org/wiki/Standard_Swahili_language | Trivial |
| 13 | **Native-speaker audio clips** (high-freq subset) | Gold-standard listening transfer (Memrise's edge) | https://www.fluentu.com/blog/reviews/memrise/ | High (content) |

---

### Sources (consolidated)
- SRS / interleaving: https://callej.org/index.php/journal/article/view/87 · https://cirl.etoncollege.com/strategies-for-making-learning-last-retrieval-practice-spaced-practice-and-interleaving/
- FSRS retention: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-optimal-retention · https://faqs.ankiweb.net/frequently-asked-questions-about-fsrs.html
- Comprehensible input / grammar: https://gianfrancoconti.com/2025/02/27/why-the-input-we-give-our-learners-must-be-95-98-comprehensible-in-order-to-enhance-language-acquisition-the-theory-and-the-research-evidence/ · https://www.cambridge.org/core/services/aop-cambridge-core/content/view/90596BB3C4297189FC221117F1E8B25F/S0272263100013103a.pdf/comprehensible_input_and_second_language_acquisition.pdf
- Feedback: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9995700/ · https://www.cambridge.org/core/journals/language-teaching/article/timing-of-corrective-feedback-in-second-language-learning/0E8856852D0183E9DD91EDB4C249E245
- Receptive/productive: https://files.eric.ed.gov/fulltext/EJ1077387.pdf
- Swahili noun classes: https://openbooks.library.baylor.edu/elementaryswahili1/chapter/lesson-1-noun-classes-and-number-agreements/ · https://wisc.pb.unizin.org/lctlresources/chapter/noun-classes-an-introduction-and-practicing-possessive-agreements/ · https://talkpal.ai/mastering-swahili-noun-classes-a-complete-guide-to-language-success/
- Dialect: https://en.wikipedia.org/wiki/Standard_Swahili_language · https://wisc.pb.unizin.org/lctlresources/chapter/swahili-dialects/
- Cloze/Clozemaster: https://www.clozemaster.com/blog/comprehensible-input-clozemaster-mirrors-natural-acquisition/ · https://www.clozemaster.com/blog/sentence-mining/ · https://www.clozemaster.com/blog/clozemaster-vs-drops/
- Language Transfer: https://www.languagetransfer.org/swahili · https://www.alllanguageresources.com/language-transfer/
- Memrise: https://www.fluentu.com/blog/reviews/memrise/
- TTS: https://www.testmuai.com/learning-hub/speech-synthesis-api-browser-support/ · https://atlasaidev.com/docs/text-to-speech/usage-setup/supported-languages-and-browser-compatibility/ · https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types · https://www.speechmatics.com/company/articles-and-news/best-tts-apis-in-2025-top-12-text-to-speech-services-for-developers
- Motivation/SDT/gamification: https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1295709/full · https://arxiv.org/pdf/2203.16175 · https://www.nngroup.com/articles/autonomy-relatedness-competence/ · https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification · https://www.trypropel.ai/resources/duolingo-customer-retention-strategy
