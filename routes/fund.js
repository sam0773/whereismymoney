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
        transactionType = 'buy', 
        redeemType = 'partial',
        date, 
        expiryDate, 
        amount,
        redeemedAmount = 0,
        shares = null,
        fundCategory,
        fundType,
        fundRiskLevel
    } = req.body;
    
    let status = 'active';
    
    db.run(
        'INSERT INTO fund (username, platform, fundCode, name, transactionType, redeemType, date, expiryDate, amount, redeemedAmount, shares, status, fundCategory, fundType, fundRiskLevel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [username, platform, fundCode, name, transactionType, redeemType, date, expiryDate, amount, redeemedAmount, shares, status, fundCategory, fundType, fundRiskLevel],
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
        transactionType, 
        redeemType, 
        date, 
        expiryDate, 
        amount, 
        redeemedAmount, 
        shares = null,
        status,
        fundCategory,
        fundType,
        fundRiskLevel 
    } = req.body;
    
    // 处理shares字段，确保它是有效的数字或null
    const processedShares = (shares !== null && shares !== undefined && !isNaN(parseFloat(shares)) && parseFloat(shares) > 0) ? parseFloat(shares) : null;
    
    db.run(
        'UPDATE fund SET platform = ?, fundCode = ?, name = ?, transactionType = ?, redeemType = ?, date = ?, expiryDate = ?, amount = ?, redeemedAmount = ?, shares = ?, status = ?, fundCategory = ?, fundType = ?, fundRiskLevel = ? WHERE id = ?',
        [platform, fundCode, name, transactionType, redeemType, date, expiryDate, amount, redeemedAmount, processedShares, status, fundCategory, fundType, fundRiskLevel, id],
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
                const fundCategoryMatch = data.match(/fS_category\s*=\s*"([^"]+)"/);
                
                console.log('基金API返回数据:', data);
                console.log('fundNameMatch:', fundNameMatch);
                console.log('fundTypeMatch:', fundTypeMatch);
                console.log('fundCategoryMatch:', fundCategoryMatch);
                
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
                let fundType = fundCategoryMatch ? fundCategoryMatch[1] : '';
                let fundRiskLevel = '';
                
                // 映射运作方式
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
                
                // 映射基金类型
                if (fundType.includes('货币')) {
                    fundType = '货币型';
                } else if (fundType.includes('债券') || fundType.includes('债')) {
                    fundType = '债券型';
                } else if (fundType.includes('混合')) {
                    fundType = '混合型';
                } else if (fundType.includes('股票') || fundType.includes('权益')) {
                    fundType = '股票型';
                } else if (fundType.includes('指数')) {
                    fundType = '指数型';
                } else if (fundType.includes('ETF')) {
                    fundType = 'ETF';
                } else if (fundType.includes('LOF')) {
                    fundType = 'LOF';
                } else if (fundType.includes('QDII')) {
                    fundType = 'QDII';
                } else if (fundType.includes('FOF')) {
                    fundType = 'FOF';
                } else if (fundName.includes('货币')) {
                    fundType = '货币型';
                } else if (fundName.includes('债券') || fundName.includes('债')) {
                    fundType = '债券型';
                } else if (fundName.includes('混合')) {
                    fundType = '混合型';
                } else if (fundName.includes('股票')) {
                    fundType = '股票型';
                } else if (fundName.includes('指数') || fundName.includes('ETF')) {
                    fundType = '指数型';
                } else {
                    fundType = '混合型'; // 默认混合型
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
                            // 3. 通过运作方式和名称判断风险等级
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
                        // 3. 通过运作方式和名称判断风险等级
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
                    fundType,
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

// 获取基金最新净值
router.get('/nav/:fundCode', (req, res) => {
    const { fundCode } = req.params;
    const https = require('https');
    
    // 使用天天基金网API获取净值数据
    const apiUrl = `https://fund.eastmoney.com/pingzhongdata/${fundCode}.js`;
    
    https.get(apiUrl, (apiRes) => {
        let data = '';
        
        apiRes.on('data', (chunk) => {
            data += chunk;
        });
        
        apiRes.on('end', () => {
            try {
                let netValue = '';
                let date = '';
                
                // 方式1：优先获取 jzrq（净值日期）字段
                const jzrqIndex = data.indexOf('jzrq');
                if (jzrqIndex !== -1) {
                    // 找到jzrq后，找到后面的冒号和引号
                    const colonIndex = data.indexOf(':', jzrqIndex);
                    if (colonIndex !== -1) {
                        const quoteStart = data.indexOf('"', colonIndex);
                        if (quoteStart !== -1) {
                            const quoteEnd = data.indexOf('"', quoteStart + 1);
                            if (quoteEnd !== -1) {
                                date = data.substring(quoteStart + 1, quoteEnd);
                            }
                        }
                    }
                }
                
                // 方式2：尝试从 Data_netWorthTrend 获取单位净值（unitMoney字段）
                const netWorthMatch = data.match(/Data_netWorthTrend\s*=\s*(\[([\s\S]*?)\])/);
                if (netWorthMatch && netWorthMatch[1]) {
                    try {
                        const trendArray = JSON.parse(netWorthMatch[1]);
                        if (Array.isArray(trendArray) && trendArray.length > 0) {
                            const lastData = trendArray[trendArray.length - 1];
                            if (lastData && typeof lastData === 'object') {
                                // 优先使用 unitMoney 字段（单位净值），而不是 y 字段（增长率）
                                if (lastData.unitMoney) {
                                    netValue = lastData.unitMoney.toString();
                                } else if (lastData.y && parseFloat(lastData.y) < 10) {
                                    // 如果没有unitMoney且y值小于10，可能是净值（不是增长率）
                                    netValue = lastData.y.toString();
                                }
                                // 只有当还没有日期时才使用数组中的日期
                                if (!date && lastData.x) {
                                    const timestamp = parseInt(lastData.x);
                                    date = new Date(timestamp).toLocaleDateString('zh-CN');
                                }
                            }
                        }
                    } catch (e) {
                        console.error('解析Data_netWorthTrend失败:', e.message);
                    }
                }
                
                // 方式3：尝试获取单位净值 dwjz
                if (!netValue) {
                    const dwjzMatch = data.match(/dwjz\s*[:=]\s*["']([^"']+)["']/);
                    if (dwjzMatch) {
                        netValue = dwjzMatch[1];
                    }
                }
                
                // 方式4：尝试从其他字段获取单位净值
                if (!netValue) {
                    const unitMoneyMatch = data.match(/unitMoney\s*[:=]\s*["']([^"']+)["']/);
                    if (unitMoneyMatch) {
                        netValue = unitMoneyMatch[1];
                    }
                }
                
                // 方式5：尝试获取 currentDate
                if (!date) {
                    const dateMatch = data.match(/currentDate\s*[:=]\s*["']([^"']+)["']/);
                    if (dateMatch) {
                        date = dateMatch[1];
                    }
                }
                
                res.json({
                    fundCode,
                    netValue,
                    date
                });
            } catch (error) {
                console.error('解析基金净值失败:', error);
                res.status(500).json({ error: '解析基金净值失败' });
            }
        });
        
    }).on('error', (error) => {
        console.error('获取基金净值失败:', error);
        res.status(500).json({ error: '获取基金净值失败' });
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