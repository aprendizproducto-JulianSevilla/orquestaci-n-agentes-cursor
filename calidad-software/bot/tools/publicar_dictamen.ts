import { parseGitHubPrContinuationKey } from "@grok/agent-sdk/channels/github";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

export default defineTool({
  description:
    "Publica el dictamen en el pull request de esta sesión. Llámalo una sola vez, y solo en una sesión de pull request. pass aprueba. pass_with_risks y fail piden cambios.",
  effect: "write",
  dryRunResult: ({ verdict }) => ({ posted: false, reason: "dry_run", verdict }),
  inputSchema: z.object({
    verdict: z.enum(["pass", "pass_with_risks", "fail"]),
    summary: z.string().min(1),
  }),
  async execute({ verdict, summary }, ctx) {
    if (ctx.session.purpose === "eval") {
      return { posted: false, reason: "eval", verdict };
    }
    const ref = parseGitHubPrContinuationKey(ctx.session.continuationKey ?? "");
    if (ref === undefined) {
      return { posted: false, reason: "no_pull_request", verdict };
    }
    const event = verdict === "pass" ? "APPROVE" : "REQUEST_CHANGES";
    const octokit = await ctx.host.github.getOctokit(
      ref.host === undefined ? undefined : { host: ref.host },
    );
    await octokit.rest.pulls.createReview({
      owner: ref.owner,
      repo: ref.repo,
      pull_number: ref.number,
      event,
      body: summary,
    });
    return {
      posted: true,
      verdict,
      event,
      pr: `${ref.owner}/${ref.repo}#${ref.number}`,
    };
  },
});
