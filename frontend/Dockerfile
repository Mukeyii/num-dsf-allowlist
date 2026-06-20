FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL=/api/v1
ARG VITE_DSF_ENVIRONMENT=PRODUCTION
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DSF_ENVIRONMENT=$VITE_DSF_ENVIRONMENT
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS prod
WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist .
COPY nginx-frontend.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
