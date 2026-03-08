const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

// 确保data目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('已创建data目录');
}

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '.')));

// 导入路由
const usersRouter = require('./routes/users');
const depositsRouter = require('./routes/deposits');
const fundRouter = require('./routes/fund');
const wealthRouter = require('./routes/wealth');
const bankSecuritiesTransfersRouter = require('./routes/bankSecuritiesTransfers');
const otherRouter = require('./routes/other');

// 使用路由
app.use('/api/users', usersRouter);
app.use('/api/deposits', depositsRouter);
app.use('/api/funds', wealthRouter); // 修复：将/api/funds路由指向wealthRouter
app.use('/api/fund', fundRouter);
app.use('/api/wealth', wealthRouter);
app.use('/api/bankSecuritiesTransfers', bankSecuritiesTransfersRouter);
app.use('/api/other', otherRouter);

// 清空所有数据（仅管理员可用）
app.delete('/api/clear-database', (req, res) => {
    // 从请求中获取用户名和角色信息
    // 注意：在实际应用中，应该通过JWT或其他认证机制来获取用户信息
    // 这里为了简化，暂时跳过严格的认证，仅做基本验证
    
    // 获取请求体中的admin标识（实际应用中应该从认证信息中获取）
    const { isAdmin } = req.body;
    
    // 基本验证 - 实际应用中应该更严格
    if (!isAdmin) {
        res.status(403).json({ message: '只有管理员可以执行此操作' });
        return;
    }
    
    db.serialize(() => {
            db.run('DELETE FROM deposits', (err) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
            });
            
            db.run('DELETE FROM wealth', (err) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
            });
            
            db.run('DELETE FROM fund', (err) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
            });
        
        // 清空其它投资表
        db.run('DELETE FROM other', (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
        });
        
        // 保留管理员用户
        db.run('DELETE FROM users WHERE role != ?', ['admin'], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
        });
        
        res.json({ message: '数据库清空成功' });
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});