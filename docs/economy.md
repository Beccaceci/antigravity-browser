# Browser output economy

## Default settings

Compact mode is enabled automatically. The launcher uses upstream `--snapshot-mode none`, `--codegen none`, and `--image-responses only`. Actions therefore omit automatic snapshots and generated Playwright code. Explicit page snapshots, targeted finds, errors, modal state, screenshots, and all existing browser actions remain available.

Gemini instructions prefer `browser_find` and targeted/shallow snapshots, reuse current observations, batch known form fields, verify significant outcomes, and reserve screenshots for visual tasks. CSS-scale viewport images avoid unnecessary dimensions; compressed file size is not itself a vision-token measurement.

## Large-result protection

The MCP bridge bounds combined text exceeding 8,192 Unicode code points. It retains the first 4,096 and last 1,024 code points plus an explicit omission notice. Complete original text is saved privately under the artifacts directory. `browser_read_output` accepts an opaque saved-output ID, a code-point offset, and a limit of 1–6,000; it returns the requested range and next offset. Prefer a focused live-page find to paging through a large saved snapshot. References from saved results may be stale.

Images retain their original content/order, and error status and result metadata are preserved. No extra language-model call summarizes output. If the recovery file cannot be saved, the complete result remains visible. The limit applies to textual tool results, not image tokens, model reasoning, conversation history, tool schemas, or structured data outside those text blocks. Saved text may contain private webpage content; it remains local and should be deleted with other artifacts when no longer needed.

`--output-mode full` restores upstream verbose output and disables text bounding for diagnostics. Default installations need no configuration changes. To test verbose mode without altering Antigravity, run:

```sh
node dist/cli.js serve --output-mode full --data-dir /tmp/antigravity-browser-debug
```

## Evidence from DeepSeek Harness

Inspected source commit `687f282e8625c6b8d11ff58211a90524be2e4317`, fetched from the user-supplied repository. No DeepSeek code or dependency is vendored.

- [Tool-result pruner](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/compaction/compaction-tool-result-pruner/src/config.ts): Unicode-aware deterministic head/tail budgets. Its README explicitly distinguishes character budgets from measured token use.
- [Spill policy](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/spill/spill-policy/README.md): retain a preview, store the full result, give retrieval guidance, and preserve original output on recovery failure.

Our bridge applies these design ideas to newly emitted MCP results. It does not modify Antigravity's existing conversation history, provider cache, or compaction behavior. It preserves images rather than estimating Gemini vision costs with DeepSeek pricing.

## Measured comparison

`npm run test:economy` uses a local page with 250 irrelevant catalog paragraphs and a form. All variants fill and save the same form and verify the same result.

| Workflow | Text response characters | Action-response characters |
| --- | ---: | ---: |
| Original verbose output + full snapshots | 50,382 | 719 |
| Compact output + bounded full snapshots | 10,833 | 85 |
| Compact output + focused finds | 818 | 85 |

This is approximately 78.5% less text for bounded broad reads and 98.4% less for focused reads on this synthetic page. The measurement sums text characters for the task workflow; it excludes tool schemas, extra test assertions/recovery checks, images, prompts, reasoning, and generated final answers. It is not an exact tokenizer result, a billing measurement, or a promise about arbitrary websites. When pages are small, extra inspection requests can outweigh savings; reuse observations and ask only for needed content.

## Enable in Antigravity

The tool is already installed on this Mac. In Antigravity, open Customizations → Installed → MCP Servers. Find `antigravity-browser`, open its three-dot menu, and choose Restart after building an update. If disabled, choose Enable. This targeted restart reloads launcher changes without quitting the app. Expect 32 tools: 31 upstream browser tools plus saved-output recovery.

Start a fresh Gemini conversation and attach or paste `instructions/browser.md` once. Example:

> Use antigravity-browser in economical mode. Open [URL], find [control], and complete [task]. Prefer browser_find; avoid full snapshots and screenshots unless required. Report only the verified result.

No API key or additional plan is needed for this local bridge; Gemini remains subject to the user's Antigravity account limits. If missing, run `npm ci`, `npm run build`, and `npm run configure` in this project, then restart Antigravity to reload new server entries.
