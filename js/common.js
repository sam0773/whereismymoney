// 公共函数模块

// 格式化日期函数（支持多种格式：YYYY-MM-DD、8位数字、Excel序列号、YYYY/M/D、YYYY/MM/DD）
function formatDate(dateValue) {
    // 如果已经是YYYY-MM-DD格式，直接返回
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return dateValue;
    }
    
    // 如果是7位或8位数字，转换为YYYY-MM-DD格式
    if (typeof dateValue === 'string' && /^\d{7,8}$/.test(dateValue)) {
        const year = dateValue.substring(0, 4);
        const month = dateValue.substring(4, 6);
        const day = dateValue.substring(6).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // 处理YYYY/M/D和YYYY/MM/DD格式
    if (typeof dateValue === 'string' && /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateValue)) {
        const parts = dateValue.split('/');
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // 如果是Date对象，转换为YYYY-MM-DD格式
    if (dateValue instanceof Date) {
        // 手动构建ISO格式日期，确保使用本地日期而非UTC时间
        // 避免时区偏移导致的日期错误
        const year = dateValue.getFullYear();
        const month = String(dateValue.getMonth() + 1).padStart(2, '0');
        const day = String(dateValue.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // 如果是Excel日期序列号（支持number和string类型）
    const numericDateValue = typeof dateValue === 'string' ? parseFloat(dateValue) : dateValue;
    if (!isNaN(numericDateValue)) {
        try {
            // Excel日期序列号从1900年1月1日开始
            // 正确处理Excel日期序列号，考虑时区偏移
            const excelBaseDate = new Date(Date.UTC(1899, 11, 30)); // 从1899年12月30日开始，修正Excel的1900年闰年错误
            // 加上天数，使用UTC时间避免时区问题
            const date = new Date(excelBaseDate.getTime() + Math.round(numericDateValue) * 24 * 60 * 60 * 1000);
            
            // 检查是否是有效日期
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (e) {
            // 转换失败，返回原始值
        }
    }
    
    // 尝试使用Date对象解析其他格式字符串
    if (typeof dateValue === 'string') {
        // 尝试直接解析，处理类似"2025-7-23"、"2025/7/23"等格式
        const dateObj = new Date(dateValue);
        if (!isNaN(dateObj.getTime())) {
            // 手动构建ISO格式日期，确保使用本地日期而非UTC时间
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    }
    
    return dateValue;
}

// 计算到期日
function calculateExpiryDate() {
    const periodInput = document.getElementById('depositPeriod');
    const periodUnit = document.getElementById('periodUnit');
    const depositDateInput = document.getElementById('depositDate');
    const expiryDateInput = document.getElementById('depositExpiryDate');
    
    // 如果存期或存入日期未填写，不计算
    if (!periodInput.value || !depositDateInput.value) return;
    
    const periodValue = parseInt(periodInput.value);
    const period = periodUnit.value === 'year' ? periodValue * 12 : periodValue;
    
    // 解析日期字符串，确保按本地时间处理
    const dateStr = formatDate(depositDateInput.value);
    const dateParts = dateStr.split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // 月份从0开始
    const day = parseInt(dateParts[2]);
    
    // 创建日期对象（本地时间）
    const depositDate = new Date(year, month, day);
    
    // 计算到期日期
    const expiryDate = new Date(year, month + period, day);
    
    // 格式化日期为YYYY-MM-DD
    const expiryYear = expiryDate.getFullYear();
    const expiryMonth = String(expiryDate.getMonth() + 1).padStart(2, '0');
    const expiryDay = String(expiryDate.getDate()).padStart(2, '0');
    const expiryDateStr = `${expiryYear}-${expiryMonth}-${expiryDay}`;
    
    expiryDateInput.value = expiryDateStr;
    
    // 同时更新利息
    calculateInterest();
}

// 计算存期
function calculatePeriod() {
    const expiryDateInput = document.getElementById('depositExpiryDate');
    const depositDateInput = document.getElementById('depositDate');
    const periodInput = document.getElementById('depositPeriod');
    const periodUnit = document.getElementById('periodUnit');
    
    // 如果到期日或存入日期未填写，不计算
    if (!expiryDateInput.value || !depositDateInput.value) return;
    
    // 解析存入日期
    const depositDateStr = formatDate(depositDateInput.value);
    const depositParts = depositDateStr.split('-');
    const depositYear = parseInt(depositParts[0]);
    const depositMonth = parseInt(depositParts[1]) - 1;
    const depositDay = parseInt(depositParts[2]);
    
    // 解析到期日期
    const expiryDateStr = formatDate(expiryDateInput.value);
    const expiryParts = expiryDateStr.split('-');
    const expiryYear = parseInt(expiryParts[0]);
    const expiryMonth = parseInt(expiryParts[1]) - 1;
    const expiryDay = parseInt(expiryParts[2]);
    
    // 计算月份差
    const monthsDiff = (expiryYear - depositYear) * 12 + (expiryMonth - depositMonth);
    
    // 根据当前选择的单位显示
    if (periodUnit.value === 'year') {
        periodInput.value = Math.round(monthsDiff / 12 * 100) / 100;
    } else {
        periodInput.value = monthsDiff;
    }
    
    // 同时更新利息
    calculateInterest();
}

// 计算利息
function calculateInterest() {
    const rateInput = document.getElementById('depositRate');
    const amountInput = document.getElementById('depositAmount');
    const periodInput = document.getElementById('depositPeriod');
    const periodUnit = document.getElementById('periodUnit');
    const interestInput = document.getElementById('depositInterest');
    
    // 如果缺少必要参数，不计算
    if (!rateInput.value || !amountInput.value || !periodInput.value) return;
    
    const rate = parseFloat(rateInput.value);
    const amount = parseFloat(amountInput.value);
    const periodValue = parseFloat(periodInput.value);
    const period = periodUnit.value === 'year' ? periodValue * 12 : periodValue;
    
    // 计算利息（单利计算）
    const interest = (amount * rate * period) / (12 * 100);
    interestInput.value = parseFloat(interest.toFixed(2));
}

// 处理日期输入，自动格式化
function handleDateInput(e) {
    const input = e.target;
    const value = input.value.replace(/[^0-9]/g, '');
    
    if (value.length === 8) {
        const year = value.substring(0, 4);
        const month = value.substring(4, 6);
        const day = value.substring(6, 8);
        input.value = `${year}-${month}-${day}`;
    }
}

// 更新汇总信息
function updateSummary() {
    // 获取当前日期
    const today = new Date();
    
    // 从各模块的全局变量中直接计算汇总值
    
    // 计算定期存款总额
    const deposits = window.currentDeposits || [];
    const depositTotalAmount = deposits.reduce((total, deposit) => {
        // 只计算未到期的存款
        // 兼容两种日期字段格式：expiryDate（驼峰命名）和expiry_date（下划线命名）
        const expiryDateStr = deposit.expiryDate || deposit.expiry_date;
        const expiryDate = new Date(expiryDateStr);
        return expiryDate >= today ? total + parseFloat(deposit.amount || 0) : total;
    }, 0);
    
    // 计算基金总额，只包含活跃基金的当前持有金额
    const funds = window.currentFund || [];
    
    // 按平台、基金代码、产品名称分组，类似于fund.js中的mergeFund逻辑
    const groupedByProduct = {};
    funds.forEach(fund => {
        const safeFundCode = fund.fundCode || '';
        const key = `${fund.platform}_${safeFundCode}`;
        if (!groupedByProduct[key]) {
            groupedByProduct[key] = [];
        }
        groupedByProduct[key].push(fund);
    });
    
    // 处理每个产品的交易记录，计算当前持有金额
    let fundTotalAmount = 0;
    for (const [productKey, transactions] of Object.entries(groupedByProduct)) {
        // 按日期排序所有交易记录
        const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // 为每个持有周期创建独立的记录
        let currentBatch = null;
        
        for (const transaction of sortedTransactions) {
            if (transaction.transactionType === 'buy') {
                // 如果没有当前批次或当前批次已全部赎回，创建新批次
                if (!currentBatch || currentBatch.status === 'redeemed') {
                    currentBatch = {
                        transactions: [],
                        totalBuyAmount: 0,
                        totalRedeemAmount: 0,
                        currentAmount: 0,
                        status: 'active'
                    };
                }
                
                // 添加购买记录到当前批次
                currentBatch.transactions.push({
                    id: transaction.id,
                    date: transaction.date,
                    type: transaction.transactionType,
                    amount: parseFloat(transaction.amount || 0),
                    redeemType: transaction.redeemType || ''
                });
                
                currentBatch.totalBuyAmount += parseFloat(transaction.amount || 0);
                currentBatch.currentAmount = currentBatch.totalBuyAmount - currentBatch.totalRedeemAmount;
            } else if (transaction.transactionType === 'redeem') {
                // 如果有当前活跃批次，添加赎回记录
                if (currentBatch && currentBatch.status === 'active') {
                    currentBatch.transactions.push({
                        id: transaction.id,
                        date: transaction.date,
                        type: transaction.transactionType,
                        amount: parseFloat(transaction.amount || 0),
                        redeemType: transaction.redeemType || ''
                    });
                    
                    currentBatch.totalRedeemAmount += parseFloat(transaction.amount || 0);
                    currentBatch.currentAmount = currentBatch.totalBuyAmount - currentBatch.totalRedeemAmount;
                    
                    // 只根据是否使用全部赎回按钮来判断状态
                    if (transaction.redeemType === 'full') {
                        currentBatch.status = 'redeemed';
                    }
                }
            }
        }
        
        // 只有活跃批次才计算当前金额
        if (currentBatch && currentBatch.status === 'active' && currentBatch.currentAmount > 0) {
            fundTotalAmount += currentBatch.currentAmount;
        }
    }
    
    // 计算理财总额，只包含未全部赎回且金额大于0的总和
    const wealths = window.currentWealth || [];
    
    // 按平台、产品名称、产品类型分组，类似于wealth.js中的mergeWealth逻辑
    // 当前活跃批次映射，key根据产品类型和周期类型生成
    // 活期：平台_产品名称_产品类型
    // 周期：平台_产品名称_产品类型_周期类型
    const activeBatches = {};
    const allBatches = [];
    
    // 按日期排序所有交易记录
    const sortedWealthTransactions = [...wealths].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    for (const transaction of sortedWealthTransactions) {
        if (transaction.transactionType === 'buy') {
            // 活期和周期产品合并处理
            if (transaction.type === '活期' || transaction.type === '周期' || transaction.type === '定期') {
                // 生成批次key：活期使用平台_产品名称_产品类型，周期使用平台_产品名称_产品类型_周期类型
                let key;
                if (transaction.type === '活期') {
                    key = `${transaction.platform}_${transaction.name}_${transaction.type}`;
                } else if (transaction.type === '周期') {
                    // 周期产品，使用周期类型作为key的一部分
                    key = `${transaction.platform}_${transaction.name}_${transaction.type}_${transaction.cycleType || '未知'}`;
                } else {
                    // 定期产品，每个购买记录都创建一个独立的批次
                    key = `${transaction.id}_${transaction.date}`;
                }
                
                // 如果没有当前活跃批次，创建新批次
                if (!activeBatches[key]) {
                    const newBatch = {
                        platform: transaction.platform,
                        name: transaction.name,
                        type: transaction.type,
                        cycleType: transaction.cycleType,
                        transactions: [],
                        totalBuyAmount: 0,
                        totalRedeemAmount: 0,
                        currentAmount: 0,
                        status: 'active'
                    };
                    activeBatches[key] = newBatch;
                    allBatches.push(newBatch);
                }
                
                // 添加购买记录到当前批次
                activeBatches[key].transactions.push({
                    id: transaction.id,
                    date: transaction.date,
                    type: transaction.transactionType,
                    amount: parseFloat(transaction.amount || 0),
                    expiryDate: transaction.expiry_date,
                    redeemedAmount: parseFloat(transaction.redeemedAmount || 0),
                    cycleType: transaction.cycleType,
                    redeemType: transaction.redeemType || ''
                });
                
                // 更新批次金额
                activeBatches[key].totalBuyAmount += parseFloat(transaction.amount || 0);
                activeBatches[key].currentAmount = activeBatches[key].totalBuyAmount - activeBatches[key].totalRedeemAmount;
            }
        } else if (transaction.transactionType === 'redeem') {
            // 处理赎回记录
            let foundBatch = null;
            
            // 查找对应的活跃批次
            for (const batch of allBatches) {
                if (batch.status === 'active' && 
                    batch.platform === transaction.platform && 
                    batch.name === transaction.name && 
                    batch.type === transaction.type) {
                    // 对于周期产品，还需要匹配周期类型
                    if (batch.type === '周期') {
                        if (batch.cycleType === transaction.cycleType) {
                            foundBatch = batch;
                            break;
                        }
                    } else {
                        // 活期和定期产品，不需要匹配周期类型
                        foundBatch = batch;
                        break;
                    }
                }
            }
            
            if (foundBatch) {
                // 添加赎回记录到找到的批次
                foundBatch.transactions.push({
                    id: transaction.id,
                    date: transaction.date,
                    type: transaction.transactionType,
                    amount: parseFloat(transaction.amount || 0),
                    expiryDate: transaction.expiry_date,
                    redeemedAmount: parseFloat(transaction.redeemedAmount || 0),
                    cycleType: transaction.cycleType,
                    redeemType: transaction.redeemType || ''
                });
                
                // 更新批次金额
                foundBatch.totalRedeemAmount += parseFloat(transaction.amount || 0);
                foundBatch.currentAmount = foundBatch.totalBuyAmount - foundBatch.totalRedeemAmount;
                
                // 只根据是否使用全部赎回按钮来判断状态，不考虑持有金额
                if (transaction.redeemType === 'full') {
                    foundBatch.status = 'redeemed';
                    // 如果是活期或周期产品，从活跃批次映射中移除
                    if (foundBatch.type === '活期' || foundBatch.type === '周期') {
                        let key;
                        if (foundBatch.type === '活期') {
                            key = `${foundBatch.platform}_${foundBatch.name}_${foundBatch.type}`;
                        } else {
                            // 周期产品，使用周期类型作为key的一部分
                            key = `${foundBatch.platform}_${foundBatch.name}_${foundBatch.type}_${foundBatch.cycleType || '未知'}`;
                        }
                        delete activeBatches[key];
                    }
                }
            }
        }
    }
    
    // 计算理财总额，只统计活跃批次且当前金额大于0的数据
    const wealthTotalAmount = allBatches
        .filter(batch => batch.status === 'active' && batch.currentAmount > 0)
        .reduce((total, batch) => total + batch.currentAmount, 0);
    
    // 计算证券总额，只包含未全部转出且金额大于0的总和
    const stocks = window.currentStocks || [];
    
    // 按券商分组，类似于stocks.js中的groupTransfersByBroker逻辑
    const groupedTransfers = {};
    stocks.forEach(transfer => {
        const broker = transfer.broker || '默认券商';
        if (!groupedTransfers[broker]) {
            groupedTransfers[broker] = [];
        }
        groupedTransfers[broker].push(transfer);
    });
    
    let stockTotalAmount = 0;
    
    // 处理每个券商的转账记录
    for (const [broker, transfers] of Object.entries(groupedTransfers)) {
        // 按日期和id排序，确保记录的正确顺序
        const sortedTransfers = [...transfers].sort((a, b) => {
            // 先按日期排序
            const dateDiff = new Date(a.date) - new Date(b.date);
            if (dateDiff !== 0) {
                return dateDiff;
            }
            // 日期相同则按id排序，确保记录的创建顺序
            return (a.id || 0) - (b.id || 0);
        });
        
        // 找出所有全部转出记录的索引
        const fullTransferIndices = [];
        sortedTransfers.forEach((transfer, index) => {
            if (transfer.isFullTransfer) {
                fullTransferIndices.push(index);
            }
        });
        
        let currentBrokerTransfers = [];
        
        // 如果没有全部转出记录，所有记录都属于当前资产
        if (fullTransferIndices.length === 0) {
            currentBrokerTransfers = sortedTransfers;
        } else {
            // 有全部转出记录，只保留最后一个全部转出记录之后的记录
            const lastFullTransferIndex = fullTransferIndices[fullTransferIndices.length - 1];
            const remainingTransfers = sortedTransfers.slice(lastFullTransferIndex + 1);
            
            // 如果还有剩余记录，这些是全部转出后新添加的，属于当前资产
            if (remainingTransfers.length > 0) {
                currentBrokerTransfers = remainingTransfers;
            }
        }
        
        // 计算券商本金
        const brokerPrincipal = currentBrokerTransfers.reduce((total, transfer) => {
            if (transfer.type === '银行转证券') {
                return total + parseFloat(transfer.amount || 0);
            } else {
                return total - parseFloat(transfer.amount || 0);
            }
        }, 0);
        
        // 只保留本金大于0的项目
        if (brokerPrincipal > 0) {
            stockTotalAmount += brokerPrincipal;
        }
    }
    
    // 计算其它投资总额，只包含未全部赎回且金额大于0的总和
    const otherInvestments = window.currentOtherInvestments || [];
    
    // 计算持有中资产的总金额，确保即使status字段不存在也能正确处理
    const activeData = otherInvestments.filter(item => (item.status || 'active') === 'active');
    
    // 按投资类型、名称、平台分组，计算每个类型的总金额
    const groupedByType = activeData.reduce((acc, item) => {
        // 先按组合分组计算每个组合的总金额
        const groupKey = `${item.type}-${item.name}-${item.platform || '-'}`;
        if (!acc[groupKey]) {
            acc[groupKey] = {
                type: item.type,
                totalActiveAmount: 0
            };
        }
        // 确保transactionType存在，默认视为buy
        acc[groupKey].totalActiveAmount += (item.transactionType || 'buy') === 'buy' ? parseFloat(item.amount || 0) : -parseFloat(item.amount || 0);
        return acc;
    }, {});
    
    // 计算总持有资产金额，只汇总投资金额大于0的项目
    const otherTotalAmount = Object.values(groupedByType)
        .filter(group => group.totalActiveAmount > 0)
        .reduce((sum, group) => sum + group.totalActiveAmount, 0);
    
    // 计算总财富：五个数据的和
    const totalWealth = depositTotalAmount + fundTotalAmount + wealthTotalAmount + stockTotalAmount + otherTotalAmount;
    
    // 使用已声明的funds变量
    const fundTotal = funds.length;
    
    // 更新UI - 检查元素是否存在，避免空指针错误
    

    
    // 更新财富概览部分（如果存在）
    const depositTotalAmountEl = document.getElementById('depositTotalAmount');
    if (depositTotalAmountEl) {
        depositTotalAmountEl.textContent = depositTotalAmount.toFixed(2);
    }
    
    const fundTotalAmountEl = document.getElementById('fundTotalAmount');
    if (fundTotalAmountEl) {
        fundTotalAmountEl.textContent = fundTotalAmount.toFixed(2);
    }
    
    const fundTotalEl = document.getElementById('fundTotal');
    if (fundTotalEl) {
        fundTotalEl.textContent = fundTotal;
    }
    
    const totalWealthEl = document.getElementById('totalWealth');
    if (totalWealthEl) {
        totalWealthEl.textContent = totalWealth.toFixed(2);
    }
    
    // 更新总览页面元素
    
    // 总资产显示 - 支持两种方式：传统HTML和SVG插画
    const totalWealthDisplay = document.getElementById('totalWealthDisplay');
    if (totalWealthDisplay) {
        const formattedAmount = `¥${totalWealth.toFixed(2)}`;
        totalWealthDisplay.textContent = formattedAmount;
        // 更新原始金额记录
        originalAmounts['totalWealthDisplay'] = formattedAmount;
    }
    
    // 指标卡片
    const metricDeposits = document.getElementById('metricDeposits');
    if (metricDeposits) {
        const formattedAmount = `¥${depositTotalAmount.toFixed(2)}`;
        metricDeposits.textContent = formattedAmount;
        originalAmounts['metricDeposits'] = formattedAmount;
    }
    
    const metricFunds = document.getElementById('metricFunds');
    if (metricFunds) {
        const formattedAmount = `¥${fundTotalAmount.toFixed(2)}`;
        metricFunds.textContent = formattedAmount;
        originalAmounts['metricFunds'] = formattedAmount;
    }
    
    const metricWealth = document.getElementById('metricWealth');
    if (metricWealth) {
        const formattedAmount = `¥${wealthTotalAmount.toFixed(2)}`;
        metricWealth.textContent = formattedAmount;
        originalAmounts['metricWealth'] = formattedAmount;
    }
    
    const metricStocks = document.getElementById('metricStocks');
    if (metricStocks) {
        const formattedAmount = `¥${stockTotalAmount.toFixed(2)}`;
        metricStocks.textContent = formattedAmount;
        originalAmounts['metricStocks'] = formattedAmount;
    }
    
    // 更新"其它"资产卡片
    const metricOther = document.getElementById('metricOther');
    if (metricOther) {
        const formattedAmount = `¥${otherTotalAmount.toFixed(2)}`;
        metricOther.textContent = formattedAmount;
        originalAmounts['metricOther'] = formattedAmount;
    }
    
    // 如果金额是隐藏状态，更新显示
    if (!amountsVisible) {
        updateAmountsDisplay();
    }
    
    // 更新总览页面的图表，包含"其它"资产
    updateAssetCompositionChart(depositTotalAmount, fundTotalAmount, wealthTotalAmount, stockTotalAmount, otherTotalAmount);
    updateAssetDistributionChart();
    updateAssetTrendChart();
}

// 选项卡切换
function switchTab(tabName) {
    // 更新按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    
    // 加载选项卡内容
    if (window.loadTabContent) {
        window.loadTabContent(tabName);
    }
    
    // 当切换到基金选项卡时，重新更新购买平台选项列表
    if (tabName === 'fund') {
        if (window.updatePlatformOptions) {
            window.updatePlatformOptions();
        }
        if (window.updateFundNameOptions) {
            window.updateFundNameOptions();
        }
    }
    
    // 当切换到总览选项卡时，确保资产趋势图被正确初始化和更新
    if (tabName === 'overview') {
        // 延迟执行，确保DOM元素已经加载完成
        setTimeout(() => {
            // 重新初始化图表（如果需要）
            if (!assetTrendChart) {
                initCharts();
            }
            
            // 更新图表数据
            updateSummary();
            
            // 重新绑定时间间隔选择器的事件监听器
            const trendIntervalSelect = document.getElementById('trendInterval');
            if (trendIntervalSelect) {
                // 移除旧的事件监听器
                const newElement = trendIntervalSelect.cloneNode(true);
                trendIntervalSelect.parentNode.replaceChild(newElement, trendIntervalSelect);
                
                // 绑定新的事件监听器
                newElement.addEventListener('change', function() {
                    const interval = parseInt(this.value);
                    updateAssetTrendChart(interval);
                });
            }
            
            // 确保金额显隐功能正常工作
            initAmountToggle();
            // 应用当前的金额显示状态
            updateAmountsDisplay();
        }, 100);
    }
}

// 绑定事件
function bindEvents() {
    // 选项卡切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            switchTab(tab);
        });
    });
    
    // 定期存款表单提交 - 检查元素是否存在
    const depositForm = document.getElementById('depositForm');
    if (depositForm && window.handleDepositSubmit) {
        depositForm.addEventListener('submit', window.handleDepositSubmit);
    }
    
    // 理财表单提交 - 检查元素是否存在
    const fundForm = document.getElementById('fundForm');
    if (fundForm && window.handleFundSubmit) {
        fundForm.addEventListener('submit', window.handleFundSubmit);
    }
    
    // 财富管理表单提交 - 检查元素是否存在
    const wealthForm = document.getElementById('wealthForm');
    if (wealthForm && window.handleWealthSubmit) {
        wealthForm.addEventListener('submit', window.handleWealthSubmit);
    }
    
    // Excel导入相关事件 - 检查元素是否存在
    const importExcelBtn = document.getElementById('importExcel');
    if (importExcelBtn && window.handleExcelImport) {
        importExcelBtn.addEventListener('click', window.handleExcelImport);
    }
    
    const excelFileInput = document.getElementById('excelFile');
    if (excelFileInput && window.handleFileSelect) {
        excelFileInput.addEventListener('change', window.handleFileSelect);
    }
    
    const downloadTemplateBtn = document.getElementById('downloadTemplate');
    if (downloadTemplateBtn && window.downloadExcelTemplate) {
        downloadTemplateBtn.addEventListener('click', window.downloadExcelTemplate);
    }
    
    // 显示/隐藏功能 - 检查元素是否存在
    const toggleSummaryBtn = document.getElementById('toggleSummary');
    if (toggleSummaryBtn) {
        toggleSummaryBtn.addEventListener('click', toggleSummary);
    }
    
    const toggleAddDepositBtn = document.getElementById('toggleAddDeposit');
    if (toggleAddDepositBtn) {
        toggleAddDepositBtn.addEventListener('click', toggleAddDeposit);
    }
    
    // 日期输入事件 - 检查元素是否存在
    const depositDateInput = document.getElementById('depositDate');
    if (depositDateInput) {
        depositDateInput.addEventListener('input', handleDateInput);
        // 设置默认日期为今天
        const today = new Date().toISOString().split('T')[0];
        depositDateInput.value = today;
    }
    
    const depositExpiryDateInput = document.getElementById('depositExpiryDate');
    if (depositExpiryDateInput) {
        depositExpiryDateInput.addEventListener('input', handleDateInput);
    }
    
    const fundDateInput = document.getElementById('fundDate');
    if (fundDateInput) {
        fundDateInput.addEventListener('input', handleDateInput);
        // 设置默认日期为今天
        const today = new Date().toISOString().split('T')[0];
        fundDateInput.value = today;
    }
    
    // 财富管理表单日期输入事件 - 检查元素是否存在
    const wealthDateInput = document.getElementById('wealthDate');
    if (wealthDateInput) {
        wealthDateInput.addEventListener('input', handleDateInput);
        // 设置默认日期为今天
        const today = new Date().toISOString().split('T')[0];
        wealthDateInput.value = today;
    }
    
    // 存期和到期日联动计算 - 检查元素是否存在
    const depositPeriodInput = document.getElementById('depositPeriod');
    if (depositPeriodInput) {
        depositPeriodInput.addEventListener('input', calculateExpiryDate);
        depositPeriodInput.addEventListener('input', calculateInterest);
    }
    
    const periodUnitSelect = document.getElementById('periodUnit');
    if (periodUnitSelect) {
        periodUnitSelect.addEventListener('change', calculateExpiryDate);
        periodUnitSelect.addEventListener('change', calculateInterest);
    }
    
    // 利率或金额变化时自动计算利息 - 检查元素是否存在
    const depositRateInput = document.getElementById('depositRate');
    if (depositRateInput) {
        depositRateInput.addEventListener('input', calculateInterest);
    }
    
    const depositAmountInput = document.getElementById('depositAmount');
    if (depositAmountInput) {
        depositAmountInput.addEventListener('input', calculateInterest);
    }
    
    // 表头排序事件 - 全局事件委托，不需要检查元素
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('sort-btn')) {
        // 获取表格ID，根据表格类型调用对应的排序函数
        const table = e.target.closest('table');
        if (table) {
            const tableId = table.id;
            
            // 根据表格ID调用对应的排序函数
            if (tableId.startsWith('fund')) {
                // 基金表格，调用fund.js中的排序函数
                if (window.handleFundSort) {
                    window.handleFundSort(e.target);
                } else {
                    console.warn('handleFundSort function not found on window object');
                }
            } else {
                // 存款表格，调用deposits.js中的排序函数
                if (window.handleDepositSort) {
                    window.handleDepositSort(e.target);
                } else {
                    console.warn('handleDepositSort function not found on window object');
                }
            }
        }
    }
});
    
    // 导出数据按钮事件 - 检查元素是否存在
    const exportExcelBtn = document.getElementById('exportExcel');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', exportDepositData);
    }
    
    // 搜索功能 - 检查元素是否存在
    const depositSearchInput = document.getElementById('depositSearch');
    if (depositSearchInput) {
        depositSearchInput.addEventListener('input', handleDepositSearch);
    }
    
    // 资产趋势图时间间隔选择 - 检查元素是否存在
    const trendIntervalSelect = document.getElementById('trendInterval');
    if (trendIntervalSelect) {
        trendIntervalSelect.addEventListener('change', function() {
            const interval = parseInt(this.value);
            updateAssetTrendChart(interval);
        });
    }
}

// 金额显隐功能
let amountsVisible = false;
let originalAmounts = {};

// 初始化金额显隐功能
function initAmountToggle() {
    const toggleBtn = document.getElementById('toggleAmounts');
    if (toggleBtn) {
        // 移除可能存在的旧事件监听器
        toggleBtn.removeEventListener('click', toggleAmounts);
        toggleBtn.addEventListener('click', toggleAmounts);
        
        // 确保按钮状态正确，使用正确的图标
        amountsVisible = false; // 明确设置默认隐藏
        toggleBtn.textContent = '🙈';
        toggleBtn.classList.add('active');
        
        // 默认隐藏状态，按钮顶端对齐
        toggleBtn.classList.add('hide-state');
    }
}

// 切换金额显示/隐藏
function toggleAmounts() {
    amountsVisible = !amountsVisible;
    
    // 更新按钮状态
    const toggleBtn = document.getElementById('toggleAmounts');
    if (toggleBtn) {
        toggleBtn.textContent = amountsVisible ? '👁️' : '🙈';
        toggleBtn.classList.toggle('active');
    }
    
    // 更新金额显示
    updateAmountsDisplay();
}

// 更新所有金额的显示状态
function updateAmountsDisplay() {
    // 金额元素ID列表
    const amountElements = [
        'totalWealthDisplay',
        'metricDeposits',
        'metricFunds',
        'metricWealth',
        'metricStocks',
        'metricOther'
    ];
    
    // 获取显隐按钮
    const toggleBtn = document.getElementById('toggleAmounts');
    
    amountElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) {
            if (amountsVisible) {
                // 显示原始金额
                if (originalAmounts[elementId]) {
                    element.textContent = originalAmounts[elementId];
                }
                // 显示状态，按钮居中对齐
                if (toggleBtn) {
                    toggleBtn.classList.remove('hide-state');
                }
            } else {
                // 隐藏金额，用****替代
                // 保存原始金额
                originalAmounts[elementId] = element.textContent;
                // 用****替代金额，不显示人民币符号
                element.textContent = '****';
                // 隐藏状态，按钮顶端对齐
                if (toggleBtn) {
                    toggleBtn.classList.add('hide-state');
                }
            }
        }
    });
}

// 导出函数
window.formatDate = formatDate;
window.calculateExpiryDate = calculateExpiryDate;
window.calculatePeriod = calculatePeriod;
window.calculateInterest = calculateInterest;
window.handleDateInput = handleDateInput;
window.updateSummary = updateSummary;
window.switchTab = switchTab;
window.bindEvents = bindEvents;
window.initCharts = initCharts;
window.initOverview = initOverview;
window.loadAllData = loadAllData;
window.initAmountToggle = initAmountToggle;

// ECharts实例
let assetCompositionChart = null;
let assetTrendChart = null;
let assetDistributionChart = null;

// 初始化ECharts图表
let chartInitAttempts = 0;
const MAX_CHART_INIT_ATTEMPTS = 5;

function initCharts() {
    // 检查echarts是否已加载
    if (typeof echarts === 'undefined') {
        chartInitAttempts++;
        if (chartInitAttempts > MAX_CHART_INIT_ATTEMPTS) {
            console.error('Failed to load echarts after multiple attempts');
            return;
        }
        console.warn(`echarts is not loaded yet, retrying chart initialization in 500ms (Attempt ${chartInitAttempts}/${MAX_CHART_INIT_ATTEMPTS})`);
        // 500毫秒后重试
        setTimeout(initCharts, 500);
        return;
    }
    
    // 重置重试次数
    chartInitAttempts = 0;
    
    // 立即初始化图表，不等待延迟
    // 初始化资产构成饼图
    const pieChartDom = document.getElementById('assetCompositionChart');
    if (pieChartDom) {
        // 先销毁旧实例（如果存在）
        if (assetCompositionChart) {
            assetCompositionChart.dispose();
        }
        // 移除硬编码的高度，让图表根据CSS样式自动适应容器尺寸
        pieChartDom.style.width = '100%';
        pieChartDom.style.height = '';
        // 初始化新实例
        assetCompositionChart = echarts.init(pieChartDom, null, {
            renderer: 'canvas',
            passiveRemove: true
        });
    }
    
    // 初始化资产趋势图
    const trendChartDom = document.getElementById('assetTrendChart');
    if (trendChartDom) {
        if (assetTrendChart) {
            assetTrendChart.dispose();
        }
        trendChartDom.style.height = '300px';
        assetTrendChart = echarts.init(trendChartDom, null, {
            renderer: 'canvas',
            passiveRemove: true
        });
    }
    
    // 初始化资产分布饼图
    const distributionChartDom = document.getElementById('assetDistributionChart');
    if (distributionChartDom) {
        if (assetDistributionChart) {
            assetDistributionChart.dispose();
        }
        // 移除硬编码的高度，让图表根据CSS样式自动适应容器尺寸
        distributionChartDom.style.width = '100%';
        distributionChartDom.style.height = '';
        // 初始化新实例
        assetDistributionChart = echarts.init(distributionChartDom, null, {
            renderer: 'canvas',
            passiveRemove: true
        });
    }
    
    // 立即更新图表数据，触发加载动画
    updateSummary();
    
    // 立即调用一次resize，确保图表能正确适应容器大小
    if (assetCompositionChart) {
        assetCompositionChart.resize();
    }
    if (assetTrendChart) {
        assetTrendChart.resize();
    }
    if (assetDistributionChart) {
        assetDistributionChart.resize();
    }
    
    // 添加窗口大小变化事件监听器，确保图表自适应容器大小
    if (!window.chartResizeListenerAdded) {
        window.addEventListener('resize', function() {
            // 延迟执行，确保容器大小已经更新
            setTimeout(function() {
                if (assetCompositionChart) {
                    assetCompositionChart.resize();
                }
                if (assetTrendChart) {
                    assetTrendChart.resize();
                }
                if (assetDistributionChart) {
                    assetDistributionChart.resize();
                }
            }, 50);
        });
        window.chartResizeListenerAdded = true;
    }
}

// 更新资产构成饼图
function updateAssetCompositionChart(depositTotal, fundTotal, wealthTotal, stockTotal, otherTotal = 0) {
    if (!assetCompositionChart) return;
    
    const data = [
        { value: depositTotal, name: '定期存款' },
        { value: fundTotal, name: '基金' },
        { value: wealthTotal, name: '理财' },
        { value: stockTotal, name: '证券' },
        { value: otherTotal, name: '其它' }
    ];
    
    const option = {
        tooltip: {
            trigger: 'item',
            formatter: '{b}: ¥{c} ({d}%)'
        },
        legend: {
            orient: 'horizontal',
            bottom: '0%',
            formatter: '{name}',
            // 调整图例文字大小以适应移动设备
            textStyle: {
                fontSize: 11
            },
            // 设置图例最大宽度，避免溢出
            maxWidth: '90%',
            // 始终显示图例
            show: true,
            // 调整图例间距
            itemGap: 8,
            // 设置图例为多行显示，自动换行
            type: 'scroll',
            pageIconSize: 10,
            pageTextStyle: {
                fontSize: 10
            }
        },
        color: [
            '#3498db',  // 定期存款 - 蓝色
            '#2ecc71',  // 基金 - 绿色
            '#f1c40f',  // 理财 - 黄色
            '#e74c3c',  // 证券 - 红色
            '#00bcd4'   // 其它 - 青色
        ],
        series: [
            {
                name: '资产构成',
                type: 'pie',
                // 增大圆环外径，保持宽度不变（差值30%）
                radius: ['50%', '80%'],
                center: ['50%', '50%'],
                data: data.filter(item => item.value > 0),
                emphasis: {
                    itemStyle: {
                        shadowBlur: 5,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.3)'
                    }
                },
                // 扇区标签设置 - 移除引出文字
                label: {
                    show: false
                },
                labelLine: {
                    show: false
                },
                itemStyle: {
                    borderRadius: 5,
                    borderColor: '#fff',
                    borderWidth: 1
                }
            }
        ]
    };
    
    assetCompositionChart.setOption(option);
}

// 计算资产分布数据
function calculateAssetDistribution() {
    const today = new Date();
    const mergedDistribution = {};
    
    // 1. 定期存款：按银行汇总未到期存款
    const deposits = window.currentDeposits || [];
    const bankDeposits = {};
    deposits.forEach(deposit => {
        const expiryDateStr = deposit.expiryDate || deposit.expiry_date;
        const expiryDate = new Date(expiryDateStr);
        if (expiryDate >= today) {
            const bank = deposit.bank;
            bankDeposits[bank] = (bankDeposits[bank] || 0) + parseFloat(deposit.amount || 0);
        }
    });
    for (const [bank, amount] of Object.entries(bankDeposits)) {
        if (amount > 0) {
            mergedDistribution[bank] = (mergedDistribution[bank] || 0) + amount;
        }
    }
    
    // 2. 基金：按购买平台汇总未全部赎回且本金>0的基金
    const funds = window.currentFund || [];
    const groupedByProduct = {};
    funds.forEach(fund => {
        const safeFundCode = fund.fundCode || '';
        const key = `${fund.platform}_${safeFundCode}`;
        if (!groupedByProduct[key]) {
            groupedByProduct[key] = [];
        }
        groupedByProduct[key].push(fund);
    });
    
    const fundPlatforms = {};
    for (const [productKey, transactions] of Object.entries(groupedByProduct)) {
        const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
        let currentBatch = null;
        
        for (const transaction of sortedTransactions) {
            if (transaction.transactionType === 'buy') {
                if (!currentBatch || currentBatch.status === 'redeemed') {
                    currentBatch = {
                        platform: transaction.platform,
                        transactions: [],
                        totalBuyAmount: 0,
                        totalRedeemAmount: 0,
                        currentAmount: 0,
                        status: 'active'
                    };
                }
                currentBatch.transactions.push({ id: transaction.id, date: transaction.date, type: transaction.transactionType, amount: parseFloat(transaction.amount || 0), redeemType: transaction.redeemType || '' });
                currentBatch.totalBuyAmount += parseFloat(transaction.amount || 0);
                currentBatch.currentAmount = currentBatch.totalBuyAmount - currentBatch.totalRedeemAmount;
            } else if (transaction.transactionType === 'redeem') {
                if (currentBatch && currentBatch.status === 'active') {
                    currentBatch.transactions.push({ id: transaction.id, date: transaction.date, type: transaction.transactionType, amount: parseFloat(transaction.amount || 0), redeemType: transaction.redeemType || '' });
                    currentBatch.totalRedeemAmount += parseFloat(transaction.amount || 0);
                    currentBatch.currentAmount = currentBatch.totalBuyAmount - currentBatch.totalRedeemAmount;
                    if (transaction.redeemType === 'full') {
                        currentBatch.status = 'redeemed';
                    }
                }
            }
        }
        if (currentBatch && currentBatch.status === 'active' && currentBatch.currentAmount > 0) {
            fundPlatforms[currentBatch.platform] = (fundPlatforms[currentBatch.platform] || 0) + currentBatch.currentAmount;
        }
    }
    for (const [platform, amount] of Object.entries(fundPlatforms)) {
        if (amount > 0) {
            mergedDistribution[platform] = (mergedDistribution[platform] || 0) + amount;
        }
    }
    
    // 3. 理财：按购买平台汇总未全部赎回且本金>0的理财
    const wealths = window.currentWealth || [];
    const activeBatches = {};
    const allBatches = [];
    const sortedWealthTransactions = [...wealths].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    for (const transaction of sortedWealthTransactions) {
        if (transaction.transactionType === 'buy') {
            if (transaction.type === '活期' || transaction.type === '周期' || transaction.type === '定期') {
                let key;
                if (transaction.type === '活期') {
                    key = `${transaction.platform}_${transaction.name}_${transaction.type}`;
                } else if (transaction.type === '周期') {
                    key = `${transaction.platform}_${transaction.name}_${transaction.type}_${transaction.cycleType || '未知'}`;
                } else {
                    key = `${transaction.id}_${transaction.date}`;
                }
                if (!activeBatches[key]) {
                    const newBatch = { platform: transaction.platform, name: transaction.name, type: transaction.type, cycleType: transaction.cycleType, transactions: [], totalBuyAmount: 0, totalRedeemAmount: 0, currentAmount: 0, status: 'active' };
                    activeBatches[key] = newBatch;
                    allBatches.push(newBatch);
                }
                activeBatches[key].transactions.push({ id: transaction.id, date: transaction.date, type: transaction.transactionType, amount: parseFloat(transaction.amount || 0), expiryDate: transaction.expiry_date, redeemedAmount: parseFloat(transaction.redeemedAmount || 0), cycleType: transaction.cycleType, redeemType: transaction.redeemType || '' });
                activeBatches[key].totalBuyAmount += parseFloat(transaction.amount || 0);
                activeBatches[key].totalRedeemAmount += parseFloat(transaction.redeemedAmount || 0);
                activeBatches[key].currentAmount = activeBatches[key].totalBuyAmount - activeBatches[key].totalRedeemAmount;
            }
        } else if (transaction.transactionType === 'redeem') {
            const buyTransaction = wealths.find(t => t.id === transaction.buyTransactionId);
            if (buyTransaction) {
                let key;
                if (buyTransaction.type === '活期') {
                    key = `${buyTransaction.platform}_${buyTransaction.name}_${buyTransaction.type}`;
                } else if (buyTransaction.type === '周期') {
                    key = `${buyTransaction.platform}_${buyTransaction.name}_${buyTransaction.type}_${buyTransaction.cycleType || '未知'}`;
                } else {
                    key = `${buyTransaction.id}_${buyTransaction.date}`;
                }
                if (activeBatches[key]) {
                    activeBatches[key].transactions.push({ id: transaction.id, date: transaction.date, type: transaction.transactionType, amount: parseFloat(transaction.amount || 0), redeemType: transaction.redeemType || '', buyTransactionId: transaction.buyTransactionId });
                    activeBatches[key].totalRedeemAmount += parseFloat(transaction.amount || 0);
                    activeBatches[key].currentAmount = activeBatches[key].totalBuyAmount - activeBatches[key].totalRedeemAmount;
                    if (transaction.redeemType === 'full') {
                        activeBatches[key].status = 'redeemed';
                    }
                }
            }
        }
    }
    
    const wealthPlatforms = {};
    allBatches.forEach(batch => {
        if (batch.status === 'active' && batch.currentAmount > 0) {
            wealthPlatforms[batch.platform] = (wealthPlatforms[batch.platform] || 0) + batch.currentAmount;
        }
    });
    for (const [platform, amount] of Object.entries(wealthPlatforms)) {
        if (amount > 0) {
            mergedDistribution[platform] = (mergedDistribution[platform] || 0) + amount;
        }
    }
    
    // 4. 证券：按券商汇总未全部转出且本金>0的证券
    const transfers = window.currentStocks || [];
    const brokerBalances = {};
    transfers.forEach(transfer => {
        const broker = transfer.broker;
        if (!brokerBalances[broker]) {
            brokerBalances[broker] = { amount: 0, isFullTransfer: false };
        }
        if (transfer.transferType === 'bankToSecurities' || transfer.type === '银行转证券') {
            brokerBalances[broker].amount += parseFloat(transfer.amount || 0);
        } else if (transfer.transferType === 'securitiesToBank' || transfer.type === '证券转银行') {
            brokerBalances[broker].amount -= parseFloat(transfer.amount || 0);
        }
        if (transfer.isFullTransfer) {
            brokerBalances[broker].isFullTransfer = true;
        }
    });
    
    for (const [broker, balance] of Object.entries(brokerBalances)) {
        if (!balance.isFullTransfer && balance.amount > 0) {
            mergedDistribution[broker] = (mergedDistribution[broker] || 0) + balance.amount;
        }
    }
    
    // 5. 其它投资：按交易平台汇总未全部赎回且投资金额>0的总和
    const otherInvestments = window.currentOtherInvestments || [];
    const otherGrouped = {};
    otherInvestments.forEach(investment => {
        const key = `${investment.type}_${investment.name}_${investment.platform || '无平台'}`;
        if (!otherGrouped[key]) {
            otherGrouped[key] = { platform: investment.platform || '无平台', totalBuy: 0, totalRedeem: 0, status: 'active' };
        }
        if (investment.transactionType === 'buy') {
            otherGrouped[key].totalBuy += parseFloat(investment.amount || 0);
        } else if (investment.transactionType === 'redeem') {
            otherGrouped[key].totalRedeem += parseFloat(investment.amount || 0);
            if (investment.redeemType === 'full') {
                otherGrouped[key].status = 'redeemed';
            }
        }
    });
    
    const otherPlatforms = {};
    for (const [key, group] of Object.entries(otherGrouped)) {
        const currentAmount = group.totalBuy - group.totalRedeem;
        if (group.status === 'active' && currentAmount > 0) {
            otherPlatforms[group.platform] = (otherPlatforms[group.platform] || 0) + currentAmount;
        }
    }
    for (const [platform, amount] of Object.entries(otherPlatforms)) {
        if (amount > 0) {
            mergedDistribution[platform] = (mergedDistribution[platform] || 0) + amount;
        }
    }
    
    // 将合并后的数据转换为数组格式
    const distributionData = [];
    for (const [name, value] of Object.entries(mergedDistribution)) {
        distributionData.push({ name, value });
    }
    
    return distributionData;
}

// 更新资产分布饼图
function updateAssetDistributionChart() {
    if (!assetDistributionChart) return;
    
    const distributionData = calculateAssetDistribution();
    
    // 过滤掉值为0的数据项
    const filteredData = distributionData.filter(item => item.value > 0);
    
    const option = {
        tooltip: {
            trigger: 'item',
            formatter: '{b}: ¥{c} ({d}%)'
        },
        legend: {
            orient: 'horizontal',
            bottom: '0%',
            formatter: '{name}',
            // 始终显示图例
            show: true,
            // 调整图例文字大小以适应移动设备
            textStyle: {
                fontSize: 11
            },
            // 设置图例最大宽度，避免溢出
            maxWidth: '90%',
            // 调整图例间距
            itemGap: 8,
            // 设置图例为多行显示，自动换行
            type: 'scroll',
            pageIconSize: 10,
            pageTextStyle: {
                fontSize: 10
            }
        },
        color: [
            '#3498db',  // 蓝色
            '#2ecc71',  // 绿色
            '#f1c40f',  // 黄色
            '#e74c3c',  // 红色
            '#00bcd4',  // 青色
            '#9b59b6',  // 紫色
            '#34495e',  // 深灰色
            '#1abc9c',  // 青绿色
            '#e67e22',  // 橙色
            '#e84393'   // 粉色
        ],
        series: [
            {
                name: '资产分布',
                type: 'pie',
                // 增大圆环外径，保持宽度不变（差值30%）
                radius: ['50%', '80%'],
                center: ['50%', '50%'],
                data: filteredData,
                emphasis: {
                    itemStyle: {
                        shadowBlur: 5,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.3)'
                    }
                },
                // 移除引出文字
                label: {
                    show: false
                },
                labelLine: {
                    show: false
                },
                itemStyle: {
                    borderRadius: 5,
                    borderColor: '#fff',
                    borderWidth: 1
                }
            }
        ]
    };
    
    assetDistributionChart.setOption(option);
}

// 计算定期存款历史资产
function calculateDepositHistory(date) {
    const deposits = window.currentDeposits || [];
    return deposits.reduce((total, deposit) => {
        const depositDate = new Date(deposit.date || deposit.deposit_date);
        const expiryDate = new Date(deposit.expiryDate || deposit.expiry_date);
        // 只计算在给定日期之前存入且未到期的存款
        return depositDate <= date && expiryDate >= date ? total + parseFloat(deposit.amount || 0) : total;
    }, 0);
}

// 计算基金历史资产
function calculateFundHistory(date) {
    const funds = window.currentFund || [];
    let totalAmount = 0;
    
    // 按平台、基金代码和产品名称分组
    const grouped = {};
    funds.forEach(fund => {
        const key = `${fund.platform}_${fund.fundCode || ''}_${fund.name || ''}`;
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(fund);
    });
    
    // 计算每个产品在给定日期的持有金额
    for (const [key, items] of Object.entries(grouped)) {
        let currentAmount = 0;
        
        // 按日期排序所有交易记录
        const sortedItems = [...items].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // 累计到给定日期的所有交易
        for (const item of sortedItems) {
            const itemDate = new Date(item.date);
            if (itemDate > date) break;
            
            if (item.transactionType === 'buy') {
                currentAmount += parseFloat(item.amount || 0);
            } else if (item.transactionType === 'redeem') {
                currentAmount -= parseFloat(item.amount || 0);
            }
        }
        
        totalAmount += Math.max(0, currentAmount);
    }
    
    return totalAmount;
}

// 计算理财历史资产
function calculateWealthHistory(date) {
    const wealths = window.currentWealth || [];
    let totalAmount = 0;
    
    // 按平台、产品名称和类型分组
    const grouped = {};
    wealths.forEach(item => {
        const key = `${item.platform}_${item.name}_${item.type}`;
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(item);
    });
    
    // 计算每个产品在给定日期的持有金额
    for (const [key, items] of Object.entries(grouped)) {
        let currentAmount = 0;
        
        // 按日期排序所有交易记录
        const sortedItems = [...items].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // 累计到给定日期的所有交易
        for (const item of sortedItems) {
            const itemDate = new Date(item.date);
            if (itemDate > date) break;
            
            if (item.transactionType === 'buy') {
                currentAmount += parseFloat(item.amount || 0);
            } else if (item.transactionType === 'redeem') {
                currentAmount -= parseFloat(item.amount || 0);
            }
        }
        
        totalAmount += Math.max(0, currentAmount);
    }
    
    return totalAmount;
}

// 计算证券历史资产
function calculateStockHistory(date) {
    const transfers = window.currentStocks || [];
    const brokerBalances = {};
    
    // 按券商分组
    transfers.forEach(transfer => {
        const broker = transfer.broker || '默认券商';
        if (!brokerBalances[broker]) {
            brokerBalances[broker] = {
                transactions: [],
                balance: 0
            };
        }
        brokerBalances[broker].transactions.push(transfer);
    });
    
    let total = 0;
    
    // 计算每个券商在给定日期的余额
    for (const [broker, data] of Object.entries(brokerBalances)) {
        let balance = 0;
        let hasFullTransfer = false;
        let lastFullTransferDate = null;
        
        // 按日期排序交易记录
        const sortedTransactions = [...data.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // 处理每个交易记录
        for (const transaction of sortedTransactions) {
            const transactionDate = new Date(transaction.date);
            if (transactionDate > date) break;
            
            // 处理全量转出记录
            if (transaction.isFullTransfer) {
                balance = 0;
                hasFullTransfer = true;
                lastFullTransferDate = transactionDate;
                continue;
            }
            
            // 如果当前交易在全量转出之后，重置余额并重新开始计算
            if (hasFullTransfer && lastFullTransferDate && transactionDate > lastFullTransferDate) {
                balance = 0;
                hasFullTransfer = false;
                lastFullTransferDate = null;
            }
            
            // 计算余额变化
            if (transaction.transferType === 'bankToSecurities' || transaction.type === '银行转证券') {
                balance += parseFloat(transaction.amount || 0);
            } else if (transaction.transferType === 'securitiesToBank' || transaction.type === '证券转银行') {
                balance -= parseFloat(transaction.amount || 0);
            }
        }
        
        total += Math.max(0, balance);
    }
    
    return total;
}

// 计算其它投资历史资产
function calculateOtherHistory(date) {
    const otherInvestments = window.currentOtherInvestments || [];
    let totalAmount = 0;
    
    // 按类型、名称和平台分组
    const grouped = {};
    otherInvestments.forEach(investment => {
        const key = `${investment.type}_${investment.name}_${investment.platform || '无平台'}`;
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(investment);
    });
    
    // 计算每个投资在给定日期的持有金额
    for (const [key, items] of Object.entries(grouped)) {
        let currentAmount = 0;
        
        // 按日期排序所有交易记录
        const sortedItems = [...items].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // 累计到给定日期的所有交易
        for (const item of sortedItems) {
            const itemDate = new Date(item.date);
            if (itemDate > date) break;
            
            if (item.transactionType === 'buy') {
                currentAmount += parseFloat(item.amount || 0);
            } else if (item.transactionType === 'redeem') {
                currentAmount -= parseFloat(item.amount || 0);
            }
        }
        
        // 只计算金额大于0的投资
        totalAmount += Math.max(0, currentAmount);
    }
    
    return totalAmount;
}

// 更新资产趋势图
function updateAssetTrendChart(intervalDays = 30) {
    if (!assetTrendChart) return;
    
    // 获取当前日期
    const today = new Date();
    
    // 根据时间间隔确定数据点数量和时间步长
    let pointCount, stepDays;
    switch(intervalDays) {
        case 30:
            pointCount = 10;
            stepDays = Math.floor(30 / 10);
            break;
        case 90:
            pointCount = 10;
            stepDays = Math.floor(90 / 10);
            break;
        case 180:
            pointCount = 10;
            stepDays = Math.floor(180 / 10);
            break;
        case 365:
            pointCount = 12;
            stepDays = Math.floor(365 / 12);
            break;
        default:
            pointCount = 10;
            stepDays = Math.floor(30 / 10);
    }
    
    // 生成日期数据和历史资产数据
    const dates = [];
    const depositData = [];
    const fundData = [];
    const wealthData = [];
    const stockData = [];
    const otherData = [];
    
    for (let i = pointCount - 1; i >= 0; i--) {
        // 计算当前数据点对应的日期
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - (i * stepDays));
        
        // 格式化日期显示
        dates.push(`${targetDate.getMonth() + 1}/${targetDate.getDate()}`);
        
        // 计算各资产类别的历史值
        depositData.push(calculateDepositHistory(targetDate));
        fundData.push(calculateFundHistory(targetDate));
        wealthData.push(calculateWealthHistory(targetDate));
        stockData.push(calculateStockHistory(targetDate));
        otherData.push(calculateOtherHistory(targetDate));
    }
    
    const option = {
        tooltip: {
            trigger: 'axis',
            formatter: function(params) {
                let result = params[0].axisValue + '<br/>';
                params.forEach(param => {
                    result += `${param.seriesName}: ¥${param.value}<br/>`;
                });
                return result;
            }
        },
        legend: {
            data: ['定期存款', '基金', '理财', '证券', '其它投资'],
            bottom: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: dates
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                formatter: '¥{value}'
            }
        },
        series: [
            {
                name: '定期存款',
                type: 'line',
                data: depositData,
                smooth: true
            },
            {
                name: '基金',
                type: 'line',
                data: fundData,
                smooth: true
            },
            {
                name: '理财',
                type: 'line',
                data: wealthData,
                smooth: true
            },
            {
                name: '证券',
                type: 'line',
                data: stockData,
                smooth: true
            },
            {
                name: '其它投资',
                type: 'line',
                data: otherData,
                smooth: true
            }
        ]
    };
    
    assetTrendChart.setOption(option);
}

// 初始化总览页面
async function initOverview() {
    console.log('总览页面初始化');
    
    // 先加载数据，不立即初始化图表，减少页面加载时间
    await loadAllData();
    
    // 先更新数据显示，让用户快速看到内容
    updateSummary();
    
    // 延迟初始化图表，等页面主要内容加载完成后再加载图表
    setTimeout(() => {
        initCharts();
    }, 500);
    
    // 添加卡片点击事件监听器，实现点击跳转到对应选项卡
    const metricCards = document.querySelectorAll('.metric-card');
    metricCards.forEach(card => {
        card.addEventListener('click', function() {
            // 根据卡片类型获取对应的选项卡名称
            let tabName;
            if (this.classList.contains('deposit-card')) {
                tabName = 'deposit';
            } else if (this.classList.contains('fund-card')) {
                tabName = 'fund';
            } else if (this.classList.contains('wealth-card')) {
                tabName = 'wealth';
            } else if (this.classList.contains('stock-card')) {
                tabName = 'stock';
            } else if (this.classList.contains('other-card')) {
                tabName = 'other';
            }
            // 调用switchTab函数跳转到对应的选项卡
            if (tabName) {
                switchTab(tabName);
            }
        });
        // 添加指针样式，提示卡片可点击
        card.style.cursor = 'pointer';
        // 添加轻微的鼠标悬停效果
        card.addEventListener('mouseenter', function() {
            this.style.opacity = '0.8';
            this.style.transform = 'translateY(-2px)';
            this.style.transition = 'all 0.2s ease';
        });
        card.addEventListener('mouseleave', function() {
            this.style.opacity = '1';
            this.style.transform = 'translateY(0)';
        });
    });
    
    // 初始化金额显隐功能
    initAmountToggle();
    
    // 默认隐藏金额
    updateAmountsDisplay();
}

// 加载所有必要的数据
async function loadAllData() {
    // 加载定期存款数据
    if (window.loadDeposits) {
        await window.loadDeposits();
    }
    
    // 加载基金数据
    if (window.loadFund) {
        await window.loadFund();
    }
    
    // 加载理财数据
    if (window.loadWealth) {
        await window.loadWealth();
    }
    
    // 加载证券数据
    if (window.loadStocks) {
        await window.loadStocks();
    }
    
    // 加载其它投资数据
    if (window.loadOtherInvestments) {
        await window.loadOtherInvestments();
    }
}

// 导出loadAllData函数
window.loadAllData = loadAllData;

// 页面加载完成后初始化
window.addEventListener('load', function() {
    // 检查登录状态，显示/隐藏容器
    if (window.checkLoginStatus) {
        window.checkLoginStatus();
    }
    
    bindEvents();
    // 移除了直接调用initOverview()，改为由动态加载逻辑调用
});