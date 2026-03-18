# Guia de Resolução de Problemas TypeScript/Jest

## Problemas Comuns e Soluções

### 1. Erro: "Cannot use import statement outside a module"

**Causa**: Jest não está configurado para transformar módulos ES6

**Solução**:
```javascript
// jest.config.js
transform: {
  '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
    presets: [
      ['@babel/preset-env', {
        targets: {
          node: 'current'
        }
      }],
      '@babel/preset-typescript',
      ['@babel/preset-react', {
        runtime: 'automatic'
      }]
    ],
  }],
},
```

### 2. Erro: "Support for the experimental syntax 'jsx' isn't currently enabled"

**Causa**: Preset React não está configurado no Babel

**Solução**:
```javascript
// babel.config.js
module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current'
      }
    }],
    '@babel/preset-typescript',
    ['@babel/preset-react', {
      runtime: 'automatic'
    }]
  ],
}
```

### 3. Erro: "Cannot redefine property: location"

**Causa**: Tentativa de redefinir uma propriedade existente do window

**Solução**:
```javascript
// jest.setup.js
if (typeof window !== 'undefined') {
  delete window.location;
  
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://localhost:3000',
      // ... outras propriedades
    },
    writable: true,
    configurable: true
  });
}
```

### 4. Erro: "Missing semicolon" em arquivos TypeScript

**Causa**: Babel não está transformando corretamente o TypeScript

**Solução**:
1. Verifique se `@babel/preset-typescript` está instalado
2. Configure o preset no babel.config.js
3. Adicione `transformIgnorePatterns` no jest.config.js

### 5. Erro: "Jest encountered an unexpected token"

**Causa**: Arquivos não estão sendo transformados pelo Babel

**Solução**:
```javascript
// jest.config.js
transformIgnorePatterns: [
  'node_modules/(?!(.*\\.mjs$))',
],
```

## Configuração Completa Recomendada

### 1. babel.config.js
```javascript
module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current'
      }
    }],
    '@babel/preset-typescript',
    ['@babel/preset-react', {
      runtime: 'automatic'
    }]
  ],
  plugins: [
    '@babel/plugin-transform-runtime',
    ['@babel/plugin-transform-modules-commonjs', {
      strictMode: false
    }]
  ],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: 'current'
          },
          modules: 'commonjs'
        }],
        '@babel/preset-typescript',
        ['@babel/preset-react', {
          runtime: 'automatic'
        }]
      ],
    }
  }
};
```

### 2. jest.config.js
```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: 'current'
          }
        }],
        '@babel/preset-typescript',
        ['@babel/preset-react', {
          runtime: 'automatic'
        }]
      ],
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))',
  ],
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/__tests__/unit/**/*.{test,spec}.{js,jsx,ts,tsx}'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      testEnvironment: 'jest-environment-jsdom',
      transform: {
        '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
          presets: [
            ['@babel/preset-env', {
              targets: {
                node: 'current'
              }
            }],
            '@babel/preset-typescript',
            ['@babel/preset-react', {
              runtime: 'automatic'
            }]
          ],
        }],
      },
    },
    // ... outros projetos
  ],
}

module.exports = createJestConfig(customJestConfig)
```

### 3. tsconfig.test.json
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "module": "commonjs",
    "moduleResolution": "node",
    "types": ["jest", "@testing-library/jest-dom", "@types/node"],
    "isolatedModules": false,
    "noEmit": true
  },
  "include": [
    "**/__tests__/**/*.{js,jsx,ts,tsx}",
    "**/*.test.{js,jsx,ts,tsx}",
    "**/*.spec.{js,jsx,ts,tsx}"
  ],
  "exclude": [
    "node_modules",
    ".next",
    "dist",
    "build"
  ]
}
```

## Pacotes Necessários

```bash
npm install --save-dev \
  @babel/core \
  @babel/preset-env \
  @babel/preset-typescript \
  @babel/preset-react \
  @babel/plugin-transform-runtime \
  @babel/plugin-transform-modules-commonjs \
  babel-jest
```

## Comandos Úteis

### Verificar configuração do Babel
```bash
npx babel --version
npx babel --help
```

### Debugar configuração do Jest
```bash
npx jest --showConfig
```

### Verificar transformação
```bash
npx babel src/__tests__/unit/example.test.ts --out-file /tmp/transformed.js
```

## Dicas Adicionais

1. **Sempre use `configurable: true`** ao redefinir propriedades do window
2. **Limpe o cache do Jest** após alterações de configuração: `npx jest --clearCache`
3. **Use `transformIgnorePatterns`** para incluir módulos node que precisam ser transformados
4. **Configure presets separados** para ambiente de teste no babel.config.js
5. **Mantenha as versões dos pacotes Babel atualizadas** e compatíveis

## Resumo do Fluxo de Configuração

1. Instalar pacotes Babel necessários
2. Configurar babel.config.js com presets TypeScript e React
3. Configurar jest.config.js com transform Babel
4. Criar tsconfig.test.json para testes
5. Configurar mocks em jest.setup.js
6. Testar com um arquivo simples
7. Limpar cache e reiniciar se necessário