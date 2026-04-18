const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取用户的所有银证转账记录
router.get('/:username', (req, res) => {
    const { username } = req.params;
    
    // 尝试查询，如果deleteFlag字段不存在则使用兼容查询
    db.all('SELECT * FROM bankSecuritiesTransfers WHERE username = ? AND deleteFlag = 0', [username], (err, rows) => {
        if (err) {
            // 如果是因为deleteFlag字段不存在导致的错误，尝试不使用deleteFlag条件
            db.all('SELECT * FROM bankSecuritiesTransfers WHERE username = ?', [username], (err2, rows2) => {
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

// 添加银证转账记录
router.post('/', (req, res) => {
    const { broker, type, amount, date, remarks, isFullTransfer, username } = req.body;
    
    db.run('INSERT INTO bankSecuritiesTransfers (broker, type, amount, date, remarks, isFullTransfer, username) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [broker, type, amount, date, remarks, isFullTransfer ? 1 : 0, username],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID, message: '银证转账记录添加成功' });
        }
    );
});

// 更新银证转账记录
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { broker, type, amount, date, remarks, isFullTransfer } = req.body;
    
    db.run('UPDATE bankSecuritiesTransfers SET broker = ?, type = ?, amount = ?, date = ?, remarks = ?, isFullTransfer = ? WHERE id = ?',
        [broker, type, amount, date, remarks, isFullTransfer ? 1 : 0, id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: '银证转账记录更新成功' });
        }
    );
});

// 删除银证转账记录（软删除）
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const deleteDate = new Date().toISOString();
    
    db.run('UPDATE bankSecuritiesTransfers SET deleteFlag = 1, deleteDate = ? WHERE id = ?', [deleteDate, id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: '银证转账记录删除成功' });
    });
});

// 删除用户的所有银证转账记录（软删除）
router.delete('/user/:username', (req, res) => {
    const { username } = req.params;
    const deleteDate = new Date().toISOString();
    
    db.run('UPDATE bankSecuritiesTransfers SET deleteFlag = 1, deleteDate = ? WHERE username = ?', [deleteDate, username], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: '用户银证转账记录删除成功' });
    });
});

// 获取用户的已删除银证转账记录
router.get('/deleted/:username', (req, res) => {
    const { username } = req.params;
    
    // 尝试查询，如果deleteFlag字段不存在则返回空数组
    db.all('SELECT * FROM bankSecuritiesTransfers WHERE username = ? AND deleteFlag = 1 ORDER BY deleteDate DESC', [username], (err, rows) => {
        if (err) {
            // 如果是因为deleteFlag字段不存在导致的错误，返回空数组
            res.json([]);
            return;
        }
        res.json(rows);
    });
});

// 恢复已删除的银证转账记录
router.put('/restore/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('UPDATE bankSecuritiesTransfers SET deleteFlag = 0, deleteDate = NULL WHERE id = ?', [id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: '恢复成功' });
    });
});

module.exports = router;