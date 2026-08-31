FROM node:24-alpine3.24 AS frontend-build
WORKDIR /app
ARG VITE_COMMIT_SHA=""
ENV VITE_COMMIT_SHA=${VITE_COMMIT_SHA}
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.30.4-alpine3.24
RUN apk upgrade --no-cache
COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
