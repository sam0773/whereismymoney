# WhereIsMyMoney - 个人财富管理系统

这是一个基于Web的个人财富管理系统，用于全面跟踪和管理个人资产，包括定期存款、基金、理财、证券和其他投资。

## 功能特性

### 核心功能

- **用户认证系统**：登录、注册、修改密码、权限管理
- **定期存款管理**：添加、删除、查看、利息自动计算、到期提醒
- **基金管理**：购买、部分赎回、全部赎回、收益率计算（XIRR算法）
- **理财管理**：理财产品管理、交易操作、状态追踪
- **证券管理**：银证转账记录、资金流向追踪
- **其他投资管理**：多样化资产记录、灵活性管理

### 高级功能

- **数据可视化**：资产总览、到期金额分布图表、资产结构分析
- **Excel导入导出**：数据批量导入导出、模板下载
- **智能计算**：自动计算利息、实际年化收益率
- **到期提醒**：近30天到期存款提醒
- **数据汇总**：多维度资产统计和分析
- **软删除机制**：误删数据可恢复

## 技术栈

- **前端**：HTML5、CSS3、JavaScript、ECharts
- **后端**：Node.js、Express
- **数据库**：SQLite
- **容器化**：Docker、Docker Compose
- **数据处理**：SheetJS（Excel导入导出）

## 部署说明

### 使用Docker部署

1. 确保已安装Docker和Docker Compose

2. 克隆或下载项目到本地

3. 进入项目目录

4. 构建并启动容器（默认端口3000）：
   ```bash
   docker-compose up -d
   ```

5. 访问应用：
   ```
   http://localhost:3000
   ```

### 自定义端口

#### 使用docker run命令自定义端口
```bash
# 构建镜像
docker build -t whereismymoney .

# 运行容器，将主机的8080端口映射到容器的3000端口
docker run -d -p 8080:3000 -v ./data:/app/data --name whereismymoney whereismymoney
```

#### 使用docker-compose自定义端口
修改docker-compose.yml文件中的ports配置：
```yaml
ports:
  - "8080:3000"  # 将主机的8080端口映射到容器的3000端口
```
然后运行：
```bash
docker-compose up -d
```

#### 使用环境变量自定义容器内端口
如果需要修改容器内的端口（不建议，除非有特殊需求），可以使用PORT环境变量：
```bash
docker run -d -p 8080:8080 -e PORT=8080 -v ./data:/app/data --name whereismymoney whereismymoney
```

或者在docker-compose.yml中：
```yaml
environment:
  - NODE_ENV=production
  - PORT=8080  # 修改容器内端口为8080
ports:
  - "8080:8080"  # 主机端口与容器端口保持一致
```

### 默认管理员账号

- 用户名：admin
- 密码：admin123

## 项目结构

```
├── index.html          # 主页面
├── style.css           # 样式文件
├── script.js           # 前端逻辑
├── server.js           # 后端服务器
├── db.js               # 数据库配置
├── package.json        # 项目依赖
├── Dockerfile          # Docker构建文件
├── docker-compose.yml  # Docker Compose配置
├── README.md           # 项目说明
├── images/             # 图片资源
├── js/                 # 前端模块
│   ├── auth.js         # 认证模块
│   ├── deposits.js     # 定期存款模块
│   ├── fund.js         # 基金模块
│   ├── wealth.js       # 理财模块
│   ├── stocks.js       # 证券模块
│   ├── other.js        # 其他投资模块
│   ├── dbManager.js    # 数据库管理
│   ├── common.js       # 通用函数
│   ├── excel.js        # Excel处理
│   ├── echarts.min.js  # ECharts库
│   └── xlsx.full.min.js # SheetJS库
├── routes/             # 后端路由
│   ├── users.js        # 用户路由
│   ├── deposits.js     # 定期存款路由
│   ├── fund.js         # 基金路由
│   ├── wealth.js       # 理财路由
│   ├── bankSecuritiesTransfers.js # 银证转账路由
│   └── other.js        # 其他投资路由
├── tabs/               # 选项卡内容
│   ├── overview.html   # 总览页面
│   ├── deposit.html    # 定期存款页面
│   ├── fund.html       # 基金页面
│   ├── wealth.html     # 理财页面
│   ├── stock.html      # 证券页面
│   └── other.html      # 其他投资页面
├── utils/              # 工具函数
│   └── passwordUtils.js # 密码处理
└── data/               # 数据库文件目录
```

## 数据存储

数据存储在SQLite数据库中，包含以下表结构：

- **users**：用户信息表
- **deposits**：定期存款表
- **wealth**：理财表
- **fund**：基金表
- **bankSecuritiesTransfers**：银证转账表
- **other**：其他投资表

数据库文件`database.db`会通过Docker卷挂载到宿主机，方便备份和管理。

## 更新说明

1. 停止容器：
   ```bash
   docker-compose down
   ```

2. 更新项目文件

3. 重新构建并启动容器：
   ```bash
   docker-compose up -d --build
   ```

## 注意事项

- 首次启动时，系统会自动创建管理员账号
- 数据库文件`database.db`会存储在项目目录中，请定期备份
- 建议在生产环境中修改默认管理员密码
- 系统支持多用户使用，每个用户的数据相互隔离
- 支持响应式设计，适配不同屏幕尺寸的设备

## 技术亮点

- **模块化设计**：清晰的代码结构，功能模块分离
- **RESTful API**：标准化的接口设计
- **XIRR算法**：专业的投资收益率计算
- **前端动态加载**：选项卡内容缓存，提升性能
- **完善的错误处理**：系统稳定性保障
- **数据验证**：前后端双重验证，确保数据准确性

## 许可证

MIT