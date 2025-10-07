# GitHub Workflow Guide for Small Team Projects

## Branching Strategy

- **Main branch (`main`) is the primary branch.**
- For every change:
  - Create a new feature branch from `main` **before** making changes.
  - Alternatively, make changes locally, then create a branch **before** staging (`git add`) and committing.

## Workflow Steps

1. **Create a Feature Branch**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```
2. **Make Changes**

   - Edit files as needed.

3. **Stage and Commit**

   ```bash
   git add .
   git commit -m "Describe your changes"
   ```

4. **Sync with Main**

   - Pull the latest changes from `main`:
     ```bash
     git checkout main
     git pull origin main
     git checkout feature/your-feature-name
     git merge main
     ```
   - **Resolve any conflicts locally.**
   - Commit resolved conflicts if necessary.

5. **Push Feature Branch**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**

   - Go to GitHub and open a pull request from your feature branch to `main`.

7. **Code Review & Merge**

   - Wait for the team leader to review and merge the pull request into `main`.

8. **Clean Up (Optional)**
   - After merging, delete the stale feature branch:
     - On GitHub: Use the "Delete branch" button.
     - Locally:
       ```bash
       git branch -d feature/your-feature-name
       git push origin --delete feature/your-feature-name
       ```

## Tips

- Always keep your feature branch up-to-date with `main` before merging.
- Communicate with your team about ongoing work to avoid conflicts.
- Use descriptive branch names and commit messages.
