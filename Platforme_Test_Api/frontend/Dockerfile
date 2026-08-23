# ---------- Étape 1 : build Angular ----------
FROM node:20-alpine AS build
WORKDIR /app

# On copie d'abord package*.json pour profiter du cache Docker
COPY package.json package-lock.json ./
RUN npm ci

# Puis le reste du code source
COPY . .
RUN npm run build

# ---------- Étape 2 : servir les fichiers statiques via Nginx ----------
FROM nginx:1.27-alpine

# Le build Angular 17 (nouveau builder "application") sort dans dist/<nom-projet>/browser
COPY --from=build /app/dist/bct-api-test-platform/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]