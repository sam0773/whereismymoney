// 基金相关路由
const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取用户的所有基金
router.get('/:username', (req, res) => {
    const { username } = req.params;
    
    // 尝试查询，如果deleteFlag字段不存在则使用兼容查询
    db.all('SELECT * FROM fund WHERE username = ? AND deleteFlag = 0', [username], (err, rows) => {
        if (err) {
            // 如果是因为deleteFlag字段不存在导致的错误，尝试不使用deleteFlag条件
            db.all('SELECT * FROM fund WHERE username = ?', [username], (err2, rows2) => {
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

// 添加基金或赎回
router.post('/', (req, res) => {
    const { 
        username, 
        platform, 
        fundCode, 
        name, 
        type = '活期', 
        transactionType = 'buy', 
        redeemType = 'partial', // 添加赎回类型标识
        date, 
        expiryDate, 
        amount,
        redeemedAmount = 0,
        fundCategory,
        fundRiskLevel
    } = req.body;
    
    // 计算状态
    let status = 'active';
    
    db.run(
        'INSERT INTO fund (username, platform, fundCode, name, type, transactionType, redeemType, date, expiryDate, amount, redeemedAmount, status, fundCategory, fundRiskLevel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [username, platform, fundCode, name, type, transactionType, redeemType, date, expiryDate, amount, redeemedAmount, status, fundCategory, fundRiskLevel],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
});

// 删除基金（软删除）
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const deleteDate = new Date().toISOString();
    
    db.run('UPDATE fund SET deleteFlag = 1, deleteDate = ? WHERE id = ?', [deleteDate, id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: '删除成功' });
    });
});

// 删除用户所有基金（软删除）
router.delete('/user/:username', (req, res) => {
    const { username } = req.params;
    const deleteDate = new Date().toISOString();
    
    db.run('UPDATE fund SET deleteFlag = 1, deleteDate = ? WHERE username = ?', [deleteDate, username], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: '删除成功' });
    });
});

// 更新基金交易记录
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { 
        platform, 
        fundCode, 
        name, 
        type, 
        transactionType, 
        redeemType, 
        date, 
        expiryDate, 
        amount, 
        redeemedAmount, 
        status,
        fundCategory,
        fundRiskLevel 
    } = req.body;
    
    db.run(
        'UPDATE fund SET platform = ?, fundCode = ?, name = ?, type = ?, transactionType = ?, redeemType = ?, date = ?, expiryDate = ?, amount = ?, redeemedAmount = ?, status = ?, fundCategory = ?, fundRiskLevel = ? WHERE id = ?',
        [platform, fundCode, name, type, transactionType, redeemType, date, expiryDate, amount, redeemedAmount, status, fundCategory, fundRiskLevel, id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: '更新成功' });
        }
    );
});

// 基金信息查询代理
router.get('/info/:fundCode', (req, res) => {
    const { fundCode } = req.params;
    const https = require('https');
    
    // 使用天天基金网API
    const apiUrl = `https://fund.eastmoney.com/pingzhongdata/${fundCode}.js`;
    
    https.get(apiUrl, (apiRes) => {
        let data = '';
        
        apiRes.on('data', (chunk) => {
            data += chunk;
        });
        
        apiRes.on('end', () => {
            try {
                console.log('基金API返回数据:', data);
                
                // 解析基金数据
                const fundNameMatch = data.match(/fS_name\s*=\s*"([^"]+)"/);
                const fundTypeMatch = data.match(/fS_fundType\s*=\s*"([^"]+)"/);
                
                console.log('基金API返回数据:', data);
                console.log('fundNameMatch:', fundNameMatch);
                console.log('fundTypeMatch:', fundTypeMatch);
                
                // 尝试多种解析方式获取基金名称
                let fundName = '';
                if (fundNameMatch) {
                    fundName = fundNameMatch[1];
                } else {
                    // 尝试另一种解析方式
                    const altMatch = data.match(/var\s+fund_name\s*=\s*"([^"]+)"/);
                    console.log('altMatch:', altMatch);
                    if (altMatch) {
                        fundName = altMatch[1];
                    } else {
                        // 尝试解析为其他格式
                        const simpleMatch = data.match(/"([^"]+)"/);
                        console.log('simpleMatch:', simpleMatch);
                        if (simpleMatch) {
                            fundName = simpleMatch[1].split(',')[0];
                        } else {
                            res.status(404).json({ error: '基金代码不存在或查询失败' });
                            return;
                        }
                    }
                }
                let fundCategory = fundTypeMatch ? fundTypeMatch[1] : '';
                let fundRiskLevel = '';
                
                // 映射基金类型
                if (fundCategory.includes('开放')) {
                    if (fundCategory.includes('定期')) {
                        fundCategory = '定期开放式';
                    } else {
                        fundCategory = '开放式';
                    }
                } else if (fundCategory.includes('封闭')) {
                    fundCategory = '封闭式';
                } else {
                    fundCategory = '开放式'; // 默认开放式
                }
                
                // 尝试从数据中提取风险等级
                // 1. 优先使用risk_level字段（数字类型：1=低风险，2=中低风险，3=中风险，4=中高风险，5=高风险）
                let riskLevelMatch = data.match(/risk_level\s*=\s*(\d+)/);
                if (riskLevelMatch) {
                    const riskLevelNum = parseInt(riskLevelMatch[1]);
                    switch(riskLevelNum) {
                        case 1:
                            fundRiskLevel = '低风险';
                            break;
                        case 2:
                            fundRiskLevel = '中低风险';
                            break;
                        case 3:
                            fundRiskLevel = '中风险';
                            break;
                        case 4:
                            fundRiskLevel = '中高风险';
                            break;
                        case 5:
                            fundRiskLevel = '高风险';
                            break;
                        default:
                            fundRiskLevel = '中风险';
                    }
                } else {
                    // 2. 尝试使用fS_riskLevel字段
                    riskLevelMatch = data.match(/fS_riskLevel\s*=\s*"([^"]+)"/);
                    if (riskLevelMatch) {
                        const riskLevel = riskLevelMatch[1];
                        // 映射为系统支持的风险等级
                        if (riskLevel.includes('低')) {
                            if (riskLevel.includes('中')) {
                                fundRiskLevel = '中低风险';
                            } else {
                                fundRiskLevel = '低风险';
                            }
                        } else if (riskLevel.includes('中')) {
                            if (riskLevel.includes('高')) {
                                fundRiskLevel = '中高风险';
                            } else {
                                fundRiskLevel = '中风险';
                            }
                        } else if (riskLevel.includes('高')) {
                            fundRiskLevel = '高风险';
                        } else {
                            // 3. 通过基金类型和名称判断风险等级
                            if (fundCategory.includes('货币') || fundName.includes('货币')) {
                                fundRiskLevel = '低风险';
                            } else if (fundCategory.includes('债券') || fundName.includes('债券')) {
                                fundRiskLevel = '中低风险';
                            } else if (fundCategory.includes('混合') || fundName.includes('混合')) {
                                fundRiskLevel = '中风险';
                            } else if (fundCategory.includes('股票') || fundName.includes('股票')) {
                                fundRiskLevel = '中高风险';
                            } else if (fundCategory.includes('指数') || fundName.includes('指数') || fundName.includes('ETF')) {
                                fundRiskLevel = '中高风险';
                            } else {
                                fundRiskLevel = '中风险'; // 默认中风险
                            }
                        }
                    } else {
                        // 3. 通过基金类型和名称判断风险等级
                        if (fundCategory.includes('货币') || fundName.includes('货币')) {
                            fundRiskLevel = '低风险';
                        } else if (fundCategory.includes('债券') || fundName.includes('债券')) {
                            fundRiskLevel = '中低风险';
                        } else if (fundCategory.includes('混合') || fundName.includes('混合')) {
                            fundRiskLevel = '中风险';
                        } else if (fundCategory.includes('股票') || fundName.includes('股票')) {
                            fundRiskLevel = '中高风险';
                        } else if (fundCategory.includes('指数') || fundName.includes('指数') || fundName.includes('ETF')) {
                            fundRiskLevel = '中高风险';
                        } else {
                            fundRiskLevel = '中风险'; // 默认中风险
                        }
                    }
                }
                
                res.json({
                    fundCode,
                    fundName,
                    fundCategory,
                    fundRiskLevel
                });
            } catch (error) {
                console.error('解析基金信息失败:', error);
                res.status(500).json({ error: '解析基金信息失败' });
            }
        });
        
    }).on('error', (error) => {
        console.error('获取基金信息失败:', error);
        res.status(500).json({ error: '获取基金信息失败' });
    });
});

// 获取用户的已删除基金
router.get('/deleted/:username', (req, res) => {
    const { username } = req.params;
    
    // 尝试查询，如果deleteFlag字段不存在则返回空数组
    db.all('SELECT * FROM fund WHERE username = ? AND deleteFlag = 1 ORDER BY deleteDate DESC', [username], (err, rows) => {
        if (err) {
            // 如果是因为deleteFlag字段不存在导致的错误，返回空数组
            res.json([]);
            return;
        }
        res.json(rows);
    });
});

// 恢复已删除的基金
router.put('/restore/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('UPDATE fund SET deleteFlag = 0, deleteDate = NULL WHERE id = ?', [id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: '恢复成功' });
    });
});

module.exports = router;