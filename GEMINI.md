# Project Instructions & Rules

## 1. 🚀 Automatic Production Deployment
- **Always Auto-Deploy**: Whenever any bug fix, feature, or code modification is completed, automatically commit all changes and push to `origin main`.
- Pushing to `origin main` automatically triggers Vercel CI/CD to build and deploy to Production (`https://tracking-stock.vercel.app`).
- Never leave finished changes unpushed or wait for the user to ask to deploy to production.

## 2. 💾 Persistent Context & Engineering Log (PROJECT_LOG.md)
- **Mandatory Log Maintenance**: The file `PROJECT_LOG.md` at the project root contains the full architecture, schema, LINE bot commands, and incident history.
- **Read First**: In any new conversation, check and read `PROJECT_LOG.md` to immediately restore 100% system context.
- **Update on Changes**: Whenever a new bug is resolved, a feature is added, or an architecture decision is made, update `PROJECT_LOG.md` with the details and changelog before committing.
