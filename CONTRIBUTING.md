# Guia de Contribuição 🤝

Obrigado pelo interesse em contribuir com o **Instagram Daily Automation**! Este é um projeto de código aberto mantido pela comunidade para fornecer uma solução autônoma, robusta e gratuita de publicação diária no Instagram.

---

## 🛠️ Pré-requisitos de Desenvolvimento

- **Node.js**: Versão **22.x ou superior** (devido ao suporte nativo a `node:sqlite`).
- **NPM**: 10.x ou superior.
- **Git** instalado.

---

## 🚀 Como Começar

1. **Faça um Fork do Repositório**:
   Clique em *Fork* no topo direito da página do GitHub.

2. **Clone o seu Fork**:
   ```bash
   git clone https://github.com/SEU_USUARIO/instagram-daily-automation.git
   cd instagram-daily-automation
   ```

3. **Instale as dependências**:
   ```bash
   npm install
   ```

4. **Configure o ambiente de teste local**:
   ```bash
   cp .env.example .env
   ```
   *Nota: No ambiente local de desenvolvimento, você pode deixar o modo `DRY_RUN=true` para simular as APIs externas com segurança sem gastar créditos nem publicar no feed real.*

5. **Execute a suíte de testes unitários**:
   ```bash
   npm test
   # ou:
   node tests/pipeline.test.js
   ```

6. **Inicie o servidor de desenvolvimento**:
   ```bash
   npm run dev
   ```
   Acesse o Dashboard Web em: `http://localhost:3000`.

---

## 🧪 Padrões de Código e Testes

- Todo novo recurso ou correção de bug **deve incluir testes** em `tests/pipeline.test.js`.
- Mantemos a filosofia de **dependências mínimas**: antes de adicionar uma nova biblioteca ao `package.json`, verifique se o recurso pode ser resolvido com módulos nativos do Node.js (`node:crypto`, `node:sqlite`, `node:http`, etc.).
- Os testes rodam de forma determinística e não devem depender de chamadas de rede externas para passar (use mock ou modo simulado).

---

## 🔀 Fluxo de Pull Requests (PR)

1. Crie uma branch com um nome descritivo:
   ```bash
   git checkout -b feature/minha-melhoria
   # ou
   git checkout -b fix/correcao-bug
   ```

2. Escreva mensagens de commit seguindo a convenção [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat: adiciona suporte a novos modelos do Gemini`
   - `fix: corrige quebra de linha no renderizador SVG`
   - `docs: atualiza instruções de deploy no Docker`

3. Certifique-se de que todos os testes passaram:
   ```bash
   node tests/pipeline.test.js
   ```

4. Envie a branch para o seu fork e abra o **Pull Request** detalhando as alterações realizadas e os testes executados.

---

## 💬 Dúvidas ou Sugestões?

Abra uma [Issue](https://github.com/gucarvalho81/instagram-daily-automation/issues) para discutir novas ideias ou relatar problemas.
