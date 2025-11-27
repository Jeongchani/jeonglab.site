FROM node:20-alpine

WORKDIR /app

# 의존성 먼저 설치
COPY package*.json ./
RUN npm install --only=production

# 앱 코드 복사
COPY . .

ENV NODE_ENV=production
ENV PORT=4000
# 컨테이너 안에서 데이터 위치
ENV LINKS_FILE=/data/links.json

EXPOSE 4000

CMD ["node", "server.js"]
