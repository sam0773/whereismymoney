// 定期存款相关路由
const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取用户的所有定期存款
router.get('/:username', (req, res) => {
    const { username } = req.params;
    
    // 尝试查询，如果deleteFlag字段不存在则使用兼容查询
    db.all('SELECT * FROM deposits WHERE username = ? AND deleteFlag = 0', [username], (err, rows) => {
        if (err) {
            // 如果是因为deleteFlag字段不存在导致的错误，尝试不使用deleteFlag条件
            db.all('SELECT * FROM deposits WHERE username = ?', [username], (err2, rows2) => {
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

// 添加定期存款
router.post('/', (req, res) => {
    const { username, bank, rate, period, amount, date, expiryDate, interest, remarks, highlight } = req.body;
    
    db.run(
        'INSERT INTO deposits (username, bank, rate, period, amount, date, expiryDate, interest, remarks, highlight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [username, bank, rate, period, amount, date, expiryDate, interest, remarks, highlight ? 1 : 0],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
});

// 更新定期存款
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { bank, rate, period, amount, date, expiryDate, interest, remarks, highlight, confirmed } = req.body;
    
    db.run(
        'UPDATE deposits SET bank = ?, rate = ?, period = ?, amount = ?, date = ?, expiryDate = ?, interest = ?, remarks = ?, highlight = ?, confirmed = ? WHERE id = ?',
        [bank, rate, period, amount, date, expiryDate, interest, remarks, highlight ? 1 : 0, confirmed ? 1 : 0, id],
        (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: '更新成功' });
        }
    );
});

// 删除定期存款（软删除）
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const deleteDate = new Date().toISOString();
    
    db.run('UPDATE deposits SET deleteFlag = 1, deleteDate = ? WHERE id = ?', [deleteDate, id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: '删除成功' });
    });
});

// 删除用户所有定期存款（软删除）
router.delete('/user/:username', (req, res) => {
    const { username } = req.params;
    const deleteDate = new Date().toISOString();
    
    db.run('UPDATE deposits SET deleteFlag = 1, deleteDate = ? WHERE username = ?', [deleteDate, username], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: '删除成功' });
    });
});

// 获取用户的已删除定期存款
router.get('/deleted/:username', (req, res) => {
    const { username } = req.params;
    
    // 尝试查询，如果deleteFlag字段不存在则返回空数组
    db.all('SELECT * FROM deposits WHERE username = ? AND deleteFlag = 1 ORDER BY deleteDate DESC', [username], (err, rows) => {
        if (err) {
            // 如果是因为deleteFlag字段不存在导致的错误，返回空数组
            res.json([]);
            return;
        }
        res.json(rows);
    });
});

// 恢复已删除的定期存款
router.put('/restore/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('UPDATE deposits SET deleteFlag = 0, deleteDate = NULL WHERE id = ?', [id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: '恢复成功' });
    });
});

module.exports = router;