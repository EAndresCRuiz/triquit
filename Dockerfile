
# Imagen ligera para producción
FROM node:18-alpine AS build
WORKDIR /app
COPY package.json .
RUN npm install --only=production
COPY server ./server
COPY public ./public

# Runtime
FROM node:18-alpine
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/server.js"]
