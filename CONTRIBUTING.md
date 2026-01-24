# Contributing

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18
- Git
- Docker (optional, for integration tests)

### Development Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Build the project**
   ```bash
   npm run build
   ```

3. **Run tests**
   ```bash
   npm test
   ```

4. **Run the CLI locally**
   ```bash
   npm run dev:cli -- status --config ./example/clisma.hcl
   ```

## 🔧 Making Changes

### Branch Naming

Use descriptive branch names:
- `feat/red-button` - for new features
- `fix/memory-leak` - for bug fixes
- `docs/update-readme` - for documentation
- `refactor/optimize-config-loader` - for refactoring
- `test/add-e2e-tests` - for tests

### Code Style

Use oxfmt/oxlint for formatting and linting:

```bash
npm run lint
npm run format
```

## 📝 Commit Message Guidelines

Follow [Conventional Commits](https://www.conventionalcommits.org/):

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `ci`: CI configuration changes
- `chore`: Other changes that don't modify src or test files

## 🧪 Testing

### Writing Tests

- Write tests for all new features
- Update tests when fixing bugs
- Use descriptive test names

```typescript
// Good
test('should parse local vars', () => {
  // ...
});

// Bad
test('test1', () => {
  // ...
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests for a single package
npm run test -w packages/config
```

## 🙏 Thank You!

Your contributions make this project better for everyone. Thank you for taking the time to contribute!
