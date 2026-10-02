import { readFileSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const src = path.join(root, 'src');
const configPath = path.join(root, 'tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
if (parsed.errors.length) throw new Error(parsed.errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));

function dependencies(source: ts.SourceFile): string[] {
  const imports: string[] = [];
  function visit(node: ts.Node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
      imports.push(node.moduleReference.expression.text);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      imports.push(node.argument.literal.text);
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteralLike(argument)) imports.push(argument.text);
      else throw new Error(`${source.fileName}: computed import/require cannot be checked; use a literal module path`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return imports;
}

function location(filename: string) {
  const relative = path.relative(src, filename).split(path.sep).join('/');
  const parts = relative.split('/');
  return { relative, area: parts[0], module: parts[0] === 'modules' ? parts[1] : undefined, layer: parts[0] === 'modules' ? parts[2] : undefined };
}

function violations(sourcePath: string, targetPath?: string): string[] {
  const source = location(sourcePath);
  const target = targetPath ? location(targetPath) : undefined;
  const failures: string[] = [];
  if (source.area === 'kernel' && target && target.area !== 'kernel') failures.push('kernel_dependency');
  if (source.module && target && target.area !== 'kernel' && target.area !== 'modules') failures.push('module_dependency_outside_kernel_or_modules');
  if (source.module && target?.module && source.module !== target.module && target.layer !== 'public') failures.push('private_cross_module_import');
  if (source.layer === 'domain' && (!target || !(target.module === source.module && target.layer === 'domain') && target.relative !== 'kernel/ports.ts')) failures.push('domain_dependency');
  if (source.layer === 'application' && target?.layer === 'infrastructure') failures.push('application_infrastructure_shortcut');
  if (source.layer === 'public' && target && target.area !== 'kernel' && target.layer !== 'public') failures.push('public_contract_private_dependency');
  const interfaceAdapter = source.layer === 'interfaces' || (source.area === 'app' && !['app/main.ts', 'app/application.ts', 'app/migrate.ts'].includes(source.relative));
  if (interfaceAdapter && target && (target.layer === 'infrastructure' || target.layer === 'domain' || /\/application\/ports\.ts$/.test(target.relative))) failures.push('interface_private_dependency');
  return failures;
}

describe('architecture boundaries', () => {
  it('checks production imports against module and layer boundaries', () => {
    expect(parsed.fileNames.length).toBeGreaterThan(0);
    const failures: string[] = [];
    for (const filename of parsed.fileNames) {
      const source = ts.createSourceFile(filename, readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
      for (const specifier of dependencies(source)) {
        if (isBuiltin(specifier)) {
          for (const violation of violations(filename)) failures.push(`${location(filename).relative} -> ${specifier}: ${violation}`);
          continue;
        }
        const resolved = ts.resolveModuleName(specifier, filename, parsed.options, ts.sys).resolvedModule;
        if (!resolved) {
          failures.push(`${location(filename).relative} -> ${specifier}: unresolved dependency`);
          continue;
        }
        const targetPath = resolved.isExternalLibraryImport ? undefined : resolved.resolvedFileName;
        for (const violation of violations(filename, targetPath)) {
          failures.push(`${location(filename).relative} -> ${specifier}: ${violation}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it.each([
    ['modules/identity/application/handler.ts', 'modules/settings/infrastructure/store.ts', 'private_cross_module_import'],
    ['modules/identity/application/handler.ts', 'modules/identity/infrastructure/store.ts', 'application_infrastructure_shortcut'],
    ['modules/identity/domain/user.ts', undefined, 'domain_dependency'],
    ['modules/identity/domain/user.ts', 'modules/settings/public/contracts.ts', 'domain_dependency'],
    ['modules/identity/domain/user.ts', 'kernel/container.ts', 'domain_dependency'],
    ['modules/settings/public/contracts.ts', 'modules/settings/domain/setting.ts', 'public_contract_private_dependency'],
    ['modules/identity/application/handler.ts', 'app/http.ts', 'module_dependency_outside_kernel_or_modules'],
    ['kernel/ports.ts', 'modules/settings/public/contracts.ts', 'kernel_dependency'],
    ['app/http.ts', 'modules/identity/infrastructure/store.ts', 'interface_private_dependency'],
    ['app/http.ts', 'modules/identity/application/ports.ts', 'interface_private_dependency'],
    ['modules/identity/interfaces/http.ts', 'modules/identity/domain/user.ts', 'interface_private_dependency'],
  ])('rejects %s -> %s (%s)', (source, target, rule) => {
    expect(violations(path.join(src, source), target ? path.join(src, target) : undefined)).toContain(rule);
  });

  it.each([
    ['modules/identity/application/login.ts', 'modules/settings/public/contracts.ts'],
    ['modules/identity/domain/user.ts', 'modules/identity/domain/email.ts'],
    ['modules/identity/domain/user.ts', 'kernel/ports.ts'],
    ['app/http.ts', 'modules/identity/application/login.ts'],
    ['app/application.ts', 'modules/identity/infrastructure/store.ts'],
  ])('allows %s -> %s', (source, target) => {
    expect(violations(path.join(src, source), path.join(src, target))).toEqual([]);
  });

  it('collects type imports, side effects, re-exports, dynamic imports, and require calls', () => {
    const source = ts.createSourceFile('fixture.ts', `
      import type { User } from './private-a.js';
      import './private-b.js';
      export { User } from './private-c.js';
      export * from './private-d.js';
      type User = import('./private-e.js').User;
      const load = () => import('./private-f.js');
      const legacy = require('./private-g.js');
      import legacyType = require('./private-h.js');
      // import './ignored-comment.js';
      const text = "import './ignored-string.js'";
    `, ts.ScriptTarget.Latest, true);
    expect(dependencies(source)).toEqual(['./private-a.js', './private-b.js', './private-c.js', './private-d.js', './private-e.js', './private-f.js', './private-g.js', './private-h.js']);
  });

  it('rejects computed dynamic dependencies instead of silently skipping them', () => {
    const source = ts.createSourceFile('fixture.ts', 'const load = (name: string) => import(name);', ts.ScriptTarget.Latest, true);
    expect(() => dependencies(source)).toThrow('computed import/require cannot be checked');
  });
});
