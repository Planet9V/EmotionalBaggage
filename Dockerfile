# Web app: Next.js standalone build
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Gives sign-in throttling the connection's own address (X-Forwarded-For is trusted only with TRUST_PROXY=1).
COPY --from=build /app/scripts/client-address.cjs ./client-address.cjs
USER node
EXPOSE 3000
CMD ["node", "-r", "./client-address.cjs", "server.js"]
