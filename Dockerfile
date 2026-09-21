FROM node:24-alpine

# Define diretório de trabalho
WORKDIR /app

# Copia arquivos de dependências
COPY package.json ./

# Instala dependências de produção
RUN npm install --omit=dev

# Copia código-fonte e assets do Dashboard Web
COPY src/ ./src/
COPY public/ ./public/
COPY tests/ ./tests/

# Cria pasta de dados persistentes para o SQLite
RUN mkdir -p /app/data

# Define variáveis de ambiente padrão
ENV NODE_ENV=production
ENV SCHEDULE_TIME=09:00
ENV TIMEZONE=America/Sao_Paulo
ENV PORT=3000

# Porta do Dashboard Web
EXPOSE 3000

# Comando padrão: inicia o painel web e agendador diário contínuo
CMD ["node", "src/index.js", "--schedule"]
