FROM node:24-alpine

ARG GIT_COMMIT=""
ARG GIT_COMMIT_SHORT=""

ENV GIT_COMMIT=$GIT_COMMIT
ENV GIT_COMMIT_SHORT=$GIT_COMMIT_SHORT

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "src/index-http.js"]
