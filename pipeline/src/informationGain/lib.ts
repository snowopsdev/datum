// One import site for pipeline stage code: the information-gain types, policy,
// and scoring live in the CMS lib so the admin UI and the pipeline read the
// same thresholds and produce the same decisions.
export * from '../../../cms/src/lib/informationGain'
