// 其它投资相关路由
const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取用户的所有其它投资
router.get('/:username', (req, res) => {
    const { username } = req.params;
    
    // 尝试查询，如果deleteFlag字段不存在则使用兼容查询
    db.all('SELECT * FROM other WHERE username = ? AND deleteFlag = 0', [username], (err, rows) => {
        if (err) {
            // 如果是因为deleteFlag字段不存在导致的错误，尝试不使用deleteFlag条件
            db.all('SELECT * FROM other WHERE username = ?', [username], (err2, rows2) => {
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

// 添加其它资产
router.post('/', (req, res) => {
    const { username, name, type, amount, date, expectedReturn, remarks, platform, flexibility, transactionType, redeemType, status } = req.body;
    
    db.run(
        'INSERT INTO other (username, name, type, amount, date, expectedReturn, remarks, platform, flexibility, transactionType, redeemType, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [username, name, type, amount, date, expectedReturn, remarks, platform, flexibility, transactionType, redeemType, status],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
});

// 更新其它资产
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { name, type, amount, date, expectedReturn, remarks, platform, flexibility, transactionType, redeemType, status } = req.body;
    
    db.run(
        'UPDATE other SET name = ?, type = ?, amount = ?, date = ?, expectedReturn = ?, remarks = ?, platform = ?, flexibility = ?, transactionType = ?, redeemType = ?, status = ? WHERE id = ?',
        [name, type, amount, date, expectedReturn, remarks, platform, flexibility, transactionType, redeemType, status, id],
        (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: '更新成功' });
        }
    );
});

// 删除其它投资（软删除）
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const deleteDate = new Date().toISOString();
    
    db.run('UPDATE other SET deleteFlag = 1, deleteDate = ? WHERE id = ?', [deleteDate, id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: '删除成功' });
    });
});

// 删除用户所有其它投资（软删除）
router.delete('/user/:username', (req, res) => {
    const { username } = req.params;
    const deleteDate = new Date().toISOString();
    
    db.run('UPDATE other SET deleteFlag = 1, deleteDate = ? WHERE username = ?', [deleteDate, username], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: '删除成功' });
    });
});

// 获取用户的已删除其它投资
router.get('/deleted/:username', (req, res) => {
    const { username } = req.params;
    
    // 尝试查询，如果deleteFlag字段不存在则返回空数组
    db.all('SELECT * FROM other WHERE username = ? AND deleteFlag = 1 ORDER BY deleteDate DESC', [username], (err, rows) => {
        if (err) {
            // 如果是因为deleteFlag字段不存在导致的错误，返回空数组
            res.json([]);
            return;
        }
        res.json(rows);
    });
});

// 恢复已删除的其它投资
router.put('/restore/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('UPDATE other SET deleteFlag = 0, deleteDate = NULL WHERE id = ?', [id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: '恢复成功' });
    });
});

module.exports = router;