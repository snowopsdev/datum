# Changelog

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
