// 用户相关路由
const express = require('express');
const router = express.Router();
const db = require('../db');
const { createPasswordHash, verifyPassword } = require('../utils/passwordUtils');

// 获取所有用户
router.get('/', (req, res) => {
    db.all('SELECT * FROM users', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 用户登录
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!row) {
            res.status(401).json({ message: '用户不存在' });
            return;
        }
        
        // 验证密码
        const { isValid, needsUpdate } = verifyPassword(password, row.password);
        
        if (!isValid) {
            res.status(401).json({ message: '密码错误' });
            return;
        }
        
        // 如果需要更新密码为哈希格式
        if (needsUpdate) {
            const hashedPassword = createPasswordHash(password);
            db.run('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username], (err) => {
                if (err) {
                    console.error('更新密码哈希失败:', err.message);
                    // 不影响登录，但记录错误
                }
            });
        }
        
        res.json(row);
    });
});

// 用户注册
router.post('/register', (req, res) => {
    const { username, password } = req.body;
    
    // 检查用户是否已存在
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (row) {
            res.status(400).json({ message: '用户已存在' });
            return;
        }
        
        // 创建新用户，密码使用哈希存储
        const newUser = {
            username,
            password: createPasswordHash(password),
            role: 'user',
            createdAt: new Date().toISOString()
        };
        
        db.run('INSERT INTO users (username, password, role, createdAt) VALUES (?, ?, ?, ?)', 
            [newUser.username, newUser.password, newUser.role, newUser.createdAt],
            (err) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ message: '注册成功' });
            }
        );
    });
});

// 检查用户名是否存在
router.post('/check', (req, res) => {
    const { username } = req.body;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        res.json({ exists: !!row });
    });
});

// 修改密码
router.put('/:username/password', (req, res) => {
    const { username } = req.params;
    const { newPassword } = req.body;
    
    // 使用哈希存储新密码
    const hashedPassword = createPasswordHash(newPassword);
    
    db.run('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: '密码修改成功' });
    });
});

// 修改用户名
router.put('/:username/username', (req, res) => {
    const { username } = req.params;
    const { newUsername } = req.body;
    
    // 检查新用户名是否已存在
    db.get('SELECT * FROM users WHERE username = ?', [newUsername], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (row) {
            res.status(400).json({ message: '用户名已存在' });
            return;
        }
        
        // 开始事务，更新所有相关表中的用户名
        db.serialize(() => {
            // 1. 更新用户表中的用户名
            db.run('UPDATE users SET username = ? WHERE username = ?', [newUsername, username], (err) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                
                // 2. 更新定期存款表中的用户名
                db.run('UPDATE deposits SET username = ? WHERE username = ?', [newUsername, username], (err) => {
                    if (err) {
                        console.error('更新定期存款表失败:', err.message);
                    }
                });
                
                // 3. 更新财富管理表中的用户名
                db.run('UPDATE wealth SET username = ? WHERE username = ?', [newUsername, username], (err) => {
                    if (err) {
                        console.error('更新财富管理表失败:', err.message);
                    }
                });
                
                // 4. 更新基金表中的用户名
                db.run('UPDATE fund SET username = ? WHERE username = ?', [newUsername, username], (err) => {
                    if (err) {
                        console.error('更新基金表失败:', err.message);
                    }
                });
                
                // 5. 更新银行证券转账表中的用户名
                db.run('UPDATE bankSecuritiesTransfers SET username = ? WHERE username = ?', [newUsername, username], (err) => {
                    if (err) {
                        console.error('更新银行证券转账表失败:', err.message);
                    }
                });
                
                // 6. 更新其它投资表中的用户名
                db.run('UPDATE other SET username = ? WHERE username = ?', [newUsername, username], (err) => {
                    if (err) {
                        console.error('更新其它投资表失败:', err.message);
                    }
                });
                
                res.json({ message: '用户名修改成功' });
            });
        });
    });
});

// 删除用户
router.delete('/:username', (req, res) => {
    const { username } = req.params;
    const currentUser = req.body.currentUser; // 从请求体获取当前用户信息
    
    // 检查是否是管理员
    if (!currentUser || currentUser.role !== 'admin') {
        res.status(403).json({ message: '只有管理员可以删除用户' });
        return;
    }
    
    // 防止自删除
    if (currentUser.username === username) {
        res.status(400).json({ message: '不能删除自己的账户' });
        return;
    }
    
    // 检查被删除用户是否是管理员
    db.get('SELECT role FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // 如果被删除用户是管理员，不允许删除
        if (row && row.role === 'admin') {
            res.status(400).json({ message: '不能删除管理员账户' });
            return;
        }
        
        // 开始事务，确保数据一致性
        db.serialize(() => {
            // 1. 删除该用户的所有存款记录
            db.run('DELETE FROM deposits WHERE username = ?', [username], (err) => {
                if (err) {
                    console.error('删除存款记录失败:', err.message);
                    // 继续执行，不中断整个事务
                }
            });
            
            // 2. 删除该用户的所有财富管理记录
            db.run('DELETE FROM wealth WHERE username = ?', [username], (err) => {
                if (err) {
                    console.error('删除财富管理记录失败:', err.message);
                    // 继续执行，不中断整个事务
                }
            });
            
            // 3. 删除该用户的所有基金记录
            db.run('DELETE FROM fund WHERE username = ?', [username], (err) => {
                if (err) {
                    console.error('删除基金记录失败:', err.message);
                    // 继续执行，不中断整个事务
                }
            });
            
            // 4. 删除该用户的所有银行证券转账记录
            db.run('DELETE FROM bankSecuritiesTransfers WHERE username = ?', [username], (err) => {
                if (err) {
                    console.error('删除银行证券转账记录失败:', err.message);
                    // 继续执行，不中断整个事务
                }
            });
            
            // 5. 删除该用户的所有其他投资记录
            db.run('DELETE FROM other WHERE username = ?', [username], (err) => {
                if (err) {
                    console.error('删除其他投资记录失败:', err.message);
                    // 继续执行，不中断整个事务
                }
            });
            
            // 6. 删除用户本身
            db.run('DELETE FROM users WHERE username = ?', [username], (err) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ message: '用户删除成功，所有相关数据已删除' });
            });
        });
    });
});

module.exports = router;