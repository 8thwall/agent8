# mcp8 - MCP Server for 8th Wall Agent
## Environment Setup
### Install prerequisites
This project uses `pnpm` for package management. To get started, first install dependencies using
```bash
pnpm install
```
### Running locally
Before we run the MCP server, make sure 8th Wall Desktop app is running with a project open. Once you have a project open on 8th Wall Desktop app, you can run below command to start the MCP inspector.

```bash
pnpm run inspect
```

## Unit Testing Guide
This project uses Vitest with TypeScript for unit testing.

### Running Tests

#### Basic test execution
```bash
pnpm test
```

#### Watch mode (re-runs tests on file changes)
```bash
pnpm test:watch
```

#### Generate coverage report
```bash
pnpm test:coverage
```

#### CI mode (for continuous integration)
```bash
pnpm test:ci
```

### Test Structure

Tests are located in the `tests/` directory and mirror the source structure:

```
tests/
└── common/
    └── helpers.test.ts
```

### Writing Tests

#### Basic Test Structure

```typescript
import { yourFunction } from '../../src/path/to/module';

describe('YourFunction', () => {
  it('should do something specific', () => {
    // Arrange
    const input = 'test input';
    
    // Act
    const result = yourFunction(input);
    
    // Assert
    expect(result).toBe('expected output');
  });
});
```
