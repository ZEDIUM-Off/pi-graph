# Release checklist

## v0.2.0

Before tagging `v0.2.0`:

1. Review the diff and decide whether to split commits by feature area:
   - run artifacts;
   - command routing;
   - system reporting;
   - store node;
   - docs/release.
2. Run verification:

   ```bash
   npm run typecheck
   npm test
   ```

3. Confirm expected result:

   ```txt
   49 passing tests
   ```

4. Inspect docs:
   - `README.md`
   - `CHANGELOG.md`
   - `docs/release-v0.2.0.md`
   - `docs/run-artifacts.md`
   - `docs/command-routing.md`
   - `docs/system-reporting.md`
   - `docs/store-node.md`

5. Dogfood locally from `/home/zedium/workspaces`:

   ```js
   graph({ action: "list" })
   graph({ action: "validate", name: "workspace-hub", scope: "project" })
   graph({ action: "run", name: "focus", scope: "project", saveRun: true })
   graph({ action: "list-runs" })
   ```

6. Known limitation to mention in release notes:
   - durable artifacts exist;
   - durable resume after process restart is not implemented yet.

7. Tag:

   ```bash
   git tag v0.2.0
   ```
