# Repository Guidelines

## Target Technology Stack

Use the complete 105-item inventory in [TARGET_TECH_STACK.md](TARGET_TECH_STACK.md) as the project's target technology reference. Record actual choices and versions in the repository as implementation begins.

## Project Structure & Module Organization

This repository does not yet contain application source, tests, or assets. Keep implementation code under `src/`, tests under `tests/`, and static assets under `assets/`. Group files by feature or component. Update this guide when the actual layout differs.

## Build, Test, and Development Commands

No build system, package manifest, or test runner is configured yet. Add a README with exact setup and run commands alongside the first application code. Prefer commands such as `make setup`, `make test`, and `make lint`; define each target before documenting it as available.

## Coding Style & Naming Conventions

Follow the formatter and linter configured for each language once one is chosen. Keep formatting automated and commit its configuration alongside the code. Use descriptive names: lowercase, hyphenated names for documentation files; language-standard names for source files; and test names that identify the behavior under test. Avoid unrelated formatting changes in feature or fix commits.

## Testing Guidelines

There is no testing framework or coverage threshold yet. Add tests with new behavior and bug fixes, placing them in `tests/` or the language's conventional test location. Name tests for observable outcomes, and include a regression case for each fixed defect. Document the test command and any required services or fixtures when the first test suite is added.

## Commit & Pull Request Guidelines

No readable Git history is available here, so there is no established commit-message convention to summarize. Use short imperative subjects such as `Add input validation` and keep commits focused. Pull requests should explain the change, list verification commands and results, and link any relevant issue. Include screenshots for visible interface changes. Call out new configuration, migrations, or deployment steps explicitly.

## Security & Configuration

Keep secrets and local credentials out of version control. Provide example configuration with placeholder values, and document required environment variables without including real tokens.
