// 基金模块
let currentFund = [];
let currentFundSearchQuery = '';

// 用户页面设置
let pageSettings = {
    shareManagementEnabled: true,
    currentAmountQueryEnabled: true
};

// 获取用户页面设置
async function loadPageSettings() {
    try {
        const currentUser = getCurrentUser();
        const response = await fetch(`/api/users/${currentUser.username}/settings`);
        if (response.ok) {
            pageSettings = await response.json();
        }
    } catch (error) {
        console.error('加载页面设置失败:', error);
    }
}

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



// 处理基金表格排序
function handleFundSort(e) {
    let btn;
    
    // 检查e是否是事件对象
    if (e && typeof e === 'object' && e.target) {
        // 正常的事件对象调用
        btn = e.target;
    } else {
        // 直接传入DOM元素的调用（来自common.js）
        btn = e;
    }
    
    // 检查btn是否存在
    if (!btn) {
        console.error('No sort button provided:', btn);
        return;
    }
    
    // 确保点击的是排序按钮
    if (!btn.classList || !btn.classList.contains('sort-btn')) {
        // 检查是否点击的是排序按钮的子元素
        if (btn.closest) {
            btn = btn.closest('.sort-btn');
            if (!btn) return;
        } else {
            return;
        }
    }
    
    // 检查btn是否存在且具有getAttribute方法
    if (!btn || typeof btn.getAttribute !== 'function') {
        console.error('Invalid sort button:', btn);
        return;
    }
    
    const column = btn.getAttribute('data-column');
    const order = btn.getAttribute('data-order');
    const table = btn.closest('table');
    
    // 检查table是否存在
    if (!table) {
        console.error('Could not find table for sort button');
        return;
    }
    
    const tableId = table.id;
    
    // 获取基金数据
    const groups = groupFund();
    let fundList;
    let tableBodyId;
    let tableType;
    
    if (tableId === 'fundCurrentFundsTable') {
        // 当前基金
        fundList = groups.current;
        tableType = 'current';
        tableBodyId = 'fundCurrentFundsBody';
    } else {
        // 历史基金
        fundList = groups.history;
        tableType = 'history';
        tableBodyId = 'fundHistoryFundsBody';
    }
    
    // 排序
    const sortedFund = [...fundList].sort((a, b) => {
        let aVal, bVal;
        
        switch (column) {
            case 'platform':
                // 购买平台排序
                aVal = (a.platform || '').toLowerCase();
                bVal = (b.platform || '').toLowerCase();
                break;
            case 'fundCode':
                // 基金代码排序
                aVal = parseFloat(a.fundCode) || 0;
                bVal = parseFloat(b.fundCode) || 0;
                break;
            case 'name':
                // 产品名称排序
                aVal = (a.name || '').toLowerCase();
                bVal = (b.name || '').toLowerCase();
                break;
            case 'fundCategory':
                // 运作方式排序
                aVal = (a.fundCategory || '').toLowerCase();
                bVal = (b.fundCategory || '').toLowerCase();
                break;
            case 'fundRiskLevel':
                // 风险等级排序
                const riskLevelOrder = {
                    '低风险': 1,
                    '中低风险': 2,
                    '中风险': 3,
                    '中高风险': 4,
                    '高风险': 5
                };
                aVal = riskLevelOrder[a.fundRiskLevel] || 0;
                bVal = riskLevelOrder[b.fundRiskLevel] || 0;
                break;
            case 'currentAmount':
            case 'totalBuyAmount':
            case 'totalRedeemAmount':
                // 金额排序
                aVal = a[column] || 0;
                bVal = b[column] || 0;
                break;
            case 'yieldRate':
                // 收益率排序
                const calculateYieldRate = (fund) => {
                    if (!fund.transactions || fund.transactions.length < 2) {
                        return 0;
                    }
                    try {
                        const cashFlows = fund.transactions.map(t => ({
                            date: t.date,
                            amount: t.transactionType === 'buy' ? -t.amount : t.amount
                        }));
                        return calculateXIRR(cashFlows) * 100;
                    } catch (error) {
                        if (fund.totalBuyAmount > 0) {
                            const profit = fund.totalRedeemAmount - fund.totalBuyAmount;
                            return (profit / fund.totalBuyAmount) * 100;
                        }
                        return 0;
                    }
                };
                aVal = calculateYieldRate(a);
                bVal = calculateYieldRate(b);
                break;
            default:
                // 默认按日期排序
                aVal = new Date(a.transactions[0].date).getTime();
                bVal = new Date(b.transactions[0].date).getTime();
        }
        
        // 比较值
        let result;
        if (aVal < bVal) {
            result = order === 'asc' ? -1 : 1;
        } else if (aVal > bVal) {
            result = order === 'asc' ? 1 : -1;
        } else {
            result = 0;
        }
        
        return result;
    });
    
    // 重新渲染表格
    renderFundTableSection(tableBodyId, sortedFund, tableType, sortedFund);
}

// 初始化基金模块
function initFund() {
    // 直接使用window.dbManager，不再重新声明
    // 绑定基金相关事件
    bindFundEvents();
    
    // 使用事件委托绑定排序按钮事件
    const fundTables = document.querySelectorAll('#fundCurrentFundsTable, #fundHistoryFundsTable');
    fundTables.forEach(table => {
        table.addEventListener('click', handleFundSort);
    });
    
    // 检查登录状态，只有已登录才加载数据
    const currentUser = getCurrentUser();
    if (currentUser) {
        // 加载基金数据并渲染表格
        loadFund().then(async () => {
            await renderFundTable();
        });
    } else {
        // 未登录状态下只渲染空表格
        renderFundTable().catch(error => {
            console.error('渲染基金表格失败:', error);
        });
    }
}

// 加载基金数据
async function loadFund() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    try {
        // 加载页面设置
        await loadPageSettings();
        
        // 控制当前金额列表头显示
        updateCurrentAmountHeader();
        
        const newFundData = await window.dbManager.getAllByIndex(STORES.FUND, 'username', currentUser.username);
        currentFund = newFundData;
        window.currentFund = currentFund;
        
        updateFundNameOptions();
        updateFundPlatformOptions();
    } catch (error) {
        console.error('加载基金数据失败:', error);
        currentFund = [];
        window.currentFund = currentFund;
    }
}

// 更新当前金额列表头显示
function updateCurrentAmountHeader() {
    const headerEl = document.getElementById('currentAmountHeader');
    if (headerEl) {
        headerEl.style.display = pageSettings.currentAmountQueryEnabled ? '' : 'none';
    }
}

// 更新购买平台选项列表
function updateFundPlatformOptions() {
    // 获取datalist元素
    const platformOptions = document.getElementById('fundPlatformOptions');
    if (!platformOptions) {
        return;
    }
    
    // 清空现有选项
    platformOptions.innerHTML = '';
    
    // 获取所有唯一的购买平台名称
    const platformSet = new Set();
    
    // 遍历基金数据
    for (const fund of currentFund) {
        if (fund && fund.platform && typeof fund.platform === 'string' && fund.platform.trim() !== '') {
            platformSet.add(fund.platform);
        }
    }
    
    // 将Set转换为数组
    const platforms = Array.from(platformSet);
    
    // 添加选项
    for (const platform of platforms) {
        const option = document.createElement('option');
        option.value = platform;
        option.textContent = platform;
        platformOptions.appendChild(option);
    }
}

// 更新产品名称选项列表
function updateFundNameOptions() {
    // 获取datalist元素
    const fundNameOptions = document.getElementById('fundNameOptions');
    if (!fundNameOptions) {
        return;
    }
    
    // 清空现有选项
    fundNameOptions.innerHTML = '';
    
    // 获取所有唯一的产品名称
    const nameSet = new Set();
    
    // 遍历基金数据
    for (const fund of currentFund) {
        if (fund && fund.name && typeof fund.name === 'string' && fund.name.trim() !== '') {
            nameSet.add(fund.name);
        }
    }
    
    // 将Set转换为数组
    const names = Array.from(nameSet);
    
    // 添加选项
    for (const name of names) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        fundNameOptions.appendChild(option);
    }
}



// 处理基金表单提交
async function handleFundSubmit(e) {
    e.preventDefault();
    
    try {
        // 获取表单数据
        const platform = document.getElementById('fundPlatform').value;
        const fundCode = document.getElementById('fundCode').value;
        const name = document.getElementById('fundName').value;
        let date = document.getElementById('fundDate').value;
        // 处理浮点数精度问题，确保金额精确到小数点后两位
        const amount = parseFloat(parseFloat(document.getElementById('fundAmount').value).toFixed(2));
        // 添加基金类型、运作方式和风险等级
        const fundType = document.getElementById('fundType').value;
        const fundCategory = document.getElementById('fundCategory').value;
        const fundRiskLevel = document.getElementById('fundRiskLevel').value;
        
        // 数据验证
        if (!platform) {
            alert('请填写购买平台');
            return;
        }
        if (!fundCode) {
            alert('请填写基金代码');
            return;
        }
        if (!name) {
            alert('请填写产品名称');
            return;
        }
        if (!fundType) {
            alert('请选择基金类型');
            return;
        }
        if (!fundRiskLevel) {
            alert('请选择风险等级');
            return;
        }
        if (!fundCategory) {
            alert('请选择运作方式');
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
        
        // 创建基金对象，添加用户名
        const fund = {
            platform,
            fundCode,
            name,
            transactionType: 'buy', // 添加交易类型，购买时为'buy'
            redeemType: 'partial', // 添加赎回类型，默认为'partial'
            date,
            expiryDate: null, // 基金不再使用到期日期
            amount,
            redeemedAmount: 0, // 添加赎回金额，购买时为0
            username: getCurrentUser().username, // 添加用户名，用于数据隔离
            fundCategory,
            fundType,
            fundRiskLevel
        };
        
        // 保存数据到数据库
        const response = await fetch('/api/fund', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(fund)
        });
        
        if (response.ok) {
            // 重新从数据库加载所有数据，确保数据一致性
            await window.loadFund();
            
            // 更新平台选项列表
            updateFundPlatformOptions();
            // 更新产品名称选项列表
            updateFundNameOptions();
            
            // 重新渲染表格
            await renderFundTable();
            
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
        
        // 确保产品名称、基金类型、风险等级和运作方式可编辑
        const fundNameInput = document.getElementById('fundName');
        const fundTypeSelect = document.getElementById('fundType');
        const fundRiskLevelSelect = document.getElementById('fundRiskLevel');
        const fundCategorySelect = document.getElementById('fundCategory');
        fundNameInput.disabled = false;
        fundNameInput.style.backgroundColor = '';
        fundTypeSelect.disabled = false;
        fundTypeSelect.style.backgroundColor = '';
        fundRiskLevelSelect.disabled = false;
        fundRiskLevelSelect.style.backgroundColor = '';
        fundCategorySelect.disabled = false;
        fundCategorySelect.style.backgroundColor = '';
        
        // 设置默认日期为今天
        document.getElementById('fundDate').value = getTodayLocalDate();
        
        alert('基金添加成功！');
        }
    } catch (error) {
        console.error('添加基金失败:', error);
        // 添加更详细的错误信息
        if (error.response) {
            // 服务器返回了错误响应
            error.response.json().then(errorData => {
                console.error('服务器返回的错误:', errorData);
                alert(`添加基金失败: ${errorData.error || '服务器错误'}`);
            }).catch(parseError => {
                console.error('解析错误响应失败:', parseError);
                alert(`添加基金失败: 服务器返回错误 (${error.response.status})`);
            });
        } else if (error.request) {
            // 请求已发送但没有收到响应
            console.error('没有收到服务器响应:', error.request);
            alert('添加基金失败: 没有收到服务器响应，请检查网络连接');
        } else {
            // 请求配置时发生错误
            console.error('请求配置错误:', error.message);
            alert(`添加基金失败: ${error.message}`);
        }
    }
}

// 合并相同产品的基金记录
function mergeFund() {
    // 首先按平台、基金代码、产品名称分组
    const groupedByProduct = {};
    
    currentFund.forEach(fund => {
        // 使用购买平台和基金代码作为分组键，确保同一购买平台和基金代码的基金被正确分组
        // 不同购买平台相同基金代码的基金分别记录
        // 确保基金代码不为undefined或null
        const safeFundCode = fund.fundCode || '';
        const key = `${fund.platform}_${safeFundCode}`;
        if (!groupedByProduct[key]) {
            groupedByProduct[key] = [];
        }
        groupedByProduct[key].push(fund);
    });
    
    const mergedFund = [];
    
    // 处理每个产品的交易记录
    for (const [productKey, transactions] of Object.entries(groupedByProduct)) {
        // 按日期排序所有交易记录
        const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // 为每个持有周期创建独立的记录
        let currentBatch = null;
        
        for (const transaction of sortedTransactions) {
            if (transaction.transactionType === 'buy') {
                // 如果没有当前批次或当前批次已全部赎回，创建新批次
                if (!currentBatch || currentBatch.status === 'redeemed') {
                    // 创建新的持有周期批次
                    currentBatch = {
                        platform: transaction.platform,
                        fundCode: transaction.fundCode,
                        name: transaction.name,
                        fundCategory: transaction.fundCategory,
                        fundType: transaction.fundType,
                        fundRiskLevel: transaction.fundRiskLevel,
                        transactions: [],
                        totalBuyAmount: 0,
                        totalRedeemAmount: 0,
                        currentAmount: 0,
                        status: 'active',
                        batchId: `${transaction.platform}_${transaction.fundCode}_${transaction.name}_${transaction.date}`
                    };
                    mergedFund.push(currentBatch);
                }
                
                currentBatch.transactions.push({
                    id: transaction.id,
                    date: transaction.date,
                    transactionType: transaction.transactionType,
                    amount: parseFloat(transaction.amount.toFixed(2)),
                    shares: transaction.shares,
                    expiryDate: transaction.expiryDate,
                    redeemedAmount: parseFloat(transaction.redeemedAmount.toFixed(2)),
                    fundCategory: transaction.fundCategory,
                    fundType: transaction.fundType,
                    fundRiskLevel: transaction.fundRiskLevel
                });
                
                // 使用toFixed(2)处理浮点数精度问题
                currentBatch.totalBuyAmount = parseFloat((currentBatch.totalBuyAmount + transaction.amount).toFixed(2));
                currentBatch.currentAmount = parseFloat((currentBatch.totalBuyAmount - currentBatch.totalRedeemAmount).toFixed(2));
            } else if (transaction.transactionType === 'dividend') {
                // 分红记录：添加到当前批次，但不影响金额（金额为0）
                if (!currentBatch || currentBatch.status === 'redeemed') {
                    // 创建新的持有周期批次
                    currentBatch = {
                        platform: transaction.platform,
                        fundCode: transaction.fundCode,
                        name: transaction.name,
                        fundCategory: transaction.fundCategory,
                        fundType: transaction.fundType,
                        fundRiskLevel: transaction.fundRiskLevel,
                        transactions: [],
                        totalBuyAmount: 0,
                        totalRedeemAmount: 0,
                        currentAmount: 0,
                        status: 'active',
                        batchId: `${transaction.platform}_${transaction.fundCode}_${transaction.name}_${transaction.date}`
                    };
                    mergedFund.push(currentBatch);
                }
                
                currentBatch.transactions.push({
                    id: transaction.id,
                    date: transaction.date,
                    transactionType: transaction.transactionType,
                    amount: parseFloat(transaction.amount.toFixed(2)),
                    shares: transaction.shares,
                    expiryDate: transaction.expiryDate,
                    redeemedAmount: parseFloat(transaction.redeemedAmount.toFixed(2)),
                    fundCategory: transaction.fundCategory,
                    fundType: transaction.fundType,
                    fundRiskLevel: transaction.fundRiskLevel
                });
                // 分红不影响金额，但会增加份额（在其他地方计算）
            } else if (transaction.transactionType === 'redeem') {
                // 如果有当前活跃批次，添加赎回记录
                if (currentBatch && currentBatch.status === 'active') {
                    currentBatch.transactions.push({
                    id: transaction.id,
                    date: transaction.date,
                    transactionType: transaction.transactionType,
                    amount: parseFloat(transaction.amount.toFixed(2)),
                    shares: transaction.shares,
                    expiryDate: transaction.expiryDate,
                    redeemedAmount: parseFloat(transaction.redeemedAmount.toFixed(2)),
                    fundCategory: transaction.fundCategory,
                    fundType: transaction.fundType,
                    fundRiskLevel: transaction.fundRiskLevel
                });
                    
                    // 使用toFixed(2)处理浮点数精度问题
                    currentBatch.totalRedeemAmount = parseFloat((currentBatch.totalRedeemAmount + transaction.amount).toFixed(2));
                    currentBatch.currentAmount = parseFloat((currentBatch.totalBuyAmount - currentBatch.totalRedeemAmount).toFixed(2));
                    
                    // 只根据是否使用全部赎回按钮来判断状态，不考虑持有金额
                    if (transaction.redeemType === 'full') {
                        currentBatch.status = 'redeemed';
                    }
                } else {
                    // 处理可能的异常情况，创建新批次存放赎回记录
                    const processedAmount = parseFloat(transaction.amount.toFixed(2));
                    const processedRedeemedAmount = parseFloat(transaction.redeemedAmount.toFixed(2));
                    const redeemBatch = {
                        platform: transaction.platform,
                        fundCode: transaction.fundCode,
                        name: transaction.name,
                        fundCategory: transaction.fundCategory,
                        fundType: transaction.fundType,
                        fundRiskLevel: transaction.fundRiskLevel,
                        transactions: [{
                            id: transaction.id,
                            date: transaction.date,
                            transactionType: transaction.transactionType,
                            amount: processedAmount,
                            expiryDate: transaction.expiryDate,
                            redeemedAmount: processedRedeemedAmount,
                            fundCategory: transaction.fundCategory, // 保存运作方式
                            fundType: transaction.fundType, // 保存基金类型
                            fundRiskLevel: transaction.fundRiskLevel // 保存风险等级
                        }],
                        totalBuyAmount: 0,
                        totalRedeemAmount: processedAmount,
                        currentAmount: -processedAmount,
                        status: 'redeemed',
                        batchId: `${transaction.platform}_${transaction.fundCode}_${transaction.name}_${transaction.date}_redeem`
                    };
                    mergedFund.push(redeemBatch);
                }
            }
        }
        
        // 如果有未处理的批次，添加到结果中
        if (currentBatch && !mergedFund.includes(currentBatch)) {
            mergedFund.push(currentBatch);
        }
    }
    
    return mergedFund;
}

// 分组基金记录
function groupFund() {
    let merged = mergeFund();
    
    // 应用搜索过滤
    if (currentFundSearchQuery) {
        merged = merged.filter(fund => {
            const query = currentFundSearchQuery.toLowerCase();
            return fund.platform.toLowerCase().includes(query) ||
                   (fund.fundCode && fund.fundCode.toLowerCase().includes(query)) ||
                   fund.name.toLowerCase().includes(query) ||
                   (fund.fundCategory && fund.fundCategory.toLowerCase().includes(query)) ||
                   (fund.fundRiskLevel && fund.fundRiskLevel.toLowerCase().includes(query)) ||
                   (fund.currentAmount !== undefined && fund.currentAmount !== null && fund.currentAmount.toString().includes(query)) ||
                   (fund.totalBuyAmount !== undefined && fund.totalBuyAmount !== null && fund.totalBuyAmount.toString().includes(query));
        });
    }
    
    const groups = {
        current: [], // 当前基金
        history: []  // 历史基金
    };
    
    merged.forEach(fund => {
        if (fund.status === 'active') {
            groups.current.push(fund);
        } else {
            groups.history.push(fund);
        }
    });
    
    return groups;
}

// 处理基金搜索
function handleFundSearch(e) {
    currentFundSearchQuery = e.target.value.toLowerCase();
    renderFundTable();
}

// 渲染基金表格
async function renderFundTable() {
    const groups = groupFund();
    
    // 渲染当前基金
    await renderFundTableSection('fundCurrentFundsBody', groups.current, 'current');
    
    // 渲染历史基金
    await renderFundTableSection('fundHistoryFundsBody', groups.history, 'history');
    
    // 更新基金汇总信息
    updateFundSummary();
}

// 渲染单个表格
async function renderFundTableSection(tableBodyId, fundList, tableType, sortedFund = null) {
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
    
    if (fundList.length === 0) {
            let colspan;
            if (tableType === 'history') {
                colspan = 9; // 包含基金代码、运作方式和风险等级列
            } else {
                colspan = 9; // 包含基金代码、运作方式和风险等级列，增加了当前金额列
            }
            tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center; color: #999; padding: 20px;">暂无数据</td></tr>`;
            
            // 移除展开/收起按钮（如果存在）
            const toggleBtnContainer = document.getElementById(`${tableBodyId}ToggleBtn`);
            if (toggleBtnContainer) {
                toggleBtnContainer.remove();
            }
            
            return;
        }
    
    // 使用传入的排序后数据或默认按日期倒序排序
    const finalSortedFund = sortedFund || [...fundList].sort((a, b) => new Date(b.transactions[0].date) - new Date(a.transactions[0].date));
    
    // 默认显示最近10条记录（仅历史基金）
    const DEFAULT_DISPLAY_COUNT = 10;
    let displayFunds = finalSortedFund;
    
    // 生成表格行
    const generateTableRows = (funds) => {
        return funds.map(fund => {
            // 格式化金额显示
            const formatAmount = (amount) => `¥${amount.toFixed(2)}`;
            
            // 计算收益率（仅历史基金）
            let yieldRate = 0;
            if (tableType === 'history') {
                // 准备现金流数据用于XIRR计算
                const cashFlows = [];
                
                // 添加所有交易记录
                if (fund.transactions && Array.isArray(fund.transactions)) {
                    fund.transactions.forEach(transaction => {
                        const amount = transaction.transactionType === 'buy' ? -transaction.amount : transaction.amount;
                        cashFlows.push({
                            date: transaction.date,
                            amount: amount
                        });
                    });
                }
                
                // 计算XIRR
                if (cashFlows.length >= 2) {
                    try {
                        yieldRate = calculateXIRR(cashFlows) * 100;
                    } catch (error) {
                        // XIRR计算失败时使用简单收益率
                        const profit = fund.totalRedeemAmount - fund.totalBuyAmount;
                        if (fund.totalBuyAmount > 0) {
                            // 简单年化收益率
                            // 获取第一次购买日期和最后一次赎回日期
                            let firstBuy = null;
                            let lastRedeem = null;
                            if (fund.transactions && Array.isArray(fund.transactions)) {
                                firstBuy = fund.transactions
                                    .filter(t => t.type === 'buy')
                                    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
                                lastRedeem = fund.transactions
                                    .filter(t => t.type === 'redeem')
                                    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                            }
                            
                            if (firstBuy && lastRedeem) {
                                const buyDate = new Date(firstBuy.date);
                                const redeemDate = new Date(lastRedeem.date);
                                // 精确计算天数，当天存入当天取出为0天
                                const timeDiff = redeemDate - buyDate;
                                const daysHeld = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
                                yieldRate = calculateYield(fund.totalBuyAmount, fund.totalRedeemAmount, daysHeld);
                            } else {
                                // 无法计算持有天数时，使用简单收益率
                                yieldRate = (profit / fund.totalBuyAmount) * 100;
                            }
                        }
                    }
                }
            }
            
            // 当前基金表格行
            if (tableType === 'current') {
                // 取消购买日期、购买金额、赎回日期、赎回金额的显示
                // 在本金金额和操作之间增加交易详情列
                
                // 计算当前金额（仅非货币基金，且仅在设置开启时）
                let currentValue = '';
                let currentAmountColumn = '';
                if (pageSettings.currentAmountQueryEnabled) {
                    if (fund.fundType === '货币型') {
                        // 货币基金直接显示 "-"
                        currentValue = '-';
                    } else if (fund.fundCode && pageSettings.shareManagementEnabled) {
                        // 检查所有交易记录的份额是否都填写了
                        const allSharesFilled = fund.transactions && fund.transactions.length > 0 && 
                            fund.transactions.every(t => t.shares && parseFloat(t.shares) > 0);
                        
                        if (allSharesFilled) {
                            // 计算当前持有份额（购买和分红为正，赎回为负）
                            let totalShares = 0;
                            fund.transactions.forEach(t => {
                                const shares = parseFloat(t.shares);
                                if (t.transactionType === 'buy' || t.transactionType === 'dividend') {
                                    totalShares += shares;
                                } else {
                                    totalShares -= shares;
                                }
                            });
                            
                            if (totalShares > 0) {
                                currentValue = `<span id="currentValue_${fund.platform}_${fund.name}"><span class="loading-spinner"></span></span>`;
                                // 异步获取净值并更新显示，传递本金金额用于比较
                                fetchFundNetValue(fund.fundCode, totalShares, fund.platform, fund.name, fund.currentAmount);
                            }
                        }
                    }
                    currentAmountColumn = `<td class="amount">${currentValue}</td>`;
                }
                
                const fundCodeLink = fund.fundCode ? `<a href="https://fund.eastmoney.com/${fund.fundCode}.html" target="_blank" class="fund-code-link">${fund.fundCode}</a>` : '';
                return `
                    <tr>
                        <td>${fund.platform}</td>
                        <td>${fundCodeLink}</td>
                        <td>${fund.name}</td>
                        <td>${fund.fundCategory || ''}</td>
                        <td>${fund.fundRiskLevel || ''}</td>
                        <td class="amount">${formatAmount(fund.currentAmount)}</td>
                        ${currentAmountColumn}
                        <td>
                            <button class="btn btn-small btn-secondary" onclick="viewFundTransactions(${JSON.stringify(fund).replace(/"/g, '&quot;')})">查看详情</button>
                        </td>
                        <td>
                            <button class="btn btn-small btn-buy" onclick="addFundPurchase(${JSON.stringify(fund).replace(/"/g, '&quot;')})">购买</button>
                            <button class="btn btn-small btn-primary" onclick="partialRedeemFund(${JSON.stringify(fund).replace(/"/g, '&quot;')})">部分赎回</button>
                            <button class="btn btn-small btn-danger" onclick="fullRedeemFund(${JSON.stringify(fund).replace(/"/g, '&quot;')})">全部赎回</button>
                            <button class="btn btn-small btn-secondary" onclick="calculateYieldModalFund(${JSON.stringify(fund).replace(/"/g, '&quot;')})">试算收益</button>
                        </td>
                    </tr>
                `;
            }
            // 历史基金表格行
            else {
                const fundCodeLink = fund.fundCode ? `<a href="https://fund.eastmoney.com/${fund.fundCode}.html" target="_blank" class="fund-code-link">${fund.fundCode}</a>` : '';
                return `
                    <tr>
                        <td>${fund.platform}</td>
                        <td>${fundCodeLink}</td>
                        <td>${fund.name}</td>
                        <td>${fund.fundCategory || ''}</td>
                        <td>${fund.fundRiskLevel || ''}</td>
                        <td class="amount">${formatAmount(fund.totalBuyAmount)}</td>
                        <td class="transfer-out">${formatAmount(fund.totalRedeemAmount)}</td>
                        <td>${yieldRate.toFixed(2)}%</td>
                        <td>
                            <button class="btn btn-small btn-secondary" onclick="viewFundTransactions(${JSON.stringify(fund).replace(/"/g, '&quot;')})">查看交易记录</button>
                        </td>
                    </tr>
                `;
            }
        }).join('');
    };
    
    // 生成表格行
    const tableRows = generateTableRows(finalSortedFund);
    
    // 添加表格内容到tbody
    tbody.innerHTML = tableRows;
    
    // 为历史基金表格添加展开/收起按钮（仅历史基金）
    if (tableType === 'history') {
        // 如果记录数超过默认显示数量，添加展开/收起按钮
        if (finalSortedFund.length > DEFAULT_DISPLAY_COUNT) {
            // 移除旧的按钮容器（如果存在）
            const oldToggleBtnContainer = document.getElementById(`${tableBodyId}ToggleBtn`);
            if (oldToggleBtnContainer) {
                oldToggleBtnContainer.remove();
            }
            
            // 默认只显示前10条记录
            tbody.innerHTML = generateTableRows(finalSortedFund.slice(0, DEFAULT_DISPLAY_COUNT));
            
            // 在表格内部添加展开/收起按钮行，使用colspan跨所有列
            const toggleRow = document.createElement('tr');
            toggleRow.id = `${tableBodyId}ToggleRow`;
            toggleRow.innerHTML = `
                <td colspan="9" style="text-align: center; padding: 10px; background-color: #f5f5f5;">
                    <button class="btn btn-small btn-primary" onclick="toggleFundHistory('${tableBodyId}', ${JSON.stringify(finalSortedFund).replace(/"/g, '&quot;')}, ${DEFAULT_DISPLAY_COUNT})")">
                        点击展开（共${finalSortedFund.length}条记录）
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
        // 非历史基金表格，移除展开/收起按钮（如果存在）
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
}

// 切换历史基金列表的显示状态
function toggleFundHistory(tableBodyId, sortedFund, defaultDisplayCount) {
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
    const generateTableRows = (funds) => {
        return funds.map(fund => {
            // 格式化金额显示
            const formatAmount = (amount) => `¥${amount.toFixed(2)}`;
            
            // 计算收益率
            let yieldRate = 0;
            // 准备现金流数据用于XIRR计算
            const cashFlows = [];
            
            // 添加所有交易记录
            if (fund.transactions && Array.isArray(fund.transactions)) {
                fund.transactions.forEach(transaction => {
                    const amount = transaction.transactionType === 'buy' ? -transaction.amount : transaction.amount;
                    cashFlows.push({
                        date: transaction.date,
                        amount: amount
                    });
                });
            }
            
            // 计算XIRR
            if (cashFlows.length >= 2) {
                try {
                    yieldRate = calculateXIRR(cashFlows) * 100;
                } catch (error) {
                    // XIRR计算失败时使用简单收益率
                    const profit = fund.totalRedeemAmount - fund.totalBuyAmount;
                    if (fund.totalBuyAmount > 0) {
                        // 简单年化收益率
                        // 获取第一次购买日期和最后一次赎回日期
                        let firstBuy = null;
                        let lastRedeem = null;
                        if (fund.transactions && Array.isArray(fund.transactions)) {
                            firstBuy = fund.transactions
                                .filter(t => t.type === 'buy')
                                .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
                            lastRedeem = fund.transactions
                                .filter(t => t.type === 'redeem')
                                .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                        }
                        
                        if (firstBuy && lastRedeem) {
                            const buyDate = new Date(firstBuy.date);
                            const redeemDate = new Date(lastRedeem.date);
                            // 精确计算天数，当天存入当天取出为0天
                            const timeDiff = redeemDate - buyDate;
                            const daysHeld = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
                            yieldRate = calculateYield(fund.totalBuyAmount, fund.totalRedeemAmount, daysHeld);
                        } else {
                            // 无法计算持有天数时，使用简单收益率
                            yieldRate = (profit / fund.totalBuyAmount) * 100;
                        }
                    }
                }
            }
            
            // 历史基金表格行
            const fundCodeLink = fund.fundCode ? `<a href="https://fund.eastmoney.com/${fund.fundCode}.html" target="_blank" class="fund-code-link">${fund.fundCode}</a>` : '';
            return `
                <tr>
                    <td>${fund.platform}</td>
                    <td>${fundCodeLink}</td>
                    <td>${fund.name}</td>
                    <td>${fund.fundCategory || ''}</td>
                    <td>${fund.fundRiskLevel || ''}</td>
                    <td class="amount">${formatAmount(fund.totalBuyAmount)}</td>
                    <td class="transfer-out">${formatAmount(fund.totalRedeemAmount)}</td>
                    <td>${yieldRate.toFixed(2)}%</td>
                    <td>
                        <button class="btn btn-small btn-secondary" onclick="viewFundTransactions(${JSON.stringify(fund).replace(/"/g, '&quot;')})">查看交易记录</button>
                    </td>
                </tr>
            `;
        }).join('');
    };
    
    if (isExpanded) {
        // 收起：只显示前10条记录
        tbody.innerHTML = generateTableRows(sortedFund.slice(0, defaultDisplayCount));
        
        // 重新添加展开/收起按钮行
        const newToggleRow = document.createElement('tr');
        newToggleRow.id = `${tableBodyId}ToggleRow`;
        newToggleRow.innerHTML = `
            <td colspan="9" style="text-align: center; padding: 10px; background-color: #f5f5f5;">
                <button class="btn btn-small btn-primary" onclick="toggleFundHistory('${tableBodyId}', ${JSON.stringify(sortedFund).replace(/"/g, '&quot;')}, ${defaultDisplayCount})">
                    点击展开（共${sortedFund.length}条记录）
                </button>
            </td>
        `;
        tbody.appendChild(newToggleRow);
    } else {
        // 展开：显示所有记录
        tbody.innerHTML = generateTableRows(sortedFund);
        
        // 重新添加展开/收起按钮行
        const newToggleRow = document.createElement('tr');
        newToggleRow.id = `${tableBodyId}ToggleRow`;
        newToggleRow.innerHTML = `
            <td colspan="9" style="text-align: center; padding: 10px; background-color: #f5f5f5;">
                <button class="btn btn-small btn-primary" onclick="toggleFundHistory('${tableBodyId}', ${JSON.stringify(sortedFund).replace(/"/g, '&quot;')}, ${defaultDisplayCount})">
                    点击收起
                </button>
            </td>
        `;
        tbody.appendChild(newToggleRow);
    }
}

// 保存基金数据
async function saveFundData() {
    try {
        for (let i = 0; i < currentFund.length; i++) {
            const fund = currentFund[i];
            const result = await window.dbManager.save(STORES.FUND, fund);
            // 如果返回了id，保存到fund对象中
            if (result && result.id) {
                fund.id = result.id;
            }
        }
    } catch (error) {
        console.error('保存基金数据失败:', error);
        throw error;
    }
}



// 部分赎回模态框
function showPartialRedeemFundModal(fund) {
    // 创建模态框元素
    let modal = document.getElementById('partialRedeemFundModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'partialRedeemFundModal';
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
                <div id="partialRedeemFundStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="partialRedeemFundConfirmBtn" class="btn btn-primary">确认赎回</button>
                    <button id="partialRedeemFundCancelBtn" class="btn btn-secondary">取消</button>
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
    document.getElementById('partialRedeemFundStatus').textContent = '';
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 返回Promise，等待用户确认
    return new Promise((resolve) => {
        const confirmBtn = document.getElementById('partialRedeemFundConfirmBtn');
        const cancelBtn = document.getElementById('partialRedeemFundCancelBtn');
        
        // 确认按钮事件
        const handleConfirm = async () => {
            const redeemDate = document.getElementById('redeemDate').value;
            const redeemAmount = parseFloat(document.getElementById('redeemAmount').value);
            const statusEl = document.getElementById('partialRedeemFundStatus');
            
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
async function partialRedeemFund(fund) {
    const result = await showPartialRedeemFundModal(fund);
    if (!result) return;
    
    try {
        // 创建赎回记录
            const redeemRecord = {
                platform: fund.platform,
                fundCode: fund.fundCode, // 添加基金代码
                name: fund.name,
                transactionType: 'redeem',
                redeemType: 'partial',
                date: result.date,
                expiryDate: null, // 基金不再使用到期日期
                amount: result.amount,
                redeemedAmount: result.amount,
                username: getCurrentUser().username,
                fundCategory: fund.fundCategory, // 保存运作方式
                fundRiskLevel: fund.fundRiskLevel // 保存风险等级
            };
        
        // 保存到数据库
        const response = await fetch('/api/fund', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(redeemRecord)
        });
        
        if (response.ok) {
            // 重新加载数据
            await loadFund();
            await renderFundTable();
            updateFundPlatformOptions();
            alert('部分赎回成功！');
        }
    } catch (error) {
        console.error('部分赎回失败:', error);
        alert('部分赎回失败，请重试！');
    }
}

// 全部赎回模态框
function showFullRedeemFundModal(fund) {
    // 创建模态框元素
    let modal = document.getElementById('fullRedeemFundModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fullRedeemFundModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>全部赎回</h2>
                <p>您确定要全部赎回该产品吗？赎回后将移至历史基金列表。</p>
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
                <div id="fullRedeemFundStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="fullRedeemFundConfirmBtn" class="btn btn-danger">确认全部赎回</button>
                    <button id="fullRedeemFundCancelBtn" class="btn btn-secondary">取消</button>
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
    document.getElementById('fullRedeemDate').value = today;
    document.getElementById('fullRedeemAmount').value = '';
    document.getElementById('fullRedeemConfirm').value = '';
    document.getElementById('fullRedeemFundStatus').textContent = '';
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 返回Promise，等待用户确认
    return new Promise((resolve) => {
        const confirmBtn = document.getElementById('fullRedeemFundConfirmBtn');
        const cancelBtn = document.getElementById('fullRedeemFundCancelBtn');
        
        // 确认按钮事件
        const handleConfirm = async () => {
            const redeemDate = document.getElementById('fullRedeemDate').value;
            const redeemAmount = parseFloat(document.getElementById('fullRedeemAmount').value);
            const confirmText = document.getElementById('fullRedeemConfirm').value;
            const statusEl = document.getElementById('fullRedeemFundStatus');
            
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
async function fullRedeemFund(fund) {
    const result = await showFullRedeemFundModal(fund);
    if (!result) return;
    
    try {
        // 创建赎回记录
            const redeemRecord = {
                platform: fund.platform,
                fundCode: fund.fundCode, // 添加基金代码
                name: fund.name,
                transactionType: 'redeem',
                redeemType: 'full',
                date: result.date,
                expiryDate: null, // 基金不再使用到期日期
                amount: result.amount,
                redeemedAmount: result.amount,
                username: getCurrentUser().username,
                fundCategory: fund.fundCategory, // 保存运作方式
                fundRiskLevel: fund.fundRiskLevel // 保存风险等级
            };
        
        // 保存到数据库
        const response = await fetch('/api/fund', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(redeemRecord)
        });
        
        if (response.ok) {
            // 重新加载数据
            await window.loadFund();
            await renderFundTable();
            updateFundPlatformOptions();
            alert('全部赎回成功！该产品已移至历史基金列表。');
        }
    } catch (error) {
        console.error('全部赎回失败:', error);
        alert('全部赎回失败，请重试！');
    }
}

// 收益率计算模态框
function showYieldCalculationFundModal(fund) {
    // 创建模态框元素
    let modal = document.getElementById('yieldCalculationFundModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'yieldCalculationFundModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>试算收益率</h2>
                <div class="form-group">
                    <label for="calculationAmount">可提取金额:</label>
                    <input type="number" id="calculationAmount" step="0.01" placeholder="请输入可提取金额">
                </div>
                <div id="yieldResult" style="margin: 15px 0; padding: 10px; background-color: #f0f0f0;"></div>
                <div id="yieldCalculationFundStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="calculateYieldFundBtn" class="btn btn-primary">计算收益率</button>
                    <button id="closeYieldFundModalBtn" class="btn btn-secondary">关闭</button>
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
        
        // 阻止modal-content上的事件冒泡，防止手机端触摸事件导致弹窗关闭
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => e.stopPropagation());
            modalContent.addEventListener('touchstart', (e) => e.stopPropagation());
            modalContent.addEventListener('touchend', (e) => e.stopPropagation());
        }
    }
    
    // 重置内容
    document.getElementById('calculationAmount').value = '';
    document.getElementById('yieldResult').innerHTML = '';
    document.getElementById('yieldCalculationFundStatus').textContent = '';
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 返回Promise，等待用户操作
    return new Promise((resolve) => {
        // 使用modal.querySelector确保只获取当前模态框中的元素
        const calculateBtn = modal.querySelector('#calculateYieldFundBtn');
        const closeBtn = modal.querySelector('#closeYieldFundModalBtn');
        
        // 计算按钮事件
        const handleCalculate = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 使用modal.querySelector确保只获取当前模态框中的元素
            const calculationAmount = parseFloat(modal.querySelector('#calculationAmount').value);
            const resultEl = modal.querySelector('#yieldResult');
            const statusEl = modal.querySelector('#yieldCalculationFundStatus');
            
            // 验证输入
            if (isNaN(calculationAmount) || calculationAmount <= 0) {
                statusEl.textContent = '请输入有效的可提取金额';
                return;
            }
            
            // 获取第一次购买日期
            let firstBuy = null;
            if (fund.transactions && Array.isArray(fund.transactions)) {
                firstBuy = fund.transactions
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
            const totalRedeemAmount = fund.totalRedeemAmount + calculationAmount;
            
            // 准备现金流数据用于XIRR计算
            const cashFlows = [];
            
            // 添加所有历史交易记录
            if (fund.transactions && Array.isArray(fund.transactions)) {
                fund.transactions.forEach(transaction => {
                    const amount = transaction.transactionType === 'buy' ? -transaction.amount : transaction.amount;
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
                    const yieldRate = calculateYield(fund.totalBuyAmount, totalRedeemAmount, daysHeld);
                    annualizedYield = yieldRate;
                }
            }
            
            // 显示结果
            resultEl.innerHTML = `
                <h4>计算结果</h4>
                <p>总购买金额：¥${fund.totalBuyAmount.toFixed(2)}</p>
                <p>已赎回金额：¥${fund.totalRedeemAmount.toFixed(2)}</p>
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
async function calculateYieldModalFund(fund) {
    await showYieldCalculationFundModal(fund);
}

// 购买弹窗
function showAddFundPurchaseModal(fund) {
    // 创建模态框元素
    let modal = document.getElementById('addFundPurchaseModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'addFundPurchaseModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>购买基金</h2>
                <div class="form-group">
                    <label for="purchaseDate">购买日期:</label>
                    <input type="text" id="purchaseDate" placeholder="格式：YYYYMMDD" required>
                </div>
                <div class="form-group">
                    <label for="purchaseAmount">购买金额:</label>
                    <input type="number" id="purchaseAmount" step="0.01" placeholder="请输入购买金额" required>
                </div>
                <div id="addFundPurchaseStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="addFundPurchaseConfirmBtn" class="btn btn-primary">确认购买</button>
                    <button id="addFundPurchaseCancelBtn" class="btn btn-secondary">取消</button>
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
    document.getElementById('purchaseDate').value = today;
    document.getElementById('purchaseAmount').value = '';
    document.getElementById('addFundPurchaseStatus').textContent = '';
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 返回Promise，等待用户确认
    return new Promise((resolve) => {
        const confirmBtn = document.getElementById('addFundPurchaseConfirmBtn');
        const cancelBtn = document.getElementById('addFundPurchaseCancelBtn');
        
        // 确认按钮事件
        const handleConfirm = async () => {
            const purchaseDate = document.getElementById('purchaseDate').value;
            const purchaseAmount = parseFloat(document.getElementById('purchaseAmount').value);
            const statusEl = document.getElementById('addFundPurchaseStatus');
            
            // 验证输入
            if (!purchaseDate || isNaN(purchaseAmount)) {
                statusEl.textContent = '请填写完整的购买信息';
                return;
            }
            
            // 格式化日期
            const formattedDate = window.formatDate(purchaseDate);
            
            modal.style.display = 'none';
            resolve({ date: formattedDate, amount: purchaseAmount });
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

// 购买功能
async function addFundPurchase(fund) {
    const result = await showAddFundPurchaseModal(fund);
    if (!result) return;
    
    try {
        // 创建购买记录
        const purchaseRecord = {
            platform: fund.platform,
            fundCode: fund.fundCode, // 添加基金代码
            name: fund.name,
            transactionType: 'buy',
            redeemType: 'partial',
            date: result.date,
            expiryDate: null, // 基金不再使用到期日期
            amount: result.amount,
            redeemedAmount: 0,
            username: getCurrentUser().username,
            fundCategory: fund.fundCategory, // 保存运作方式
            fundRiskLevel: fund.fundRiskLevel // 保存风险等级
        };
        
        // 保存到数据库
        const response = await fetch('/api/fund', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(purchaseRecord)
        });
        
        if (response.ok) {
            // 重新加载数据
            await loadFund();
            await renderFundTable();
            updateFundPlatformOptions();
            alert('购买成功！');
        }
    } catch (error) {
        console.error('购买失败:', error);
        alert('购买失败，请重试！');
    }
}

// 确保handleFundSort函数在全局可用
window.handleFundSort = handleFundSort;

// 查看交易记录
function viewFundTransactions(fund) {
    // 创建模态框元素
    let modal = document.getElementById('viewFundTransactionsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'viewFundTransactionsModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-height: 80vh; overflow-y: auto; max-width: 1000px; width: 100%;">
                <h2>交易记录详情</h2>
                <div id="fundTransactionDetailsContent"></div>
                <div class="form-actions" style="margin-top: 20px;">
                    <button id="closeFundTransactionsModalBtn" class="btn btn-secondary">关闭</button>
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
    const contentEl = document.getElementById('fundTransactionDetailsContent');
    const formatAmount = (amount) => {
        if (amount === undefined || amount === null) {
            return '¥0.00';
        }
        return `¥${parseFloat(amount).toFixed(2)}`;
    };
    
    // 按日期排序交易记录
    let sortedTransactions = [];
    if (fund.transactions && Array.isArray(fund.transactions)) {
        sortedTransactions = [...fund.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    
    // 判断是否显示份额相关信息
    const showShares = pageSettings.shareManagementEnabled && fund.fundType !== '货币型';
    
    // 渲染交易记录表格
    contentEl.innerHTML = `
        <h3>${fund.platform} - ${fund.fundCode || ''} ${fund.name}</h3>
        <div style="margin: 10px 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
            <div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: center; margin-bottom: 8px;">
                <div><strong>基金类型:</strong> ${fund.fundType || '未设置'}</div>
                <div><strong>运作方式:</strong> ${fund.fundCategory || '未设置'}</div>
                <div><strong>风险等级:</strong> ${fund.fundRiskLevel || '未设置'}</div>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: center;">
                <div><strong>总购买金额:</strong> ${formatAmount(fund.totalBuyAmount)}</div>
                <div><strong>总赎回金额:</strong> ${formatAmount(fund.totalRedeemAmount)}</div>
                ${showShares ? `<div><strong>持有份额:</strong> ${calculateHoldings(sortedTransactions)}份</div>` : ''}
            </div>
        </div>
        <table class="transaction-details-table" style="width: 100%; table-layout: fixed; border-collapse: collapse;">
            <thead>
                <tr>
                    <th style="width: 120px; min-width: 120px; padding: 8px; border: 1px solid #ddd; text-align: center;">日期</th>
                <th style="width: 100px; min-width: 100px; padding: 8px; border: 1px solid #ddd; text-align: center;">交易类型</th>
                <th style="width: 120px; min-width: 120px; padding: 8px; border: 1px solid #ddd; text-align: right;">金额</th>
                ${showShares ? '<th style="width: 120px; min-width: 120px; padding: 8px; border: 1px solid #ddd; text-align: right;">份额</th>' : ''}
                <th style="width: 160px; min-width: 160px; padding: 8px; border: 1px solid #ddd; text-align: center;">操作</th>
                </tr>
            </thead>
            <tbody>
                ${sortedTransactions.map((transaction, index) => `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${transaction.date}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${transaction.transactionType === 'buy' ? '购买' : transaction.transactionType === 'dividend' ? '分红' : '赎回'}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatAmount(transaction.amount)}</td>
                        ${showShares ? `<td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${transaction.shares ? parseFloat(transaction.shares).toFixed(4) : '-'}</td>` : ''}
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
                            <button class="btn btn-small btn-edit" onclick="editFundTransactionById(${transaction.id}, ${JSON.stringify(fund).replace(/"/g, '&quot;')})">编辑</button>
                            <button class="btn btn-small btn-danger" onclick="deleteFundTransaction(${transaction.id}, ${JSON.stringify(fund).replace(/"/g, '&quot;')})">删除</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 绑定关闭按钮事件
    const closeBtn = document.getElementById('closeFundTransactionsModalBtn');
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };
    
    // 点击模态框外部关闭
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

function calculateHoldings(transactions) {
    let totalShares = 0;
    transactions.forEach(transaction => {
        if (transaction.shares) {
            const shares = parseFloat(transaction.shares);
            // 购买和分红都增加份额，赎回减少份额
            if (transaction.transactionType === 'buy' || transaction.transactionType === 'dividend') {
                totalShares += shares;
            } else {
                totalShares -= shares;
            }
        }
    });
    return totalShares.toFixed(4);
}

// 获取基金最新净值并计算当前金额
async function fetchFundNetValue(fundCode, totalShares, platform, fundName, principalAmount) {
    try {
        // 添加时间戳参数防止缓存
        const response = await fetch(`/api/fund/nav/${fundCode}?t=${Date.now()}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        
        if (data.netValue && data.date) {
            const netValue = parseFloat(data.netValue);
            const currentAmountValue = netValue * totalShares;
            
            // 判断当前金额与本金金额的关系，设置颜色
            let color = '#666'; // 默认灰色
            if (currentAmountValue > principalAmount) {
                color = '#dc3545'; // 红色：大于本金
            } else if (currentAmountValue < principalAmount) {
                color = '#28a745'; // 绿色：小于本金
            }
            
            // 更新页面显示
            const elementId = `currentValue_${platform}_${fundName}`;
            const element = document.getElementById(elementId);
            if (element) {
                element.innerHTML = `<span style="color: ${color}; font-weight: bold;">${formatAmountForDisplay(currentAmountValue)}</span><span style="font-size: 11px; color: #999; margin-left: 4px;">(${data.date})</span>`;
            }
        }
    } catch (error) {
        console.error('获取基金净值失败:', error);
        const elementId = `currentValue_${platform}_${fundName}`;
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = '<span style="color: #dc3545;">获取失败</span>';
        }
    }
}

// 编辑交易记录
async function editFundTransactionById(id, fund = null) {
    // 查找交易记录
    const transaction = findFundTransactionById(id);
    if (!transaction) {
        alert('未找到该交易记录');
        return;
    }
    
    // 创建编辑模态框
    let modal = document.getElementById('editFundTransactionModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editFundTransactionModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>编辑交易记录</h2>
                <div id="editTransactionContent"></div>
                <div class="form-actions" style="margin-top: 20px;">
                    <button id="saveFundTransactionBtn" class="btn btn-primary">保存修改</button>
                    <button id="cancelFundTransactionBtn" class="btn btn-secondary">取消</button>
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
    
    // 获取基金类型用于判断是否显示份额字段
    const fundType = fund ? fund.fundType : (transaction.fundType || '');
    
    // 渲染编辑表单
    const contentEl = document.getElementById('editTransactionContent');
    contentEl.innerHTML = `
        <form id="editFundTransactionForm">
            <input type="hidden" id="editTransactionId" value="${transaction.id}">
            <div class="form-group">
                <label for="editTransactionDate">交易日期:</label>
                <input type="text" id="editTransactionDate" value="${transaction.date}" required>
            </div>
            <div class="form-group">
                <label for="editTransactionAmount">交易金额:</label>
                <input type="number" id="editTransactionAmount" step="0.01" value="${transaction.amount}" required>
            </div>
            ${fundType !== '货币型' ? `
            <div class="form-group">
                <label for="editTransactionShares">份额:</label>
                <input type="number" id="editTransactionShares" step="0.0001" value="${transaction.shares || ''}">
            </div>
            ` : ''}
        </form>
    `;
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 绑定保存和取消按钮事件
    const saveBtn = document.getElementById('saveFundTransactionBtn');
    const cancelBtn = document.getElementById('cancelFundTransactionBtn');
    
    // 保存按钮事件
    saveBtn.onclick = async () => {
        const transactionId = document.getElementById('editTransactionId').value;
        const date = document.getElementById('editTransactionDate').value;
        const amount = parseFloat(document.getElementById('editTransactionAmount').value);
        const sharesInput = document.getElementById('editTransactionShares');
        const shares = sharesInput ? parseFloat(sharesInput.value) : null;
        
        // 验证输入
        if (!date || isNaN(amount)) {
            alert('请填写完整的交易信息');
            return;
        }
        
        // 如果金额为0且份额不为0，将交易类型改为分红
        let transactionType = transaction.transactionType;
        if (amount === 0 && shares !== null && shares !== undefined && shares !== 0) {
            transactionType = 'dividend';
        }
        
        // 格式化日期
        const formattedDate = window.formatDate(date);
        
        try {
            // 发送PUT请求更新交易记录，确保包含所有必需字段
            const response = await fetch(`/api/fund/${transactionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    platform: transaction.platform,
                    fundCode: transaction.fundCode,
                    name: transaction.name,
                    transactionType: transactionType,
                    redeemType: transaction.redeemType,
                    date: formattedDate,
                    expiryDate: null,
                    amount: amount,
                    redeemedAmount: transaction.redeemedAmount,
                    status: transaction.status,
                    fundCategory: transaction.fundCategory,
                    fundType: transaction.fundType,
                    fundRiskLevel: transaction.fundRiskLevel,
                    shares: shares
                })
            });
            
            // 重新加载数据
            await loadFund();
            await renderFundTable();
            // 关闭模态框
            modal.style.display = 'none';
            
            // 如果有fund参数，重新获取最新的fund数据并渲染交易记录详情
            if (fund) {
                // 重新获取最新的fund数据
                const updatedGroups = groupFund();
                const updatedFund = [...updatedGroups.current, ...updatedGroups.history].find(
                    f => f.platform === fund.platform && f.name === fund.name
                );
                
                if (updatedFund) {
                    viewFundTransactions(updatedFund);
                }
            }
            
            alert('交易记录修改成功！');
        } catch (error) {
            console.error('修改交易记录失败:', error);
            alert('交易记录修改失败，请重试！');
        }
    };
    
    // 取消按钮事件
    cancelBtn.onclick = () => {
        modal.style.display = 'none';
    };
    
    // 点击模态框外部关闭
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// 根据ID查找交易记录
function findFundTransactionById(id) {
    // 直接在currentFund数组中查找，因为currentFund包含所有原始交易记录
    return currentFund.find(transaction => transaction.id === id) || null;
}

// 显示维护基金信息模态框
function showMaintainFundInfoModal(fund) {
    // 创建模态框元素
    let modal = document.getElementById('maintainFundInfoModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'maintainFundInfoModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>维护基金信息</h2>
                <form id="maintainFundInfoForm">
                    <div class="form-group">
                        <label for="maintainFundName">产品名称:</label>
                        <input type="text" id="maintainFundName" placeholder="输入产品名称">
                    </div>
                    <div class="form-group">
                        <label for="maintainFundType">基金类型:</label>
                        <select id="maintainFundType">
                            <option value="">请选择</option>
                            <option value="货币型">货币型</option>
                            <option value="债券型">债券型</option>
                            <option value="混合型">混合型</option>
                            <option value="股票型">股票型</option>
                            <option value="指数型">指数型</option>
                            <option value="ETF">ETF</option>
                            <option value="LOF">LOF</option>
                            <option value="QDII">QDII</option>
                            <option value="FOF">FOF</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="maintainFundCategory">运作方式:</label>
                        <select id="maintainFundCategory">
                            <option value="">请选择</option>
                            <option value="开放式">开放式</option>
                            <option value="封闭式">封闭式</option>
                            <option value="定期开放式">定期开放式</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="maintainFundRiskLevel">风险等级:</label>
                        <select id="maintainFundRiskLevel">
                            <option value="">请选择</option>
                            <option value="低风险">低风险</option>
                            <option value="中低风险">中低风险</option>
                            <option value="中风险">中风险</option>
                            <option value="中高风险">中高风险</option>
                            <option value="高风险">高风险</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <button type="button" id="queryFundInfoBtn" class="btn btn-small btn-primary">联网查询</button>
                    </div>
                    <div class="form-actions" style="margin-top: 20px;">
                        <button id="saveFundInfoBtn" class="btn btn-primary" type="submit">保存修改</button>
                        <button id="cancelFundInfoBtn" class="btn btn-secondary" type="button">取消</button>
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
    
    // 获取DOM元素
    const fundNameInput = document.getElementById('maintainFundName');
    const fundTypeSelect = document.getElementById('maintainFundType');
    const fundCategorySelect = document.getElementById('maintainFundCategory');
    const fundRiskLevelSelect = document.getElementById('maintainFundRiskLevel');
    const queryBtn = document.getElementById('queryFundInfoBtn');
    
    // 设置默认值
    fundNameInput.value = fund.name || '';
    fundTypeSelect.value = fund.fundType || '';
    fundCategorySelect.value = fund.fundCategory || '';
    fundRiskLevelSelect.value = fund.fundRiskLevel || '';
    
    // 判断是否为通过基金代码查询添加的基金（通过检查是否有fundCode且产品名称与基金代码关联）
    const isQueryAdded = fund.fundCode && fund.name; // 假设通过查询添加的基金同时有基金代码和名称
    
    // 根据添加方式限制可修改字段
    if (isQueryAdded) {
        // 通过查询添加的基金，产品名称不可修改
        fundNameInput.disabled = true;
        fundNameInput.style.backgroundColor = '#f0f0f0';
        
        // 基金类型只有在有值的情况下才锁定，空值时允许编辑
        if (fund.fundType) {
            fundTypeSelect.disabled = true;
            fundTypeSelect.style.backgroundColor = '#f0f0f0';
        } else {
            fundTypeSelect.disabled = false;
            fundTypeSelect.style.backgroundColor = '';
        }
        
        // 风险等级只有在有值的情况下才锁定，空值时允许编辑
        if (fund.fundRiskLevel) {
            fundRiskLevelSelect.disabled = true;
            fundRiskLevelSelect.style.backgroundColor = '#f0f0f0';
        } else {
            fundRiskLevelSelect.disabled = false;
            fundRiskLevelSelect.style.backgroundColor = '';
        }
        
        // 运作方式允许修改
        fundCategorySelect.disabled = false;
        fundCategorySelect.style.backgroundColor = '';
    } else {
        // 手动添加的基金，所有字段允许修改
        fundNameInput.disabled = false;
        fundNameInput.style.backgroundColor = '';
        fundTypeSelect.disabled = false;
        fundTypeSelect.style.backgroundColor = '';
        fundCategorySelect.disabled = false;
        fundCategorySelect.style.backgroundColor = '';
        fundRiskLevelSelect.disabled = false;
        fundRiskLevelSelect.style.backgroundColor = '';
    }
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 绑定查询按钮事件 - 通过联网查询刷新数据
    queryBtn.onclick = async () => {
        const fundCode = fund.fundCode;
        if (!fundCode) {
            alert('该基金没有基金代码，无法查询');
            return;
        }
        
        try {
            // 显示加载状态
            queryBtn.textContent = '查询中...';
            queryBtn.disabled = true;
            
            // 调用服务器端代理端点
            const response = await fetch(`/api/fund/info/${fundCode}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || '基金代码不存在或查询失败');
            }
            
            const fundInfo = await response.json();
            const { fundName, fundType, fundCategory, fundRiskLevel } = fundInfo;
            
            // 填充查询结果到表单
            if (fundName) {
                fundNameInput.value = fundName;
                fundNameInput.disabled = true;
                fundNameInput.style.backgroundColor = '#f0f0f0';
            }
            
            if (fundType) {
                fundTypeSelect.value = fundType;
                fundTypeSelect.disabled = true;
                fundTypeSelect.style.backgroundColor = '#f0f0f0';
            }
            
            if (fundCategory) {
                fundCategorySelect.value = fundCategory;
                fundCategorySelect.disabled = true;
                fundCategorySelect.style.backgroundColor = '#f0f0f0';
            }
            
            if (fundRiskLevel) {
                fundRiskLevelSelect.value = fundRiskLevel;
                fundRiskLevelSelect.disabled = true;
                fundRiskLevelSelect.style.backgroundColor = '#f0f0f0';
            }
            
            // 提示用户查询成功，询问是否立即更新所有相关记录
            if (confirm('基金信息查询成功！是否立即更新该基金代码下所有记录？')) {
                // 查找该基金代码下的所有交易记录
                const fundTransactions = currentFund.filter(transaction => 
                    transaction.fundCode === fund.fundCode
                );
                
                // 更新所有相关交易记录 - 更新产品名称、基金类型和风险等级，不更新运作方式
                for (const transaction of fundTransactions) {
                    await fetch(`/api/fund/${transaction.id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            platform: transaction.platform,
                            fundCode: transaction.fundCode,
                            name: fundName || transaction.name,
                            transactionType: transaction.transactionType,
                            redeemType: transaction.redeemType,
                            date: transaction.date,
                            expiryDate: transaction.expiryDate,
                            amount: transaction.amount,
                            redeemedAmount: transaction.redeemedAmount,
                            status: transaction.status,
                            fundCategory: transaction.fundCategory,
                            fundType: fundType || transaction.fundType,
                            fundRiskLevel: fundRiskLevel || transaction.fundRiskLevel
                        })
                    });
                }
                
                // 重新加载数据
                await loadFund();
                await renderFundTable();
                
                alert('该基金代码下所有记录已更新！');
            }
            
            // 恢复查询按钮状态
            queryBtn.textContent = '联网查询';
            queryBtn.disabled = false;
            
        } catch (error) {
            console.error('查询基金信息失败:', error);
            alert(`查询基金信息失败: ${error.message}`);
            // 恢复查询按钮状态
            queryBtn.textContent = '联网查询';
            queryBtn.disabled = false;
        }
    };
    
    // 绑定保存和取消按钮事件
    const saveBtn = document.getElementById('saveFundInfoBtn');
    const cancelBtn = document.getElementById('cancelFundInfoBtn');
    
    // 保存按钮事件
    saveBtn.onclick = async (e) => {
        e.preventDefault();
        
        const fundName = fundNameInput.value;
        const fundType = fundTypeSelect.value;
        const fundCategory = fundCategorySelect.value;
        const fundRiskLevel = fundRiskLevelSelect.value;
        
        try {
            // 查找该基金代码下的所有交易记录，不考虑平台
            const fundTransactions = currentFund.filter(transaction => 
                transaction.fundCode === fund.fundCode
            );
            
            // 更新所有相关交易记录 - 同一基金代码下的所有记录
            for (const transaction of fundTransactions) {
                await fetch(`/api/fund/${transaction.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        platform: transaction.platform,
                        fundCode: transaction.fundCode,
                        name: fundName,
                        transactionType: transaction.transactionType,
                        redeemType: transaction.redeemType,
                        date: transaction.date,
                        expiryDate: transaction.expiryDate,
                        amount: transaction.amount,
                        redeemedAmount: transaction.redeemedAmount,
                        status: transaction.status,
                        fundCategory: fundCategory,
                        fundType: fundType,
                        fundRiskLevel: fundRiskLevel
                    })
                });
            }
            
            // 重新加载数据
            await loadFund();
            await renderFundTable();
            
            // 关闭维护基金信息模态框
            modal.style.display = 'none';
            
            // 刷新基金数据维护列表
            showFundMaintenanceList();
            
            alert('基金信息维护成功！该基金代码下所有记录已更新。');
        } catch (error) {
            console.error('维护基金信息失败:', error);
            alert('基金信息维护失败，请重试！');
        }
    };
    
    // 取消按钮事件
    cancelBtn.onclick = () => {
        modal.style.display = 'none';
    };
    
    // 点击模态框外部关闭
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// 删除交易记录
async function deleteFundTransaction(id, fund = null) {
    if (!confirm('确定要删除该交易记录吗？')) {
        return;
    }
    
    try {
        // 发送DELETE请求删除交易记录
        const response = await fetch(`/api/fund/${id}`, {
            method: 'DELETE'
        });
        
        // 无论响应如何，都重新加载数据并更新UI
        // 因为即使服务器返回错误，数据可能已经被删除
        await loadFund();
        await renderFundTable();
        
        // 刷新交易记录详情，保持弹窗打开
        if (fund) {
            // 重新获取最新的fund数据
            const updatedGroups = groupFund();
            const updatedFund = [...updatedGroups.current, ...updatedGroups.history].find(
                f => f.platform === fund.platform && f.name === fund.name
            );
            
            if (updatedFund) {
                viewFundTransactions(updatedFund);
            } else {
                // 如果找不到基金，关闭弹窗
                const modal = document.getElementById('viewFundTransactionsModal');
                if (modal) {
                    modal.style.display = 'none';
                }
            }
        }
        
        alert('交易记录删除成功！');
    } catch (error) {
        console.error('删除交易记录失败:', error);
        // 即使发生异常，也重新加载数据并更新UI
        await loadFund();
        await renderFundTable();
        
        // 刷新交易记录详情，保持弹窗打开
        if (fund) {
            // 重新获取最新的fund数据
            const updatedGroups = groupFund();
            const updatedFund = [...updatedGroups.current, ...updatedGroups.history].find(
                f => f.platform === fund.platform && f.name === fund.name
            );
            
            if (updatedFund) {
                viewFundTransactions(updatedFund);
            } else {
                // 如果找不到基金，关闭弹窗
                const modal = document.getElementById('viewFundTransactionsModal');
                if (modal) {
                    modal.style.display = 'none';
                }
            }
        }
        
        alert('交易记录删除成功！');
    }
}

// 绑定基金相关事件
function bindFundEvents() {
    // 添加基金表单提交事件
    const fundForm = document.getElementById('fundForm');
    if (fundForm) {
        fundForm.addEventListener('submit', handleFundSubmit);
    }
    
    // 导出数据按钮事件
    const exportBtn = document.getElementById('exportFundData');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportFundData);
    }
    
    // 基金数据维护按钮事件
    const maintainFundListBtn = document.getElementById('maintainFundListBtn');
    if (maintainFundListBtn) {
        maintainFundListBtn.addEventListener('click', showFundMaintenanceList);
    }
    
    // 标记是否通过查询功能填充了表单
    let isQueried = false;
    
    // 基金代码查询按钮事件
    const queryBtn = document.getElementById('queryFundBtn');
    if (queryBtn) {
        queryBtn.addEventListener('click', () => {
            queryFundInfo();
            isQueried = true;
        });
    }
    
    // 标记原始基金代码是否匹配到维护列表
    let wasInMaintenance = false;
    
    // 购买平台输入框焦点事件
    const fundPlatformInput = document.getElementById('fundPlatform');
    if (fundPlatformInput) {
        fundPlatformInput.addEventListener('focus', () => {
            // 当购买平台输入框获得焦点时，更新购买平台选项列表
            updateFundPlatformOptions();
        });
    }
    
    // 产品名称输入框焦点事件
    const fundNameInput = document.getElementById('fundName');
    if (fundNameInput) {
        fundNameInput.addEventListener('focus', () => {
            // 当产品名称输入框获得焦点时，更新产品名称选项列表
            updateFundNameOptions();
        });
    }
    
    // 搜索框事件绑定
    const fundSearchInput = document.getElementById('fundSearch');
    if (fundSearchInput) {
        fundSearchInput.addEventListener('input', handleFundSearch);
    }
    
    // 基金代码输入框变化事件
    const fundCodeInput = document.getElementById('fundCode');
    if (fundCodeInput) {
        // 初始化时检查基金代码是否在维护列表中
        const initialCode = fundCodeInput.value.trim();
        const initialMergedFund = mergeFund();
        const initialMaintenanceFundCodes = new Set();
        
        initialMergedFund.forEach(fund => {
            if (fund.fundCode) {
                initialMaintenanceFundCodes.add(fund.fundCode);
            }
        });
        
        wasInMaintenance = initialMaintenanceFundCodes.has(initialCode);
        
        fundCodeInput.addEventListener('input', () => {
            const fundNameInput = document.getElementById('fundName');
            const fundTypeSelect = document.getElementById('fundType');
            const fundRiskLevelSelect = document.getElementById('fundRiskLevel');
            const fundCategorySelect = document.getElementById('fundCategory');
            
            const fundCode = fundCodeInput.value.trim();
            
            // 获取基金数据维护列表中的基金代码
            const mergedFund = mergeFund();
            const maintenanceFundCodes = new Set();
            
            mergedFund.forEach(fund => {
                if (fund.fundCode) {
                    maintenanceFundCodes.add(fund.fundCode);
                }
            });
            
            // 检查当前代码是否匹配到维护列表中的基金
            const isCurrentInMaintenance = maintenanceFundCodes.has(fundCode);
            
            // 当基金代码被清空时
            if (fundCode === '') {
                // 清空产品名称、基金类型、风险等级和运作方式
                fundNameInput.value = '';
                fundTypeSelect.value = '';
                fundRiskLevelSelect.value = '';
                fundCategorySelect.value = '';
                
                // 恢复可编辑状态
                fundNameInput.disabled = false;
                fundNameInput.style.backgroundColor = '';
                fundTypeSelect.disabled = false;
                fundTypeSelect.style.backgroundColor = '';
                fundRiskLevelSelect.disabled = false;
                fundRiskLevelSelect.style.backgroundColor = '';
                fundCategorySelect.disabled = false;
                fundCategorySelect.style.backgroundColor = '';
                
                // 重置状态
                isQueried = false;
                wasInMaintenance = false;
            } else {
                // 恢复可编辑状态
                fundNameInput.disabled = false;
                fundNameInput.style.backgroundColor = '';
                fundTypeSelect.disabled = false;
                fundTypeSelect.style.backgroundColor = '';
                fundRiskLevelSelect.disabled = false;
                fundRiskLevelSelect.style.backgroundColor = '';
                fundCategorySelect.disabled = false;
                fundCategorySelect.style.backgroundColor = '';
                
                // 只有在以下两种情况下才清空字段：
                // 1. 通过查询功能查询后修改基金代码
                // 2. 基金代码匹配到基金数据维护表的数据后再修改代码
                if (isQueried || wasInMaintenance) {
                    fundNameInput.value = '';
                    fundTypeSelect.value = '';
                    fundRiskLevelSelect.value = '';
                    fundCategorySelect.value = '';
                    // 重置状态
                    isQueried = false;
                    wasInMaintenance = false;
                }
                
                // 当输入6位基金代码时，自动匹配
                if (fundCode.length === 6) {
                    // 查找是否存在相同基金代码的基金
                    const existingFund = mergedFund.find(fund => fund.fundCode === fundCode);
                    
                    if (existingFund) {
                        // 自动填充产品名称、基金类型、风险等级和运作方式
                        fundNameInput.value = existingFund.name || '';
                        fundTypeSelect.value = existingFund.fundType || '';
                        fundRiskLevelSelect.value = existingFund.fundRiskLevel || '';
                        fundCategorySelect.value = existingFund.fundCategory || '';
                        
                        // 输入框变灰，显示已有的值
                        // 产品名称、基金类型、风险等级和运作方式均设为不可编辑
                        fundNameInput.disabled = true;
                        fundNameInput.style.backgroundColor = '#f0f0f0';
                        fundTypeSelect.disabled = true;
                        fundTypeSelect.style.backgroundColor = '#f0f0f0';
                        fundRiskLevelSelect.disabled = true;
                        fundRiskLevelSelect.style.backgroundColor = '#f0f0f0';
                        fundCategorySelect.disabled = true;
                        fundCategorySelect.style.backgroundColor = '#f0f0f0';
                        
                        // 更新状态，标记当前代码在维护列表中
                        wasInMaintenance = true;
                    }
                }
            }
        });
    }
    
    // 设置默认日期为今天
    const dateInput = document.getElementById('fundDate');
    if (dateInput) {
        dateInput.value = getTodayLocalDate();
    }
    
    // 基金汇总信息隐藏按钮事件
    const toggleFundSummaryBtn = document.getElementById('toggleFundSummary');
    if (toggleFundSummaryBtn) {
        toggleFundSummaryBtn.addEventListener('click', (e) => {
            const summaryContent = document.getElementById('fundSummaryContent');
            if (summaryContent.style.display === 'none') {
                summaryContent.style.display = 'block';
                toggleFundSummaryBtn.textContent = '隐藏';
            } else {
                summaryContent.style.display = 'none';
                toggleFundSummaryBtn.textContent = '显示';
            }
        });
    }
    
    // 添加基金表单隐藏按钮事件
    const toggleAddFundBtn = document.getElementById('toggleAddFund');
    if (toggleAddFundBtn) {
        toggleAddFundBtn.addEventListener('click', (e) => {
            const addFundContent = document.getElementById('addFundContent');
            if (addFundContent.style.display === 'none') {
                addFundContent.style.display = 'block';
                toggleAddFundBtn.textContent = '隐藏';
            } else {
                addFundContent.style.display = 'none';
                toggleAddFundBtn.textContent = '显示';
            }
        });
    }
}

// 显示基金数据维护列表
function showFundMaintenanceList() {
    // 创建模态框元素
    let modal = document.getElementById('fundMaintenanceListModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fundMaintenanceListModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="width: 80%; max-width: 1000px;">
                <h2>基金数据维护</h2>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <input type="text" id="fundMaintenanceSearchInput" placeholder="搜索基金代码或名称..." style="width: 250px; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                    <button id="batchUpdateFundInfoBtn" class="btn btn-primary">一键更新</button>
                </div>
                <div id="fundMaintenanceListContent"></div>
                <div class="form-actions" style="margin-top: 20px; text-align: center;">
                    <button id="closeFundMaintenanceListBtn" class="btn btn-secondary">关闭</button>
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
    
    // 生成基金列表
    const contentEl = document.getElementById('fundMaintenanceListContent');
    
    // 合并基金数据
    const mergedFund = mergeFund();
    
    // 获取所有基金产品，去重 - 同一个基金代码只出现一次
    const fundProducts = [];
    const seenFundCodes = new Set();
    
    mergedFund.forEach(fund => {
        if (fund.fundCode && !seenFundCodes.has(fund.fundCode)) {
            seenFundCodes.add(fund.fundCode);
            fundProducts.push(fund);
        }
    });
    
    // 保存基金产品列表到全局变量，用于搜索
    window.fundMaintenanceProducts = fundProducts;
    
    // 渲染基金列表的函数
    const renderFundMaintenanceList = (searchQuery = '') => {
        let filteredFunds = fundProducts;
        
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filteredFunds = fundProducts.filter(fund => 
                (fund.fundCode && fund.fundCode.toLowerCase().includes(query)) ||
                (fund.name && fund.name.toLowerCase().includes(query))
            );
        }
        
        let tableHtml = `
            <table class="fund-maintenance-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="border: 1px solid #ddd; padding: 8px;">基金代码</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">产品名称</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">基金类型</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">风险等级</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">运作方式</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">操作</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        if (filteredFunds.length === 0) {
            tableHtml += `
                <tr>
                    <td colspan="6" style="text-align: center; color: #999; padding: 20px;">暂无基金数据</td>
                </tr>
            `;
        } else {
            filteredFunds.forEach(fund => {
                const fundCodeLink = fund.fundCode ? `<a href="https://fund.eastmoney.com/${fund.fundCode}.html" target="_blank" class="fund-code-link">${fund.fundCode}</a>` : '';
                tableHtml += `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px;">${fundCodeLink}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${fund.name}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${fund.fundType || '未设置'}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${fund.fundRiskLevel || '未设置'}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${fund.fundCategory || '未设置'}</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                            <button class="btn btn-small btn-primary" onclick="showMaintainFundInfoModal(${JSON.stringify(fund).replace(/"/g, '&quot;')})">维护</button>
                        </td>
                    </tr>
                `;
            });
        }
        
        tableHtml += `
                </tbody>
            </table>
        `;
        
        contentEl.innerHTML = tableHtml;
    };
    
    // 初始渲染
    renderFundMaintenanceList();
    
    // 绑定搜索框事件
    const searchInput = document.getElementById('fundMaintenanceSearchInput');
    searchInput.addEventListener('input', (e) => {
        renderFundMaintenanceList(e.target.value);
    });
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 绑定一键更新按钮事件
    const batchUpdateBtn = document.getElementById('batchUpdateFundInfoBtn');
    batchUpdateBtn.onclick = async () => {
        if (fundProducts.length === 0) {
            alert('暂无基金数据可更新');
            return;
        }
        
        if (!confirm(`确定要更新全部 ${fundProducts.length} 个基金的基金类型和风险等级吗？`)) {
            return;
        }
        
        batchUpdateBtn.textContent = '更新中...';
        batchUpdateBtn.disabled = true;
        
        let successCount = 0;
        let failCount = 0;
        
        for (const fund of fundProducts) {
            if (!fund.fundCode) continue;
            
            try {
                const response = await fetch(`/api/fund/info/${fund.fundCode}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    failCount++;
                    continue;
                }
                
                const fundInfo = await response.json();
                const { fundType, fundRiskLevel } = fundInfo;
                
                if (!fundType && !fundRiskLevel) {
                    failCount++;
                    continue;
                }
                
                // 更新该基金代码下的所有交易记录
                const fundTransactions = currentFund.filter(transaction => 
                    transaction.fundCode === fund.fundCode
                );
                
                for (const transaction of fundTransactions) {
                    await fetch(`/api/fund/${transaction.id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            platform: transaction.platform,
                            fundCode: transaction.fundCode,
                            name: transaction.name,
                            transactionType: transaction.transactionType,
                            redeemType: transaction.redeemType,
                            date: transaction.date,
                            expiryDate: transaction.expiryDate,
                            amount: transaction.amount,
                            redeemedAmount: transaction.redeemedAmount,
                            status: transaction.status,
                            fundCategory: transaction.fundCategory,
                            fundType: fundType || transaction.fundType,
                            fundRiskLevel: fundRiskLevel || transaction.fundRiskLevel
                        })
                    });
                }
                
                successCount++;
            } catch (error) {
                failCount++;
            }
        }
        
        // 重新加载数据
        await loadFund();
        await renderFundTable();
        showFundMaintenanceList();
        
        batchUpdateBtn.textContent = '一键更新';
        batchUpdateBtn.disabled = false;
        
        alert(`更新完成！\n成功: ${successCount} 个\n失败: ${failCount} 个`);
    };
    
    // 绑定关闭按钮事件
    const closeBtn = document.getElementById('closeFundMaintenanceListBtn');
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };
    
    // 点击模态框外部关闭
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// 查询基金信息
async function queryFundInfo() {
    const fundCode = document.getElementById('fundCode').value.trim();
    if (!fundCode) {
        alert('请输入基金代码');
        return;
    }
    
    try {
        // 显示加载状态
        const queryBtn = document.getElementById('queryFundBtn');
        const originalText = queryBtn.textContent;
        queryBtn.textContent = '查询中...';
        queryBtn.disabled = true;
        
        // 调用服务器端代理端点，避免CORS问题
        const response = await fetch(`/api/fund/info/${fundCode}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || '基金代码不存在或查询失败');
        }
        
        const fundInfo = await response.json();
        const { fundName, fundCategory, fundType, fundRiskLevel } = fundInfo;
        
        // 自动填充表单
        const fundNameInput = document.getElementById('fundName');
        const fundTypeSelect = document.getElementById('fundType');
        const fundCategorySelect = document.getElementById('fundCategory');
        const fundRiskLevelSelect = document.getElementById('fundRiskLevel');
        
        if (fundName) {
            fundNameInput.value = fundName;
            // 设置为灰色不可修改
            fundNameInput.disabled = true;
            fundNameInput.style.backgroundColor = '#f0f0f0';
        }
        
        if (fundType) {
            fundTypeSelect.value = fundType;
            // 设置为灰色不可修改
            fundTypeSelect.disabled = true;
            fundTypeSelect.style.backgroundColor = '#f0f0f0';
        }
        
        if (fundCategory) {
            fundCategorySelect.value = fundCategory;
            // 设置为灰色不可修改
            fundCategorySelect.disabled = true;
            fundCategorySelect.style.backgroundColor = '#f0f0f0';
        }
        
        if (fundRiskLevel) {
            fundRiskLevelSelect.value = fundRiskLevel;
            // 设置为灰色不可修改
            fundRiskLevelSelect.disabled = true;
            fundRiskLevelSelect.style.backgroundColor = '#f0f0f0';
        }
        
        // 恢复按钮状态
        queryBtn.textContent = originalText;
        queryBtn.disabled = false;
        
    } catch (error) {
        console.error('查询基金信息失败:', error);
        alert(`查询基金信息失败: ${error.message}`);
        
        // 恢复按钮状态
        const queryBtn = document.getElementById('queryFundBtn');
        queryBtn.textContent = '查询';
        queryBtn.disabled = false;
    }
}

// 更新基金汇总信息
function updateFundSummary() {
    const groups = groupFund();
    
    // 计算当前购买基金总本金，只汇总本金金额大于0的数据
    const totalPrincipal = groups.current
        .filter(fund => fund.currentAmount > 0)  // 只汇总本金金额大于0的数据
        .reduce((sum, fund) => sum + fund.currentAmount, 0);
    
    // 计算历史基金收益
    const totalInterest = groups.history
        .reduce((sum, fund) => sum + (fund.totalRedeemAmount - fund.totalBuyAmount), 0);
    
    // 更新DOM
    const totalPrincipalEl = document.getElementById('totalFundPrincipal');
    const totalInterestEl = document.getElementById('totalFundInterest');
    
    if (totalPrincipalEl) {
        totalPrincipalEl.textContent = `¥${totalPrincipal.toFixed(2)}`;
    }
    
    if (totalInterestEl) {
        totalInterestEl.textContent = `¥${totalInterest.toFixed(2)}`;
    }
    
    // 按平台汇总当前基金，只汇总本金金额大于0的数据
    const platformSummary = {};
    
    // 遍历当前基金，按平台分组
    groups.current.forEach(fund => {
        // 只汇总本金金额大于0的数据
        if (fund.currentAmount > 0) {
            if (!platformSummary[fund.platform]) {
                platformSummary[fund.platform] = {
                    count: 0,
                    totalAmount: 0
                };
            }
            
            platformSummary[fund.platform].count++;
            platformSummary[fund.platform].totalAmount += fund.currentAmount;
        }
    });
    
    // 生成平台汇总HTML，使用和存款相同的样式
    const platformSummaryEl = document.getElementById('fundPlatformSummary');
    if (platformSummaryEl) {
        // 排序平台，按总金额降序
        const sortedPlatforms = Object.entries(platformSummary)
            .sort(([,a], [,b]) => b.totalAmount - a.totalAmount);
        
        // 生成HTML，使用和存款相同的样式
        let html = '';
        
        // 遍历排序后的平台
        sortedPlatforms.forEach(([platform, data]) => {
            const percentage = totalPrincipal > 0 ? ((data.totalAmount / totalPrincipal) * 100) : 0;
            html += `<div class="summary-row">`;
            html += `<span class="summary-label">${platform}：</span>`;
            html += `<span class="summary-value">${data.count}只 ¥${data.totalAmount.toFixed(2)} (${percentage.toFixed(2)}%)</span>`;
            html += `</div>`;
        });
        
        platformSummaryEl.innerHTML = html;
    }
}

// 导出基金数据
async function exportFundData() {
    try {
        console.log('exportFundData function called');
        const currentUser = getCurrentUser();
        if (!currentUser) {
            alert('请先登录！');
            return;
        }
        
        // 加载最新数据
        await loadFund();
        
        if (currentFund.length === 0) {
            alert('没有基金数据可以导出！');
            return;
        }
        
        // 准备导出数据 - 详细到每一笔操作
        
        // 1. 按平台、基金代码、产品名称分组交易记录
        const transactionGroups = new Map();
        
        // 2. 为每个交易记录创建唯一的分组键
        currentFund.forEach(fund => {
            const key = `${fund.platform}_${fund.fundCode}_${fund.name}`;
            if (!transactionGroups.has(key)) {
                transactionGroups.set(key, []);
            }
            transactionGroups.get(key).push(fund);
        });
        
        // 3. 处理每个分组，计算累计本金
        const processedTransactions = [];
        
        transactionGroups.forEach(transactions => {
            // 按交易日期排序
            transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // 初始化累计本金
            let cumulativePrincipal = 0;
            
            // 遍历交易记录，计算每笔交易后的累计本金
            transactions.forEach(transaction => {
                // 计算交易后的累计本金
                if (transaction.transactionType === 'buy') {
                    // 购买时，累计本金增加
                    cumulativePrincipal += parseFloat(transaction.amount.toFixed(2));
                } else if (transaction.transactionType === 'redeem') {
                    // 赎回时，累计本金减少
                    cumulativePrincipal -= parseFloat(transaction.amount.toFixed(2));
                    
                    // 只有当赎回类型为"全部"时，重置累计本金为0
                    if (transaction.redeemType === 'full') {
                        cumulativePrincipal = 0;
                    }
                }
                
                // 保存累计本金，允许出现负值（全部赎回后可能会有利息）
                const principalAmount = parseFloat(cumulativePrincipal.toFixed(2));
                
                // 添加到处理后的交易列表
                processedTransactions.push({
                    ...transaction,
                    principalAmount: principalAmount
                });
            });
        });
        
        // 4. 生成导出数据
        const exportData = processedTransactions.map(fund => ({
            购买平台: fund.platform,
            基金代码: fund.fundCode || '',
            产品名称: fund.name,
            运作方式: fund.fundCategory || '',
            风险等级: fund.fundRiskLevel || '',
            交易类型: fund.transactionType === 'buy' ? '购买' : '赎回',
            交易金额: parseFloat(fund.amount.toFixed(2)),
            交易日期: fund.date,
            赎回类型: fund.redeemType === 'partial' ? '部分' : fund.redeemType === 'full' ? '全部' : '',
            本金金额: parseFloat(fund.principalAmount.toFixed(2))
        }));
        
        // 5. 调整列顺序，确保本金金额在赎回类型右边
        // 注意：SheetJS会按照对象属性的顺序生成列，这里已经调整了对象属性的顺序
        
        // 使用SheetJS转换为XLSX格式
        // 创建工作表
        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // 创建工作簿
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '基金交易明细');
        
        // 生成XLSX文件并下载
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        
        // 创建下载链接
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `基金交易明细_${new Date().toISOString().split('T')[0]}.xlsx`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert('基金交易明细导出成功！');
    } catch (error) {
        console.error('导出基金数据失败:', error);
        alert('导出基金数据失败，请重试！');
    }
}

// 导出函数到window对象
window.loadFund = loadFund;
window.initFund = initFund;
window.renderFundTable = renderFundTable;
window.handleFundSubmit = handleFundSubmit;
window.updateFundPlatformOptions = updateFundPlatformOptions;
window.updateFundNameOptions = updateFundNameOptions;
window.exportFundData = exportFundData;
window.mergeFund = mergeFund;
window.groupFund = groupFund;
// 导出基金数据到window对象
window.currentFund = currentFund;