# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - heading "Acesse sua conta" [level=2] [ref=e5]
    - generic [ref=e9]:
      - generic [ref=e10]:
        - generic [ref=e11]:
          - generic [ref=e12]: Endereço de e-mail
          - textbox "Endereço de e-mail" [ref=e13]:
            - /placeholder: Seu endereço de e-mail
        - generic [ref=e14]:
          - generic [ref=e15]: Sua senha
          - textbox "Sua senha" [ref=e16]
      - button "Entrar" [ref=e17] [cursor=pointer]
      - generic [ref=e18]:
        - link "Esqueceu sua senha?" [ref=e19] [cursor=pointer]:
          - /url: "#auth-forgot-password"
        - link "Não tem uma conta? Cadastre-se" [ref=e20] [cursor=pointer]:
          - /url: "#auth-sign-up"
  - region "Notifications alt+T"
  - alert [ref=e21]
```