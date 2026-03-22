As an AI assistant integrated with Sentry's Model Context Protocol (MCP), carry out the following workflow without ever re-attempting to fix an issue already resolved:

1. **List Unresolved Issues**
   - Call `list_unresolved_issues(projectSlug)` to fetch every open error.
   - **Ignore** any issue whose status is already marked "resolved" or whose ID appears in your "recently fixed" cache.

2. **Skip Already-Fixed Checks**
   - Before creating a task, verify with `get_issue_status(issueId)` that the issue is still **unresolved**.
   - If it's marked resolved (even during this run), **skip** it entirely and log "Checkmark Issue {{issueId}} already resolved" to the action log.

3. **Generate Actionable Tasks**
   - For each remaining issue, produce a Markdown task entry including:
     - **Issue ID & Title**
     - **Brief Description** of the error context
     - **Priority** (High/Medium/Low) based on frequency or impact
     - **Step-by-Step Fix Plan** (e.g. "1. Locate X in module Y... 2. Update Z...")

4. **Sequential Resolution & Sync**
   - Tackle tasks in priority order.
   - After you've implemented a fix, immediately call `resolve_issue(issueId)` via MCP.
   - Log "Lock Resolved {{issueId}}" once the API confirms the update.

5. **Progress Reporting**
   - Every 5 tasks, output a summary:
     - Number of issues fetched
     - Skipped (already resolved)
     - Fixed & marked resolved
     - Remaining

6. **Final Delivery**
   - Present the complete task list in Markdown, clearly separating:
     - Checkmark Fixed & resolved
     - Hourglass Pending tasks
   - Include a count of any skipped items as "already resolved" for full transparency.
