# Changelog

## [0.10.0](https://github.com/snowopsdev/datum/compare/v0.9.0...v0.10.0) (2026-11-10)


### Features

* **cms:** archived pieces leave the public site; publish and revisit ask first ([86bfeec](https://github.com/snowopsdev/datum/commit/86bfeec012bf6d6cc1c5d525cc4b70cf983e7149))
* **cms:** render and convert lists, emphasis, quotes and links in article bodies ([39583fd](https://github.com/snowopsdev/datum/commit/39583fd41d7514b3083fdc322e6045d1adf97669))
* **cms:** style lists, links, quotes and code in the reader page ([3400947](https://github.com/snowopsdev/datum/commit/34009473f484fc5f3273d07658cc902332e26aae))
* **pipeline:** gate `pipeline run` on setup and register it as a locked run ([0b8473f](https://github.com/snowopsdev/datum/commit/0b8473f5d3c6f10fe31be3a035fe66e9df91f28c))


### Bug Fixes

* **ci:** seed without dev push, guard every E2E run, wait for hydration ([6be4b8a](https://github.com/snowopsdev/datum/commit/6be4b8aa24b11ad4c2b07133ec07a07fe73421ca))
* **cms:** accept a banned-word suggestion only when the voice save lands ([fc13264](https://github.com/snowopsdev/datum/commit/fc1326422d85a2a1c58d3b51c486962fa10af9c2))
* **cms:** accept raster images only in the media collection ([842dc48](https://github.com/snowopsdev/datum/commit/842dc48d5092436d7fe88c778b632a5cc6260dd7))
* **cms:** bound the emphasis scan and keep plain text free of markdown ([8e01185](https://github.com/snowopsdev/datum/commit/8e011850b7b2f5fd84aacf6f114d78a60d2edebf))
* **cms:** cap positioning core claims at three in the schema ([1441692](https://github.com/snowopsdev/datum/commit/144169255851d51ac45ba2af89c89c174470fa50))
* **cms:** clear stale publishAt on already-published articles ([ade854a](https://github.com/snowopsdev/datum/commit/ade854ae742581bc52a5545dd1dcacf6684a64b8))
* **cms:** correct the Claude Sonnet 5 catalog price to $2/$10 ([4d1d17a](https://github.com/snowopsdev/datum/commit/4d1d17add6a6d18915864b33d979bbaa0ff048e2))
* **cms:** default extraction and setup assist to the generate model ([b784068](https://github.com/snowopsdev/datum/commit/b784068c463b0e5929b508ebbc7fb419d9114e6e))
* **cms:** drop the retired board wording from topic discovery ([1420b6c](https://github.com/snowopsdev/datum/commit/1420b6c448aa2f41295b3f9012a80d6300fb681d))
* **cms:** fail a content run that errors before its worker claims it ([07f0bec](https://github.com/snowopsdev/datum/commit/07f0bec99439f85845854bce32336f5672707dca))
* **cms:** keep adjacent bold and italic readable when a template is saved again ([37099c7](https://github.com/snowopsdev/datum/commit/37099c7c0d3f7ced97be9f9c80904518b00af06e))
* **cms:** keep de-duplicated article slugs clear of existing ones ([966042c](https://github.com/snowopsdev/datum/commit/966042c5315a0f4047821003d8a6c57fe753b289))
* **cms:** keep the editor's version after a refused activation ([4d31dde](https://github.com/snowopsdev/datum/commit/4d31dde2aa97c5d1245434c1701e0b53c7444699))
* **cms:** keep the running run on the bar when another queues behind it ([4d04482](https://github.com/snowopsdev/datum/commit/4d044828b5852f79a672ad4051e0bf8c64248c90))
* **cms:** log unexpected action failures and compare brief versions exactly ([69606c4](https://github.com/snowopsdev/datum/commit/69606c408abc9179bbe239dc7aaf89df4d9d3aa4))
* **cms:** normalise article slugs and make them unique ([0c0459b](https://github.com/snowopsdev/datum/commit/0c0459b9e3b34912d8e78dec769c73048ce8123e))
* **cms:** recover content runs whose worker died ([2c55d30](https://github.com/snowopsdev/datum/commit/2c55d3005f142ad0f24235641687e5714d5c530c))
* **cms:** release a stuck job only when recovery's own run transition won ([49ee574](https://github.com/snowopsdev/datum/commit/49ee574a099f0d0d805d0044962f54f7823ab9a6))
* **cms:** reports show the evidence check and label checks and stages readably ([432f4ce](https://github.com/snowopsdev/datum/commit/432f4cea2b055a0db8bbc2a95d814960de73ebed))
* **cms:** return reviewer-action refusals as values so production shows them ([89646b4](https://github.com/snowopsdev/datum/commit/89646b4eed79c4879c8569e75de1fd2ecb3ed81f))
* **cms:** run bar follows the executing run, totals from SQL, banner waits for sign-in ([481cf80](https://github.com/snowopsdev/datum/commit/481cf80085960a65e5eb02f7da309a20deec3911))
* **cms:** say why a run lost its lease ([80bcec0](https://github.com/snowopsdev/datum/commit/80bcec0de1df1c78e41fcea7ff7de9fd884e5424))
* **cms:** setup editors surface save failures, refuse stale saves and page the source queue ([ef98d2e](https://github.com/snowopsdev/datum/commit/ef98d2e5fec00caa1d56c9733ce7c6b88cc0a885))
* **ig:** clamp suggestClass to secondary at most ([8957f8b](https://github.com/snowopsdev/datum/commit/8957f8b9dd631c93943b6d5f7adcca83e2cd3a5f))
* **ig:** exempt evidence-bank-backed first-party claims from the block ([bfd2078](https://github.com/snowopsdev/datum/commit/bfd2078e7a3881124af1f0e7fb244d0e8cf1828f))
* **ig:** read range bounds with the range kind and compound word numbers as one amount ([17a5fc9](https://github.com/snowopsdev/datum/commit/17a5fc99b775789a33683e1dfe5d751ca615830e))
* **ig:** refuse a judge entry with no numeric internalDuplicateProbability ([e0bca8a](https://github.com/snowopsdev/datum/commit/e0bca8a3b8d8e65c9983d84ee7e31de875883a2c))
* one tolerant mock/live rule that never throws at import ([842191b](https://github.com/snowopsdev/datum/commit/842191b23941e1c217aebb57ebe11bbb5e93c6cd))
* **pipeline:** commit article writes only while the run owns its row ([8fef0e8](https://github.com/snowopsdev/datum/commit/8fef0e8669efdee8fe10ee17f390052d6e62c0c1))
* **pipeline:** create discovered topics under the run fence ([bf41bd0](https://github.com/snowopsdev/datum/commit/bf41bd04097da0c8c3e573768082b2fb23306590))
* **pipeline:** leave a cost row for billed failures and name truncation and refusal ([ab50dfa](https://github.com/snowopsdev/datum/commit/ab50dfa354a6778b7dec31c168ae341799e22ae3))
* **pipeline:** name an OpenAI refusal instead of reporting no text ([cde431f](https://github.com/snowopsdev/datum/commit/cde431f886c4d35dcff6daaa79878b49db18c7ae))
* **pipeline:** pass the evidence bank when reading citation markers ([95e302f](https://github.com/snowopsdev/datum/commit/95e302f2e8def50798cfca9f7d2e053a40336bce))
* **pipeline:** report counts the evidence check and applies QA's qualitative rule ([17e2e98](https://github.com/snowopsdev/datum/commit/17e2e989cea7d1c7c9e55bc62065219257e6e77b))
* **pipeline:** stop an unreadable SERP before paying for corpus extraction ([8ca5d8a](https://github.com/snowopsdev/datum/commit/8ca5d8a9e03a5a9311e575c42f514b1cee45e1c4))
* **pipeline:** store citation excerpts as plain text ([2e8d3c0](https://github.com/snowopsdev/datum/commit/2e8d3c0e4fbf75324bc1a9918ef7c8c2c2c79185))
* project audit fixes for crawling, review gates, workers and scoring ([4175f09](https://github.com/snowopsdev/datum/commit/4175f0997ab7226a13bfbc7701d1fd527c472b19))
* recover runs from a dead worker, fence every run write, and keep a cost row for every paid call ([#165](https://github.com/snowopsdev/datum/issues/165)) ([6fa3330](https://github.com/snowopsdev/datum/commit/6fa333077a8f81cdc608aae7b22d9084b6736b8e))
* render lists, bold and links in articles, and stop blocking bank-verified claims ([#163](https://github.com/snowopsdev/datum/issues/163)) ([9885af7](https://github.com/snowopsdev/datum/commit/9885af7e6efd6b1b5b500f7470b5793a8ac12946))
* repair Node 22 crawling, close the unreviewed-publish path, stop workers pushing schema ([#160](https://github.com/snowopsdev/datum/issues/160)) ([6c89501](https://github.com/snowopsdev/datum/commit/6c895012bde3574bed8bc477b5f32f2090008c34))
* show reviewers why an action was refused and stop setup editors overwriting each other ([#164](https://github.com/snowopsdev/datum/issues/164)) ([cdfac3e](https://github.com/snowopsdev/datum/commit/cdfac3e3c5042f07ee841866a344837a9b8678ab))
* **tenant:** read [F&lt;n&gt;]/[R&lt;n&gt;] as evidence refs only when the bank has them ([e5bc5af](https://github.com/snowopsdev/datum/commit/e5bc5af06568ef25f9a68e3ad8c8c159dab4a59f))
* workspace saves check the loaded version; leave dialog waits for save-and-activate; report skips archived ([c34e6ec](https://github.com/snowopsdev/datum/commit/c34e6ec8db5d932141b1bcd34142b55bc6ca2604))


### Performance Improvements

* **cms:** count site pages in SQL for the setup hub ([a5ef934](https://github.com/snowopsdev/datum/commit/a5ef93417b04e66b476bfee38625a73a1233534a))
* **cms:** keep only the status of the newest run in the setup data ([a41817e](https://github.com/snowopsdev/datum/commit/a41817e98798fc633bc07613f279730376a792af))
* **cms:** select only the compared fields when scanning published articles ([621b922](https://github.com/snowopsdev/datum/commit/621b922243e6c3bdabcdad8c32f4927f70a25485))

## [0.9.0](https://github.com/snowopsdev/datum/compare/v0.8.0...v0.9.0) (2026-11-10)


### Features

* **public:** add article structured data, dateline and editor bar ([#155](https://github.com/snowopsdev/datum/issues/155)) ([7a15a5f](https://github.com/snowopsdev/datum/commit/7a15a5f3950b65b9a723117d96c0401c1972642f))
* **ui:** AA colour tokens, one focus ring and a skip link ([7cedcdd](https://github.com/snowopsdev/datum/commit/7cedcdddd2368fe2ad9ef25c9c3c2924bd698cd2))
* **ui:** AA colour tokens, one focus ring and a skip link ([bbcf610](https://github.com/snowopsdev/datum/commit/bbcf6100a68bd345136aaf7ab83b2a182f789e82))
* **ui:** guard unsaved edits on the setup and template editors ([#159](https://github.com/snowopsdev/datum/issues/159)) ([3dbba7b](https://github.com/snowopsdev/datum/commit/3dbba7bba72d07b61cb39e07eb95f6ae24a43dfd))
* **ui:** motion tokens and a single feedback model for the review page ([#158](https://github.com/snowopsdev/datum/issues/158)) ([4f94e3a](https://github.com/snowopsdev/datum/commit/4f94e3aa980ec30c0f691699767105d145a4a05c))


### Bug Fixes

* **evidence,setup:** honest evidence save state, dedupe proposals, one workspace readiness rule ([#154](https://github.com/snowopsdev/datum/issues/154)) ([8607d7f](https://github.com/snowopsdev/datum/commit/8607d7fde878a00b56f2b8631facef381a0ba08a))
* **nav,brief,brand-voice:** remove duplicate governance group, style angle choices, correct archive copy ([#152](https://github.com/snowopsdev/datum/issues/152)) ([317b2e3](https://github.com/snowopsdev/datum/commit/317b2e3d9b6d55a2273085a6b9074cde5b5e62d9))
* **review:** show unrun QA checks as Not run and correct event and create labels ([#153](https://github.com/snowopsdev/datum/issues/153)) ([58682f3](https://github.com/snowopsdev/datum/commit/58682f36a4967cf399b8d01b6f01dc5da16c7c4e))
* **runs:** wake the run bar on queue actions and keep failures visible ([#151](https://github.com/snowopsdev/datum/issues/151)) ([e5d04c5](https://github.com/snowopsdev/datum/commit/e5d04c5bed53d700bc408412dd5f0431a9337019))
* **ui:** draw the focus ring as an outline and cover the secret field ([57f78d0](https://github.com/snowopsdev/datum/commit/57f78d087a6f32a1c18414e71f77dcac6c29f548))

## [0.8.0](https://github.com/snowopsdev/datum/compare/v0.7.0...v0.8.0) (2026-10-10)


### Features

* **brief:** propose audience-grounded angles during research ([#142](https://github.com/snowopsdev/datum/issues/142)) ([7ade888](https://github.com/snowopsdev/datum/commit/7ade88842792a1ebc3379a6e948f3855c7f496d5))
* **discovery:** rank suggested topics by audience fit ([#143](https://github.com/snowopsdev/datum/issues/143)) ([3ac904f](https://github.com/snowopsdev/datum/commit/3ac904f22b54e00e4690f3f25681fd374ec923c6))
* **governance:** suggest setup changes from recurring review corrections ([#144](https://github.com/snowopsdev/datum/issues/144)) ([f0850d3](https://github.com/snowopsdev/datum/commit/f0850d34f2561edcd33ce244fcac6940ded94007))
* **tenant:** control company mentions and carry brief direction into review ([#139](https://github.com/snowopsdev/datum/issues/139)) ([35aeb97](https://github.com/snowopsdev/datum/commit/35aeb972839c404098422e985ceb026029df967b))


### Bug Fixes

* **tenant:** address review findings across brief angles, discovery, and suggestions ([#145](https://github.com/snowopsdev/datum/issues/145)) ([226b4e3](https://github.com/snowopsdev/datum/commit/226b4e3caf263a3174ec876eb2f185aef876c215))
* **tenant:** separate "Not our user" and churn triggers ([#140](https://github.com/snowopsdev/datum/issues/140)) ([5905ae6](https://github.com/snowopsdev/datum/commit/5905ae621ae067da8902259aeabec1c9caa05348))


### Performance Improvements

* cut admin and pipeline query load; fix audit and job-queue bugs ([#122](https://github.com/snowopsdev/datum/issues/122)) ([211267c](https://github.com/snowopsdev/datum/commit/211267cba6b983104343a5dfe6357c9233bc74ca))

## [0.7.0](https://github.com/snowopsdev/datum/compare/v0.6.4...v0.7.0) (2026-09-14)


### Features

* **cms:** polish the operator journey, consolidate surfaces, remove legacy code ([#110](https://github.com/snowopsdev/datum/issues/110)) ([7bb204f](https://github.com/snowopsdev/datum/commit/7bb204fdddfed797b2b7985fd1da1e07f24f3b3a))

## [0.6.4](https://github.com/snowopsdev/datum/compare/v0.6.3...v0.6.4) (2026-09-11)


### Bug Fixes

* Improve ops workspace guidance and review layouts ([#98](https://github.com/snowopsdev/datum/issues/98)) ([8e97da5](https://github.com/snowopsdev/datum/commit/8e97da5cbe5f6fd09f6d083784e4dd784e3d9ce6))

## [0.6.3](https://github.com/snowopsdev/datum/compare/v0.6.2...v0.6.3) (2026-09-05)


### Bug Fixes

* **cms:** aggregate report costs in Postgres ([#93](https://github.com/snowopsdev/datum/issues/93)) ([27d6923](https://github.com/snowopsdev/datum/commit/27d692363673b855389d6a3821a9f9a60267e2f3))
* **cms:** queue concurrent selected content runs reliably ([#89](https://github.com/snowopsdev/datum/issues/89)) ([aba9d4f](https://github.com/snowopsdev/datum/commit/aba9d4f64191e11e04725c66af173ff53f92e67b))
* **cms:** refresh articles when short runs finish between polls ([#90](https://github.com/snowopsdev/datum/issues/90)) ([b68a0fd](https://github.com/snowopsdev/datum/commit/b68a0fd073865e4470fc5a9649948b6cf88b818f))
* **cms:** restore GraphQL with valid policy enum options ([#96](https://github.com/snowopsdev/datum/issues/96)) ([d57f27c](https://github.com/snowopsdev/datum/commit/d57f27c4c57e27317b0d06cd8646d3a084b9665e))
* **cms:** support keyboard selection of content templates ([#91](https://github.com/snowopsdev/datum/issues/91)) ([bda8404](https://github.com/snowopsdev/datum/commit/bda840481703b8855d3c782f5cd2e55f8dd454d4))
* **cms:** validate signed cache invalidation requests ([#95](https://github.com/snowopsdev/datum/issues/95)) ([94b0a8c](https://github.com/snowopsdev/datum/commit/94b0a8c13e18d3a1ff656b3905736473941ee920))
* **pipeline:** report progress only after article writes succeed ([#87](https://github.com/snowopsdev/datum/issues/87)) ([f07b44c](https://github.com/snowopsdev/datum/commit/f07b44c640f10014d4ef1b119822f5e685fed879))
* **pipeline:** report saved results without research setup ([#88](https://github.com/snowopsdev/datum/issues/88)) ([bf30442](https://github.com/snowopsdev/datum/commit/bf304424f52827d270339e431a03725151752e7d))

## [0.6.2](https://github.com/snowopsdev/datum/compare/v0.6.1...v0.6.2) (2026-09-04)


### Performance Improvements

* **cms:** speed up content lists and reduce admin data loading ([#85](https://github.com/snowopsdev/datum/issues/85)) ([6e9cc1c](https://github.com/snowopsdev/datum/commit/6e9cc1c7e73b34804b4d769baf47188e4c8b5498))

## [0.6.1](https://github.com/snowopsdev/datum/compare/v0.6.0...v0.6.1) (2026-09-04)


### Bug Fixes

* **cms:** Validate models before content discovery ([715bbf8](https://github.com/snowopsdev/datum/commit/715bbf878037f1e48c029e535e565febe66c632a))
* **security:** Disable live local Codex execution ([f15f5a2](https://github.com/snowopsdev/datum/commit/f15f5a2e50ef70a217de2c1bfa18b0b63cec3e40))
* **security:** Disable live local Codex execution ([f9fb74b](https://github.com/snowopsdev/datum/commit/f9fb74b0ea5ac7d69151b112d602716f7bc52afb))

## [0.6.0](https://github.com/snowopsdev/datum/compare/v0.5.0...v0.6.0) (2026-09-03)


### Features

* **onboarding:** add tenant context assets and AI-assisted setup ([42b7c20](https://github.com/snowopsdev/datum/commit/42b7c20388074d74ba1e7c461e91d960604efdd5))
* **onboarding:** add tenant context assets and AI-assisted setup ([e3275f3](https://github.com/snowopsdev/datum/commit/e3275f316fa7a9bc6389b810000cef10fdf555c3))


### Bug Fixes

* **evidence:** harden evidence bank, site crawl, and demo fill after review ([e489593](https://github.com/snowopsdev/datum/commit/e489593dbdcd0daed6ba4e19dfa1555b09d5ebdf))

## [0.5.0](https://github.com/snowopsdev/datum/compare/v0.4.0...v0.5.0) (2026-09-03)


### Features

* **cms:** add a Game Preview template ([7d25dac](https://github.com/snowopsdev/datum/commit/7d25dac4de13e9e14176b4833dfc4a3b49775ba1))
* **llm:** run pipeline stages on a ChatGPT plan via the Codex CLI ([#67](https://github.com/snowopsdev/datum/issues/67)) ([62090b8](https://github.com/snowopsdev/datum/commit/62090b88be2402f208941e9ff05e113aa8b26e80))
* **pipeline:** carry the template example into the generate prompt ([54fef48](https://github.com/snowopsdev/datum/commit/54fef486666040c42cfa8cfa280aaa6af39c2ce7))
* **templates:** add Game Preview and carry the example into the generate prompt ([72ca7b4](https://github.com/snowopsdev/datum/commit/72ca7b40961fea03376553b3da6f440f71bcf859))


### Bug Fixes

* **templates:** order the Game Preview example like its outline ([faa96a9](https://github.com/snowopsdev/datum/commit/faa96a922277e2709147e3d903cc1b0ac0b2472d))

## [0.4.0](https://github.com/snowopsdev/datum/compare/v0.3.0...v0.4.0) (2026-08-31)


### Features

* **ops:** webhooks, scheduled publishing, caching, and a shared status table ([#63](https://github.com/snowopsdev/datum/issues/63)) ([98db434](https://github.com/snowopsdev/datum/commit/98db434a136e1578eb8aa35e3067e61eca01883b))

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
