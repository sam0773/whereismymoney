// 银证转账模块
let currentTransfers = [];

// 初始化银证转账模块
function initStocks() {
    // 绑定事件
    bindStockEvents();
    // 绑定证券汇总事件
    bindStockSummaryEvents();
    // 绑定排序按钮事件
    const sortBtns = document.querySelectorAll('.sort-btn');
    sortBtns.forEach(btn => {
        btn.addEventListener('click', () => handleStockSort(btn));
    });
    // 绑定模态框事件
    bindModalEvents();
    
    // 设置默认日期
    const transferDateInput = document.getElementById('transferDate');
    if (transferDateInput) {
        transferDateInput.value = getTodayLocalDate();
        transferDateInput.addEventListener('input', handleDateInput);
    }
    
    // 检查登录状态，只有已登录才加载数据
    const currentUser = getCurrentUser();
    if (currentUser) {
        // 加载数据
        loadData().then(() => {
            // 渲染证券资产表格
            renderStockTable();
            // 渲染历史转账表格
            renderHistoryTable();
            // 渲染证券汇总信息
            renderStockSummary();
            // 填充券商数据列表
            populateBrokerDatalist();
        });
    } else {
        // 未登录状态下只渲染空表格
        renderStockTable();
        renderHistoryTable();
        renderStockSummary();
    }
}

// 处理证券表格排序
function handleStockSort(btn) {
    const column = btn.getAttribute('data-column');
    const order = btn.getAttribute('data-order');
    const tableId = btn.closest('table').id;
    
    if (tableId === 'stockTable') {
        // 证券资产表格排序
        const currentAssets = getCurrentAssets();
        const brokers = Object.keys(currentAssets);
        const activeBrokers = brokers.filter(broker => {
            const transfers = currentAssets[broker];
            const principal = calculateBrokerPrincipal(transfers);
            return principal > 0;
        });
        
        // 转换为可排序的数组
        const brokerData = activeBrokers.map(broker => {
            const transfers = currentAssets[broker];
            const principal = calculateBrokerPrincipal(transfers);
            return {
                broker,
                principal
            };
        });
        
        // 排序
        const sortedBrokers = [...brokerData].sort((a, b) => {
            let aVal, bVal;
            
            switch (column) {
                case 'broker':
                    aVal = a.broker.toLowerCase();
                    bVal = b.broker.toLowerCase();
                    break;
                case 'principal':
                    aVal = a.principal;
                    bVal = b.principal;
                    break;
                default:
                    aVal = a.broker.toLowerCase();
                    bVal = b.broker.toLowerCase();
            }
            
            if (aVal < bVal) {
                return order === 'asc' ? -1 : 1;
            }
            if (aVal > bVal) {
                return order === 'asc' ? 1 : -1;
            }
            return 0;
        });
        
        // 重新渲染证券资产表格
        renderStockTable(sortedBrokers.map(item => item.broker));
    } else {
        // 历史记录表格排序
        // 获取所有转账记录，并按券商分组
        const allBrokers = [...new Set(currentTransfers.map(transfer => transfer.broker))];
        const historyRecords = [];
        
        // 遍历所有券商，筛选出有全部转出记录的记录组
        allBrokers.forEach(broker => {
            const brokerTransfers = currentTransfers.filter(transfer => transfer.broker === broker);
            
            // 按日期和id排序，确保记录的正确顺序
            brokerTransfers.sort((a, b) => {
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
            brokerTransfers.forEach((transfer, index) => {
                if (transfer.isFullTransfer) {
                    fullTransferIndices.push(index);
                }
            });
            
            // 如果没有全部转出记录，跳过
            if (fullTransferIndices.length === 0) return;
            
            // 按全部转出记录分割成不同的批次
            let startIndex = 0;
            fullTransferIndices.forEach(index => {
                // 获取当前批次的转账记录
                const batchTransfers = brokerTransfers.slice(startIndex, index + 1);
                
                // 计算批次的总转入、总转出和收益率
                const totalIn = calculateTotalTransferIn(batchTransfers);
                const totalOut = calculateTotalTransferOut(batchTransfers);
                const yieldRate = calculateYieldRate(batchTransfers);
                
                // 添加到历史记录中
                historyRecords.push({
                    broker,
                    transfers: batchTransfers,
                    totalIn,
                    totalOut,
                    yieldRate
                });
                
                // 更新开始索引
                startIndex = index + 1;
            });
        });
        
        // 排序
        const sortedHistory = [...historyRecords].sort((a, b) => {
            let aVal, bVal;
            
            switch (column) {
                case 'broker':
                    aVal = a.broker.toLowerCase();
                    bVal = b.broker.toLowerCase();
                    break;
                case 'totalIn':
                    aVal = a.totalIn;
                    bVal = b.totalIn;
                    break;
                case 'totalOut':
                    aVal = a.totalOut;
                    bVal = b.totalOut;
                    break;
                case 'yieldRate':
                    aVal = a.yieldRate;
                    bVal = b.yieldRate;
                    break;
                default:
                    // 默认按全部转出日期排序
                    aVal = new Date(a.transfers[a.transfers.length - 1].date);
                    bVal = new Date(b.transfers[b.transfers.length - 1].date);
            }
            
            if (aVal < bVal) {
                return order === 'asc' ? -1 : 1;
            }
            if (aVal > bVal) {
                return order === 'asc' ? 1 : -1;
            }
            return 0;
        });
        
        // 重新渲染历史记录表格
        renderHistoryTable(sortedHistory);
    }
}

// 加载数据
async function loadData() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    try {
        // 加载银证转账数据
        const newTransferData = await window.dbManager.getAllByIndex(STORES.BANK_SECURITIES_TRANSFERS, 'username', currentUser.username);
        currentTransfers = newTransferData;
        window.currentStocks = currentTransfers;
    } catch (error) {
        console.error('加载银证转账数据失败:', error);
        currentTransfers = [];
        window.currentStocks = currentTransfers;
    }
}

// 导出loadStocks函数，供总览页面调用
async function loadStocks() {
    await loadData();
}
window.loadStocks = loadStocks;

// 绑定银证转账相关事件
function bindStockEvents() {
    // 绑定添加转账表单提交事件
    const stockForm = document.getElementById('stockForm');
    if (stockForm) {
        stockForm.addEventListener('submit', handleStockSubmit);
    }
    
    // 绑定添加转账表单显示/隐藏按钮事件
    const toggleAddStockBtn = document.getElementById('toggleAddStock');
    if (toggleAddStockBtn) {
        toggleAddStockBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const contentEl = document.getElementById('addStockContent');
            const btn = e.target;
            
            if (contentEl.style.display === 'none') {
                contentEl.style.display = 'block';
                btn.textContent = '隐藏';
            } else {
                contentEl.style.display = 'none';
                btn.textContent = '显示';
            }
        });
    }
    
    // 绑定导出数据按钮事件
    const exportStockBtn = document.getElementById('exportStockData');
    if (exportStockBtn) {
        exportStockBtn.addEventListener('click', exportStockData);
    }
}

// 绑定证券汇总事件
function bindStockSummaryEvents() {
    // 绑定证券汇总显示/隐藏按钮事件
    const toggleStockSummaryBtn = document.getElementById('toggleStockSummary');
    if (toggleStockSummaryBtn) {
        toggleStockSummaryBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const contentEl = document.getElementById('stockSummaryContent');
            const btn = e.target;
            
            if (contentEl.style.display === 'none') {
                contentEl.style.display = 'block';
                btn.textContent = '隐藏';
            } else {
                contentEl.style.display = 'none';
                btn.textContent = '显示';
            }
        });
    }
}

// 处理日期输入，自动格式化
function handleDateInput(e) {
    const input = e.target;
    const value = input.value.replace(/[^0-9]/g, '');
    
    if (value.length === 8) {
        const year = value.substring(0, 4);
        const month = value.substring(4, 6);
        const day = value.substring(6, 8);
        input.value = `${year}${month}${day}`;
    }
}



// 绑定模态框事件
function bindModalEvents() {
    const modal = document.getElementById('transferDetailsModal');
    const closeBtn = document.querySelector('.close');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeTransferDetails);
    }
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeTransferDetails();
            }
        });
    }
}

// 填充券商数据列表
function populateBrokerDatalist() {
    // 获取所有已添加的券商名称
    const brokers = [...new Set(currentTransfers.map(transfer => transfer.broker))];
    
    // 填充数据列表
    const brokerOptionsEl = document.getElementById('brokerOptions');
    if (brokerOptionsEl) {
        brokerOptionsEl.innerHTML = brokers.map(broker => `<option value="${broker}">`).join('');
    }
}

// 处理转账表单提交
async function handleStockSubmit(e) {
    e.preventDefault();
    
    try {
        // 获取表单数据
        const broker = document.getElementById('broker').value;
        // 移除转账类型选择，默认使用银行转证券
        const type = '银行转证券';
        const amount = parseFloat(document.getElementById('transferAmount').value);
        let date = document.getElementById('transferDate').value;
        const remarks = document.getElementById('transferRemarks').value;
        
        // 格式化日期
        date = window.formatDate(date);
        
        // 创建转账对象
        const transfer = {
            broker,
            type,
            amount,
            date,
            remarks,
            username: getCurrentUser().username
        };
        
        // 使用DBManager保存数据
        await window.dbManager.save(STORES.BANK_SECURITIES_TRANSFERS, transfer);
        
        // 重新加载数据
        await loadData();
        
        // 重新渲染表格
        renderStockTable();
        // 重新渲染历史转账表格
        renderHistoryTable();
        // 重新渲染证券汇总信息
        renderStockSummary();
        // 更新券商数据列表
        populateBrokerDatalist();
        
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
        
        // 设置默认日期为今天
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0].replace(/-/g, '');
        document.getElementById('transferDate').value = formattedDate;
        
        alert('银证转账添加成功');
    } catch (error) {
        console.error('添加银证转账失败:', error);
        alert('添加银证转账失败，请检查输入数据格式是否正确');
    }
}

// 按券商分组转账记录
function groupTransfersByBroker() {
    const grouped = {};
    
    currentTransfers.forEach(transfer => {
        if (!grouped[transfer.broker]) {
            grouped[transfer.broker] = [];
        }
        grouped[transfer.broker].push(transfer);
    });
    
    return grouped;
}

// 获取当前证券资产（处理全部转出后的新转入记录）
function getCurrentAssets() {
    const groupedTransfers = groupTransfersByBroker();
    const currentAssets = {};
    
    Object.keys(groupedTransfers).forEach(broker => {
        const transfers = groupedTransfers[broker];
        
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
        
        // 如果没有全部转出记录，所有记录都属于当前资产
        if (fullTransferIndices.length === 0) {
            currentAssets[broker] = sortedTransfers;
        } else {
            // 有全部转出记录，只保留最后一个全部转出记录之后的记录
            const lastFullTransferIndex = fullTransferIndices[fullTransferIndices.length - 1];
            const remainingTransfers = sortedTransfers.slice(lastFullTransferIndex + 1);
            
            // 如果还有剩余记录，这些是全部转出后新添加的，属于当前资产
            if (remainingTransfers.length > 0) {
                currentAssets[broker] = remainingTransfers;
            }
        }
    });
    
    return currentAssets;
}

// 获取历史记录（按券商分组，显示已完成的券商记录）
function getHistoryTransfers() {
    const groupedTransfers = groupTransfersByBroker();
    const historyBrokers = [];
    
    // 遍历所有券商，筛选出已完成的记录（只有有全部转出记录的券商）
    for (const broker in groupedTransfers) {
        const transfers = groupedTransfers[broker];
        const hasFullTransfer = transfers.some(transfer => transfer.isFullTransfer);
        
        // 筛选条件：只有有全部转出记录的券商才显示在历史记录中
        if (hasFullTransfer) {
            historyBrokers.push(broker);
        }
    }
    
    return historyBrokers;
}

// 计算券商本金金额
function calculateBrokerPrincipal(brokerTransfers) {
    return brokerTransfers.reduce((total, transfer) => {
        if (transfer.type === '银行转证券') {
            return total + transfer.amount;
        } else {
            return total - transfer.amount;
        }
    }, 0);
}

// 计算证券汇总数据
function calculateStockSummary() {
    // 获取当前证券资产（没有全部转出记录的券商）
    const currentAssets = getCurrentAssets();
    const brokerAssets = [];
    let totalAssets = 0;
    
    // 计算每个券商的本金和总金额，只保留本金大于0的项目
    for (const broker in currentAssets) {
        const transfers = currentAssets[broker];
        const principal = calculateBrokerPrincipal(transfers);
        // 只保留本金金额大于0的项目
        if (principal > 0) {
            brokerAssets.push({ broker, principal });
            totalAssets += principal;
        }
    }
    
    // 计算每个券商的占比，只处理本金大于0的项目
    const brokerSummary = brokerAssets.map(item => {
        const percentage = totalAssets > 0 ? (item.principal / totalAssets) * 100 : 0;
        return {
            broker: item.broker,
            principal: item.principal,
            percentage
        };
    });
    
    // 按本金金额降序排序
    brokerSummary.sort((a, b) => b.principal - a.principal);
    
    return {
        totalAssets,
        brokerSummary
    };
}

// 渲染证券汇总信息
function renderStockSummary() {
    // 计算汇总数据
    const summaryData = calculateStockSummary();
    
    // 更新DOM元素
    const stockSummaryContent = document.getElementById('stockSummaryContent');
    
    if (stockSummaryContent) {
        // 清空现有内容
        stockSummaryContent.innerHTML = '';
        
        // 渲染总金额
        const totalRow = document.createElement('div');
        totalRow.className = 'summary-row total-row';
        totalRow.innerHTML = `
            <span class="summary-label">当前证券账户总资产:</span>
            <span class="summary-value" id="totalStockAssets">¥${summaryData.totalAssets.toFixed(2)}</span>
        `;
        stockSummaryContent.appendChild(totalRow);
        
        // 渲染每个券商的汇总信息
        summaryData.brokerSummary.forEach(item => {
            const brokerRow = document.createElement('div');
            brokerRow.className = 'summary-row';
            brokerRow.innerHTML = `
                <span class="summary-label">${item.broker}:</span>
                <span class="summary-value">¥${item.principal.toFixed(2)} (${item.percentage.toFixed(0)}%)</span>
            `;
            stockSummaryContent.appendChild(brokerRow);
        });
    }
}

// 渲染证券资产表格
function renderStockTable(sortedBrokers = null) {
    const tbody = document.getElementById('stockTableBody');
    
    // 获取当前证券资产（没有全部转出记录的券商）
    const currentAssets = getCurrentAssets();
    let brokers = Object.keys(currentAssets);
    
    // 筛选出本金大于0的券商
    let activeBrokers = brokers.filter(broker => {
        const transfers = currentAssets[broker];
        const principal = calculateBrokerPrincipal(transfers);
        return principal > 0;
    });
    
    // 如果提供了排序后的券商列表，使用它
    if (sortedBrokers && sortedBrokers.length > 0) {
        // 只保留在activeBrokers中的券商
        activeBrokers = sortedBrokers.filter(broker => activeBrokers.includes(broker));
    }
    
    if (activeBrokers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999; padding: 20px;">暂无证券资产记录</td></tr>';
        return;
    }
    
    tbody.innerHTML = activeBrokers.map(broker => {
        const transfers = currentAssets[broker];
        const principal = calculateBrokerPrincipal(transfers);
        
        return `
        <tr>
            <td>${broker}</td>
            <td class="${principal >= 0 ? 'transfer-in' : 'transfer-out'}">¥${principal.toFixed(2)}</td>
            <td>
                <button class="btn btn-small btn-primary" onclick="showTransferDetails('${broker}')">查看详情</button>
            </td>
            <td>
                <button class="btn btn-small btn-bank-to-stock" onclick="handleBankToSecurities('${broker}')">银行转证券</button>
                <button class="btn btn-small btn-stock-to-bank" onclick="handleSecuritiesToBank('${broker}')">证券转银行</button>
                <button class="btn btn-small btn-danger" onclick="handleFullTransferOut('${broker}')">全部转出</button>
                <button class="btn btn-small btn-secondary" onclick="handleCalculateYield('${broker}')">试算收益</button>
            </td>
        </tr>
    `;
    }).join('');
}

// 计算券商总转入金额
function calculateTotalTransferIn(brokerTransfers) {
    return brokerTransfers
        .filter(transfer => transfer.type === '银行转证券')
        .reduce((sum, transfer) => sum + transfer.amount, 0);
}

// 计算券商总转出金额
function calculateTotalTransferOut(brokerTransfers) {
    return brokerTransfers
        .filter(transfer => transfer.type === '证券转银行')
        .reduce((sum, transfer) => sum + transfer.amount, 0);
}

// 计算券商收益率
function calculateYieldRate(brokerTransfers) {
    const totalIn = calculateTotalTransferIn(brokerTransfers);
    const totalOut = calculateTotalTransferOut(brokerTransfers);
    
    if (totalIn <= 0) return 0;
    
    // 收益率 = (总转出金额 - 总转入金额) / 总转入金额 * 100%
    const profit = totalOut - totalIn;
    return (profit / totalIn) * 100;
}

// 渲染历史记录表格
function renderHistoryTable(sortedHistoryRecords = null) {
    const tbody = document.getElementById('historyTableBody');
    
    let historyRecords;
    
    // 如果提供了排序后的历史记录，使用它
    if (sortedHistoryRecords && sortedHistoryRecords.length > 0) {
        historyRecords = sortedHistoryRecords;
    } else {
        // 获取所有转账记录，并按券商分组
        const allBrokers = [...new Set(currentTransfers.map(transfer => transfer.broker))];
        historyRecords = [];
        
        // 遍历所有券商，筛选出有全部转出记录的记录组
        allBrokers.forEach(broker => {
            const brokerTransfers = currentTransfers.filter(transfer => transfer.broker === broker);
            
            // 按日期和id排序，确保记录的正确顺序
            brokerTransfers.sort((a, b) => {
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
            brokerTransfers.forEach((transfer, index) => {
                if (transfer.isFullTransfer) {
                    fullTransferIndices.push(index);
                }
            });
            
            // 如果没有全部转出记录，跳过
            if (fullTransferIndices.length === 0) return;
            
            // 按全部转出记录分割成不同的批次
            let startIndex = 0;
            fullTransferIndices.forEach(index => {
                // 获取当前批次的转账记录
                const batchTransfers = brokerTransfers.slice(startIndex, index + 1);
                
                // 计算批次的总转入、总转出和收益率
                const totalIn = calculateTotalTransferIn(batchTransfers);
                const totalOut = calculateTotalTransferOut(batchTransfers);
                const yieldRate = calculateYieldRate(batchTransfers);
                
                // 添加到历史记录中
                historyRecords.push({
                    broker,
                    transfers: batchTransfers,
                    totalIn,
                    totalOut,
                    yieldRate
                });
                
                // 更新开始索引
                startIndex = index + 1;
            });
            
            // 最后一个全部转出记录之后的记录属于当前资产，不添加到历史记录中
        });
        
        // 按全部转出日期倒序排序（最近的在前）
        historyRecords.sort((a, b) => {
            // 找到每个批次的最后一笔交易（全部转出记录）
            const aLastTransfer = a.transfers[a.transfers.length - 1];
            const bLastTransfer = b.transfers[b.transfers.length - 1];
            return new Date(bLastTransfer.date) - new Date(aLastTransfer.date);
        });
    }
    
    if (historyRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999; padding: 20px;">暂无历史记录</td></tr>';
        
        // 移除展开/收起按钮（如果存在）
        const toggleBtnContainer = document.getElementById('historyTableBodyToggleBtn');
        if (toggleBtnContainer) {
            toggleBtnContainer.remove();
        }
        
        return;
    }
    
    // 生成表格行的辅助函数
    const generateTableRows = (records) => {
        return records.map(record => {
            return `
            <tr>
                <td>${record.broker}</td>
                <td class="transfer-in">¥${record.totalIn.toFixed(2)}</td>
                <td class="transfer-out">¥${record.totalOut.toFixed(2)}</td>
                <td>${record.yieldRate >= 0 ? '+' : ''}${record.yieldRate.toFixed(2)}%</td>
                <td>
                    <button class="btn btn-small btn-primary" onclick="showTransferDetails('${record.broker}', ${JSON.stringify(record.transfers).replace(/"/g, '&quot;')})">查看详情</button>
                </td>
            </tr>
        `;
        }).join('');
    };
    
    // 默认显示最近10条记录
    const DEFAULT_DISPLAY_COUNT = 10;
    
    // 如果记录数超过默认显示数量，添加展开/收起按钮
    if (historyRecords.length > DEFAULT_DISPLAY_COUNT) {
        // 默认只显示前10条记录
        tbody.innerHTML = generateTableRows(historyRecords.slice(0, DEFAULT_DISPLAY_COUNT)) + `
            <tr class="history-toggle-row">
                <td colspan="5" style="text-align: center; padding: 10px;">
                    <button class="btn btn-small btn-primary" onclick="toggleHistoryTable(${JSON.stringify(historyRecords).replace(/"/g, '&quot;')}, ${DEFAULT_DISPLAY_COUNT})">
                        点击展开（共${historyRecords.length}条记录）
                    </button>
                </td>
            </tr>
        `;
    } else {
        // 显示所有记录
        tbody.innerHTML = generateTableRows(historyRecords);
    }
}

// 切换历史记录表格的显示状态
function toggleHistoryTable(historyRecords, defaultDisplayCount) {
    const tbody = document.getElementById('historyTableBody');
    const toggleBtn = event.target;
    
    if (!tbody || !toggleBtn) return;
    
    // 检查当前是否已展开
    const isExpanded = toggleBtn.textContent.includes('收起');
    
    // 生成表格行的辅助函数
    const generateTableRows = (records) => {
        return records.map(record => {
            return `
            <tr>
                <td>${record.broker}</td>
                <td class="transfer-in">¥${record.totalIn.toFixed(2)}</td>
                <td class="transfer-out">¥${record.totalOut.toFixed(2)}</td>
                <td>${record.yieldRate >= 0 ? '+' : ''}${record.yieldRate.toFixed(2)}%</td>
                <td>
                    <button class="btn btn-small btn-primary" onclick="showTransferDetails('${record.broker}', ${JSON.stringify(record.transfers).replace(/"/g, '&quot;')})">查看详情</button>
                </td>
            </tr>
        `;
        }).join('');
    };
    
    if (isExpanded) {
        // 收起：只显示前10条记录
        tbody.innerHTML = generateTableRows(historyRecords.slice(0, defaultDisplayCount)) + `
            <tr class="history-toggle-row">
                <td colspan="5" style="text-align: center; padding: 10px;">
                    <button class="btn btn-small btn-primary" onclick="toggleHistoryTable(${JSON.stringify(historyRecords).replace(/"/g, '&quot;')}, ${defaultDisplayCount})">
                        点击展开（共${historyRecords.length}条记录）
                    </button>
                </td>
            </tr>
        `;
    } else {
        // 展开：显示所有记录
        tbody.innerHTML = generateTableRows(historyRecords) + `
            <tr class="history-toggle-row">
                <td colspan="5" style="text-align: center; padding: 10px;">
                    <button class="btn btn-small btn-primary" onclick="toggleHistoryTable(${JSON.stringify(historyRecords).replace(/"/g, '&quot;')}, ${defaultDisplayCount})">
                        点击收起
                    </button>
                </td>
            </tr>
        `;
    }
    
    // 清理可能存在的旧按钮容器
    const oldToggleBtnContainer = document.getElementById('historyTableBodyToggleBtn');
    if (oldToggleBtnContainer) {
        oldToggleBtnContainer.remove();
    }
}

// 显示转账详情
function showTransferDetails(broker, transfers) {
    const modal = document.getElementById('transferDetailsModal');
    const brokerNameEl = document.getElementById('modalBrokerName');
    const modalTableBody = document.getElementById('modalTransferTableBody');
    
    // 设置券商名称
    brokerNameEl.textContent = `${broker} - 转账明细`;
    
    let displayTransfers;
    // 如果提供了具体的交易记录批次，就使用它；否则获取该券商的所有转账记录
    if (transfers && transfers.length > 0) {
        // 已经是按顺序排列的批次记录
        displayTransfers = transfers;
    } else {
        // 获取该券商的转账记录
        const brokerTransfers = currentTransfers.filter(transfer => transfer.broker === broker);
        
        // 按日期和id排序交易记录，确保记录的正确顺序
        displayTransfers = [...brokerTransfers].sort((a, b) => {
            // 先按日期排序
            const dateDiff = new Date(a.date) - new Date(b.date);
            if (dateDiff !== 0) {
                return dateDiff;
            }
            // 日期相同则按id排序，确保记录的创建顺序
            return (a.id || 0) - (b.id || 0);
        });
    }
    
    // 渲染转账明细
    modalTableBody.innerHTML = displayTransfers.map(transfer => {
        // 格式化金额，移除人民币符号前的符号
        const amountDisplay = `¥${transfer.amount.toFixed(2)}`;
        
        return `
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${transfer.type}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${amountDisplay}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${transfer.date}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${transfer.remarks || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
                <button class="btn btn-small btn-edit" onclick="editTransferRecord(${transfer.id}, '${broker}')">编辑</button>
                <button class="btn btn-small btn-danger" onclick="deleteTransferRecord(${transfer.id}, '${broker}')">删除</button>
            </td>
        </tr>
    `;
    }).join('');
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 点击模态框外部关闭
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// 关闭转账详情模态框
function closeTransferDetails() {
    const modal = document.getElementById('transferDetailsModal');
    modal.style.display = 'none';
}

// 编辑转账记录
function editTransferRecord(transferId, broker) {
    // 查找要编辑的转账记录
    const transfer = currentTransfers.find(t => t.id === transferId);
    if (!transfer) return;
    
    // 创建编辑弹窗
    let modal = document.getElementById('editTransferModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editTransferModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px; width: 100%;">
                <h2>编辑转账记录</h2>
                <form id="editTransferForm">
                    <input type="hidden" id="editTransferId" value="${transferId}">
                    <input type="hidden" id="editTransferBroker" value="${broker}">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editTransferAmount">转账金额:</label>
                            <input type="number" id="editTransferAmount" step="0.01" required>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editTransferDate">转账日期:</label>
                            <input type="text" id="editTransferDate" placeholder="格式：YYYYMMDD" required>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editTransferRemarks">备注:</label>
                            <input type="text" id="editTransferRemarks" placeholder="可选">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">保存修改</button>
                        <button type="button" id="cancelEditTransferBtn" class="btn btn-secondary">取消</button>
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
        
        // 绑定表单提交事件
        const form = modal.querySelector('#editTransferForm');
        form.addEventListener('submit', handleEditTransferSubmit);
        
        // 绑定取消按钮事件
        const cancelBtn = modal.querySelector('#cancelEditTransferBtn');
        cancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    // 填充表单数据
    document.getElementById('editTransferAmount').value = transfer.amount;
    document.getElementById('editTransferDate').value = transfer.date.replace(/-/g, '');
    document.getElementById('editTransferRemarks').value = transfer.remarks || '';
    
    // 显示模态框
    modal.style.display = 'flex';
}

// 处理编辑转账记录表单提交
async function handleEditTransferSubmit(e) {
    e.preventDefault();
    
    const transferId = parseInt(document.getElementById('editTransferId').value);
    const broker = document.getElementById('editTransferBroker').value;
    const amount = parseFloat(document.getElementById('editTransferAmount').value);
    let date = document.getElementById('editTransferDate').value;
    const remarks = document.getElementById('editTransferRemarks').value;
    
    // 格式化日期为YYYY-MM-DD格式
    if (date.length === 8) {
        date = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
    }
    
    try {
        // 更新转账记录
        const updatedTransfer = currentTransfers.find(t => t.id === transferId);
        if (updatedTransfer) {
            updatedTransfer.amount = amount;
            updatedTransfer.date = date;
            updatedTransfer.remarks = remarks;
            
            // 保存到数据库
            await window.dbManager.save(STORES.BANK_SECURITIES_TRANSFERS, updatedTransfer);
            
            // 重新加载数据
            await loadData();
            
            // 重新渲染相关表格
        renderStockTable();
        renderHistoryTable();
        // 重新渲染证券汇总信息
        renderStockSummary();
        
        // 更新转账详情弹窗（如果打开）
        const transferDetailsModal = document.getElementById('transferDetailsModal');
        if (transferDetailsModal.style.display === 'flex') {
            showTransferDetails(broker);
        }
        
        // 关闭编辑弹窗
        const editModal = document.getElementById('editTransferModal');
        editModal.style.display = 'none';
        
        alert('转账记录已更新');
        }
    } catch (error) {
        console.error('更新转账记录失败:', error);
        alert('更新转账记录失败，请重试');
    }
}

// 删除转账记录
function deleteTransferRecord(transferId, broker) {
    // 确认删除
    if (!confirm('确定要删除这条转账记录吗？')) return;
    
    try {
        // 从数组中移除
        const index = currentTransfers.findIndex(t => t.id === transferId);
        if (index !== -1) {
            const transfer = currentTransfers[index];
            
            // 从数据库删除
            window.dbManager.delete(STORES.BANK_SECURITIES_TRANSFERS, transferId);
            
            // 从数组中移除
            currentTransfers.splice(index, 1);
            
            // 重新渲染相关表格
        renderStockTable();
        renderHistoryTable();
        // 重新渲染证券汇总信息
        renderStockSummary();
        
        // 更新转账详情弹窗（如果打开）
        const transferDetailsModal = document.getElementById('transferDetailsModal');
        if (transferDetailsModal.style.display === 'flex') {
            showTransferDetails(broker);
        }
        
        alert('转账记录已删除');
        }
    } catch (error) {
        console.error('删除转账记录失败:', error);
        alert('删除转账记录失败，请重试');
    }
}

// 显示银行转证券弹窗
function showBankToSecuritiesModal(broker) {
    let modal = document.getElementById('bankToSecuritiesModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'bankToSecuritiesModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>银行转证券</h2>
                <div class="form-group">
                    <label for="bankToSecuritiesDate">转账日期:</label>
                    <input type="text" id="bankToSecuritiesDate" placeholder="格式：YYYYMMDD" required>
                </div>
                <div class="form-group">
                    <label for="bankToSecuritiesAmount">转账金额:</label>
                    <input type="number" id="bankToSecuritiesAmount" step="0.01" placeholder="请输入转账金额" required>
                </div>
                <div class="form-group">
                    <label for="bankToSecuritiesRemarks">备注:</label>
                    <input type="text" id="bankToSecuritiesRemarks" placeholder="请输入备注（可选）">
                </div>
                <div id="bankToSecuritiesStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="bankToSecuritiesConfirmBtn" class="btn btn-primary">确认转账</button>
                    <button id="bankToSecuritiesCancelBtn" class="btn btn-secondary">取消</button>
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
    document.getElementById('bankToSecuritiesDate').value = today;
    document.getElementById('bankToSecuritiesAmount').value = '';
    document.getElementById('bankToSecuritiesRemarks').value = '';
    document.getElementById('bankToSecuritiesStatus').textContent = '';
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 返回Promise，等待用户确认
    return new Promise((resolve) => {
        const confirmBtn = document.getElementById('bankToSecuritiesConfirmBtn');
        const cancelBtn = document.getElementById('bankToSecuritiesCancelBtn');
        
        // 确认按钮事件
        const handleConfirm = async () => {
            const transferDate = document.getElementById('bankToSecuritiesDate').value;
            const transferAmount = parseFloat(document.getElementById('bankToSecuritiesAmount').value);
            const remarks = document.getElementById('bankToSecuritiesRemarks').value;
            const statusEl = document.getElementById('bankToSecuritiesStatus');
            
            // 验证输入
            if (!transferDate || isNaN(transferAmount)) {
                statusEl.textContent = '请填写完整的转账信息';
                return;
            }
            
            // 格式化日期
            const formattedDate = window.formatDate(transferDate);
            
            modal.style.display = 'none';
            resolve({ broker, type: '银行转证券', date: formattedDate, amount: transferAmount, remarks });
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

// 显示证券转银行弹窗
function showSecuritiesToBankModal(broker) {
    let modal = document.getElementById('securitiesToBankModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'securitiesToBankModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>证券转银行</h2>
                <div class="form-group">
                    <label for="securitiesToBankDate">转账日期:</label>
                    <input type="text" id="securitiesToBankDate" placeholder="格式：YYYYMMDD" required>
                </div>
                <div class="form-group">
                    <label for="securitiesToBankAmount">转账金额:</label>
                    <input type="number" id="securitiesToBankAmount" step="0.01" placeholder="请输入转账金额" required>
                </div>
                <div class="form-group">
                    <label for="securitiesToBankRemarks">备注:</label>
                    <input type="text" id="securitiesToBankRemarks" placeholder="请输入备注（可选）">
                </div>
                <div id="securitiesToBankStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="securitiesToBankConfirmBtn" class="btn btn-primary">确认转账</button>
                    <button id="securitiesToBankCancelBtn" class="btn btn-secondary">取消</button>
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
    document.getElementById('securitiesToBankDate').value = today;
    document.getElementById('securitiesToBankAmount').value = '';
    document.getElementById('securitiesToBankRemarks').value = '';
    document.getElementById('securitiesToBankStatus').textContent = '';
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 返回Promise，等待用户确认
    return new Promise((resolve) => {
        const confirmBtn = document.getElementById('securitiesToBankConfirmBtn');
        const cancelBtn = document.getElementById('securitiesToBankCancelBtn');
        
        // 确认按钮事件
        const handleConfirm = async () => {
            const transferDate = document.getElementById('securitiesToBankDate').value;
            const transferAmount = parseFloat(document.getElementById('securitiesToBankAmount').value);
            const remarks = document.getElementById('securitiesToBankRemarks').value;
            const statusEl = document.getElementById('securitiesToBankStatus');
            
            // 验证输入
            if (!transferDate || isNaN(transferAmount)) {
                statusEl.textContent = '请填写完整的转账信息';
                return;
            }
            
            // 格式化日期
            const formattedDate = formatDate(transferDate);
            
            modal.style.display = 'none';
            resolve({ broker, type: '证券转银行', date: formattedDate, amount: transferAmount, remarks });
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

// 处理银行转证券
async function handleBankToSecurities(broker) {
    const result = await showBankToSecuritiesModal(broker);
    if (!result) return;
    
    try {
        // 创建转账记录
        const transferRecord = {
            broker: result.broker,
            type: result.type,
            amount: result.amount,
            date: result.date,
            remarks: result.remarks,
            username: getCurrentUser().username
        };
        
        // 使用DBManager保存数据
        await window.dbManager.save(STORES.BANK_SECURITIES_TRANSFERS, transferRecord);
        
        // 重新加载数据
        await loadData();
        
        // 重新渲染表格
        renderStockTable();
        // 重新渲染历史转账表格
        renderHistoryTable();
        // 重新渲染证券汇总信息
        renderStockSummary();
        
        alert('银行转证券操作成功');
    } catch (error) {
        console.error('添加银行转证券失败:', error);
        alert('添加银行转证券失败，请检查输入数据格式是否正确');
    }
}

// 显示全部转出弹窗
function showFullTransferOutModal(broker) {
    let modal = document.getElementById('fullTransferOutModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fullTransferOutModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>全部转出</h2>
                <p>您确定要全部转出该券商的资金吗？转出后将移至历史记录。</p>
                <div class="form-group">
                    <label for="fullTransferOutDate">转出日期:</label>
                    <input type="text" id="fullTransferOutDate" placeholder="格式：YYYYMMDD" required>
                </div>
                <div class="form-group">
                    <label for="fullTransferOutAmount">转出金额:</label>
                    <input type="number" id="fullTransferOutAmount" step="0.01" required>
                </div>
                <div class="form-group">
                    <label for="fullTransferOutConfirm">请输入 "全部转出" 以确认:</label>
                    <input type="text" id="fullTransferOutConfirm" placeholder="请输入确认文本">
                </div>
                <div id="fullTransferOutStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="fullTransferOutConfirmBtn" class="btn btn-danger">确认全部转出</button>
                    <button id="fullTransferOutCancelBtn" class="btn btn-secondary">取消</button>
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
    
    // 计算可转出金额（本金金额）
    const brokerTransfers = currentTransfers.filter(transfer => transfer.broker === broker);
    const principal = calculateBrokerPrincipal(brokerTransfers);
    
    // 设置默认值
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    document.getElementById('fullTransferOutDate').value = today;
    document.getElementById('fullTransferOutAmount').value = ''; // 移除默认转出金额
    document.getElementById('fullTransferOutConfirm').value = '';
    document.getElementById('fullTransferOutStatus').textContent = '';
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 返回Promise，等待用户确认
    return new Promise((resolve) => {
        const confirmBtn = document.getElementById('fullTransferOutConfirmBtn');
        const cancelBtn = document.getElementById('fullTransferOutCancelBtn');
        
        // 确认按钮事件
        const handleConfirm = async () => {
            const transferDate = document.getElementById('fullTransferOutDate').value;
            const transferAmount = parseFloat(document.getElementById('fullTransferOutAmount').value);
            const confirmText = document.getElementById('fullTransferOutConfirm').value;
            const statusEl = document.getElementById('fullTransferOutStatus');
            
            // 验证输入
            if (!transferDate || isNaN(transferAmount)) {
                statusEl.textContent = '请填写完整的转出信息';
                return;
            }
            
            if (confirmText !== '全部转出') {
                statusEl.textContent = '请输入正确的确认文本';
                return;
            }
            
            // 格式化日期
            const formattedDate = formatDate(transferDate);
            
            modal.style.display = 'none';
            resolve({ broker, date: formattedDate, amount: transferAmount });
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

// 处理证券转银行
async function handleSecuritiesToBank(broker) {
    const result = await showSecuritiesToBankModal(broker);
    if (!result) return;
    
    try {
        // 创建转账记录
        const transferRecord = {
            broker: result.broker,
            type: result.type,
            amount: result.amount,
            date: result.date,
            remarks: result.remarks,
            username: getCurrentUser().username
        };
        
        // 使用DBManager保存数据
        await window.dbManager.save(STORES.BANK_SECURITIES_TRANSFERS, transferRecord);
        
        // 重新加载数据
        await loadData();
        
        // 重新渲染表格
        renderStockTable();
        // 重新渲染历史转账表格
        renderHistoryTable();
        // 重新渲染证券汇总信息
        renderStockSummary();
        
        alert('证券转银行操作成功');
    } catch (error) {
        console.error('添加证券转银行失败:', error);
        alert('添加证券转银行失败，请检查输入数据格式是否正确');
    }
}

// 显示试算收益弹窗
function showCalculateYieldModal(broker) {
    let modal = document.getElementById('calculateYieldModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'calculateYieldModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>试算收益</h2>
                <div class="form-group">
                    <label for="calculationAmount">券商总资产:</label>
                    <input type="number" id="calculationAmount" step="0.01" placeholder="请输入券商总资产">
                </div>
                <div id="yieldResult" style="margin: 15px 0; padding: 10px; background-color: #f0f0f0;"></div>
                <div id="yieldCalculationStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="calculateYieldBtn" class="btn btn-primary">计算收益率</button>
                    <button id="closeYieldModalBtn" class="btn btn-secondary">关闭</button>
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
    document.getElementById('yieldCalculationStatus').textContent = '';
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 返回Promise，等待用户操作
    return new Promise((resolve) => {
        const calculateBtn = document.getElementById('calculateYieldBtn');
        const closeBtn = document.getElementById('closeYieldModalBtn');
        
        // 计算按钮事件
        const handleCalculate = () => {
            const calculationAmount = parseFloat(document.getElementById('calculationAmount').value);
            const resultEl = document.getElementById('yieldResult');
            const statusEl = document.getElementById('yieldCalculationStatus');
            
            // 验证输入
            if (isNaN(calculationAmount) || calculationAmount < 0) {
                statusEl.textContent = '请输入有效的券商总资产';
                return;
            }
            
            // 获取该券商的所有转账记录
            const brokerTransfers = currentTransfers.filter(transfer => transfer.broker === broker);
            
            // 计算总转入金额
            const totalIn = brokerTransfers
                .filter(transfer => transfer.type === '银行转证券')
                .reduce((sum, transfer) => sum + transfer.amount, 0);
            
            // 计算已转出金额
            const totalOut = brokerTransfers
                .filter(transfer => transfer.type === '证券转银行')
                .reduce((sum, transfer) => sum + transfer.amount, 0);
            
            // 计算当前在券商的资产
            const currentAsset = totalIn - totalOut;
            
            // 计算总收益
            const totalAsset = calculationAmount;
            const profit = totalAsset - totalIn;
            
            // 计算收益率
            const yieldRate = totalIn > 0 ? (profit / totalIn) * 100 : 0;
            
            // 显示结果
            resultEl.innerHTML = `
                <h4>计算结果</h4>
                <p>总转入金额：¥${totalIn.toFixed(2)}</p>
                <p>已转出金额：¥${totalOut.toFixed(2)}</p>
                <p>当前资产：¥${currentAsset.toFixed(2)}</p>
                <p>券商总资产：¥${totalAsset.toFixed(2)}</p>
                <p>总收益：¥${profit.toFixed(2)}</p>
                <p>收益率：<strong>${yieldRate.toFixed(2)}%</strong></p>
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

// 处理全部转出
async function handleFullTransferOut(broker) {
    const result = await showFullTransferOutModal(broker);
    if (!result) return;
    
    try {
        // 计算收益率
        const brokerTransfers = currentTransfers.filter(transfer => transfer.broker === broker);
        const totalIn = brokerTransfers
            .filter(transfer => transfer.type === '银行转证券')
            .reduce((sum, transfer) => sum + transfer.amount, 0);
        const totalOut = brokerTransfers
            .filter(transfer => transfer.type === '证券转银行')
            .reduce((sum, transfer) => sum + transfer.amount, 0);
        
        // 新增全部转出记录
        const fullTransferRecord = {
            broker: result.broker,
            type: '证券转银行',
            amount: result.amount,
            date: result.date,
            remarks: '全部转出',
            isFullTransfer: true,
            username: getCurrentUser().username
        };
        
        // 使用DBManager保存数据
        await window.dbManager.save(STORES.BANK_SECURITIES_TRANSFERS, fullTransferRecord);
        
        // 重新加载数据
        await loadData();
        
        // 重新渲染表格
        renderStockTable();
        // 重新渲染历史转账表格
        renderHistoryTable();
        // 重新渲染证券汇总信息
        renderStockSummary();
        
        // 计算收益率
        const profit = totalOut + result.amount - totalIn;
        const yieldRate = totalIn > 0 ? (profit / totalIn) * 100 : 0;
        
        alert(`全部转出操作成功！\n转出金额：¥${result.amount.toFixed(2)}\n总投入：¥${totalIn.toFixed(2)}\n总收益：¥${profit.toFixed(2)}\n收益率：${yieldRate.toFixed(2)}%`);
    } catch (error) {
        console.error('全部转出失败:', error);
        alert('全部转出失败，请检查输入数据格式是否正确');
    }
}

// 处理试算收益
async function handleCalculateYield(broker) {
    await showCalculateYieldModal(broker);
}

// 删除券商所有记录
async function deleteBroker(broker) {
    if (confirm(`确定要删除${broker}的所有转账记录吗？`)) {
        try {
            // 获取该券商的所有转账记录
            const brokerTransfers = currentTransfers.filter(transfer => transfer.broker === broker);
            
            // 批量删除所有记录
            for (const transfer of brokerTransfers) {
                await window.dbManager.delete(STORES.BANK_SECURITIES_TRANSFERS, transfer.id);
            }
            
            // 重新加载数据
            await loadData();
            
            // 重新渲染表格
        renderStockTable();
        // 重新渲染历史转账表格
        renderHistoryTable();
        // 重新渲染证券汇总信息
        renderStockSummary();
        
        alert('删除成功');
        } catch (error) {
            console.error('删除券商记录失败:', error);
            alert('删除失败，请检查网络连接');
        }
    }
}

// 删除单个转账记录（用于模态框中）
async function deleteTransfer(id) {
    if (confirm('确定要删除这条转账记录吗？')) {
        try {
            // 使用DBManager删除单个记录
            await window.dbManager.delete(STORES.BANK_SECURITIES_TRANSFERS, id);
            
            // 重新加载数据
            await loadData();
            
            // 重新渲染表格
        renderStockTable();
        // 重新渲染历史转账表格
        renderHistoryTable();
        // 重新渲染证券汇总信息
        renderStockSummary();
        
        // 如果模态框打开，更新模态框内容
        const modal = document.getElementById('transferDetailsModal');
        if (modal && modal.style.display === 'flex') {
            const brokerName = document.getElementById('modalBrokerName').textContent.split(' - ')[0];
            showTransferDetails(brokerName);
        }
        
        alert('删除成功');
        } catch (error) {
            console.error('删除转账记录失败:', error);
            alert('删除失败，请检查网络连接');
        }
    }
}

// 格式化日期为YYYY-MM-DD
// 使用common.js中导出的formatDate函数，不再重新定义

// 导出证券数据
function exportStockData() {
    if (!currentTransfers || currentTransfers.length === 0) {
        alert('没有证券数据可以导出');
        return;
    }
    
    // 准备导出数据
    const exportData = [];
    
    currentTransfers.forEach(transfer => {
        // 根据交易类型确定操作类型
        let typeText = '';
        if (transfer.transferType === 'bankToSecurities') {
            typeText = '银转证';
        } else if (transfer.transferType === 'securitiesToBank') {
            typeText = '证转银';
        } else if (transfer.transferType === 'full') {
            typeText = '全部转出';
        }
        
        exportData.push({
            '券商': transfer.broker,
            '转账类型': typeText,
            '转账金额': transfer.amount,
            '转账日期': transfer.date,
            '备注': transfer.remarks || '-',
            '交易ID': transfer.id
        });
    });
    
    if (exportData.length === 0) {
        alert('没有可导出的交易记录');
        return;
    }
    
    // 创建工作簿和工作表
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '证券数据');
    
    // 导出为Excel文件
    const fileName = `证券数据_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

// 导出函数
window.initStocks = initStocks;
window.renderStockTable = renderStockTable;
window.handleStockSubmit = handleStockSubmit;
window.showTransferDetails = showTransferDetails;
window.closeTransferDetails = closeTransferDetails;
window.deleteBroker = deleteBroker;
window.deleteTransfer = deleteTransfer;
window.handleBankToSecurities = handleBankToSecurities;
window.handleSecuritiesToBank = handleSecuritiesToBank;
window.handleFullTransferOut = handleFullTransferOut;
window.handleCalculateYield = handleCalculateYield;
window.exportStockData = exportStockData;
// 导出证券数据到window对象，兼容common.js中的window.currentStocks
window.currentStocks = currentTransfers;
