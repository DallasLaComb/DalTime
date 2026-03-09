Run the following steps to generate a Git commit message:

1. Run `git diff --staged` to get the staged changes. If the output is empty, fall back to `git diff`.

2. If both diffs are empty, respond with exactly: "No changes to commit."

3. Otherwise, analyze the diff and produce a commit message using Conventional Commits format:

```
<type>: <short summary>

<detailed explanation>
```

Allowed types: feat, fix, refactor, docs, test, chore, perf, build, ci

Rules for the short summary:
- Must be <= 72 characters
- Use imperative mood (e.g., "add", "fix", "remove", not "added", "fixes", "removed")
- Clearly describe the change

Rules for the body:
- Explain WHY the change was made
- Summarize key modifications
- Mention breaking changes if applicable (prefix with "BREAKING CHANGE:")
- If the diff contains multiple logical changes, summarize each clearly

4. Output ONLY the commit message text. No explanations, no markdown fences, no commentary.
.
