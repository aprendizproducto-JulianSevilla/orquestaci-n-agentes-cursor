import { defaultGitHubAuth, githubChannel } from "@grok/agent-sdk/channels/github";

export default githubChannel({
  botName: "calidad-software",
  cursorAccount: true,
  onPullRequest: (ctx, pr) => {
    if (pr.draft) {
      return null;
    }
    if (pr.action !== "opened" && pr.action !== "ready_for_review") {
      return null;
    }
    return { auth: defaultGitHubAuth(ctx) };
  },
});
