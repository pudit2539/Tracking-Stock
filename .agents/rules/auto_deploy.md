# Auto Deploy Policy

Whenever any code changes, bug fixes, or enhancements are completed in this repository:
1. Ensure all tests and verifications pass.
2. Automatically stage modified and new code files (`git add ...`).
3. Commit with a clear, descriptive message (`git commit -m "..."`).
4. Push to `origin main` (`git push origin main`).
5. This automatically triggers Vercel to rebuild and deploy to Production immediately.
6. Verify deployment and inform the user that changes are live on Production.
