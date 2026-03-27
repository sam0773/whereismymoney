# 使用Node.js官方镜像作为基础镜像
FROM docker.1ms.run/node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json到工作目录
COPY package*.json ./

# 安装依赖
RUN npm install --production

# 复制应用程序文件到工作目录
COPY . .

# 暴露端口9000
EXPOSE 9000

# 启动应用程序
CMD ["node", "server.js"]