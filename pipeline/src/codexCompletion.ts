// Shared with the CMS so both workspaces reject live local Codex execution.
export {
  CodexLocalExecutionDisabledError,
  CodexNotLoggedInError,
  type CodexTextRequest,
  type CodexTextResult,
  completeTextViaCodex,
} from '../../cms/src/lib/codexCompletion'
