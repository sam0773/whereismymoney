// 理财相关路由
const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取用户的所有理财
router.get('/:username', (req, res) => {
    const { username } = req.params;
    
    // 尝试查询，如果deleteFlag字段不存在则使用兼容查询
    db.all('SELECT * FROM wealth WHERE username = ? AND deleteFlag = 0', [username], (err, rows) => {
        if (err) {
            // 如果是因为deleteFlag字段不存在导致的错误，尝试不使用deleteFlag条件
            db.all('SELECT * FROM wealth WHERE username = ?', [username], (err2, rows2) => {
                if (err2) {
                    res.status(500).json({ error: err2.message });
                    return;
                }
                res.json(rows2);
            });
            return;
        }
        res.json(rows);
    });
});

// 添加理财或赎回
router.post('/', (req, res) => {
    const { 
        username, 
        platform, 
        name, 
        type = '活期', 
        transactionType = 'buy', 
        redeemType = 'partial', // 添加赎回类型标识
        date, 
        expiryDate, 
        amount,
        redeemedAmount = 0
    } = req.body;
    
    // 计算状态
    let status = 'active';
    
    db.run(
        'INSERT INTO wealth (username, platform, name, type, transactionType, redeemType, date, expiryDate, amount, redeemedAmount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [username, platform, name, type, transactionType, redeemType, date, expiryDate, amount, redeemedAmount, status],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
});

// 删除理财（软删除）
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const deleteDate = new Date().toISOString();
    
    db.run('UPDATE wealth SET deleteFlag = 1, deleteDate = ? WHERE id = ?', [deleteDate, id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: '删除成功' });
    });
});

// 删除用户所有理财（软删除）
router.delete('/user/:username', (req, res) => {
    const { username } = req.params;
    const deleteDate = new Date().toISOString();
    
    db.run('UPDATE wealth SET deleteFlag = 1, deleteDate = ? WHERE username = ?', [deleteDate, username], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: '删除成功' });
    });
});

// 更新理财交易记录
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { 
        platform, 
        name, 
        type, 
        transactionType, 
        redeemType, 
        date, 
        expiryDate, 
        amount, 
        redeemedAmount, 
        status 
    } = req.body;
    
    db.run(
        'UPDATE wealth SET platform = ?, name = ?, type = ?, transactionType = ?, redeemType = ?, date = ?, expiryDate = ?, amount = ?, redeemedAmount = ?, status = ? WHERE id = ?',
        [platform, name, type, transactionType, redeemType, date, expiryDate, amount, redeemedAmount, status, id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: '更新成功' });
        }
    );
});

// 获取用户的已删除理财
router.get('/deleted/:username', (req, res) => {
    const { username } = req.params;
    
    // 尝试查询，如果deleteFlag字段不存在则返回空数组
    db.all('SELECT * FROM wealth WHERE username = ? AND deleteFlag = 1 ORDER BY deleteDate DESC', [username], (err, rows) => {
        if (err) {
            // 如果是因为deleteFlag字段不存在导致的错误，返回空数组
            res.json([]);
            return;
        }
        res.json(rows);
    });
});

// 恢复已删除的理财
router.put('/restore/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('UPDATE wealth SET deleteFlag = 0, deleteDate = NULL WHERE id = ?', [id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: '恢复成功' });
    });
});

module.exports = router;