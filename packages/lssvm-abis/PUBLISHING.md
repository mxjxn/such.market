# Publishing @lssvm/abis to npm

## Prerequisites

1. **npm account**: Make sure you're logged in to npm
   ```bash
   npm login
   ```

2. **Build the package**: The `prepublishOnly` script will automatically build before publishing
   ```bash
   cd packages/lssvm-abis
   npm run build
   ```

## Publishing Steps

1. **Navigate to the package directory**:
   ```bash
   cd packages/lssvm-abis
   ```

2. **Update version** (if needed):
   ```bash
   npm version patch  # for 0.1.0 -> 0.1.1
   npm version minor  # for 0.1.0 -> 0.2.0
   npm version major  # for 0.1.0 -> 1.0.0
   ```
   
   Or manually edit `package.json` and update the version field.

3. **Publish to npm**:
   ```bash
   npm publish
   ```
   
   The `prepublishOnly` script will:
   - Clean the dist directory
   - Build the TypeScript files
   - Ensure everything is ready for publishing

4. **Verify publication**:
   ```bash
   npm view @lssvm/abis
   ```

## Updating cryptoart-monorepo

After publishing, update `cryptoart-monorepo/package.json`:

```json
{
  "dependencies": {
    "@lssvm/abis": "^0.1.0"
  }
}
```

Then run:
```bash
cd cryptoart-monorepo
npm install
# or
pnpm install
```

## Troubleshooting

### "You do not have permission to publish"
- Make sure you're logged in: `npm whoami`
- Verify you own the `@lssvm` scope or have access to it
- If the scope doesn't exist, you may need to create it on npm

### "Package name already exists"
- The version already exists. Bump the version number.

### Build errors
- Make sure TypeScript is installed: `npm install`
- Check that `tsconfig.json` is correct
- Run `npm run build` manually to see errors

