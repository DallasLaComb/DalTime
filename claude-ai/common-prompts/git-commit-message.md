Create a reusable prompt template for generating high-quality Git commit messages.

The prompt should be designed to work in a coding assistant environment where the tool can run shell commands.

Requirements:

1. The prompt must automatically run:
   git diff --staged
   If nothing is staged, fall back to:
   git diff

2. The prompt should analyze the diff and produce a clear, high-quality commit message.

3. The commit message must follow best practices:
   - Use Conventional Commits format
   - Format:
       <type>: <short summary>

       <detailed explanation>

   - Types allowed:
       feat, fix, refactor, docs, test, chore, perf, build, ci

4. The short summary must:
   - be <= 72 characters
   - be written in imperative mood
   - clearly describe the change

5. The body should:
   - explain WHY the change was made
   - summarize key modifications
   - mention breaking changes if applicable

6. The output should ONLY be the commit message text, with no explanations.

7. The template should be reusable so it can be saved as something like:
   /generate-commit-message

8. If the diff contains multiple logical changes, summarize them clearly in the body.

9. If there are no changes in the diff, return:
   "No changes to commit."

Output the final reusable prompt template only.