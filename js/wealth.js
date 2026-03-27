// 理财模块
let currentWealth = [];
let currentWealthSearchQuery = '';

// XIRR算法实现
function calculateXIRR(cashFlows, guess = 0.1) {
    // 最大迭代次数
    const maxIterations = 2000;
    // 放宽收敛阈值，提高收敛性
    const tolerance = 1e-4;
    
    // 至少需要两笔不同的现金流量才能计算XIRR
    if (cashFlows.length < 2) {
        return 0;
    }
    
    // 检查是否有正有负的现金流量
    const hasNegative = cashFlows.some(cf => cf.amount < 0);
    const hasPositive = cashFlows.some(cf => cf.amount > 0);
    if (!hasNegative || !hasPositive) {
        return 0;
    }
    
    // 计算NPV
    const npv = (rate) => {
        return cashFlows.reduce((total, cf) => {
            const daysDiff = Math.ceil((new Date(cf.date) - new Date(cashFlows[0].date)) / (1000 * 60 * 60 * 24));
            return total + cf.amount / Math.pow(1 + rate, daysDiff / 365);
        }, 0);
    };
    
    // 计算NPV的导数
    const npvDerivative = (rate) => {
        return cashFlows.reduce((total, cf) => {
            const daysDiff = Math.ceil((new Date(cf.date) - new Date(cashFlows[0].date)) / (1000 * 60 * 60 * 24));
            return total - (cf.amount * daysDiff / 365) / Math.pow(1 + rate, daysDiff / 365 + 1);
        }, 0);
    };
    
    // 增加更多的初始猜测值，特别是负值区域，确保负收益率能被正确计算
    const initialGuesses = [0.1, -0.1, 0.5, -0.5, 0, -0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -0.9];
    
    for (const initialGuess of initialGuesses) {
        let rate = initialGuess;
        let iteration = 0;
        let npvValue = npv(rate);
        
        // 使用牛顿迭代法求解
        while (Math.abs(npvValue) > tolerance && iteration < maxIterations) {
            const derivative = npvDerivative(rate);
            if (derivative === 0) break;
            
            rate = rate - npvValue / derivative;
            npvValue = npv(rate);
            iteration++;
        }
        
        // 检查是否收敛到合理值
        if (Math.abs(npvValue) <= tolerance) {
            return rate;
        }
    }
    
    // 如果所有初始猜测都不收敛，直接使用简单收益率计算
    // 计算总投入和总产出
    const totalInput = Math.abs(cashFlows.filter(cf => cf.amount < 0).reduce((sum, cf) => sum + cf.amount, 0));
    const totalOutput = cashFlows.filter(cf => cf.amount > 0).reduce((sum, cf) => sum + cf.amount, 0);
    
    if (totalInput <= 0) return 0;
    
    // 计算持有天数
    const startDate = new Date(cashFlows[0].date);
    const endDate = new Date(cashFlows[cashFlows.length - 1].date);
    const daysHeld = Math.max(0.5, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
    
    // 计算简单年化收益率
    const simpleReturn = (totalOutput - totalInput) / totalInput;
    const annualizedReturn = simpleReturn * (365 / daysHeld);
    
    return annualizedReturn;
}

// 计算收益率
function calculateYield(buyAmount, redeemAmount, daysHeld) {
    if (buyAmount <= 0) return 0;
    const profit = redeemAmount - buyAmount;
    // 当天存入当天取出时，持有天数按0.5天计算，确保能正确计算收益率
    const actualDaysHeld = daysHeld <= 0 ? 0.5 : daysHeld;
    return (profit / buyAmount) * (365 / actualDaysHeld) * 100;
}

// 初始化理财模块
function initWealth() {
    // 直接使用window.dbManager，不再重新声明
    // 添加产品类型选择的事件监听
    const wealthTypeSelect = document.getElementById('wealthType');
    if (wealthTypeSelect) {
        wealthTypeSelect.addEventListener('change', handleWealthTypeChange);
        // 初始化时调用一次，确保状态正确
        handleWealthTypeChange();
    }
    
    // 绑定理财相关事件
    bindWealthEvents();
    
    // 绑定排序按钮事件
    const sortBtns = document.querySelectorAll('.sort-btn');
    sortBtns.forEach(btn => {
        btn.addEventListener('click', () => handleWealthSort(btn));
    });
    
    // 检查登录状态，只有已登录才加载数据
    const currentUser = getCurrentUser();
    if (currentUser) {
        // 加载数据并渲染表格
        loadWealth().then(async () => {
            if (window.renderWealthTable) {
                await window.renderWealthTable();
            }
        });
    } else {
        // 未登录状态下只渲染空表格
        if (window.renderWealthTable) {
            window.renderWealthTable().catch(error => {
                console.error('渲染理财表格失败:', error);
            });
        }
    }
}

// 处理理财表格排序
function handleWealthSort(btn) {
    const column = btn.getAttribute('data-column');
    const order = btn.getAttribute('data-order');
    const tableId = btn.closest('table').id;
    
    // 获取当前分组的理财数据
    const groups = groupWealth();
    let wealthList;
    let tableType;
    let tableBodyId;
    
    if (tableId === 'currentFundsTable') {
        // 当前理财
        wealthList = [...groups.currentDemand, ...groups.currentFixed];
        tableType = 'current';
        tableBodyId = 'currentFundsBody';
    } else {
        // 历史理财
        wealthList = [...groups.historyDemand, ...groups.historyFixed];
        tableType = 'history';
        tableBodyId = 'historyFundsBody';
    }
    
    // 排序
    const sortedWealth = [...wealthList].sort((a, b) => {
        let aVal, bVal;
        
        switch (column) {
            case 'platform':
                aVal = a.platform.toLowerCase();
                bVal = b.platform.toLowerCase();
                break;
            case 'name':
                aVal = a.name.toLowerCase();
                bVal = b.name.toLowerCase();
                break;
            case 'type':
                aVal = a.type.toLowerCase();
                bVal = b.type.toLowerCase();
                break;
            case 'currentAmount':
                aVal = a.currentAmount;
                bVal = b.currentAmount;
                break;
            case 'amount':
                // 对于当前理财，取第一笔购买金额
                aVal = a.transactions && a.transactions.length > 0 ? a.transactions[0].amount : 0;
                bVal = b.transactions && b.transactions.length > 0 ? b.transactions[0].amount : 0;
                break;
            case 'expiryDate':
                // 对于当前理财，取第一笔交易的到期日期或周期类型
                aVal = a.transactions && a.transactions.length > 0 ? a.transactions[0].expiryDate : '';
                bVal = b.transactions && b.transactions.length > 0 ? b.transactions[0].expiryDate : '';
                // 空值处理
                if (!aVal) aVal = '';
                if (!bVal) bVal = '';
                // 日期字符串比较
                break;
            case 'totalBuyAmount':
                aVal = a.totalBuyAmount;
                bVal = b.totalBuyAmount;
                break;
            case 'totalRedeemAmount':
                aVal = a.totalRedeemAmount;
                bVal = b.totalRedeemAmount;
                break;
            case 'yieldRate':
                // 计算收益率
                const calculateYieldRate = (wealth) => {
                    // 准备现金流数据用于XIRR计算
                    const cashFlows = [];
                    if (wealth.transactions && Array.isArray(wealth.transactions)) {
                        wealth.transactions.forEach(transaction => {
                            const amount = transaction.type === 'buy' ? -transaction.amount : transaction.amount;
                            cashFlows.push({ date: transaction.date, amount: amount });
                        });
                    }
                    
                    let annualizedYield = 0;
                    if (cashFlows.length >= 2) {
                        try {
                            annualizedYield = calculateXIRR(cashFlows) * 100;
                        } catch (error) {
                            const profit = wealth.totalRedeemAmount - wealth.totalBuyAmount;
                            if (wealth.totalBuyAmount > 0) {
                                annualizedYield = (profit / wealth.totalBuyAmount) * 100;
                            }
                        }
                    }
                    return annualizedYield;
                };
                aVal = calculateYieldRate(a);
                bVal = calculateYieldRate(b);
                break;
            default:
                // 默认按日期排序
                aVal = new Date(a.transactions[0].date);
                bVal = new Date(b.transactions[0].date);
        }
        
        // 比较值
        if (aVal < bVal) {
            return order === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
            return order === 'asc' ? 1 : -1;
        }
        return 0;
    });
    
    // 重新渲染表格
    renderWealthTableSection(tableBodyId, wealthList, tableType, sortedWealth);
}

// 加载理财数据
async function loadWealth() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    try {
        const newWealthData = await window.dbManager.getAllByIndex(STORES.WEALTH, 'username', currentUser.username);
        currentWealth = newWealthData;
        window.currentWealth = currentWealth;
        
        if (document.getElementById('wealthNameOptions')) {
            updateWealthNameOptions();
        }
        
        if (document.getElementById('wealthPlatformOptions')) {
            updatePlatformOptions();
        }
    } catch (error) {
        console.error('加载理财数据失败:', error);
        currentWealth = [];
        window.currentWealth = currentWealth;
    }
}

// 更新购买平台选项列表
function updatePlatformOptions() {
    const platformOptions = document.getElementById('wealthPlatformOptions');
    
    // 获取所有唯一的购买平台名称
    const platforms = [...new Set(currentWealth.map(wealth => wealth.platform))];
    
    // 清空现有选项
    if (platformOptions) {
        platformOptions.innerHTML = '';
        
        // 添加新选项
        platforms.forEach(platform => {
            const option = document.createElement('option');
            option.value = platform;
            option.textContent = platform;
            platformOptions.appendChild(option);
        });
    }
}

// 更新产品名称选项列表
function updateWealthNameOptions() {
    const wealthNameOptions = document.getElementById('wealthNameOptions');
    
    // 检查元素是否存在
    if (!wealthNameOptions) {
        console.warn('Element with id wealthNameOptions not found');
        return;
    }
    
    // 获取所有唯一的产品名称
    const wealthNames = [...new Set(currentWealth.map(wealth => wealth.name))];
    
    // 清空现有选项
    wealthNameOptions.innerHTML = '';
    
    // 添加新选项
    wealthNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        wealthNameOptions.appendChild(option);
    });
}

// 处理产品类型选择变化
function handleWealthTypeChange() {
    const wealthType = document.getElementById('wealthType').value;
    const expiryDateContainer = document.getElementById('expiryDateContainer');
    const expiryDateInput = document.getElementById('wealthExpiryDate');
    
    if (wealthType === '封闭式') {
        // 封闭式（原定期）：显示到期日期
        expiryDateContainer.style.display = 'block';
        expiryDateInput.required = true;
    } else {
        // 其他类型（每日开放、最短持有期、定期开放式、固定天数循环、结构性周期）：隐藏到期日期
        expiryDateContainer.style.display = 'none';
        expiryDateInput.required = false;
        expiryDateInput.value = '';
    }
}

// 处理理财表单提交
async function handleWealthSubmit(e) {
    e.preventDefault();
    
    try {
        // 获取表单数据
        const platform = document.getElementById('wealthPlatform').value;
        const name = document.getElementById('wealthName').value;
        const type = document.getElementById('wealthType').value;
        let date = document.getElementById('wealthDate').value;
        // 处理浮点数精度问题，确保金额精确到小数点后两位
        const amount = parseFloat(parseFloat(document.getElementById('wealthAmount').value).toFixed(2));
        let expiryDate = document.getElementById('wealthExpiryDate').value;
        
        // 数据验证
        if (!platform) {
            alert('请填写购买平台');
            return;
        }
        if (!name) {
            alert('请填写产品名称');
            return;
        }
        if (isNaN(amount) || amount <= 0) {
            alert('请填写有效的购买金额');
            return;
        }
        if (!date) {
            alert('请填写购买日期');
            return;
        }
        
        // 格式化日期并验证
        date = window.formatDate(date);
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
            alert('请填写有效的购买日期');
            return;
        }
        
        // 处理到期日期
        if (type === '封闭式') {
            if (!expiryDate) {
                alert('请填写到期日期');
                return;
            }
            expiryDate = window.formatDate(expiryDate);
            const expiryDateObj = new Date(expiryDate);
            if (isNaN(expiryDateObj.getTime())) {
                alert('请填写有效的到期日期');
                return;
            }
            if (expiryDateObj < dateObj) {
                alert('到期日期不能早于购买日期');
                return;
            }
        } else {
            // 其他类型不需要到期日期
            expiryDate = null;
        }
        
        // 创建理财对象，添加用户名
        const wealthData = {
            platform,
            name,
            type,
            transactionType: 'buy', // 添加交易类型，购买时为'buy'
            redeemType: 'partial', // 添加赎回类型，默认为'partial'
            date,
            expiryDate,
            amount,
            redeemedAmount: 0, // 添加赎回金额，购买时为0
            username: getCurrentUser().username // 添加用户名，用于数据隔离
        };
        
        // 保存数据到数据库
        const response = await fetch('/api/wealth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(wealthData)
        });
        
        if (response.ok) {
            // 重新从数据库加载所有数据，确保数据一致性
            await window.loadWealth();
            
            // 更新平台选项列表
            updatePlatformOptions();
            // 更新产品名称选项列表
            updateWealthNameOptions();
            
            // 重新渲染表格
            await renderWealthTable();
            
            // 更新汇总信息
            if (window.updateSummary) {
                window.updateSummary();
            }
            // 更新最近动态
            if (window.updateRecentActivities) {
                window.updateRecentActivities();
            }
            
            // 清空表单
            e.target.reset();
            
            // 处理产品类型变化，确保到期日期输入框的显示状态正确
            handleWealthTypeChange();
            
            // 设置默认日期为今天
            const today = new Date();
            const formattedDate = today.toISOString().split('T')[0].replace(/-/g, '');
            document.getElementById('wealthDate').value = formattedDate;
            
            alert('理财添加成功！');
        }
    } catch (error) {
        console.error('添加理财失败:', error);
        // 添加更详细的错误信息
        if (error.response) {
            // 服务器返回了错误响应
            error.response.json().then(errorData => {
                console.error('服务器返回的错误:', errorData);
                alert(`添加理财失败: ${errorData.error || '服务器错误'}`);
            }).catch(parseError => {
                console.error('解析错误响应失败:', parseError);
                alert(`添加理财失败: 服务器返回错误 (${error.response.status})`);
            });
        } else if (error.request) {
            // 请求已发送但没有收到响应
            console.error('没有收到服务器响应:', error.request);
            alert('添加理财失败: 没有收到服务器响应，请检查网络连接');
        } else {
            // 请求配置时发生错误
            console.error('请求配置错误:', error.message);
            alert(`添加理财失败: ${error.message}`);
        }
    }
}

// 合并相同产品的理财记录
function mergeWealth() {
    const mergedWealth = [];
    
    // 按日期排序所有交易记录
    const sortedTransactions = [...currentWealth].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // 当前活跃批次映射，key根据产品类型生成
    // 每日开放：平台_产品名称_产品类型
    // 其他类型：平台_产品名称_产品类型
    const activeBatches = {};
    
    for (const transaction of sortedTransactions) {
        if (transaction.transactionType === 'buy') {
            // 每日开放和其他类型（除封闭式外）合并处理
            if (transaction.type === '每日开放' || transaction.type === '最短持有期' || transaction.type === '定期开放式' || transaction.type === '固定天数循环' || transaction.type === '结构性周期') {
                // 生成批次key：平台_产品名称_产品类型
                const key = `${transaction.platform}_${transaction.name}_${transaction.type}`;
                
                // 如果没有当前活跃批次，创建新批次
                if (!activeBatches[key]) {
                    activeBatches[key] = {
                        platform: transaction.platform,
                        name: transaction.name,
                        type: transaction.type,
                        transactions: [],
                        totalBuyAmount: 0,
                        totalRedeemAmount: 0,
                        currentAmount: 0,
                        status: 'active',
                        batchId: key
                    };
                    mergedWealth.push(activeBatches[key]);
                }
                
                // 添加购买记录到当前批次
                activeBatches[key].transactions.push({
                    id: transaction.id,
                    date: transaction.date,
                    type: transaction.transactionType,
                    amount: parseFloat(transaction.amount.toFixed(2)),
                    expiryDate: transaction.expiryDate,
                    redeemedAmount: parseFloat(transaction.redeemedAmount.toFixed(2))
                });
                
                // 更新批次金额
                activeBatches[key].totalBuyAmount = parseFloat((activeBatches[key].totalBuyAmount + transaction.amount).toFixed(2));
                activeBatches[key].currentAmount = parseFloat((activeBatches[key].totalBuyAmount - activeBatches[key].totalRedeemAmount).toFixed(2));
            } else {
                // 封闭式产品，每个购买记录都创建一个独立的批次
                // 为每个封闭式购买创建独立批次
                const newBatch = {
                    platform: transaction.platform,
                    name: transaction.name,
                    type: transaction.type,
                    transactions: [],
                    totalBuyAmount: 0,
                    totalRedeemAmount: 0,
                    currentAmount: 0,
                    status: 'active',
                    // 使用交易ID作为批次标识，确保唯一性
                    batchId: `${transaction.id}_${transaction.date}`
                };
                
                // 添加购买记录到新批次
                newBatch.transactions.push({
                    id: transaction.id,
                    date: transaction.date,
                    type: transaction.transactionType,
                    amount: parseFloat(transaction.amount.toFixed(2)),
                    expiryDate: transaction.expiryDate,
                    redeemedAmount: parseFloat(transaction.redeemedAmount.toFixed(2))
                });
                
                // 更新批次金额
                newBatch.totalBuyAmount = parseFloat((newBatch.totalBuyAmount + transaction.amount).toFixed(2));
                newBatch.currentAmount = parseFloat((newBatch.totalBuyAmount - newBatch.totalRedeemAmount).toFixed(2));
                
                // 添加到结果列表
                mergedWealth.push(newBatch);
            }
        } else if (transaction.transactionType === 'redeem') {
            // 处理赎回记录
            let foundBatch = null;
            
            // 查找对应的活跃批次
            for (const batch of mergedWealth) {
                if (batch.status === 'active' && 
                    batch.platform === transaction.platform && 
                    batch.name === transaction.name && 
                    batch.type === transaction.type) {
                    // 所有类型只需要匹配平台、名称、类型即可
                    foundBatch = batch;
                    break;
                }
            }
            
            if (foundBatch) {
                // 添加赎回记录到找到的批次
                foundBatch.transactions.push({
                    id: transaction.id,
                    date: transaction.date,
                    type: transaction.transactionType,
                    amount: parseFloat(transaction.amount.toFixed(2)),
                    expiryDate: transaction.expiryDate,
                    redeemedAmount: parseFloat(transaction.redeemedAmount.toFixed(2))
                });
                
                // 更新批次金额
                foundBatch.totalRedeemAmount = parseFloat((foundBatch.totalRedeemAmount + transaction.amount).toFixed(2));
                foundBatch.currentAmount = parseFloat((foundBatch.totalBuyAmount - foundBatch.totalRedeemAmount).toFixed(2));
                
                // 只根据是否使用全部赎回按钮来判断状态，不考虑持有金额
                if (transaction.redeemType === 'full') {
                    foundBatch.status = 'redeemed';
                    // 如果是每日开放或其他类型（除封闭式外），从活跃批次映射中移除
                    if (foundBatch.type === '每日开放' || foundBatch.type === '最短持有期' || foundBatch.type === '定期开放式' || foundBatch.type === '固定天数循环' || foundBatch.type === '结构性周期') {
                        const key = `${foundBatch.platform}_${foundBatch.name}_${foundBatch.type}`;
                        delete activeBatches[key];
                    }
                }
            } else {
                // 处理可能的异常情况，创建新批次存放赎回记录
                const processedAmount = parseFloat(transaction.amount.toFixed(2));
                const processedRedeemedAmount = parseFloat(transaction.redeemedAmount.toFixed(2));
                const redeemBatch = {
                    platform: transaction.platform,
                    name: transaction.name,
                    type: transaction.type,
                    transactions: [{
                        id: transaction.id,
                        date: transaction.date,
                        type: transaction.transactionType,
                        amount: processedAmount,
                        expiryDate: transaction.expiryDate,
                        redeemedAmount: processedRedeemedAmount
                    }],
                    totalBuyAmount: 0,
                    totalRedeemAmount: processedAmount,
                    currentAmount: -processedAmount,
                    status: 'redeemed',
                    batchId: `${transaction.platform}_${transaction.name}_${transaction.type}_${transaction.date}_redeem`
                };
                mergedWealth.push(redeemBatch);
            }
        }
    }
    
    return mergedWealth;
}

// 分组理财记录
function groupWealth() {
    let merged = mergeWealth();
    
    // 应用搜索过滤
    if (currentWealthSearchQuery) {
        merged = merged.filter(wealth => {
            const query = currentWealthSearchQuery.toLowerCase();
            return wealth.platform.toLowerCase().includes(query) ||
                   wealth.name.toLowerCase().includes(query) ||
                   wealth.type.toLowerCase().includes(query) ||
                   wealth.currentAmount.toString().includes(query) ||
                   wealth.totalBuyAmount.toString().includes(query) ||
                   wealth.totalRedeemAmount.toString().includes(query);
        });
    }
    
    const groups = {
        currentDemand: [], // 当前每日开放理财
        currentFixed: [],   // 当前其他类型理财
        historyDemand: [],  // 历史每日开放理财
        historyFixed: []    // 历史其他类型理财
    };
    
    merged.forEach(wealth => {
        // 根据产品类型和状态分组
        if (wealth.status === 'active') {
            if (wealth.type === '每日开放') {
                groups.currentDemand.push(wealth);
            } else {
                groups.currentFixed.push(wealth);
            }
        } else {
            if (wealth.type === '每日开放') {
                groups.historyDemand.push(wealth);
            } else {
                groups.historyFixed.push(wealth);
            }
        }
    });
    
    return groups;
}

// 处理理财搜索
function handleWealthSearch(e) {
    currentWealthSearchQuery = e.target.value.toLowerCase();
    renderWealthTable();
}

// 渲染理财表格
async function renderWealthTable() {
    const groups = groupWealth();
    
    // 合并所有当前理财数据（每日开放+其他类型）
    const allCurrentWealth = [...groups.currentDemand, ...groups.currentFixed];
    // 渲染当前理财表格
    await renderWealthTableSection('currentFundsBody', allCurrentWealth, 'current');
    
    // 合并所有历史理财数据（每日开放+其他类型）
    const allHistoryWealth = [...groups.historyDemand, ...groups.historyFixed];
    // 渲染历史理财表格
    await renderWealthTableSection('historyFundsBody', allHistoryWealth, 'history');
    
    // 更新理财汇总信息
    updateWealthSummary();
}

// 渲染单个表格
async function renderWealthTableSection(tableBodyId, wealthList, tableType, sortedWealth = null) {
    const maxAttempts = 50;
    let attempts = 0;
    let tbody = document.getElementById(tableBodyId);
    
    while (!tbody && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10));
        tbody = document.getElementById(tableBodyId);
        attempts++;
    }
    
    if (!tbody) {
        console.warn(`Element with id ${tableBodyId} not found after waiting`);
        return;
    }
    
    if (wealthList.length === 0) {
            let colspan = tableType === 'history' ? 7 : 8;
            tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center; color: #999; padding: 20px;">暂无数据</td></tr>`;
            
            // 移除展开/收起按钮（如果存在）
            const toggleBtnContainer = document.getElementById(`${tableBodyId}ToggleBtn`);
            if (toggleBtnContainer) {
                toggleBtnContainer.remove();
            }
            
            return;
        }
    
    // 使用传入的排序后数据或默认按日期倒序排序
    const finalSortedWealth = sortedWealth || [...wealthList].sort((a, b) => new Date(b.transactions[0].date) - new Date(a.transactions[0].date));
    
    // 生成表格行
    const generateTableRows = (wealths) => {
        return wealths.map(wealth => {
            // 格式化金额显示
            const formatAmount = (amount) => `¥${amount.toFixed(2)}`;
            
            // 计算收益率（仅历史理财）
            let yieldRate = 0;
            if (tableType === 'history') {
                // 获取第一次购买日期
                let firstBuy = null;
                let lastRedeem = null;
                if (wealth.transactions && Array.isArray(wealth.transactions)) {
                    firstBuy = wealth.transactions
                        .filter(t => t.type === 'buy')
                        .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
                    
                    if (firstBuy) {
                        // 获取最后一次赎回日期
                        lastRedeem = wealth.transactions
                            .filter(t => t.type === 'redeem')
                            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                        
                        if (lastRedeem) {
                            const buyDate = new Date(firstBuy.date);
                            const redeemDate = new Date(lastRedeem.date);
                            // 精确计算天数，当天存入当天取出为0天
                            const timeDiff = redeemDate - buyDate;
                            const daysHeld = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
                            yieldRate = calculateYield(wealth.totalBuyAmount, wealth.totalRedeemAmount, daysHeld);
                        }
                    }
                }
            }
            
            // 当前理财表格行
            if (tableType === 'current') {
                // 按日期排序所有交易记录
                let sortedTransactions = [];
                if (wealth.transactions && Array.isArray(wealth.transactions)) {
                    sortedTransactions = [...wealth.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
                }
                
                // 分离购买和赎回记录
                const buyTransactions = sortedTransactions.filter(t => t.type === 'buy');
                
                // 产品类型显示
                let typeDisplay = wealth.type;
                
                // 确定到期日期列显示内容
                let expiryOrCycleDisplay = '';
                if (wealth.type === '封闭式') {
                    expiryOrCycleDisplay = buyTransactions[0] ? buyTransactions[0].expiryDate : '';
                } else {
                    // 其他类型始终显示"-"
                    expiryOrCycleDisplay = '-';
                }
                
                // 每日开放理财不显示多行记录，只显示一行
                if (wealth.type === '每日开放' || buyTransactions.length <= 1) {
                    // 只显示一行记录，删除购买金额列
                    return `
                        <tr>
                            <td>${wealth.platform}</td>
                            <td>${wealth.name}</td>
                            <td>${typeDisplay}</td>
                            <td class="amount">${formatAmount(wealth.currentAmount)}</td>
                            <td>${expiryOrCycleDisplay}</td>
                            <td>
                                <button class="btn btn-small btn-secondary" onclick="viewWealthTransactions(${JSON.stringify(wealth).replace(/"/g, '&quot;')})">查看详情</button>
                            </td>
                            <td>
                                <button class="btn btn-small btn-buy" onclick="addPurchaseWealth(${JSON.stringify(wealth).replace(/"/g, '&quot;')})">购买</button>
                                <button class="btn btn-small btn-primary" onclick="partialRedeemWealth(${JSON.stringify(wealth).replace(/"/g, '&quot;')})">部分赎回</button>
                                <button class="btn btn-small btn-danger" onclick="fullRedeemWealth(${JSON.stringify(wealth).replace(/"/g, '&quot;')})">全部赎回</button>
                                <button class="btn btn-small btn-secondary" onclick="calculateYieldModalWealth(${JSON.stringify(wealth).replace(/"/g, '&quot;')})">试算收益</button>
                            </td>
                        </tr>
                    `;
                } else {
                    // 非每日开放且有多笔交易，显示多行记录，删除购买金额列
                    // 确定最大记录数（只考虑购买记录）
                    const maxRows = buyTransactions.length;
                    
                    // 生成多行表格
                    let rowsHtml = '';
                    
                    for (let i = 0; i < maxRows; i++) {
                        const buy = buyTransactions[i];
                        
                        // 第一行显示产品基本信息，后续行只显示交易记录
                        if (i === 0) {
                            rowsHtml += `
                                <tr>
                                    <td rowspan="${maxRows}">${wealth.platform}</td>
                                    <td rowspan="${maxRows}">${wealth.name}</td>
                                    <td rowspan="${maxRows}">${typeDisplay}</td>
                                    <td class="amount" rowspan="${maxRows}">${formatAmount(wealth.currentAmount)}</td>
                                    <td>${expiryOrCycleDisplay}</td>
                                    <td rowspan="${maxRows}">
                                        <button class="btn btn-small btn-secondary" onclick="viewWealthTransactions(${JSON.stringify(wealth).replace(/"/g, '&quot;')})">查看详情</button>
                                    </td>
                                    <td rowspan="${maxRows}">
                                        <button class="btn btn-small btn-buy" onclick="addPurchaseWealth(${JSON.stringify(wealth).replace(/"/g, '&quot;')})">购买</button>
                                        <button class="btn btn-small btn-primary" onclick="partialRedeemWealth(${JSON.stringify(wealth).replace(/"/g, '&quot;')})">部分赎回</button>
                                        <button class="btn btn-small btn-danger" onclick="fullRedeemWealth(${JSON.stringify(wealth).replace(/"/g, '&quot;')})">全部赎回</button>
                                        <button class="btn btn-small btn-secondary" onclick="calculateYieldModalWealth(${JSON.stringify(wealth).replace(/"/g, '&quot;')})">试算收益</button>
                                    </td>
                                </tr>
                            `;
                        } else {
                            // 后续行显示交易记录，删除购买金额列
                            rowsHtml += `
                                <tr>
                                    <td>${expiryOrCycleDisplay}</td>
                                    <td></td>
                                    <td></td>
                                </tr>
                            `;
                        }
                    }
                    
                    return rowsHtml;
                }
            }
            // 历史理财表格行
            else {
                // 准备现金流数据用于XIRR计算
                const cashFlows = [];
                
                // 添加所有交易记录
                if (wealth.transactions && Array.isArray(wealth.transactions)) {
                    wealth.transactions.forEach(transaction => {
                        const amount = transaction.type === 'buy' ? -transaction.amount : transaction.amount;
                        cashFlows.push({
                            date: transaction.date,
                            amount: amount
                        });
                    });
                }
                
                // 计算XIRR
                let annualizedYield = 0;
                if (cashFlows.length >= 2) {
                    try {
                        annualizedYield = calculateXIRR(cashFlows) * 100;
                    } catch (error) {
                        // XIRR计算失败时使用简单收益率
                        const profit = wealth.totalRedeemAmount - wealth.totalBuyAmount;
                        if (wealth.totalBuyAmount > 0) {
                            // 简单年化收益率
                            // 获取第一次购买日期和最后一次赎回日期
                            let firstBuy = null;
                            let lastRedeem = null;
                            if (wealth.transactions && Array.isArray(wealth.transactions)) {
                                firstBuy = wealth.transactions
                                    .filter(t => t.type === 'buy')
                                    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
                                lastRedeem = wealth.transactions
                                    .filter(t => t.type === 'redeem')
                                    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                            }
                            
                            if (firstBuy && lastRedeem) {
                                const buyDate = new Date(firstBuy.date);
                                const redeemDate = new Date(lastRedeem.date);
                                // 精确计算天数，当天存入当天取出为0天
                                const timeDiff = redeemDate - buyDate;
                                const daysHeld = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
                                annualizedYield = calculateYield(wealth.totalBuyAmount, wealth.totalRedeemAmount, daysHeld);
                            } else {
                                // 无法计算持有天数时，使用简单收益率
                                annualizedYield = (profit / wealth.totalBuyAmount) * 100;
                            }
                        }
                    }
                }
                
                // 获取周期类型信息
                let typeDisplay = wealth.type;
                if (wealth.type === '最短持有期' || wealth.type === '定期开放式' || wealth.type === '固定天数循环' || wealth.type === '结构性周期') {
                    // 直接使用财富对象中的周期类型
                    const cycleType = wealth.cycleType;
                    if (cycleType) {
                        typeDisplay = `${wealth.type} (${cycleType})`;
                    }
                }
                
                return `
                    <tr>
                        <td>${wealth.platform}</td>
                        <td>${wealth.name}</td>
                        <td>${typeDisplay}</td>
                        <td class="amount">${formatAmount(wealth.totalBuyAmount)}</td>
                        <td class="transfer-out">${formatAmount(wealth.totalRedeemAmount)}</td>
                        <td>${annualizedYield.toFixed(2)}%</td>
                        <td>
                            <button class="btn btn-small btn-secondary" onclick="viewWealthTransactions(${JSON.stringify(wealth).replace(/"/g, '&quot;')})">查看交易记录</button>
                        </td>
                    </tr>
                `;
            }
        }).join('');
    };
    
    // 生成表格行
    const tableRows = generateTableRows(finalSortedWealth);
    
    // 添加表格内容到tbody
    tbody.innerHTML = tableRows;
    
    // 为历史理财表格添加展开/收起按钮（仅历史理财）
    if (tableType === 'history') {
        // 默认显示最近10条记录
        const DEFAULT_DISPLAY_COUNT = 10;
        
        // 如果记录数超过默认显示数量，添加展开/收起按钮
        if (finalSortedWealth.length > DEFAULT_DISPLAY_COUNT) {
            // 移除旧的按钮容器（如果存在）
            const oldToggleBtnContainer = document.getElementById(`${tableBodyId}ToggleBtn`);
            if (oldToggleBtnContainer) {
                oldToggleBtnContainer.remove();
            }
            
            // 默认只显示前10条记录
            tbody.innerHTML = generateTableRows(finalSortedWealth.slice(0, DEFAULT_DISPLAY_COUNT));
            
            // 在表格内部添加展开/收起按钮行，使用colspan跨所有列
            const toggleRow = document.createElement('tr');
            toggleRow.id = `${tableBodyId}ToggleRow`;
            toggleRow.innerHTML = `
                <td colspan="10" style="text-align: center; padding: 10px; background-color: #f5f5f5;">
                    <button class="btn btn-small btn-primary" onclick="toggleWealthHistory('${tableBodyId}', ${JSON.stringify(finalSortedWealth).replace(/"/g, '&quot;')}, ${DEFAULT_DISPLAY_COUNT})")">
                        点击展开（共${finalSortedWealth.length}条记录）
                    </button>
                </td>
            `;
            tbody.appendChild(toggleRow);
        } else {
            // 移除旧的按钮容器（如果存在）
            const oldToggleBtnContainer = document.getElementById(`${tableBodyId}ToggleBtn`);
            if (oldToggleBtnContainer) {
                oldToggleBtnContainer.remove();
            }
            // 移除表格内部的按钮行（如果存在）
            const toggleRow = document.getElementById(`${tableBodyId}ToggleRow`);
            if (toggleRow) {
                toggleRow.remove();
            }
        }
    } else {
        // 非历史理财表格，移除展开/收起按钮（如果存在）
        const toggleBtnContainer = document.getElementById(`${tableBodyId}ToggleBtn`);
        if (toggleBtnContainer) {
            toggleBtnContainer.remove();
        }
    }
}

// 切换历史理财列表的显示状态
function toggleWealthHistory(tableBodyId, sortedWealth, defaultDisplayCount) {
    const tbody = document.getElementById(tableBodyId);
    let toggleBtn;
    
    // 尝试从表格内的按钮行中查找按钮
    const toggleRow = document.getElementById(`${tableBodyId}ToggleRow`);
    if (toggleRow) {
        toggleBtn = toggleRow.querySelector('button');
    }
    
    if (!tbody || !toggleBtn) return;
    
    // 检查当前是否已展开
    const isExpanded = toggleBtn.textContent.includes('收起');
    
    // 生成表格行的辅助函数
    const generateTableRows = (wealths) => {
        return wealths.map(wealth => {
            // 格式化金额显示
            const formatAmount = (amount) => `¥${amount.toFixed(2)}`;
            
            // 准备现金流数据用于XIRR计算
            const cashFlows = [];
            
            // 添加所有交易记录
            if (wealth.transactions && Array.isArray(wealth.transactions)) {
                wealth.transactions.forEach(transaction => {
                    const amount = transaction.type === 'buy' ? -transaction.amount : transaction.amount;
                    cashFlows.push({
                        date: transaction.date,
                        amount: amount
                    });
                });
            }
            
            // 计算XIRR
            let annualizedYield = 0;
            if (cashFlows.length >= 2) {
                try {
                    annualizedYield = calculateXIRR(cashFlows) * 100;
                } catch (error) {
                    // XIRR计算失败时使用简单收益率
                    const profit = wealth.totalRedeemAmount - wealth.totalBuyAmount;
                    if (wealth.totalBuyAmount > 0) {
                        // 简单年化收益率
                        // 获取第一次购买日期和最后一次赎回日期
                        let firstBuy = null;
                        let lastRedeem = null;
                        if (wealth.transactions && Array.isArray(wealth.transactions)) {
                            firstBuy = wealth.transactions
                                .filter(t => t.type === 'buy')
                                .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
                            lastRedeem = wealth.transactions
                                .filter(t => t.type === 'redeem')
                                .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                        }
                        
                        if (firstBuy && lastRedeem) {
                            const buyDate = new Date(firstBuy.date);
                            const redeemDate = new Date(lastRedeem.date);
                            // 精确计算天数，当天存入当天取出为0天
                            const timeDiff = redeemDate - buyDate;
                            const daysHeld = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
                            annualizedYield = calculateYield(wealth.totalBuyAmount, wealth.totalRedeemAmount, daysHeld);
                        } else {
                            // 无法计算持有天数时，使用简单收益率
                            annualizedYield = (profit / wealth.totalBuyAmount) * 100;
                        }
                    }
                }
            }
            
            // 产品类型显示
            let typeDisplay = wealth.type;
            
            // 历史理财表格行
            return `
                <tr>
                    <td>${wealth.platform}</td>
                    <td>${wealth.name}</td>
                    <td>${typeDisplay}</td>
                    <td>${formatAmount(wealth.totalBuyAmount)}</td>
                    <td class="transfer-out">${formatAmount(wealth.totalRedeemAmount)}</td>
                    <td>${annualizedYield.toFixed(2)}%</td>
                    <td>
                        <button class="btn btn-small btn-secondary" onclick="viewWealthTransactions(${JSON.stringify(wealth).replace(/"/g, '&quot;')})">查看交易记录</button>
                    </td>
                </tr>
            `;
        }).join('');
    };
    
    if (isExpanded) {
        // 收起：只显示前10条记录
        tbody.innerHTML = generateTableRows(sortedWealth.slice(0, defaultDisplayCount));
        
        // 重新添加展开/收起按钮行
        const newToggleRow = document.createElement('tr');
        newToggleRow.id = `${tableBodyId}ToggleRow`;
        newToggleRow.innerHTML = `
            <td colspan="10" style="text-align: center; padding: 10px; background-color: #f5f5f5;">
                <button class="btn btn-small btn-primary" onclick="toggleWealthHistory('${tableBodyId}', ${JSON.stringify(sortedWealth).replace(/"/g, '&quot;')}, ${defaultDisplayCount})">
                    点击展开（共${sortedWealth.length}条记录）
                </button>
            </td>
        `;
        tbody.appendChild(newToggleRow);
    } else {
        // 展开：显示所有记录
        tbody.innerHTML = generateTableRows(sortedWealth);
        
        // 重新添加展开/收起按钮行
        const newToggleRow = document.createElement('tr');
        newToggleRow.id = `${tableBodyId}ToggleRow`;
        newToggleRow.innerHTML = `
            <td colspan="10" style="text-align: center; padding: 10px; background-color: #f5f5f5;">
                <button class="btn btn-small btn-primary" onclick="toggleWealthHistory('${tableBodyId}', ${JSON.stringify(sortedWealth).replace(/"/g, '&quot;')}, ${defaultDisplayCount})">
                    点击收起
                </button>
            </td>
        `;
        tbody.appendChild(newToggleRow);
    }
}

// 保存理财数据
async function saveWealthData() {
    try {
        for (let i = 0; i < currentWealth.length; i++) {
            const wealth = currentWealth[i];
            const result = await window.dbManager.save(STORES.WEALTH, wealth);
            // 如果返回了id，保存到wealth对象中
            if (result && result.id) {
                currentWealth[i].id = result.id;
            }
        }
    } catch (error) {
        console.error('保存理财数据失败:', error);
        throw error;
    }
}

// 部分赎回模态框
function showPartialRedeemWealthModal(wealth) {
    // 创建模态框元素
    let modal = document.getElementById('partialRedeemWealthModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'partialRedeemWealthModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>部分赎回</h2>
                <div class="form-group">
                    <label for="redeemDate">赎回日期:</label>
                    <input type="text" id="redeemDate" placeholder="格式：YYYYMMDD" required>
                </div>
                <div class="form-group">
                    <label for="redeemAmount">赎回金额:</label>
                    <input type="number" id="redeemAmount" step="0.01" placeholder="请输入赎回金额" required>
                </div>
                <div id="partialRedeemWealthStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="partialRedeemWealthConfirmBtn" class="btn btn-primary">确认赎回</button>
                    <button id="partialRedeemWealthCancelBtn" class="btn btn-secondary">取消</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 添加样式
        modal.style.cssText = `
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            justify-content: center;
            align-items: center;
        `;
    }
    
    // 设置默认日期为今天
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    document.getElementById('redeemDate').value = today;
    document.getElementById('redeemAmount').value = '';
    document.getElementById('partialRedeemWealthStatus').textContent = '';
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 返回Promise，等待用户确认
    return new Promise((resolve) => {
        const confirmBtn = document.getElementById('partialRedeemWealthConfirmBtn');
        const cancelBtn = document.getElementById('partialRedeemWealthCancelBtn');
        
        // 确认按钮事件
        const handleConfirm = async () => {
            // 使用模态框元素的querySelector确保只获取当前模态框中的元素
            const redeemDate = modal.querySelector('#redeemDate').value;
            const redeemAmount = parseFloat(modal.querySelector('#redeemAmount').value);
            const statusEl = modal.querySelector('#partialRedeemWealthStatus');
            
            // 验证输入
            if (!redeemDate || isNaN(redeemAmount)) {
                statusEl.textContent = '请填写完整的赎回信息';
                return;
            }
            
            // 移除赎回金额不能超过当前持有金额的限制
            
            // 格式化日期
            const formattedDate = window.formatDate(redeemDate);
            
            modal.style.display = 'none';
            resolve({ date: formattedDate, amount: redeemAmount });
        };
        
        // 取消按钮事件
        const handleCancel = () => {
            modal.style.display = 'none';
            resolve(null);
        };
        
        // 移除之前的事件监听器
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        
        // 添加新的事件监听器
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        
        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                resolve(null);
            }
        });
        
        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                modal.style.display = 'none';
                resolve(null);
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    });
}

// 部分赎回功能
async function partialRedeemWealth(wealth) {
    const result = await showPartialRedeemWealthModal(wealth);
    if (!result) return;
    
    try {
        // 创建赎回记录
            const redeemRecord = {
                platform: wealth.platform,
                name: wealth.name,
                type: wealth.type,
                transactionType: 'redeem',
                redeemType: 'partial',
                date: result.date,
                expiryDate: wealth.transactions && Array.isArray(wealth.transactions) && wealth.transactions.length > 0 ? wealth.transactions[0].expiryDate : '',
                amount: result.amount,
                redeemedAmount: result.amount,
                cycleType: wealth.transactions && Array.isArray(wealth.transactions) && wealth.transactions.length > 0 ? wealth.transactions[0].cycleType : '',
                username: getCurrentUser().username
            };
        
        // 保存到数据库
        const response = await fetch('/api/wealth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(redeemRecord)
        });
        
        if (response.ok) {
            // 重新加载数据，使用wealth.js中定义的loadWealth函数
            await window.loadWealth();
            renderWealthTable();
            updatePlatformOptions();
            alert('部分赎回成功！');
        }
    } catch (error) {
        console.error('部分赎回失败:', error);
        alert('部分赎回失败，请重试！');
    }
}

// 全部赎回模态框
function showFullRedeemWealthModal(wealth) {
    // 创建模态框元素
    let modal = document.getElementById('fullRedeemWealthModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fullRedeemWealthModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>全部赎回</h2>
                <p>您确定要全部赎回该产品吗？赎回后将移至历史理财列表。</p>
                <div class="form-group">
                    <label for="fullRedeemDate">赎回日期:</label>
                    <input type="text" id="fullRedeemDate" placeholder="格式：YYYYMMDD" required>
                </div>
                <div class="form-group">
                    <label for="fullRedeemAmount">赎回金额:</label>
                    <input type="number" id="fullRedeemAmount" step="0.01" required>
                </div>
                <div class="form-group">
                    <label for="fullRedeemConfirm">请输入 "全部赎回" 以确认:</label>
                    <input type="text" id="fullRedeemConfirm" placeholder="请输入确认文本">
                </div>
                <div id="fullRedeemWealthStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="fullRedeemWealthConfirmBtn" class="btn btn-danger">确认全部赎回</button>
                    <button id="fullRedeemWealthCancelBtn" class="btn btn-secondary">取消</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 添加样式
        modal.style.cssText = `
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            justify-content: center;
            align-items: center;
        `;
    }
    
    // 设置默认值
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    modal.querySelector('#fullRedeemDate').value = today;
    modal.querySelector('#fullRedeemAmount').value = '';
    modal.querySelector('#fullRedeemConfirm').value = '';
    modal.querySelector('#fullRedeemWealthStatus').textContent = '';
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 返回Promise，等待用户确认
    return new Promise((resolve) => {
        const confirmBtn = document.getElementById('fullRedeemWealthConfirmBtn');
        const cancelBtn = document.getElementById('fullRedeemWealthCancelBtn');
        
        // 确认按钮事件
        const handleConfirm = async () => {
            // 使用模态框元素的querySelector确保只获取当前模态框中的元素
            const redeemDate = modal.querySelector('#fullRedeemDate').value;
            const redeemAmount = parseFloat(modal.querySelector('#fullRedeemAmount').value);
            const confirmText = modal.querySelector('#fullRedeemConfirm').value;
            const statusEl = modal.querySelector('#fullRedeemWealthStatus');
            
            // 验证输入
            if (!redeemDate || isNaN(redeemAmount)) {
                statusEl.textContent = '请填写完整的赎回信息';
                return;
            }
            
            if (confirmText !== '全部赎回') {
                statusEl.textContent = '请输入正确的确认文本';
                return;
            }
            
            // 移除赎回金额不能超过当前持有金额的限制
            
            // 格式化日期
            const formattedDate = formatDate(redeemDate);
            
            modal.style.display = 'none';
            resolve({ date: formattedDate, amount: redeemAmount });
        };
        
        // 取消按钮事件
        const handleCancel = () => {
            modal.style.display = 'none';
            resolve(null);
        };
        
        // 移除之前的事件监听器
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        
        // 添加新的事件监听器
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        
        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                resolve(null);
            }
        });
        
        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                modal.style.display = 'none';
                resolve(null);
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    });
}

// 全部赎回功能
async function fullRedeemWealth(wealth) {
    const result = await showFullRedeemWealthModal(wealth);
    if (!result) return;
    
    try {
        // 创建赎回记录
            const redeemRecord = {
                platform: wealth.platform,
                name: wealth.name,
                type: wealth.type,
                transactionType: 'redeem',
                redeemType: 'full',
                date: result.date,
                expiryDate: wealth.transactions && Array.isArray(wealth.transactions) && wealth.transactions.length > 0 ? wealth.transactions[0].expiryDate : '',
                amount: result.amount,
                redeemedAmount: result.amount,
                cycleType: wealth.transactions && Array.isArray(wealth.transactions) && wealth.transactions.length > 0 ? wealth.transactions[0].cycleType : '',
                username: getCurrentUser().username
            };
        
        // 保存到数据库
        const response = await fetch('/api/wealth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(redeemRecord)
        });
        
        if (response.ok) {
            // 重新加载数据
            await window.loadWealth();
            renderWealthTable();
            updatePlatformOptions();
            alert('全部赎回成功！该产品已移至历史理财列表。');
        }
    } catch (error) {
        console.error('全部赎回失败:', error);
        alert('全部赎回失败，请重试！');
    }
}

// 收益率计算模态框
function showYieldCalculationWealthModal(wealth) {
    // 创建模态框元素
    let modal = document.getElementById('yieldCalculationWealthModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'yieldCalculationWealthModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>试算收益率</h2>
                <div class="form-group">
                    <label for="calculationAmount">可提取金额:</label>
                    <input type="number" id="calculationAmount" step="0.01" placeholder="请输入可提取金额">
                </div>
                <div id="yieldResult" style="margin: 15px 0; padding: 10px; background-color: #f0f0f0;"></div>
                <div id="yieldCalculationWealthStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="calculateYieldWealthBtn" class="btn btn-primary">计算收益率</button>
                    <button id="closeYieldWealthModalBtn" class="btn btn-secondary">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 添加样式
        modal.style.cssText = `
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            justify-content: center;
            align-items: center;
        `;
    }
    
    // 重置内容
    document.getElementById('calculationAmount').value = '';
    document.getElementById('yieldResult').innerHTML = '';
    document.getElementById('yieldCalculationWealthStatus').textContent = '';
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 返回Promise，等待用户操作
    return new Promise((resolve) => {
        const calculateBtn = document.getElementById('calculateYieldWealthBtn');
        const closeBtn = document.getElementById('closeYieldWealthModalBtn');
        
        // 计算按钮事件
        const handleCalculate = (e) => {
            e.stopPropagation(); // 阻止事件冒泡，防止模态框关闭
            
            const calculationAmount = parseFloat(document.getElementById('calculationAmount').value);
            const resultEl = document.getElementById('yieldResult');
            const statusEl = document.getElementById('yieldCalculationWealthStatus');
            
            // 验证输入
            if (isNaN(calculationAmount) || calculationAmount <= 0) {
                statusEl.textContent = '请输入有效的可提取金额';
                return;
            }
            
            // 获取第一次购买日期
            let firstBuy = null;
            if (wealth.transactions && Array.isArray(wealth.transactions)) {
                firstBuy = wealth.transactions
                    .filter(t => t.type === 'buy')
                    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
            }
            
            if (!firstBuy) {
                statusEl.textContent = '无法获取购买记录';
                return;
            }
            
            // 计算持有天数（截至今天）
            const buyDate = new Date(firstBuy.date);
            const todayDate = new Date();
            // 精确计算天数，当天存入当天取出为0天
            const timeDiff = todayDate - buyDate;
            const daysHeld = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
            
            // 总赎回金额 = 已赎回金额 + 可提取金额
            const totalRedeemAmount = wealth.totalRedeemAmount + calculationAmount;
            
            // 准备现金流数据用于XIRR计算
            const cashFlows = [];
            
            // 添加所有历史交易记录
            if (wealth.transactions && Array.isArray(wealth.transactions)) {
                wealth.transactions.forEach(transaction => {
                    const amount = transaction.type === 'buy' ? -transaction.amount : transaction.amount;
                    cashFlows.push({
                        date: transaction.date,
                        amount: amount
                    });
                });
            }
            
            // 添加用户输入的可提取金额作为新的赎回记录（今天）
            const today = new Date().toISOString().split('T')[0];
            cashFlows.push({
                date: today,
                amount: calculationAmount
            });
            
            // 计算XIRR
            let annualizedYield = 0;
            if (cashFlows.length >= 2) {
                try {
                    annualizedYield = calculateXIRR(cashFlows) * 100;
                } catch (error) {
                    // XIRR计算失败时使用简单收益率
                    console.error('XIRR计算失败:', error);
                    const yieldRate = calculateYield(wealth.totalBuyAmount, totalRedeemAmount, daysHeld);
                    annualizedYield = yieldRate;
                }
            }
            
            // 显示结果
            resultEl.innerHTML = `
                <h4>计算结果</h4>
                <p>总购买金额：¥${wealth.totalBuyAmount.toFixed(2)}</p>
                <p>已赎回金额：¥${wealth.totalRedeemAmount.toFixed(2)}</p>
                <p>可提取金额：¥${calculationAmount.toFixed(2)}</p>
                <p>持有天数：${daysHeld}天</p>
                <p>预计年化收益率：<strong>${annualizedYield.toFixed(2)}%</strong></p>
            `;
            
            statusEl.textContent = '';
        };
        
        // 关闭按钮事件
        const handleClose = () => {
            modal.style.display = 'none';
            resolve();
        };
        
        // 移除之前的事件监听器
        calculateBtn.removeEventListener('click', handleCalculate);
        closeBtn.removeEventListener('click', handleClose);
        
        // 添加新的事件监听器
        calculateBtn.addEventListener('click', handleCalculate);
        closeBtn.addEventListener('click', handleClose);
        
        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                resolve();
            }
        });
        
        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                modal.style.display = 'none';
                resolve();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    });
}

// 收益率计算功能
async function calculateYieldModalWealth(wealth) {
    await showYieldCalculationWealthModal(wealth);
}

// 购买弹窗
function showAddPurchaseWealthModal(wealth) {
    // 创建模态框元素
    let modal = document.getElementById('addPurchaseWealthModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'addPurchaseWealthModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>购买</h2>
                <div class="form-group">
                    <label for="purchaseDate">购买日期:</label>
                    <input type="text" id="purchaseDate" placeholder="格式：YYYYMMDD" required>
                </div>
                <div class="form-group" id="expiryDateGroup" style="display: none;">
                    <label for="purchaseExpiryDate">到期日期:</label>
                    <input type="text" id="purchaseExpiryDate" placeholder="格式：YYYYMMDD">
                </div>
                <div class="form-group">
                    <label for="purchaseAmount">购买金额:</label>
                    <input type="number" id="purchaseAmount" step="0.01" placeholder="请输入购买金额" required>
                </div>
                <div id="addPurchaseWealthStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="addPurchaseWealthConfirmBtn" class="btn btn-primary">确认购买</button>
                    <button id="addPurchaseWealthCancelBtn" class="btn btn-secondary">取消</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 添加样式
        modal.style.cssText = `
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            justify-content: center;
            align-items: center;
        `;
    }
    
    // 设置默认日期为今天
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    modal.querySelector('#purchaseDate').value = today;
    modal.querySelector('#purchaseAmount').value = '';
    modal.querySelector('#addPurchaseWealthStatus').textContent = '';
    
    // 根据产品类型显示/隐藏到期日期输入框
    const expiryDateGroup = modal.querySelector('#expiryDateGroup');
    const expiryDateInput = modal.querySelector('#purchaseExpiryDate');
    if (wealth.type === '封闭式') {
        expiryDateGroup.style.display = 'block';
        expiryDateInput.required = true;
        expiryDateInput.value = '';
    } else {
        expiryDateGroup.style.display = 'none';
        expiryDateInput.required = false;
        expiryDateInput.value = '';
    }
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 返回Promise，等待用户确认
    return new Promise((resolve) => {
        const confirmBtn = document.getElementById('addPurchaseWealthConfirmBtn');
        const cancelBtn = document.getElementById('addPurchaseWealthCancelBtn');
        
        // 确认按钮事件
        const handleConfirm = async () => {
            // 使用模态框元素的querySelector确保只获取当前模态框中的元素
            const purchaseDate = modal.querySelector('#purchaseDate').value;
            const purchaseAmount = parseFloat(modal.querySelector('#purchaseAmount').value);
            const expiryDate = modal.querySelector('#purchaseExpiryDate').value;
            const statusEl = modal.querySelector('#addPurchaseWealthStatus');
            
            // 验证输入
            if (!purchaseDate || isNaN(purchaseAmount)) {
                statusEl.textContent = '请填写完整的购买信息';
                return;
            }
            
            // 封闭式产品需要验证到期日期
            if (wealth.type === '封闭式' && !expiryDate) {
                statusEl.textContent = '请填写到期日期';
                return;
            }
            
            // 格式化日期
            const formattedDate = window.formatDate(purchaseDate);
            const formattedExpiryDate = expiryDate ? window.formatDate(expiryDate) : '';
            
            modal.style.display = 'none';
            resolve({ date: formattedDate, amount: purchaseAmount, expiryDate: formattedExpiryDate });
        };
        
        // 取消按钮事件
        const handleCancel = () => {
            modal.style.display = 'none';
            resolve(null);
        };
        
        // 移除之前的事件监听器
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        
        // 添加新的事件监听器
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        
        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                resolve(null);
            }
        });
        
        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                modal.style.display = 'none';
                resolve(null);
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    });
}

// 购买处理函数
async function addPurchaseWealth(wealth) {
    const result = await showAddPurchaseWealthModal(wealth);
    if (!result) return;
    
    try {
        // 创建购买记录
        const purchaseRecord = {
            platform: wealth.platform,
            name: wealth.name,
            type: wealth.type,
            transactionType: 'buy',
            redeemType: 'partial',
            date: result.date,
            expiryDate: result.expiryDate || (wealth.transactions && Array.isArray(wealth.transactions) && wealth.transactions.length > 0 ? wealth.transactions[0].expiryDate : ''),
            amount: result.amount,
            redeemedAmount: 0,
            username: getCurrentUser().username
        };
        
        // 保存到数据库
        const response = await fetch('/api/wealth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(purchaseRecord)
        });
        
        if (response.ok) {
            // 重新加载数据，使用wealth.js中定义的loadWealth函数
            await window.loadWealth();
            renderWealthTable();
            updatePlatformOptions();
            alert('购买成功！');
        }
    } catch (error) {
        console.error('购买失败:', error);
        alert('购买失败，请重试！');
    }
}

// 查看交易记录
function viewWealthTransactions(wealth) {
    // 创建模态框元素
    let modal = document.getElementById('viewWealthTransactionsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'viewWealthTransactionsModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-height: 80vh; overflow-y: auto; max-width: 800px; width: 95vw; box-sizing: border-box; padding: 15px;">
                <h2>交易记录详情</h2>
                <div id="wealthTransactionDetailsContent"></div>
                <div class="form-actions" style="margin-top: 20px;">
                    <button id="closeWealthTransactionsModalBtn" class="btn btn-secondary">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 添加样式
        modal.style.cssText = `
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            justify-content: center;
            align-items: center;
        `;
    }
    
    // 渲染交易记录
    const contentEl = document.getElementById('wealthTransactionDetailsContent');
    const formatAmount = (amount) => {
        if (amount === undefined || amount === null) {
            return '¥0.00';
        }
        return `¥${parseFloat(amount).toFixed(2)}`;
    };
    
    // 按日期排序交易记录
    let sortedTransactions = [];
    if (wealth.transactions && Array.isArray(wealth.transactions)) {
        sortedTransactions = [...wealth.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    } else {
        sortedTransactions = [];
    }
    
    // 显示操作列，与当前理财的查看详情弹窗一致
    const showActions = true;
    
    // 计算总购买金额和总赎回金额，确保它们是数字
    const totalBuyAmount = wealth.totalBuyAmount || 0;
    const totalRedeemAmount = wealth.totalRedeemAmount || 0;
    
    // 获取产品的到期日期
    let expiryDateInfo = '';
    if (wealth.transactions && Array.isArray(wealth.transactions) && wealth.transactions.length > 0) {
        const firstTransaction = wealth.transactions[0];
        if (wealth.type === '封闭式') {
            expiryDateInfo = `<div><strong>到期日期:</strong> ${firstTransaction.expiryDate || '未设置'}</div>`;
        }
    }
    
    contentEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
            <h3 style="margin: 0; flex: 1;">${wealth.platform} - ${wealth.name}</h3>
            <button class="btn btn-small btn-edit" onclick="editWealthProductName('${wealth.platform}', '${wealth.name}', '${wealth.type}')">编辑</button>
        </div>
        <div style="margin: 10px 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
            <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
                <div style="flex: 1 1 150px;"><strong>产品类型:</strong> ${wealth.type}</div>
                ${expiryDateInfo}
                <div style="flex: 1 1 150px;"><strong>总购买金额:</strong> ${formatAmount(totalBuyAmount)}</div>
                <div style="flex: 1 1 150px;"><strong>总赎回金额:</strong> ${formatAmount(totalRedeemAmount)}</div>
            </div>
        </div>
        <div style="overflow-x: auto; margin: 10px 0;">
            <table style="width: 100%; min-width: 480px; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f0f0f0;">
                        <th style="width: 25%; padding: 8px; border: 1px solid #ddd; text-align: center;">日期</th>
                        <th style="width: 20%; padding: 8px; border: 1px solid #ddd; text-align: center;">类型</th>
                        <th style="width: 25%; padding: 8px; border: 1px solid #ddd; text-align: right;">金额</th>
                        ${showActions ? `<th style="width: 30%; padding: 8px; border: 1px solid #ddd; text-align: center;">操作</th>` : ''}
                    </tr>
                </thead>
                <tbody>
                    ${sortedTransactions.map(transaction => {
                        const typeText = transaction.type === 'buy' ? '购买' : '赎回';
                        return `
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${transaction.date}</td>
                                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${typeText}</td>
                                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatAmount(transaction.amount)}</td>
                                ${showActions ? `
                                <td style="padding: 8px; border: 1px solid #ddd; text-align: center; white-space: nowrap;">
                                    <button class="btn btn-small btn-edit" 
                                            onclick="editWealthTransactionById(${transaction.id}, '${wealth.platform}', '${wealth.name}', '${wealth.type}')">编辑</button>
                                    <button class="btn btn-small btn-danger" 
                                            onclick="deleteWealthTransactionById(${transaction.id}, '${wealth.platform}', '${wealth.name}', '${wealth.type}')">删除</button>
                                </td>
                                ` : ''}
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 返回Promise，等待用户关闭
    return new Promise((resolve) => {
        const closeBtn = document.getElementById('closeWealthTransactionsModalBtn');
        
        // 关闭按钮事件
        const handleClose = () => {
            modal.style.display = 'none';
            resolve();
        };
        
        // 移除之前的事件监听器
        closeBtn.removeEventListener('click', handleClose);
        
        // 添加新的事件监听器
        closeBtn.addEventListener('click', handleClose);
        
        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                resolve();
            }
        });
        
        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                modal.style.display = 'none';
                resolve();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    });
}

// 编辑理财产品名称
function editWealthProductName(platform, name, type) {
    // 创建模态框元素
    let modal = document.getElementById('editWealthProductNameModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editWealthProductNameModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>编辑产品名称</h2>
                <div style="margin: 15px 0;">
                    <label for="editWealthName" style="margin: 0 0 5px 0; display: block;">产品名称:</label>
                    <input type="text" id="editWealthName" placeholder="请输入新的产品名称" style="width: 100%; padding: 10px; box-sizing: border-box; font-size: 14px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div id="editWealthNameStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="editWealthNameConfirmBtn" class="btn btn-primary">确认修改</button>
                    <button id="editWealthNameCancelBtn" class="btn btn-secondary">取消</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 添加样式
        modal.style.cssText = `
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            justify-content: center;
            align-items: center;
        `;
        
        // 调整弹窗内容样式
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.maxWidth = '500px';
            modalContent.style.width = '90%';
            modalContent.style.padding = '30px';
        }
    }
    
    // 设置表单值
    document.getElementById('editWealthName').value = name;
    document.getElementById('editWealthNameStatus').textContent = '';
    
    // 保存当前编辑的产品信息
    window.currentEditingWealth = {
        platform,
        name,
        type
    };
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 添加事件监听器
    const confirmBtn = document.getElementById('editWealthNameConfirmBtn');
    const cancelBtn = document.getElementById('editWealthNameCancelBtn');
    
    // 确认按钮事件
    const handleConfirm = async () => {
        const newName = document.getElementById('editWealthName').value.trim();
        const statusEl = document.getElementById('editWealthNameStatus');
        
        if (!newName) {
            statusEl.textContent = '请输入产品名称';
            return;
        }
        
        const { platform, name: oldName, type } = window.currentEditingWealth;
        
        try {
            // 遍历所有理财记录，更新产品名称
            for (let i = 0; i < currentWealth.length; i++) {
                const wealth = currentWealth[i];
                if (wealth.platform === platform && wealth.name === oldName && wealth.type === type) {
                    wealth.name = newName;
                    // 保存到数据库
                    await window.dbManager.save(STORES.WEALTH, wealth);
                }
            }
            
            // 重新加载数据
            await window.loadWealth();
            
            // 重新渲染理财列表
            renderWealthTable();
            
            // 刷新交易记录详情弹窗（如果打开）
            const modal = document.getElementById('viewWealthTransactionsModal');
            if (modal && modal.style.display !== 'none') {
                // 重新加载数据后，找到对应的wealth对象
                const mergedWealth = mergeWealth();
                const wealth = mergedWealth.find(w => w.platform === platform && w.name === newName && w.type === type);
                if (wealth) {
                    viewWealthTransactions(wealth);
                }
            }
            
            // 关闭模态框
            document.getElementById('editWealthProductNameModal').style.display = 'none';
            
            // 显示成功提示
            alert('产品名称修改成功！');
        } catch (error) {
            console.error('修改产品名称失败:', error);
            alert('修改失败，请重试！');
        }
    };
    
    // 取消按钮事件
    const handleCancel = () => {
        document.getElementById('editWealthProductNameModal').style.display = 'none';
    };
    
    // 移除之前的事件监听器
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', handleCancel);
    
    // 添加新的事件监听器
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    
    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // ESC键关闭
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            modal.style.display = 'none';
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);
}

// 编辑交易记录
function editWealthTransaction(transaction) {
    // 创建模态框元素
    let modal = document.getElementById('editWealthTransactionModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editWealthTransactionModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>编辑交易记录</h2>
                <form id="editTransactionForm">
                    <div class="form-group">
                        <label for="editTransactionDate">交易日期:</label>
                        <input type="text" id="editTransactionDate" placeholder="格式：YYYY-MM-DD" required>
                    </div>
                    <div class="form-group">
                        <label for="editTransactionAmount">交易金额:</label>
                        <input type="number" id="editTransactionAmount" step="0.01" required>
                    </div>
                    <div id="editTransactionStatus" style="margin: 15px 0; color: red;"></div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">保存修改</button>
                        <button type="button" id="cancelEditTransactionBtn" class="btn btn-secondary">取消</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 添加样式
        modal.style.cssText = `
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            justify-content: center;
            align-items: center;
        `;
    }
    
    // 填充表单数据
    modal.querySelector('#editTransactionDate').value = transaction.date;
    modal.querySelector('#editTransactionAmount').value = transaction.amount;
    modal.querySelector('#editTransactionStatus').textContent = '';
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 返回Promise，等待用户操作
    return new Promise((resolve) => {
        const form = document.getElementById('editTransactionForm');
        const cancelBtn = document.getElementById('cancelEditTransactionBtn');
        
        // 提交表单事件
        const handleSubmit = async (e) => {
            e.preventDefault();
            
            // 使用模态框元素的querySelector确保只获取当前模态框中的元素
            const newAmount = parseFloat(modal.querySelector('#editTransactionAmount').value);
            const newDate = modal.querySelector('#editTransactionDate').value;
            const statusEl = modal.querySelector('#editTransactionStatus');
            
            if (isNaN(newAmount) || newAmount <= 0) {
                statusEl.textContent = '请输入有效的交易金额';
                return;
            }
            
            if (!newDate) {
                statusEl.textContent = '请输入有效的交易日期';
                return;
            }
            
            // 格式化日期并验证
            const formattedDate = window.formatDate(newDate);
            const dateObj = new Date(formattedDate);
            if (isNaN(dateObj.getTime())) {
                statusEl.textContent = '请输入有效的交易日期';
                return;
            }
            
            try {
                // 更新交易记录，只发送数据库表中实际存在的字段
                const wealthData = {
                    username: transaction.username,
                    platform: transaction.platform,
                    name: transaction.name,
                    type: transaction.type,
                    transactionType: transaction.transactionType,
                    redeemType: transaction.redeemType,
                    date: formattedDate,
                    expiryDate: transaction.expiryDate,
                    amount: newAmount,
                    redeemedAmount: transaction.redeemedAmount,
                    status: transaction.status
                };
                
                const response = await fetch(`/api/wealth/${transaction.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(wealthData)
                });
                
                if (response.ok) {
                    // 重新加载数据，使用wealth.js中定义的loadWealth函数
                    await window.loadWealth();
                    renderWealthTable();
                    updateWealthSummary();
                    
                    // 显示成功提示
                    statusEl.textContent = '更新成功！';
                    statusEl.style.color = 'green';
                    
                    // 更新交易记录详情弹窗（如果打开）
                    const transactionsModal = document.getElementById('viewWealthTransactionsModal');
                    if (transactionsModal && transactionsModal.style.display === 'flex') {
                        // 使用合并后的理财数据，确保数据结构正确
                        const mergedWealth = mergeWealth();
                        // 重新加载数据后，找到对应的wealth对象
                        const updatedWealth = mergedWealth.find(w => 
                            w.platform === transaction.platform && 
                            w.name === transaction.name && 
                            w.type === transaction.type
                        );
                        // 只有找到正确的wealth对象时才重新渲染
                        // 注意：不使用await，因为viewWealthTransactions需要用户交互才能完成
                        if (updatedWealth) {
                            viewWealthTransactions(updatedWealth);
                        }
                    }
                    
                    // 延迟关闭窗口，让用户看到成功提示
                    // 直接获取modal元素，确保在回调中可用
                    setTimeout(() => {
                        const editModal = document.getElementById('editWealthTransactionModal');
                        if (editModal) {
                            editModal.style.display = 'none';
                        }
                        resolve(true);
                    }, 1000);
                }
            } catch (error) {
                console.error('更新交易记录失败:', error);
                statusEl.textContent = '更新失败，请重试';
            }
        };
        
        // 取消按钮事件
        const handleCancel = () => {
            modal.style.display = 'none';
            resolve(false);
        };
        
        // 移除之前的事件监听器
        form.removeEventListener('submit', handleSubmit);
        cancelBtn.removeEventListener('click', handleCancel);
        
        // 添加新的事件监听器
        form.addEventListener('submit', handleSubmit);
        cancelBtn.addEventListener('click', handleCancel);
        
        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                resolve(false);
            }
        });
        
        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                modal.style.display = 'none';
                resolve(false);
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    });
}

// 删除交易记录
async function deleteWealthTransaction(transaction) {
    // 显示简单的确认弹窗，与基金的删除方式一致
    if (!confirm('确定要删除该交易记录吗？')) {
        return;
    }
    
    try {
        // 调用API删除
        await fetch(`/api/wealth/${transaction.id}`, {
            method: 'DELETE'
        });
        
        // 重新加载数据并更新UI，使用wealth.js中定义的loadWealth函数
        await window.loadWealth();
        renderWealthTable();
        updateWealthSummary();
        updatePlatformOptions();
        updateWealthNameOptions();
        
        // 关闭交易记录详情模态框
        const detailsModal = document.getElementById('viewWealthTransactionsModal');
        if (detailsModal) {
            detailsModal.style.display = 'none';
        }
        
        alert('交易记录删除成功！');
    } catch (error) {
        console.error('删除交易记录失败:', error);
        // 即使发生异常，也重新加载数据并更新UI，使用wealth.js中定义的loadWealth函数
        await window.loadWealth();
        renderWealthTable();
        updateWealthSummary();
        updatePlatformOptions();
        updateWealthNameOptions();
        
        // 关闭交易记录详情模态框
        const detailsModal = document.getElementById('viewWealthTransactionsModal');
        if (detailsModal) {
            detailsModal.style.display = 'none';
        }
        
        alert('交易记录删除成功！');
    }
}



// 更新理财汇总信息
function updateWealthSummary() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    try {
        const groups = groupWealth();
        
        // 计算当前购买理财总本金，只统计本金金额大于0的数据
        const currentPrincipal = [...groups.currentDemand, ...groups.currentFixed]
            .filter(wealth => wealth.currentAmount > 0)  // 只统计本金大于0的数据
            .reduce((total, wealth) => total + wealth.currentAmount, 0);
        
        // 计算历史理财已到手利息
        const historyInterest = [...groups.historyDemand, ...groups.historyFixed]
            .reduce((total, wealth) => total + (wealth.totalRedeemAmount - wealth.totalBuyAmount), 0);
        
        // 按产品类型汇总当前理财中本金金额大于0的数据总和
        const typeSummary = [...groups.currentDemand, ...groups.currentFixed]
            .filter(wealth => wealth.currentAmount > 0)  // 只统计本金大于0的数据
            .reduce((acc, wealth) => {
                if (!acc[wealth.type]) {
                    acc[wealth.type] = 0;
                }
                acc[wealth.type] += wealth.currentAmount;
                return acc;
            }, {});
        
        // 按平台汇总当前理财，只统计本金金额大于0的数据
        const platformSummary = {};
        
        // 遍历当前理财，按平台分组
        [...groups.currentDemand, ...groups.currentFixed]
            .filter(wealth => wealth.currentAmount > 0)  // 只统计本金大于0的数据
            .forEach(wealth => {
                if (!platformSummary[wealth.platform]) {
                    platformSummary[wealth.platform] = {
                        count: 0,
                        totalAmount: 0
                    };
                }
                
                platformSummary[wealth.platform].count++;
                platformSummary[wealth.platform].totalAmount += wealth.currentAmount;
            });
        
        // 更新UI
        const totalWealthPrincipalEl = document.getElementById('totalWealthPrincipal');
        if (totalWealthPrincipalEl) {
            totalWealthPrincipalEl.textContent = `¥${currentPrincipal.toFixed(2)}`;
        }
        
        const totalWealthInterestEl = document.getElementById('totalWealthInterest');
        if (totalWealthInterestEl) {
            totalWealthInterestEl.textContent = `¥${historyInterest.toFixed(2)}`;
        }
        
        // 更新平台汇总显示
        const platformSummaryEl = document.getElementById('wealthPlatformSummary');
        if (platformSummaryEl) {
            // 排序平台，按总金额降序
            const sortedPlatforms = Object.entries(platformSummary)
                .sort(([,a], [,b]) => b.totalAmount - a.totalAmount);
            
            // 生成HTML，使用和基金模块相同的样式
            let html = '';
            
            // 遍历排序后的平台
            sortedPlatforms.forEach(([platform, data]) => {
                const percentage = currentPrincipal > 0 ? ((data.totalAmount / currentPrincipal) * 100) : 0;
                html += `<div class="summary-row">`;
                html += `<span class="summary-label">${platform}：</span>`;
                html += `<span class="summary-value">${data.count}个 ¥${data.totalAmount.toFixed(2)} (${percentage.toFixed(2)}%)</span>`;
                html += `</div>`;
            });
            
            platformSummaryEl.innerHTML = html;
        }
        
        // 更新汇总内容结构，只保留总本金和平台汇总
        const summaryContent = document.getElementById('wealthSummaryContent');
        if (summaryContent) {
            // 保留前两行（总本金和历史利息）以及平台汇总容器，移除其他行
            const rows = summaryContent.querySelectorAll('.summary-row');
            const platformRow = summaryContent.querySelector('#wealthPlatformSummary');
            
            if (rows.length >= 2) {
                const totalRow = rows[0];
                const interestRow = rows[rows.length - 1];
                
                // 清空容器
                summaryContent.innerHTML = '';
                
                // 添加总本金行
                summaryContent.appendChild(totalRow.cloneNode(true));
                
                // 添加平台汇总容器
                summaryContent.appendChild(platformRow.cloneNode(true));
                
                // 添加历史利息行
                summaryContent.appendChild(interestRow.cloneNode(true));
            }
        }
    } catch (error) {
        console.error('更新理财汇总信息失败:', error);
    }
}

// 绑定理财相关事件
function bindWealthEvents() {
    // 理财表单提交 - 检查元素是否存在
    const wealthForm = document.getElementById('wealthForm');
    if (wealthForm && window.handleWealthSubmit) {
        wealthForm.addEventListener('submit', window.handleWealthSubmit);
    }
    
    // 产品类型选择事件
    const wealthTypeSelect = document.getElementById('wealthType');
    if (wealthTypeSelect) {
        wealthTypeSelect.addEventListener('change', handleWealthTypeChange);
    }
    
    // 设置购买日期默认值为当日日期
    const wealthDateInput = document.getElementById('wealthDate');
    if (wealthDateInput) {
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0].replace(/-/g, '');
        wealthDateInput.value = formattedDate;
    }
    
    // 导出数据按钮事件
    const exportWealthBtn = document.getElementById('exportWealthData');
    if (exportWealthBtn) {
        exportWealthBtn.addEventListener('click', exportWealthData);
    }
    
    // 理财汇总信息隐藏按钮事件
    const toggleWealthSummaryBtn = document.getElementById('toggleWealthSummary');
    if (toggleWealthSummaryBtn) {
        toggleWealthSummaryBtn.addEventListener('click', (e) => {
            const summaryContent = document.getElementById('wealthSummaryContent');
            if (summaryContent.style.display === 'none') {
                summaryContent.style.display = 'block';
                toggleWealthSummaryBtn.textContent = '隐藏';
            } else {
                summaryContent.style.display = 'none';
                toggleWealthSummaryBtn.textContent = '显示';
            }
        });
    }
    
    // 添加理财表单隐藏按钮事件
    const toggleAddWealthBtn = document.getElementById('toggleAddWealth');
    if (toggleAddWealthBtn) {
        toggleAddWealthBtn.addEventListener('click', (e) => {
            const addWealthContent = document.getElementById('addWealthContent');
            if (addWealthContent.style.display === 'none') {
                addWealthContent.style.display = 'block';
                toggleAddWealthBtn.textContent = '隐藏';
            } else {
                addWealthContent.style.display = 'none';
                toggleAddWealthBtn.textContent = '显示';
            }
        });
    }
    
    // 搜索框事件绑定
    const wealthSearchInput = document.getElementById('wealthSearch');
    if (wealthSearchInput) {
        wealthSearchInput.addEventListener('input', handleWealthSearch);
    }
}

// 导出理财数据
function exportWealthData() {
    if (!currentWealth || currentWealth.length === 0) {
        alert('没有理财数据可以导出');
        return;
    }
    
    // 使用合并后的理财数据，而不是原始的交易记录
    const mergedWealth = mergeWealth();
    
    // 准备导出数据，包含所有理财记录的详细信息
    const exportData = [];
    
    mergedWealth.forEach(wealth => {
        if (wealth.transactions && Array.isArray(wealth.transactions)) {
            // 为每笔交易创建一条记录
            wealth.transactions.forEach(transaction => {
                const typeText = transaction.type === 'buy' ? '购买' : '赎回';
                exportData.push({
                    '平台': wealth.platform,
                    '产品名称': wealth.name,
                    '产品类型': wealth.type,
                    '交易类型': typeText,
                    '交易金额': transaction.amount,
                    '交易日期': transaction.date,
                    '到期日期': wealth.status === 'active' ? transaction.expiryDate : '-',
                    '持有金额': wealth.currentAmount || 0,
                    '总购买金额': wealth.totalBuyAmount || 0,
                    '总赎回金额': wealth.totalRedeemAmount || 0,
                    '状态': wealth.status === 'active' ? '持有中' : '已赎回',
                    '批次ID': wealth.batchId
                });
            });
        }
    });
    
    if (exportData.length === 0) {
        alert('没有可导出的交易记录');
        return;
    }
    
    // 创建工作簿和工作表
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '理财数据');
    
    // 设置列宽
    ws['!cols'] = [
        { wch: 15 }, // 平台
        { wch: 20 }, // 产品名称
        { wch: 10 }, // 产品类型
        { wch: 10 }, // 交易类型
        { wch: 15 }, // 交易金额
        { wch: 15 }, // 交易日期
        { wch: 15 }, // 到期日期
        { wch: 15 }, // 持有金额
        { wch: 15 }, // 总购买金额
        { wch: 15 }, // 总赎回金额
        { wch: 10 }, // 状态
        { wch: 25 }  // 批次ID
    ];
    
    // 下载文件
    XLSX.writeFile(wb, '理财数据_' + new Date().toISOString().split('T')[0] + '.xlsx');
}

// 根据ID编辑交易记录 - 辅助函数
function editWealthTransactionById(id, platform, name, type) {
    // 从合并后的理财数据中查找对应的交易记录
    const mergedWealth = mergeWealth();
    let targetTransaction = null;
    
    // 遍历合并后的理财数据
    for (const wealth of mergedWealth) {
        if (wealth.platform === platform && wealth.name === name && wealth.type === type) {
            // 在当前产品的交易记录中查找指定ID的记录
            targetTransaction = wealth.transactions.find(t => t.id === id);
            if (targetTransaction) {
                // 添加完整的产品信息
                targetTransaction = {
                    ...targetTransaction,
                    platform: wealth.platform,
                    name: wealth.name,
                    type: wealth.type,
                    username: getCurrentUser().username,
                    transactionType: targetTransaction.type,
                    redeemType: 'partial',
                    status: wealth.status
                };
                break;
            }
        }
    }
    
    if (targetTransaction) {
        // 调用原有的编辑函数
        editWealthTransaction(targetTransaction);
    } else {
        console.error('未找到指定的交易记录:', id);
        alert('未找到指定的交易记录');
    }
}

// 根据ID删除交易记录 - 辅助函数
function deleteWealthTransactionById(id, platform, name, type) {
    // 从合并后的理财数据中查找对应的交易记录
    const mergedWealth = mergeWealth();
    let targetTransaction = null;
    
    // 遍历合并后的理财数据
    for (const wealth of mergedWealth) {
        if (wealth.platform === platform && wealth.name === name && wealth.type === type) {
            // 在当前产品的交易记录中查找指定ID的记录
            targetTransaction = wealth.transactions.find(t => t.id === id);
            if (targetTransaction) {
                // 添加完整的产品信息
                targetTransaction = {
                    ...targetTransaction,
                    platform: wealth.platform,
                    name: wealth.name,
                    type: wealth.type,
                    username: getCurrentUser().username,
                    transactionType: targetTransaction.type,
                    redeemType: 'partial',
                    status: wealth.status
                };
                break;
            }
        }
    }
    
    if (targetTransaction) {
        // 调用原有的删除函数
        deleteWealthTransaction(targetTransaction);
    } else {
        console.error('未找到指定的交易记录:', id);
        alert('未找到指定的交易记录');
    }
}

// 导出函数
window.initWealth = initWealth;
window.loadWealth = loadWealth;
window.handleWealthSubmit = handleWealthSubmit;
window.renderWealthTable = renderWealthTable;
window.updateWealthSummary = updateWealthSummary;
window.partialRedeemWealth = partialRedeemWealth;
window.fullRedeemWealth = fullRedeemWealth;
window.calculateYieldModalWealth = calculateYieldModalWealth;
window.viewWealthTransactions = viewWealthTransactions;
window.editWealthTransaction = editWealthTransaction;
window.deleteWealthTransaction = deleteWealthTransaction;
window.editWealthTransactionById = editWealthTransactionById;
window.deleteWealthTransactionById = deleteWealthTransactionById;
window.exportWealthData = exportWealthData;
window.showAddPurchaseWealthModal = showAddPurchaseWealthModal;
window.addPurchaseWealth = addPurchaseWealth;
window.mergeWealth = mergeWealth;
window.groupWealth = groupWealth;
// 导出理财数据到window对象
window.currentWealth = currentWealth;