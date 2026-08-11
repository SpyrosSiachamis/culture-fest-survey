FROM node:24.18.1
 
WORKDIR /app
 
COPY package*.json ./
 
RUN npm install
 
COPY . .
 
EXPOSE 3000
 
ENV NODE_ENV=development
ENV CHOKIDAR_USE_POLLING=true
 
CMD ["npm", "run", "dev"]