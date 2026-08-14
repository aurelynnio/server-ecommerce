FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/src ./src
# Run as non-root user (node user exists in the official alpine image)
# to reduce impact if the app is compromised.
RUN chown -R node:node /app
USER node
EXPOSE 5000
CMD ["npm", "start"]
