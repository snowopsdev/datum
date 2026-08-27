# Changelog

## [0.3.0](https://github.com/snowopsdev/datum/compare/v0.2.0...v0.3.0) (2026-08-27)


### Features

* **cms:** add the evidence-source-candidates collection ([35f7fc8](https://github.com/snowopsdev/datum/commit/35f7fc8f5fa1f589ea3163307cda0704e5f287f9))
* **cms:** add the source review governance page ([015aff4](https://github.com/snowopsdev/datum/commit/015aff46905ab36443c074d328ab374b9cfb01a6))
* **cms:** add the topic discovery migration ([b289188](https://github.com/snowopsdev/datum/commit/b28918859201be75ec7dae11d0a8fce612ac6619))
* **cms:** group picked topics into one article and cache discovery ([cdf1d5f](https://github.com/snowopsdev/datum/commit/cdf1d5f4c9c4a7183f23b76e447f906aeb2b2bdd))
* **cms:** intent-first new content flow that starts research on its own ([5df5866](https://github.com/snowopsdev/datum/commit/5df5866849c43a5274cd2a4556ceb9c37341d60e))
* **cms:** let operators discover topics from a subject they type ([1e12678](https://github.com/snowopsdev/datum/commit/1e1267801334c5ec0388cafd8fb4cc40b1fbea10))
* **cms:** onboarding is one decision, then your first piece ([278a0fa](https://github.com/snowopsdev/datum/commit/278a0fac0ad617718fe6befb0c42d18f7301149e))
* **cms:** replace the article board with a content list and stepper ([9ad44e3](https://github.com/snowopsdev/datum/commit/9ad44e38d7f5b208eebe8e02083e2e5b61641356))
* **cms:** report run outcomes on the board and allow new templates ([a35393d](https://github.com/snowopsdev/datum/commit/a35393d3520ef1f4cf16c94798844547388c6aa1))
* **cms:** run and remove selected topics from the article board ([cf03720](https://github.com/snowopsdev/datum/commit/cf037201848c956f11f687af387c346c49a17201))
* **cms:** say what QA failed and what the rewrite must change ([1ec050b](https://github.com/snowopsdev/datum/commit/1ec050b57570f4d2ec337bb2fe0cfc5d875cec24))
* **cms:** say what the model is doing during a live run ([3a2b758](https://github.com/snowopsdev/datum/commit/3a2b758c48f1c85bfd8a17d32ea7a393a6958d48))
* **cms:** show active runs in a sticky bar across the admin ([57cacf2](https://github.com/snowopsdev/datum/commit/57cacf23bd0aede7676d6816fed07754a5d854cb))
* **pipeline:** add the brief checkpoint between research and writing ([bda52a7](https://github.com/snowopsdev/datum/commit/bda52a70dfc288a39a8b2dd8e5aa9ed0a7a7de5e))
* **pipeline:** record unrated evidence domains from the scoring stage ([c32951b](https://github.com/snowopsdev/datum/commit/c32951b1266f3ad030f499272fed3a9cba8c2195))


### Bug Fixes

* **cms:** keep the domain rating pill on one line ([b32e575](https://github.com/snowopsdev/datum/commit/b32e57576bfd1bb22593c2f7006e22f5e2598131))
* **cms:** make the source review page match the ops CSS conventions ([c9f35b6](https://github.com/snowopsdev/datum/commit/c9f35b6f47a9d1905b4374eec05f168def6800cb))
* **cms:** Prevent integration schema races ([9dd2e14](https://github.com/snowopsdev/datum/commit/9dd2e14b7d8f3d6fe50c1a0f960fc38fa177962a))
* **cms:** unstick deferred research and fix two Codex findings ([5125ef1](https://github.com/snowopsdev/datum/commit/5125ef1fab1151c41ee5a31ae36f1ccf7a7ad2d7))
* **pipeline:** label FAQ entries so QA stops reporting them as duplicate content ([e7b6417](https://github.com/snowopsdev/datum/commit/e7b641777e0b3e7b2e5f58e77cbb21e61381901d))
* **pipeline:** repair the OpenAI path and the checks it feeds ([013b19f](https://github.com/snowopsdev/datum/commit/013b19ff219a0ccd2c385e1bce989068ff401399))
* **pipeline:** stop failing every draft on a missing social image ([116aee8](https://github.com/snowopsdev/datum/commit/116aee8b9924fa5dbcf063c97f209d6ed1fcfecc))
* **pipeline:** stop the e2e report check failing when it finds the block ([f20cb34](https://github.com/snowopsdev/datum/commit/f20cb34592ee93ad792dc18a9fd30836214b256a))
* **pipeline:** stop truncating command output when it is piped ([fc7c26c](https://github.com/snowopsdev/datum/commit/fc7c26c413679629f27bae61cf0597e211c9b008))
* **pipeline:** update workspaceReadiness tests for the ready redefinition ([b157e20](https://github.com/snowopsdev/datum/commit/b157e20663c3e8d36d47e444e69184f7b8e383d1))

## [0.2.0](https://github.com/snowopsdev/datum/compare/v0.1.0...v0.2.0) (2026-08-26)


### Features

* Add brand voice governance and OpenAI model support ([0e5c172](https://github.com/snowopsdev/datum/commit/0e5c172561ac8a3aeb81759a75ed12e7ead93e31))
* Add OpenAI provider and admin-configurable model choice ([c1fc4c6](https://github.com/snowopsdev/datum/commit/c1fc4c62d2cd9271852c955343216aaeae944a73))
* **cms:** add information-gain-runs collection and article scorecard summary ([95c6db8](https://github.com/snowopsdev/datum/commit/95c6db8a8e4ed75907aea6941110aaa1b93b9fb9))
* **cms:** add reviewer override and regenerate-from-gaps actions ([5a693a9](https://github.com/snowopsdev/datum/commit/5a693a95485e15787e39ee9b56160a15731e799d))
* **cms:** show the information-gain scorecard and reviewer actions ([779b87f](https://github.com/snowopsdev/datum/commit/779b87f133547dc6dfceb28f08ce83994d35cf2b))
* information-gain policy, evidence sources, review statuses, and shared scoring lib ([#42](https://github.com/snowopsdev/datum/issues/42)) ([c3275a9](https://github.com/snowopsdev/datum/commit/c3275a9142493cec907ca109d90bba6031df15c4))
* information-gain scoring stage, reviewer workflow, and scorecard ([cd729cb](https://github.com/snowopsdev/datum/commit/cd729cbd5ee63b56763e4d143fc4074df2742c78))
* **onboarding:** Add governed pipeline setup flow ([0efb7c9](https://github.com/snowopsdev/datum/commit/0efb7c95616c67e12f67587a500859e04b65460d))
* **onboarding:** Add governed pipeline setup flow ([0669e56](https://github.com/snowopsdev/datum/commit/0669e56493597955e346a0f2bf669d3a887e1813))
* **pipeline:** add information-gain prompts, judge batching, and mock fixtures ([363434a](https://github.com/snowopsdev/datum/commit/363434a65cc809051b4ace40e72d7455724fa6fb))
* **pipeline:** add the informationGain stage and its scorecard reporting ([9185817](https://github.com/snowopsdev/datum/commit/91858175f082e41bf0b8b3a8076d107c3b3d89d6))
* **pipeline:** corpus snapshots, page fetching, and gap-fed generation ([#44](https://github.com/snowopsdev/datum/issues/44)) ([61d18a7](https://github.com/snowopsdev/datum/commit/61d18a7aa0beae47cb1908fad1c6200cbdbacbae))


### Bug Fixes

* **cms:** build regeneration notes from the article's current run ([387802c](https://github.com/snowopsdev/datum/commit/387802ccccb89471eade9c700d7b23fae0590dda))
* **cms:** clear the information-gain summary when an article is sent back ([57f7a3b](https://github.com/snowopsdev/datum/commit/57f7a3bebdba5e5e8409c75cc7464ef16cb69568))
* **cms:** Escape backslashes before pipes in guide table cells ([7b62f10](https://github.com/snowopsdev/datum/commit/7b62f10bf408068a4bb05705fcbad701656d7397))
* **cms:** invalidate an information-gain decision when scored content changes ([7f255d3](https://github.com/snowopsdev/datum/commit/7f255d3eefe5ed5e2a440ee2dc5ba90448a6f5ee))
* **cms:** make verified reachable only through scoring or a reviewed override ([03c8980](https://github.com/snowopsdev/datum/commit/03c8980d29678b3c48a4be3956b9c1a739e90e5b))
* **cms:** persist the claim ids behind an information-gain decision ([3aafb9e](https://github.com/snowopsdev/datum/commit/3aafb9e13e62500a37677197cbab4a9e35b964da))
* **onboarding:** make pipeline setup upgrade-safe ([67190bf](https://github.com/snowopsdev/datum/commit/67190bff673ee4ab9516b87205c6e3fb008a5d86))
* **pipeline:** drop resolved articles from the report's review queue ([cdda0ed](https://github.com/snowopsdev/datum/commit/cdda0ed955be609cbb8359b37386384a20bc8962))
* **pipeline:** Only load models/brand voice for run, not fetch/report ([d26d941](https://github.com/snowopsdev/datum/commit/d26d94130c7e7d4a0bcee16645c432558818aa79))
* **pipeline:** quote full support for verbatim evidence in the mock fixtures ([1e9caeb](https://github.com/snowopsdev/datum/commit/1e9caeb13f6e31b3d50a664e78fc963a9b93f3aa))
* **pipeline:** Rename provider env-var lookup to dodge clear-text-log alert ([04372e9](https://github.com/snowopsdev/datum/commit/04372e92e1185bbd7053a9500e3840cff5a1bc2d))

## 0.1.0 (2026-08-25)


### Features

* **cms:** Add article audit trail and organize admin UI ([d1ff105](https://github.com/snowopsdev/datum/commit/d1ff105d95d35c1d6356eceb03743a391b865860))
* **cms:** Add article audit trail and organize admin UI ([7cdaf38](https://github.com/snowopsdev/datum/commit/7cdaf38bd6c0e21cd06a098dbb7844e585dc3969))
* **cms:** Add public reader SEO metadata ([ec869bf](https://github.com/snowopsdev/datum/commit/ec869bfbdd08b60abac032a0b5dc69bb5926c9cb))
* Extra Ops board, templates config, reports, public reader ([#16](https://github.com/snowopsdev/datum/issues/16)) ([433c884](https://github.com/snowopsdev/datum/commit/433c884618146025ebcd5b2838e294137a382d53))


### Bug Fixes

* **cms:** Avoid localhost canonicals without SITE_URL ([1aaf239](https://github.com/snowopsdev/datum/commit/1aaf239604de300ffcbda7e5e2899690a92e55d8))
* **cms:** Bound article audit history ([11181a6](https://github.com/snowopsdev/datum/commit/11181a6bb6995f69e50a1d0aabda1b463c002bc2))
* **cms:** Omit unchanged audit transitions ([4b47b6b](https://github.com/snowopsdev/datum/commit/4b47b6baf429f12d1905d9bbee583c451025c2ca))
* **cms:** Protect audit evidence and timestamps ([0576d9a](https://github.com/snowopsdev/datum/commit/0576d9a3014626e83bf306f1a6ca06274a641f69))
* **release:** sync lockfile version and require ! for breaking changes ([ec7de03](https://github.com/snowopsdev/datum/commit/ec7de03c566119b555306f91bf108bcba73ec782))
