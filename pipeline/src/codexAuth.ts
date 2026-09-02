// Shared with the CMS so both workspaces resolve the Codex login identically.
export {
  checkCodexLogin,
  CODEX_LOGIN_HINT,
  codexAuthFilePresent,
  codexHome,
  ensureManagedCodexHome,
} from '../../cms/src/lib/codexAuth'
