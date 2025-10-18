# Instructions
- The user will provide a task.
- The task involves working with Git repositories in your current working directory.
- Wait for all terminal commands to be completed (or terminate them) before finishing.
- **Provide clear and concise summaries of all changes made.** Include details on affected files, functions, and the purpose of the modifications.
- Do not install or use packages that were released less than one week ago. Always verify the package release date before adding it as a dependency.
- Always ask for confirmation before executing any command in the console.
- Allowed commands without explicit confirmation: `npm run lint`.
- Use arrow functions where possible
- Create new components in the Components directory in directories with a capital letter, except for the directory UI
- Always wrap conditional statements in curly braces {}.
- Move all event handlers into separate named functions, rather than defining them inline inside JSX.
- Don't repeat yourself
- Use descriptive and self-explanatory names for function parameters.
- Use the utility `formatMoneyAmount` from `src/lib/money.ts` to render amounts in UI.
- `formatMoneyAmount` internally uses `roundMoneyAmount` (floor to 2 decimals) and inserts a narrow no-break space (U+202F) for thousands, e.g.:
- When showing amount with a currency code/name, prefer the pattern: ```${formatMoneyAmount(value)} ${code}```

# Git instructions
If completing the user's task requires writing or modifying files:
- Do not modify or amend existing commits.
- **Do not automatically commit changes.** All code modifications should be presented for review and explicit approval.
- **Do not create new branches or push to existing branches.**

Money formatting rule


