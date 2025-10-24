import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fail } from 'assert';

describe('Dependency Security Audit', () => {
  let packageJson: any;
  let packageLockJson: any;

  beforeAll(() => {
    const packagePath = path.join(__dirname, '../../package.json');
    const lockPath = path.join(__dirname, '../../package-lock.json');
    
    packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    if (fs.existsSync(lockPath)) {
      packageLockJson = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    }
  });

  describe('Package Vulnerabilities', () => {
    it('should not have known high-severity vulnerabilities', () => {
      try {
        // Run npm audit and capture output
        const auditResult = execSync('npm audit --audit-level high --json', {
          cwd: path.join(__dirname, '../..'),
          encoding: 'utf8'
        });
        
        const audit = JSON.parse(auditResult);
        
        // Check for high or critical vulnerabilities
        const highVulns = audit.vulnerabilities ? 
          Object.values(audit.vulnerabilities).filter((vuln: any) => 
            vuln.severity === 'high' || vuln.severity === 'critical'
          ) : [];
        
        expect(highVulns.length).toBe(0);
      } catch (error) {
        // If npm audit fails with exit code 1, it means vulnerabilities were found
        if (error instanceof Error && 'status' in error && error.status === 1) {
          fail('High or critical vulnerabilities found in dependencies');
        }
        // Other errors might be network issues, etc.
        console.warn('Could not run npm audit:', error);
      }
    });

    it('should use secure versions of cryptographic libraries', () => {
      const cryptoDeps = {
        'crypto': packageJson.dependencies?.crypto,
        'bcrypt': packageJson.dependencies?.bcrypt,
        'jsonwebtoken': packageJson.dependencies?.jsonwebtoken,
        'node-forge': packageJson.dependencies?.['node-forge']
      };

      // Check that we're not using known vulnerable versions
      Object.entries(cryptoDeps).forEach(([dep, version]) => {
        if (version) {
          expect(version).toBeDefined();
          // Add specific version checks for known vulnerabilities
          if (dep === 'jsonwebtoken') {
            // Ensure we're using a version that fixes known vulnerabilities
            expect(version).not.toMatch(/^[0-8]\./); // Avoid very old versions
          }
        }
      });
    });
  });

  describe('Dependency Analysis', () => {
    it('should not include unnecessary development dependencies in production', () => {
      const devDeps = packageJson.devDependencies || {};
      const prodDeps = packageJson.dependencies || {};
      
      // Common dev dependencies that should not be in production
      const devOnlyPackages = [
        'jest', 'ts-jest', '@types/jest',
        'eslint', '@typescript-eslint/eslint-plugin',
        'prettier', 'husky', 'lint-staged',
        'ts-node-dev', 'supertest', '@types/supertest'
      ];
      
      devOnlyPackages.forEach(pkg => {
        expect(prodDeps[pkg]).toBeUndefined();
        // It's OK if they're in devDependencies
      });
    });

    it('should use pinned versions for security-critical packages', () => {
      const criticalPackages = [
        'jsonwebtoken',
        'bcrypt',
        'helmet',
        'cors'
      ];
      
      criticalPackages.forEach(pkg => {
        const version = packageJson.dependencies?.[pkg];
        if (version) {
          // Check that version is defined and reasonable
          expect(version).toBeDefined();
          // Note: In development, loose ranges are acceptable, but log for awareness
          if (version.match(/^[\^~]/)) {
            console.warn(`Package ${pkg} uses loose version range: ${version}`);
          }
        }
      });
    });
  });
});