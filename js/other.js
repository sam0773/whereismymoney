// 其它投资模块
let currentOtherInvestments = [];
let currentOtherSearchQuery = '';

// 初始化其它资产模块
async function initOther() {
    // 重置搜索查询，确保切换选项卡后显示完整数据
    currentOtherSearchQuery = '';
    // 清空搜索框
    const otherSearchInput = document.getElementById('otherSearch');
    if (otherSearchInput) {
        otherSearchInput.value = '';
    }
    // 绑定事件
    bindOtherEvents();
    // 绑定排序按钮事件
    const sortBtns = document.querySelectorAll('.sort-btn');
    sortBtns.forEach(btn => {
        btn.addEventListener('click', () => handleOtherSort(btn));
    });
    // 设置默认日期
    const otherDateInput = document.getElementById('otherDate');
    if (otherDateInput) {
        otherDateInput.value = getTodayLocalDate();
    }
    
    try {
        // 检查登录状态
        const currentUser = getCurrentUser();
        if (currentUser) {
            // 只有在已登录状态下才加载数据
            await loadOtherInvestments();
            
            // 确保数据被正确存储到全局变量
            window.otherInvestments = currentOtherInvestments;
            window.currentOtherInvestments = currentOtherInvestments;
            
            // 填充数据列表
            populateDatalists();
        }
        
        // 渲染表格（无论是否登录，都渲染表格，未登录时显示空状态）
        renderOtherTable();
        
        // 初始化模态框
        initOtherModals();
    } catch (error) {
        console.error('初始化其它资产失败:', error);
        // 即使出错，也确保表格有内容显示
        renderOtherTable();
    }
}

// 处理其它投资表格排序
function handleOtherSort(btn) {
    const column = btn.getAttribute('data-column');
    const order = btn.getAttribute('data-order');
    const tableId = btn.closest('table').id;
    
    // 获取当前数据
    const latestData = window.currentOtherInvestments || currentOtherInvestments || [];
    let filteredData = latestData;
    
    // 应用搜索过滤
    if (currentOtherSearchQuery) {
        filteredData = filteredData.filter(item => {
            return item.name.toLowerCase().includes(currentOtherSearchQuery) ||
                   item.type.toLowerCase().includes(currentOtherSearchQuery) ||
                   item.amount.toString().includes(currentOtherSearchQuery) ||
                   item.remarks?.toLowerCase().includes(currentOtherSearchQuery) ||
                   item.platform?.toLowerCase().includes(currentOtherSearchQuery) ||
                   item.flexibility?.toLowerCase().includes(currentOtherSearchQuery);
        });
    }
    
    // 找出所有已完成全部赎回的组合
    const fullRedeemGroups = {};
    currentOtherInvestments.forEach(item => {
        if (item.transactionType === 'redeem' && item.redeemType === 'full') {
            const groupKey = `${item.type}-${item.name}-${item.platform || '-'}`;
            fullRedeemGroups[groupKey] = true;
        }
    });
    
    // 分离持有中和已赎回的数据
    const activeData = filteredData.filter(item => {
        const groupKey = `${item.type}-${item.name}-${item.platform || '-'}`;
        return !fullRedeemGroups[groupKey];
    });
    
    const historyData = filteredData.filter(item => {
        const groupKey = `${item.type}-${item.name}-${item.platform || '-'}`;
        return fullRedeemGroups[groupKey];
    });
    
    // 计算收益率函数
    function calculateYieldRate(totalBuy, totalRedeem) {
        if (totalBuy === 0) return '0.00%';
        const rate = ((totalRedeem - totalBuy) / totalBuy) * 100;
        return `${parseFloat(rate).toFixed(2)}%`;
    }
    
    // 处理当前投资表格排序
    if (tableId === 'otherTable') {
        // 按投资类型-投资名称-交易平台分组
        const groupedData = activeData.reduce((acc, item) => {
            const key = `${item.type}-${item.name}-${item.platform || '-'}`;
            if (!acc[key]) {
                acc[key] = {
                    type: item.type,
                    name: item.name,
                    platform: item.platform,
                    items: [],
                    totalAmount: 0
                };
            }
            acc[key].items.push(item);
            acc[key].totalAmount += (item.transactionType || 'buy') === 'buy' ? item.amount : -item.amount;
            return acc;
        }, {});
        
        let groups = Object.values(groupedData);
        
        // 排序
        groups.sort((a, b) => {
            let aVal, bVal;
            const latestA = a.items.sort((x, y) => new Date(y.date) - new Date(x.date))[0];
            const latestB = b.items.sort((x, y) => new Date(y.date) - new Date(x.date))[0];
            
            switch (column) {
                case 'type':
                    aVal = a.type.toLowerCase();
                    bVal = b.type.toLowerCase();
                    break;
                case 'name':
                    aVal = a.name.toLowerCase();
                    bVal = b.name.toLowerCase();
                    break;
                case 'platform':
                    aVal = a.platform?.toLowerCase() || '';
                    bVal = b.platform?.toLowerCase() || '';
                    break;
                case 'flexibility':
                    aVal = latestA.flexibility?.toLowerCase() || '';
                    bVal = latestB.flexibility?.toLowerCase() || '';
                    break;
                case 'amount':
                    aVal = parseFloat(a.totalAmount);
                    bVal = parseFloat(b.totalAmount);
                    break;
                case 'date':
                    aVal = new Date(latestA.date);
                    bVal = new Date(latestB.date);
                    break;
                default:
                    // 默认按日期排序
                    aVal = new Date(latestA.date);
                    bVal = new Date(latestB.date);
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
        renderOtherTable(groups);
    } else {
        // 处理历史投资表格排序
        // 找出所有全部赎回记录
        const fullRedeemRecords = historyData.filter(item => 
            item.transactionType === 'redeem' && item.redeemType === 'full'
        );
        
        let historyGroups = [];
        
        if (fullRedeemRecords.length === 0) {
            // 按投资类型-投资名称-交易平台分组
            const historyGroupedData = historyData.reduce((acc, item) => {
                const key = `${item.type}-${item.name}-${item.platform || '-'}`;
                if (!acc[key]) {
                    acc[key] = {
                        type: item.type,
                        name: item.name,
                        platform: item.platform,
                        items: [],
                        totalBuyAmount: 0,
                        totalRedeemAmount: 0,
                        latestDate: item.date
                    };
                }
                acc[key].items.push(item);
                if ((item.transactionType || 'buy') === 'buy') {
                    acc[key].totalBuyAmount += item.amount;
                } else {
                    acc[key].totalRedeemAmount += item.amount;
                }
                if (new Date(item.date) > new Date(acc[key].latestDate)) {
                    acc[key].latestDate = item.date;
                }
                return acc;
            }, {});
            
            historyGroups = Object.values(historyGroupedData);
        } else {
            // 有全部赎回记录，按每次全部赎回作为独立记录显示
            fullRedeemRecords.forEach(redeemRecord => {
                const relatedItems = historyData.filter(item => 
                    item.type === redeemRecord.type && 
                    item.name === redeemRecord.name && 
                    (item.platform || '-') === (redeemRecord.platform || '-') &&
                    new Date(item.date) <= new Date(redeemRecord.date)
                );
                
                const totalBuyAmount = relatedItems.reduce((sum, item) => {
                    return sum + ((item.transactionType || 'buy') === 'buy' ? item.amount : 0);
                }, 0);
                
                const totalRedeemAmount = relatedItems.reduce((sum, item) => {
                    return sum + ((item.transactionType || 'buy') === 'redeem' ? item.amount : 0);
                }, 0);
                
                historyGroups.push({
                    type: redeemRecord.type,
                    name: redeemRecord.name,
                    platform: redeemRecord.platform,
                    items: relatedItems,
                    totalBuyAmount: totalBuyAmount,
                    totalRedeemAmount: totalRedeemAmount,
                    latestDate: redeemRecord.date,
                    redeemRecord: redeemRecord
                });
            });
        }
        
        // 排序历史记录
        historyGroups.sort((a, b) => {
            let aVal, bVal;
            
            switch (column) {
                case 'type':
                    aVal = a.type.toLowerCase();
                    bVal = b.type.toLowerCase();
                    break;
                case 'name':
                    aVal = a.name.toLowerCase();
                    bVal = b.name.toLowerCase();
                    break;
                case 'platform':
                    aVal = a.platform?.toLowerCase() || '';
                    bVal = b.platform?.toLowerCase() || '';
                    break;
                case 'totalBuyAmount':
                    aVal = parseFloat(a.totalBuyAmount);
                    bVal = parseFloat(b.totalBuyAmount);
                    break;
                case 'totalRedeemAmount':
                    aVal = parseFloat(a.totalRedeemAmount);
                    bVal = parseFloat(b.totalRedeemAmount);
                    break;
                case 'yieldRate':
                    aVal = parseFloat(calculateYieldRate(a.totalBuyAmount, a.totalRedeemAmount).replace('%', ''));
                    bVal = parseFloat(calculateYieldRate(b.totalBuyAmount, b.totalRedeemAmount).replace('%', ''));
                    break;
                case 'date':
                    aVal = new Date(a.latestDate);
                    bVal = new Date(b.latestDate);
                    break;
                default:
                    // 默认按日期排序
                    aVal = new Date(a.latestDate);
                    bVal = new Date(b.latestDate);
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
        renderOtherTable(null, historyGroups);
    }
}

// 初始化模态框
function initOtherModals() {
    // 创建购买模态框
    createBuyOtherModal();
    // 创建部分赎回模态框
    createPartialRedeemOtherModal();
    // 创建全部赎回模态框
    createFullRedeemOtherModal();
    // 创建编辑模态框
    createEditOtherModal();
}

// 创建购买模态框
function createBuyOtherModal() {
    let modal = document.getElementById('buyOtherModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'buyOtherModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>购买</h2>
                <div class="form-group">
                    <label for="buyDate">购买日期:</label>
                    <input type="text" id="buyDate" placeholder="格式：YYYYMMDD" required>
                </div>
                <div class="form-group">
                    <label for="buyAmount">购买金额:</label>
                    <input type="number" id="buyAmount" step="0.01" min="0.01" required placeholder="输入购买金额">
                </div>
                <div class="form-group">
                    <label for="buyRemarks">备注:</label>
                    <input type="text" id="buyRemarks" placeholder="输入备注">
                </div>
                <div id="buyOtherStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="buyOtherConfirmBtn" class="btn btn-primary">确认购买</button>
                    <button id="buyOtherCancelBtn" type="button" class="btn btn-secondary">取消</button>
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
        
        // 绑定事件
        modal.querySelector('#buyOtherConfirmBtn').addEventListener('click', handleBuyOtherSubmit);
        modal.querySelector('#buyOtherCancelBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
}

// 创建部分赎回模态框
function createPartialRedeemOtherModal() {
    let modal = document.getElementById('partialRedeemOtherModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'partialRedeemOtherModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>部分赎回</h2>
                <div class="form-group">
                    <label for="partialRedeemDate">赎回日期:</label>
                    <input type="text" id="partialRedeemDate" placeholder="格式：YYYYMMDD" required>
                </div>
                <div class="form-group">
                    <label for="partialRedeemAmount">赎回金额:</label>
                    <input type="number" id="partialRedeemAmount" step="0.01" min="0.01" required placeholder="输入赎回金额">
                </div>
                <div class="form-group">
                    <label for="partialRedeemRemarks">备注:</label>
                    <input type="text" id="partialRedeemRemarks" placeholder="输入备注">
                </div>
                <div id="partialRedeemOtherStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="partialRedeemOtherConfirmBtn" type="submit" class="btn btn-primary">确认赎回</button>
                    <button id="partialRedeemOtherCancelBtn" type="button" class="btn btn-secondary">取消</button>
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
        
        // 绑定事件
        modal.querySelector('#partialRedeemOtherConfirmBtn').addEventListener('click', handlePartialRedeemOtherSubmit);
        modal.querySelector('#partialRedeemOtherCancelBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
}

// 创建全部赎回模态框
function createFullRedeemOtherModal() {
    let modal = document.getElementById('fullRedeemOtherModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fullRedeemOtherModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>全部赎回</h2>
                <div class="form-group">
                    <label for="fullRedeemDate">赎回日期:</label>
                    <input type="text" id="fullRedeemDate" placeholder="格式：YYYYMMDD" required>
                </div>
                <div class="form-group">
                    <label for="fullRedeemAmount">赎回金额:</label>
                    <input type="number" id="fullRedeemAmount" step="0.01" min="0.01" required placeholder="输入赎回金额">
                </div>
                <div class="form-group">
                    <label for="fullRedeemRemarks">备注:</label>
                    <input type="text" id="fullRedeemRemarks" placeholder="输入备注">
                </div>
                <div class="form-group">
                    <label for="fullRedeemConfirm">请输入 "全部赎回" 以确认:</label>
                    <input type="text" id="fullRedeemConfirm" placeholder="请输入确认文本">
                </div>
                <div id="fullRedeemOtherStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="fullRedeemOtherConfirmBtn" type="submit" class="btn btn-danger">确认全部赎回</button>
                    <button id="fullRedeemOtherCancelBtn" type="button" class="btn btn-secondary">取消</button>
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
        
        // 绑定事件
        modal.querySelector('#fullRedeemOtherConfirmBtn').addEventListener('click', handleFullRedeemOtherSubmit);
        modal.querySelector('#fullRedeemOtherCancelBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
}

// 创建编辑模态框
function createEditOtherModal() {
    let modal = document.getElementById('editOtherModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editOtherModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>编辑交易记录</h2>
                <div class="form-group">
                    <label for="editOtherDate">日期:</label>
                    <input type="text" id="editOtherDate" placeholder="格式：YYYYMMDD" required>
                </div>
                <div class="form-group">
                    <label for="editOtherAmount">金额:</label>
                    <input type="number" id="editOtherAmount" step="0.01" min="0.01" required placeholder="输入金额">
                </div>
                <div class="form-group">
                    <label for="editOtherRemarks">备注:</label>
                    <input type="text" id="editOtherRemarks" placeholder="输入备注">
                </div>
                <div id="editOtherStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="editOtherConfirmBtn" type="submit" class="btn btn-primary">保存</button>
                    <button id="editOtherCancelBtn" type="button" class="btn btn-secondary">取消</button>
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
        
        // 绑定事件
        modal.querySelector('#editOtherConfirmBtn').addEventListener('click', handleEditOtherSubmit);
        modal.querySelector('#editOtherCancelBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
}

// 绑定事件
function bindOtherEvents() {
    // 表单提交事件
    const otherForm = document.getElementById('otherForm');
    if (otherForm) {
        otherForm.addEventListener('submit', handleOtherSubmit);
    }
    
    // 搜索事件
    const otherSearchInput = document.getElementById('otherSearch');
    if (otherSearchInput) {
        otherSearchInput.addEventListener('input', handleOtherSearch);
    }
    
    // 隐藏/显示表单事件
    const toggleAddOtherBtn = document.getElementById('toggleAddOther');
    if (toggleAddOtherBtn) {
        toggleAddOtherBtn.addEventListener('click', toggleAddOther);
    }
    
    // 隐藏/显示汇总信息事件
    const toggleOtherSummaryBtn = document.getElementById('toggleOtherSummary');
    if (toggleOtherSummaryBtn) {
        toggleOtherSummaryBtn.addEventListener('click', toggleOtherSummary);
    }
    
    // 导出数据事件
    const exportOtherBtn = document.getElementById('exportOtherData');
    if (exportOtherBtn) {
        exportOtherBtn.addEventListener('click', exportOtherData);
    }
}

// 加载其它投资数据
async function loadOtherInvestments() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        return;
    }
    
    try {
        // 从后端API加载数据
        const loadedData = await window.dbManager.getAllByIndex(STORES.OTHER, 'username', currentUser.username);
        
        // 处理后端返回的数据，确保转换为正确的数组格式
        let processedData = [];
        
        // 检查loadedData是否为数组
        if (Array.isArray(loadedData)) {
            // 如果是数组，直接使用
            processedData = loadedData;
        } 
        // 检查loadedData是否为对象且包含length属性（后端返回的特殊格式）
        else if (typeof loadedData === 'object' && loadedData !== null) {
            // 处理后端返回的特殊格式：{0: {...}, 1: {...}, length: 2}
            processedData = [];
            for (let key in loadedData) {
                // 只处理数字键
                if (loadedData.hasOwnProperty(key) && !isNaN(parseInt(key))) {
                    processedData.push(loadedData[key]);
                }
            }
        }
        
        // 确保processedData是数组
        processedData = Array.isArray(processedData) ? processedData : [];
        
        // 处理数据，确保每个记录都有必要的字段
        processedData = processedData.map(item => ({
            ...item,
            transactionType: item.transactionType || 'buy',
            redeemType: item.redeemType || 'partial',
            status: item.status || 'active'
        }));
        
        // 更新当前数据列表
        currentOtherInvestments = processedData;
        
        // 更新全局window对象的otherInvestments
        window.otherInvestments = currentOtherInvestments;
        window.currentOtherInvestments = currentOtherInvestments;
        
    } catch (error) {
        console.error('加载其它投资数据失败:', error);
        currentOtherInvestments = [];
        
        // 更新全局变量
        window.otherInvestments = currentOtherInvestments;
        window.currentOtherInvestments = currentOtherInvestments;
    }
}

// 填充数据列表
function populateDatalists() {
    // 获取所有已添加的资产
    const assets = currentOtherInvestments;
    
    // 提取唯一值
    const types = [...new Set(assets.map(asset => asset.type))];
    const names = [...new Set(assets.map(asset => asset.name))];
    const platforms = [...new Set(assets.map(asset => asset.platform).filter(Boolean))];
    
    // 填充投资类型数据列表（保留预设选项）
    const typeOptionsEl = document.getElementById('otherTypeOptions');
    if (typeOptionsEl) {
        // 保留预设选项，只添加新的自定义类型
        const presetTypes = ['债券', '贵金属', '可转债', '不动产', '保险类理财', '私募类产品'];
        const customTypes = types.filter(type => !presetTypes.includes(type));
        typeOptionsEl.innerHTML = presetTypes.concat(customTypes).map(type => `<option value="${type}">`).join('');
    }
    
    // 填充投资名称数据列表
    const nameOptionsEl = document.getElementById('otherNameOptions');
    if (nameOptionsEl) {
        nameOptionsEl.innerHTML = names.map(name => `<option value="${name}">`).join('');
    }
    
    // 填充交易平台数据列表
    const platformOptionsEl = document.getElementById('otherPlatformOptions');
    if (platformOptionsEl) {
        platformOptionsEl.innerHTML = platforms.map(platform => `<option value="${platform}">`).join('');
    }
}

// 处理表单提交
async function handleOtherSubmit(e) {
    e.preventDefault();
    
    try {
        // 获取表单数据
        const name = document.getElementById('otherName').value;
        const type = document.getElementById('otherType').value;
        const amount = parseFloat(parseFloat(document.getElementById('otherAmount').value).toFixed(2));
        const date = document.getElementById('otherDate').value;
        const remarks = document.getElementById('otherRemarks').value;
        const platform = document.getElementById('otherPlatform').value;
        const flexibility = document.getElementById('otherFlexibility').value;
        
        // 数据验证
        if (!name || !type || isNaN(amount) || amount <= 0 || !date) {
            alert('请填写完整的资产信息');
            return;
        }
        
        // 格式化日期
        const formattedDate = window.formatDate(date);
        
        // 创建资产对象
        const otherAsset = {
            name,
            type,
            amount,
            date: formattedDate,
            remarks,
            platform,
            flexibility,
            expectedReturn: 0, // 添加默认值
            transactionType: 'buy', // buy: 购买, redeem: 赎回
            redeemType: 'partial', // partial: 部分赎回, full: 全部赎回
            status: 'active', // active: 持有中, redeemed: 已赎回
            username: getCurrentUser().username
        };
        
        // 保存数据到数据库
        const savedAsset = await window.dbManager.save(STORES.OTHER, otherAsset);
        
        // 创建完整的资产对象，包含从数据库返回的id
        const fullAsset = {
            ...otherAsset,
            id: savedAsset.id
        };
        
        // 添加到当前数据列表
        currentOtherInvestments.push(fullAsset);
        
        // 更新全局window对象的otherInvestments
        window.otherInvestments = currentOtherInvestments;
        
        // 重新渲染表格
        renderOtherTable();
        
        // 更新数据列表
        populateDatalists();
        
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
        
        // 设置默认日期
        const today = new Date();
        const defaultFormattedDate = today.toISOString().split('T')[0].replace(/-/g, '');
        document.getElementById('otherDate').value = defaultFormattedDate;
        
        alert('其它资产添加成功！');
    } catch (error) {
        console.error('添加其它资产失败:', error);
        alert('添加其它资产失败，请检查输入数据格式是否正确');
    }
}

// 处理搜索
function handleOtherSearch(e) {
    currentOtherSearchQuery = e.target.value.toLowerCase();
    renderOtherTable();
}

// 渲染其它资产表格和历史记录
function renderOtherTable(sortedActiveGroups = null, sortedHistoryGroups = null) {
    const tbody = document.getElementById('otherTableBody');
    const historyTbody = document.getElementById('otherHistoryTableBody');
    
    // 检查元素是否存在
    if (!tbody || !historyTbody) {
        console.warn('Element with id otherTableBody or otherHistoryTableBody not found');
        return;
    }
    
    // 确保使用最新数据，优先使用全局变量中的数据
    const latestData = window.currentOtherInvestments || currentOtherInvestments || [];
    let filteredData = latestData;
    
    // 应用搜索过滤
    if (currentOtherSearchQuery) {
        filteredData = filteredData.filter(item => {
            return item.name.toLowerCase().includes(currentOtherSearchQuery) ||
                   item.type.toLowerCase().includes(currentOtherSearchQuery) ||
                   item.amount.toString().includes(currentOtherSearchQuery) ||
                   item.remarks?.toLowerCase().includes(currentOtherSearchQuery) ||
                   item.platform?.toLowerCase().includes(currentOtherSearchQuery) ||
                   item.flexibility?.toLowerCase().includes(currentOtherSearchQuery);
        });
    }
    
    // 分离持有中和已赎回的数据
    // 对于当前列表，显示所有没有被全部赎回的记录
    // 对于历史列表，显示所有被全部赎回的记录
    let activeData, historyData;
    
    // 找出所有已完成全部赎回的组合
    const fullRedeemGroups = {};
    currentOtherInvestments.forEach(item => {
        if (item.transactionType === 'redeem' && item.redeemType === 'full') {
            const groupKey = `${item.type}-${item.name}-${item.platform || '-'}`;
            fullRedeemGroups[groupKey] = true;
        }
    });
    
    // 渲染当前列表：显示所有未被全部赎回的记录
    activeData = filteredData.filter(item => {
        const groupKey = `${item.type}-${item.name}-${item.platform || '-'}`;
        return !fullRedeemGroups[groupKey];
    });
    
    // 渲染历史列表：显示所有被全部赎回的记录
    historyData = filteredData.filter(item => {
        const groupKey = `${item.type}-${item.name}-${item.platform || '-'}`;
        return fullRedeemGroups[groupKey];
    });

    
    // 渲染持有中表格
    if (activeData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #999; padding: 20px;">暂无数据</td></tr>';
    } else {
        let renderGroups;
        if (sortedActiveGroups) {
            // 使用传入的排序后的数据
            renderGroups = sortedActiveGroups;
        } else {
            // 按投资类型-投资名称-交易平台分组
            const groupedData = activeData.reduce((acc, item) => {
                // 使用统一的键格式：type-name-platform
                const key = `${item.type}-${item.name}-${item.platform || '-'}`;
                if (!acc[key]) {
                    acc[key] = {
                        type: item.type,
                        name: item.name,
                        platform: item.platform,
                        items: [],
                        totalAmount: 0
                    };
                }
                acc[key].items.push(item);
                // 确保transactionType存在，默认视为buy
                acc[key].totalAmount += (item.transactionType || 'buy') === 'buy' ? item.amount : -item.amount;
                return acc;
            }, {});
            renderGroups = Object.values(groupedData);
        }
        
        // 渲染表格内容
        tbody.innerHTML = renderGroups.map(group => {
            // 使用最新的日期和灵活性信息
            const latestItem = group.items.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            const groupKey = `${group.type}-${group.name}-${group.platform || '-'}`;
            // 使用组合备注
            const groupRemarks = group.items[0]?.groupRemarks || '-';
            return `
                <tr>
                    <td>${group.type}</td>
                    <td>${group.name}</td>
                    <td>${group.platform || '-'}</td>
                    <td>${latestItem.flexibility || '-'}</td>
                    <td class="amount">¥${parseFloat(group.totalAmount).toFixed(2)}</td>
                    <td>${latestItem.date}</td>
                    <td>${groupRemarks}</td>
                    <td>
                        <button class="btn btn-small btn-primary" onclick="showOtherDetails('${groupKey.replace(/'/g, "&#39;")}')">查看详情</button>
                    </td>
                    <td>
                        <button class="btn btn-small btn-buy" onclick="buyOther('${groupKey.replace(/'/g, "&#39;")}')">购买</button>
                        <button class="btn btn-small btn-partial-redemption" onclick="partialRedeemOther('${groupKey.replace(/'/g, "&#39;")}')">部分赎回</button>
                        <button class="btn btn-small btn-danger" onclick="fullRedeemOther('${groupKey.replace(/'/g, "&#39;")}')">全部赎回</button>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    // 渲染历史记录表格
    if (historyData.length === 0) {
        historyTbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #999; padding: 20px;">暂无历史记录</td></tr>';
    } else {
        let historyGroups;
        if (sortedHistoryGroups) {
            // 使用传入的排序后的数据
            historyGroups = sortedHistoryGroups;
        } else {
            // 找出所有全部赎回记录
            const fullRedeemRecords = historyData.filter(item => 
                item.transactionType === 'redeem' && item.redeemType === 'full'
            );
            
            // 计算收益率函数
            function calculateYieldRate(totalBuy, totalRedeem) {
                if (totalBuy === 0) return '0.00%';
                const rate = ((totalRedeem - totalBuy) / totalBuy) * 100;
                return `${parseFloat(rate).toFixed(2)}%`;
            }
            
            historyGroups = [];
            
            if (fullRedeemRecords.length === 0) {
                // 按投资类型-投资名称-交易平台分组
                const historyGroupedData = historyData.reduce((acc, item) => {
                    const key = `${item.type}-${item.name}-${item.platform || '-'}`;
                    if (!acc[key]) {
                        acc[key] = {
                            type: item.type,
                            name: item.name,
                            platform: item.platform,
                            items: [],
                            totalBuyAmount: 0,
                            totalRedeemAmount: 0,
                            latestDate: item.date // 使用最新日期作为排序依据
                        };
                    }
                    acc[key].items.push(item);
                    if ((item.transactionType || 'buy') === 'buy') {
                        acc[key].totalBuyAmount += item.amount;
                    } else {
                        acc[key].totalRedeemAmount += item.amount;
                    }
                    // 更新最新日期
                    if (new Date(item.date) > new Date(acc[key].latestDate)) {
                        acc[key].latestDate = item.date;
                    }
                    return acc;
                }, {});
                
                historyGroups = Object.values(historyGroupedData);
            } else {
                // 有全部赎回记录，按每次全部赎回作为独立记录显示
                // 为每个全部赎回记录创建一个分组
                fullRedeemRecords.forEach(redeemRecord => {
                    // 找出该全部赎回记录相关的所有记录
                    const relatedItems = historyData.filter(item => 
                        item.type === redeemRecord.type && 
                        item.name === redeemRecord.name && 
                        (item.platform || '-') === (redeemRecord.platform || '-') &&
                        new Date(item.date) <= new Date(redeemRecord.date)
                    );
                    
                    // 计算该批次的总购买金额和总赎回金额
                    const totalBuyAmount = relatedItems.reduce((sum, item) => {
                        return sum + ((item.transactionType || 'buy') === 'buy' ? item.amount : 0);
                    }, 0);
                    
                    const totalRedeemAmount = relatedItems.reduce((sum, item) => {
                        return sum + ((item.transactionType || 'buy') === 'redeem' ? item.amount : 0);
                    }, 0);
                    
                    historyGroups.push({
                        type: redeemRecord.type,
                        name: redeemRecord.name,
                        platform: redeemRecord.platform,
                        items: relatedItems,
                        totalBuyAmount: totalBuyAmount,
                        totalRedeemAmount: totalRedeemAmount,
                        latestDate: redeemRecord.date, // 使用赎回日期作为排序依据
                        redeemRecord: redeemRecord // 保存赎回记录用于详情展示
                    });
                });
            }
            
            // 按最新日期降序排序
            historyGroups.sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));
        }
        
        // 分页设置
        const pageSize = 20;
        const totalRecords = historyGroups.length;
        const showFullList = window.otherHistoryShowFull || false;
        const displayGroups = showFullList ? historyGroups : historyGroups.slice(0, pageSize);
        
        // 渲染历史记录表格内容
        let tableHTML = displayGroups.map(group => {
            // 使用组合备注
            const groupRemarks = group.items[0]?.groupRemarks || '-';
            // 计算收益率
            const yieldRate = calculateYieldRate(group.totalBuyAmount, group.totalRedeemAmount);
            
            // 生成详情按钮的点击事件
            let detailsButton;
            if (group.redeemRecord) {
                detailsButton = `<button class="btn btn-small btn-primary" onclick="showOtherDetails(${group.redeemRecord.id})">查看详情</button>`;
            } else {
                const groupKey = `${group.type}-${group.name}-${group.platform || '-'}`;
                detailsButton = `<button class="btn btn-small btn-primary" onclick="showOtherDetails('${groupKey.replace(/'/g, "&#39;")}')">查看详情</button>`;
            }
            
            return `
                <tr>
                    <td>${group.type}</td>
                    <td>${group.name}</td>
                    <td>${group.platform || '-'}</td>
                    <td class="amount">¥${parseFloat(group.totalBuyAmount).toFixed(2)}</td>
                    <td class="transfer-out">¥${parseFloat(group.totalRedeemAmount).toFixed(2)}</td>
                    <td>${yieldRate}</td>
                    <td>${groupRemarks}</td>
                    <td>${detailsButton}</td>
                </tr>
            `;
        }).join('');
        
        // 检查是否需要显示展开/折叠按钮
        if (totalRecords > pageSize) {
            // 添加展开/收起按钮作为表格的一部分，使用colspan跨列
            tableHTML += `
                <tr class="history-toggle-row">
                    <td colspan="8" style="text-align: center; padding: 10px;">
                        <button class="btn btn-small btn-secondary" onclick="toggleOtherHistory()">
                            ${showFullList ? '点击收起' : '点击展开'}
                        </button>
                    </td>
                </tr>
            `;
        } else {
            // 如果记录数不超过20条，确保状态为收起
            window.otherHistoryShowFull = false;
        }
        
        // 更新表格内容
        historyTbody.innerHTML = tableHTML;
        
        // 清理可能存在的旧按钮
        const tableContainer = historyTbody.closest('.table-container');
        const oldToggleButton = tableContainer.querySelector('#toggleOtherHistory');
        if (oldToggleButton) {
            oldToggleButton.remove();
        }
    }
    
    // 更新汇总信息
    updateOtherSummary();
}

// 切换显示/隐藏添加表单
function toggleAddOther() {
    const addOtherContent = document.getElementById('addOtherContent');
    const toggleBtn = document.getElementById('toggleAddOther');
    
    if (addOtherContent.style.display === 'none') {
        addOtherContent.style.display = 'block';
        toggleBtn.textContent = '隐藏';
    } else {
        addOtherContent.style.display = 'none';
        toggleBtn.textContent = '显示';
    }
}

// 切换显示/隐藏汇总信息
function toggleOtherSummary() {
    const otherSummaryContent = document.getElementById('otherSummaryContent');
    const toggleBtn = document.getElementById('toggleOtherSummary');
    
    if (otherSummaryContent.style.display === 'none') {
        otherSummaryContent.style.display = 'block';
        toggleBtn.textContent = '隐藏';
    } else {
        otherSummaryContent.style.display = 'none';
        toggleBtn.textContent = '显示';
    }
}

// 切换历史记录表格的显示状态
function toggleOtherHistory() {
    window.otherHistoryShowFull = !window.otherHistoryShowFull;
    renderOtherTable();
}

// 计算其它资产汇总信息
function calculateOtherSummary() {
    // 计算持有中资产的总金额，确保即使status字段不存在也能正确处理
    const activeData = currentOtherInvestments.filter(item => (item.status || 'active') === 'active');
    
    // 按投资类型分组，计算每个类型的总金额
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
        acc[groupKey].totalActiveAmount += (item.transactionType || 'buy') === 'buy' ? item.amount : -item.amount;
        return acc;
    }, {});
    
    // 计算总持有资产金额，只汇总投资金额大于0的项目
    const totalActiveAmount = Object.values(groupedByType)
        .filter(group => group.totalActiveAmount > 0)
        .reduce((sum, group) => sum + group.totalActiveAmount, 0);
    
    // 按投资类型汇总，只保留总金额大于0的项目
    const typeSummary = Object.values(groupedByType)
        .filter(group => group.totalActiveAmount > 0)
        .reduce((acc, group) => {
            if (!acc[group.type]) {
                acc[group.type] = 0;
            }
            acc[group.type] += group.totalActiveAmount;
            return acc;
        }, {});
    
    return {
        totalActiveAmount,
        typeSummary
    };
}

// 更新其它资产汇总信息显示
function updateOtherSummary() {
    const summary = calculateOtherSummary();
    
    // 更新显示
    const totalAssetsEl = document.getElementById('totalOtherAssets');
    if (totalAssetsEl) {
        totalAssetsEl.textContent = `¥${parseFloat(summary.totalActiveAmount).toFixed(2)}`;
    }
    
    // 获取汇总内容容器
    const summaryContent = document.getElementById('otherSummaryContent');
    if (summaryContent) {
        // 保留第一个总金额行，移除其他行
        const totalRow = summaryContent.querySelector('.total-row');
        // 清除除了总金额行之外的所有内容
        summaryContent.innerHTML = totalRow.outerHTML;
        
        // 添加按投资类型汇总的行
        Object.entries(summary.typeSummary).forEach(([type, amount]) => {
            const typeRow = document.createElement('div');
            typeRow.className = 'summary-row';
            typeRow.innerHTML = `
                <span class="summary-label">${type}:</span>
                <span class="summary-value">¥${parseFloat(amount).toFixed(2)}</span>
            `;
            summaryContent.appendChild(typeRow);
        });
    }
}

// 显示资产详情
function showOtherDetails(identifier) {
    let groupItems = [];
    let groupType, groupName, groupPlatform;
    
    // 检查identifier是否为分组键（包含'-'）
    if (typeof identifier === 'string' && identifier.includes('-')) {
        // 是分组键：type-name-platform
        const [type, name, platform] = identifier.split('-');
        groupType = type;
        groupName = name;
        groupPlatform = platform === '-' ? '' : platform;
        
        // 查找所有匹配的记录
        groupItems = currentOtherInvestments.filter(item => {
            return item.type === groupType && 
                   item.name === groupName && 
                   (item.platform || '-') === (groupPlatform || '-');
        });
    } else {
        // 是单个ID
        const id = typeof identifier === 'string' ? parseInt(identifier) : identifier;
        const redeemRecord = currentOtherInvestments.find(item => item.id === id);
        if (redeemRecord) {
            // 如果是全部赎回记录，找出相关的所有记录
            if (redeemRecord.transactionType === 'redeem' && redeemRecord.redeemType === 'full') {
                // 找出该全部赎回相关的所有记录
                groupItems = currentOtherInvestments.filter(item => 
                    item.type === redeemRecord.type && 
                    item.name === redeemRecord.name && 
                    (item.platform || '-') === (redeemRecord.platform || '-') &&
                    // 只显示该赎回批次相关的记录
                    // 这里使用日期逻辑：找出在该赎回记录日期之前或当天的所有记录
                    new Date(item.date) <= new Date(redeemRecord.date)
                );
            } else {
                // 普通记录，只显示一条
                groupItems = [redeemRecord];
            }
            groupType = redeemRecord.type;
            groupName = redeemRecord.name;
            groupPlatform = redeemRecord.platform;
        }
    }
    
    if (groupItems.length === 0) {
        alert('未找到相关交易记录');
        return;
    }
    
    // 计算总购买金额和总赎回金额
    const totalBuyAmount = groupItems.filter(item => item.transactionType === 'buy').reduce((sum, item) => sum + item.amount, 0);
    const totalRedeemAmount = groupItems.filter(item => item.transactionType === 'redeem').reduce((sum, item) => sum + item.amount, 0);
    const totalAmount = totalBuyAmount - totalRedeemAmount;
    
    // 按日期排序交易记录
    const sortedTransactions = [...groupItems].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // 创建详情模态框
    let modal = document.getElementById('otherDetailsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'otherDetailsModal';
        modal.className = 'modal';
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
        document.body.appendChild(modal);
        
        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    // 创建唯一的groupKey
    const groupKey = `${groupType}-${groupName}-${groupPlatform || '-'}`;
    
    // 生成交易记录表格HTML
    // 查找组合的备注（使用第一条记录的备注，或默认空）
    const groupRemarks = groupItems[0]?.groupRemarks || '';
    const transactionTableHTML = `
        <div style="margin: 10px 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
            <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>备注:</strong> ${groupRemarks || '-'}
                </div>
                <button class="btn btn-small btn-primary" onclick="editGroupRemarks('${groupKey.replace(/'/g, "&#39;")}')">编辑</button>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: center;">
                <div><strong>总购买金额:</strong> ¥${parseFloat(totalBuyAmount).toFixed(2)}</div>
                <div><strong>总赎回金额:</strong> ¥${parseFloat(totalRedeemAmount).toFixed(2)}</div>
            </div>
        </div>
        <table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
            <thead>
                <tr style="background-color: #f0f0f0;">
                    <th style="width: 120px; padding: 8px; border: 1px solid #ddd; text-align: center;">日期</th>
                    <th style="width: 100px; padding: 8px; border: 1px solid #ddd; text-align: center;">类型</th>
                    <th style="width: 120px; padding: 8px; border: 1px solid #ddd; text-align: right;">金额</th>
                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">备注</th>
                    <th style="width: 120px; padding: 8px; border: 1px solid #ddd; text-align: center;">操作</th>
                </tr>
            </thead>
            <tbody>
                ${sortedTransactions.map(item => {
                    const typeText = item.transactionType === 'buy' ? '购买' : '赎回';
                    return `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.date}</td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${typeText}</td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">¥${parseFloat(item.amount).toFixed(2)}</td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: left;">${item.remarks || '-'}</td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
                                <button class="btn btn-small btn-edit" onclick="editOtherTransaction(${item.id})">编辑</button>
                                <button class="btn btn-small btn-danger" onclick="deleteOtherTransaction(${item.id})">删除</button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    modal.innerHTML = `
        <div class="modal-content" style="max-height: 80vh; overflow-y: auto; max-width: 1000px; width: 100%;">
            <h2>交易记录详情</h2>
            <h3>${groupType} - ${groupName} - ${groupPlatform || '未知平台'}</h3>
            ${transactionTableHTML}
            <div class="form-actions" style="margin-top: 20px;">
                <button class="btn btn-secondary" onclick="document.getElementById('otherDetailsModal').style.display = 'none'">关闭</button>
            </div>
        </div>
    `;
    
    // 显示模态框
    modal.style.display = 'flex';
}

// 购买其它资产
function buyOther(identifier) {
    // 解析identifier
    const [type, name, platform] = identifier.split('-');
    const actualPlatform = platform === '-' ? '' : platform;
    
    // 保存当前资产信息
    window.currentBuyingOther = {
        type,
        name,
        platform: actualPlatform
    };
    
    // 设置默认日期
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0].replace(/-/g, '');
    const modal = document.getElementById('buyOtherModal');
    modal.querySelector('#buyDate').value = formattedDate;
    modal.querySelector('#buyAmount').value = '';
    modal.querySelector('#buyRemarks').value = '';
    modal.querySelector('#buyOtherStatus').textContent = '';
    
    // 显示模态框
    modal.style.display = 'flex';
}

// 处理购买表单提交
async function handleBuyOtherSubmit() {
    try {
        const { type, name, platform } = window.currentBuyingOther;
        const modal = document.getElementById('buyOtherModal');
        const amount = parseFloat(parseFloat(modal.querySelector('#buyAmount').value).toFixed(2));
        const date = modal.querySelector('#buyDate').value;
        const remarks = modal.querySelector('#buyRemarks').value;
        const statusEl = modal.querySelector('#buyOtherStatus');
        
        // 数据验证
        if (isNaN(amount) || amount <= 0 || !date) {
            statusEl.textContent = '请填写完整的购买信息';
            return;
        }
        
        // 格式化日期
        const formattedDate = formatDate(date);
        
        // 创建购买记录
        const buyRecord = {
            name,
            type,
            amount,
            date: formattedDate,
            remarks,
            platform,
            transactionType: 'buy',
            redeemType: 'partial',
            status: 'active',
            expectedReturn: 0,
            flexibility: '',
            username: getCurrentUser().username
        };
        
        // 保存到数据库
        const savedRecord = await window.dbManager.save(STORES.OTHER, buyRecord);
        
        // 创建完整记录
        const fullRecord = {
            ...buyRecord,
            id: savedRecord.id
        };
        
        // 添加到当前数据列表
        currentOtherInvestments.push(fullRecord);
        
        // 更新全局window对象
        window.otherInvestments = currentOtherInvestments;
        window.currentOtherInvestments = currentOtherInvestments;
        
        // 重新渲染表格
        renderOtherTable();
        
        // 更新数据列表
        populateDatalists();
        
        // 关闭模态框
        document.getElementById('buyOtherModal').style.display = 'none';
        
        alert('购买成功！');
    } catch (error) {
        console.error('购买失败:', error);
        alert('购买失败，请检查输入数据格式是否正确');
    }
}

// 部分赎回其它资产
function partialRedeemOther(identifier) {
    // 解析identifier
    const [type, name, platform] = identifier.split('-');
    const actualPlatform = platform === '-' ? '' : platform;
    
    // 计算当前持有金额
    const groupItems = currentOtherInvestments.filter(item => {
        return item.type === type && 
               item.name === name && 
               (item.platform || '-') === (actualPlatform || '-') &&
               item.status === 'active';
    });
    
    const currentAmount = groupItems.reduce((sum, item) => {
        return sum + (item.transactionType === 'buy' ? item.amount : -item.amount);
    }, 0);
    
    // 保存当前资产信息
    window.currentRedeemingOther = {
        type,
        name,
        platform: actualPlatform,
        currentAmount
    };
    
    // 设置默认日期
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0].replace(/-/g, '');
    const modal = document.getElementById('partialRedeemOtherModal');
    modal.querySelector('#partialRedeemDate').value = formattedDate;
    modal.querySelector('#partialRedeemAmount').value = '';
    modal.querySelector('#partialRedeemRemarks').value = '';
    modal.querySelector('#partialRedeemOtherStatus').textContent = '';
    
    // 显示模态框
    modal.style.display = 'flex';
}

// 处理部分赎回表单提交
async function handlePartialRedeemOtherSubmit() {
    try {
        const { type, name, platform, currentAmount } = window.currentRedeemingOther;
        const modal = document.getElementById('partialRedeemOtherModal');
        const amount = parseFloat(parseFloat(modal.querySelector('#partialRedeemAmount').value).toFixed(2));
        const date = modal.querySelector('#partialRedeemDate').value;
        const remarks = modal.querySelector('#partialRedeemRemarks').value;
        const statusEl = modal.querySelector('#partialRedeemOtherStatus');
        
        // 数据验证
        if (isNaN(amount) || amount <= 0 || !date) {
            statusEl.textContent = '请填写完整的赎回信息';
            return;
        }
        
        // 格式化日期
        const formattedDate = formatDate(date);
        
        // 创建赎回记录
        const redeemRecord = {
            name,
            type,
            amount,
            date: formattedDate,
            remarks,
            platform,
            transactionType: 'redeem',
            redeemType: 'partial',
            status: 'active',
            expectedReturn: 0,
            flexibility: '',
            username: getCurrentUser().username
        };
        
        // 保存到数据库
        const savedRecord = await window.dbManager.save(STORES.OTHER, redeemRecord);
        
        // 创建完整记录
        const fullRecord = {
            ...redeemRecord,
            id: savedRecord.id
        };
        
        // 添加到当前数据列表
        currentOtherInvestments.push(fullRecord);
        
        // 更新全局window对象
        window.otherInvestments = currentOtherInvestments;
        
        // 重新渲染表格
        renderOtherTable();
        
        // 更新数据列表
        populateDatalists();
        
        // 关闭模态框
        modal.style.display = 'none';
        
        alert('部分赎回成功！');
    } catch (error) {
        console.error('部分赎回失败:', error);
        alert('部分赎回失败，请检查输入数据格式是否正确');
    }
}

// 全部赎回其它资产
function fullRedeemOther(identifier) {
    // 解析identifier
    const [type, name, platform] = identifier.split('-');
    const actualPlatform = platform === '-' ? '' : platform;
    
    // 计算当前持有金额
    const allItems = currentOtherInvestments.filter(item => {
        return item.type === type && 
               item.name === name && 
               (item.platform || '-') === (actualPlatform || '-');
    });
    
    const groupItems = allItems.filter(item => item.status === 'active');
    
    const currentAmount = groupItems.reduce((sum, item) => {
        return sum + (item.transactionType === 'buy' ? item.amount : -item.amount);
    }, 0);
    
    // 保存当前资产信息
    window.currentFullRedeemingOther = {
        type,
        name,
        platform: actualPlatform,
        allItems,
        groupItems,
        currentAmount
    };
    
    // 设置默认日期
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0].replace(/-/g, '');
    const modal = document.getElementById('fullRedeemOtherModal');
    modal.querySelector('#fullRedeemDate').value = formattedDate;
    modal.querySelector('#fullRedeemAmount').value = ''; // 移除默认值，留空
    modal.querySelector('#fullRedeemRemarks').value = '';
    modal.querySelector('#fullRedeemOtherStatus').textContent = '';
    
    // 显示模态框
    modal.style.display = 'flex';
}

// 处理全部赎回表单提交
async function handleFullRedeemOtherSubmit() {
    try {
        const { type, name, platform, allItems, currentAmount } = window.currentFullRedeemingOther;
        const modal = document.getElementById('fullRedeemOtherModal');
        const amount = parseFloat(parseFloat(modal.querySelector('#fullRedeemAmount').value).toFixed(2));
        const date = modal.querySelector('#fullRedeemDate').value;
        const remarks = modal.querySelector('#fullRedeemRemarks').value;
        const statusEl = modal.querySelector('#fullRedeemOtherStatus');
        
        // 数据验证
        if (!date) {
            statusEl.textContent = '请填写赎回日期';
            return;
        }
        
        // 验证赎回金额
        if (isNaN(amount) || amount <= 0) {
            statusEl.textContent = '请填写有效的赎回金额';
            return;
        }
        
        const confirmText = modal.querySelector('#fullRedeemConfirm').value;
        if (confirmText !== '全部赎回') {
            statusEl.textContent = '请输入正确的确认文本';
            return;
        }
        
        // 格式化日期
        const formattedDate = formatDate(date);
        
        // 1. 创建赎回记录
        const redeemRecord = {
            name,
            type,
            amount: amount,
            date: formattedDate,
            remarks,
            platform,
            transactionType: 'redeem',
            redeemType: 'full',
            status: 'redeemed',
            expectedReturn: 0,
            flexibility: '',
            username: getCurrentUser().username
        };
        
        // 保存到数据库
        const savedRecord = await window.dbManager.save(STORES.OTHER, redeemRecord);
        
        // 2. 将所有相关记录标记为已赎回
        for (const item of allItems) {
            // 更新数据库
            await window.dbManager.save(STORES.OTHER, {
                ...item,
                status: 'redeemed'
            });
            
            // 更新本地数据
            const index = currentOtherInvestments.findIndex(inv => inv.id === item.id);
            if (index !== -1) {
                currentOtherInvestments[index].status = 'redeemed';
            }
        }
        
        // 创建完整的赎回记录
        const fullRecord = {
            ...redeemRecord,
            id: savedRecord.id
        };
        
        // 添加到当前数据列表
        currentOtherInvestments.push(fullRecord);
        
        // 更新全局window对象
        window.otherInvestments = currentOtherInvestments;
        window.currentOtherInvestments = currentOtherInvestments;
        
        // 重新渲染表格
        renderOtherTable();
        
        // 更新数据列表
        populateDatalists();
        
        // 关闭模态框
        modal.style.display = 'none';
        
        alert('全部赎回成功！');
    } catch (error) {
        console.error('全部赎回失败:', error);
        alert('全部赎回失败，请重试');
    }
}

// 编辑组合备注
function editGroupRemarks(groupKey) {
    // 解析groupKey
    const [type, name, platform] = groupKey.split('-');
    const actualPlatform = platform === '-' ? '' : platform;
    
    // 查找组合的所有记录
    const groupItems = currentOtherInvestments.filter(item => {
        return item.type === type && 
               item.name === name && 
               (item.platform || '-') === (actualPlatform || '-');
    });
    
    // 创建编辑组合备注的模态框
        let modal = document.getElementById('editGroupRemarksModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'editGroupRemarksModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h2>资产备注</h2>
                    <div class="form-group">
                        <label for="editGroupRemarksContent">备注内容:</label>
                        <textarea id="editGroupRemarksContent" rows="5" style="width: 500px; box-sizing: border-box;"></textarea>
                    </div>
                    <div id="editGroupRemarksStatus" style="margin: 15px 0; color: red;"></div>
                    <div class="form-actions">
                        <button id="editGroupRemarksConfirmBtn" class="btn btn-primary">保存</button>
                        <button id="editGroupRemarksCancelBtn" class="btn btn-secondary">取消</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // 添加样式
            modal.style.cssText = `
                display: none;
                position: fixed;
                z-index: 1002;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                justify-content: center;
                align-items: center;
            `;
            
            // 设置模态框内容宽度
            const modalContent = modal.querySelector('.modal-content');
            modalContent.style.maxWidth = '600px';
            modalContent.style.width = '100%';
            
            // 绑定事件
            modal.querySelector('#editGroupRemarksConfirmBtn').addEventListener('click', handleEditGroupRemarksSubmit);
            modal.querySelector('#editGroupRemarksCancelBtn').addEventListener('click', () => {
                modal.style.display = 'none';
            });
            
            // 点击模态框外部关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
    
    // 设置表单值
    const existingRemarks = groupItems[0]?.groupRemarks || '';
    modal.querySelector('#editGroupRemarksContent').value = existingRemarks;
    modal.querySelector('#editGroupRemarksStatus').textContent = '';
    
    // 保存当前编辑的groupKey
    window.currentEditingGroupKey = groupKey;
    
    // 显示模态框
    modal.style.display = 'flex';
}

// 处理编辑组合备注提交
async function handleEditGroupRemarksSubmit() {
    try {
        const groupKey = window.currentEditingGroupKey;
        const modal = document.getElementById('editGroupRemarksModal');
        const remarks = modal.querySelector('#editGroupRemarksContent').value;
        const statusEl = modal.querySelector('#editGroupRemarksStatus');
        
        // 解析groupKey
        const [type, name, platform] = groupKey.split('-');
        const actualPlatform = platform === '-' ? '' : platform;
        
        // 查找组合的所有记录
        const groupItems = currentOtherInvestments.filter(item => {
            return item.type === type && 
                   item.name === name && 
                   (item.platform || '-') === (actualPlatform || '-');
        });
        
        // 更新所有记录的groupRemarks
        for (const item of groupItems) {
            // 更新本地数据
            item.groupRemarks = remarks;
            
            // 更新数据库
            await window.dbManager.save(STORES.OTHER, item);
        }
        
        // 更新全局window对象
        window.otherInvestments = currentOtherInvestments;
        window.currentOtherInvestments = currentOtherInvestments;
        
        // 更新详情页面的备注显示
        const detailsModal = document.getElementById('otherDetailsModal');
        if (detailsModal) {
            const remarksContent = detailsModal.querySelector('#groupRemarksContent');
            if (remarksContent) {
                remarksContent.textContent = remarks || '-';
            }
        }
        
        // 重新渲染表格，更新备注列
        renderOtherTable();
        
        // 关闭模态框
        modal.style.display = 'none';
        
        alert('组合备注更新成功！');
    } catch (error) {
        console.error('更新组合备注失败:', error);
        alert('更新组合备注失败，请重试');
    }
}

// 编辑交易记录
function editOtherTransaction(transactionId) {
    // 查找要编辑的交易记录
    const transaction = currentOtherInvestments.find(item => item.id === transactionId);
    if (!transaction) return;
    
    // 保存当前交易ID
    window.currentEditingTransactionId = transactionId;
    
    // 设置表单值
    const modal = document.getElementById('editOtherModal');
    modal.querySelector('#editOtherDate').value = transaction.date;
    modal.querySelector('#editOtherAmount').value = transaction.amount;
    modal.querySelector('#editOtherRemarks').value = transaction.remarks || '';
    modal.querySelector('#editOtherStatus').textContent = '';
    
    // 设置编辑弹窗的z-index高于详情弹窗，使其显示在详情弹窗上层
    modal.style.zIndex = '1001';
    
    // 显示模态框
    modal.style.display = 'flex';
}

// 处理编辑表单提交
async function handleEditOtherSubmit() {
    try {
        const transactionId = window.currentEditingTransactionId;
        const modal = document.getElementById('editOtherModal');
        const date = modal.querySelector('#editOtherDate').value;
        const amount = parseFloat(parseFloat(modal.querySelector('#editOtherAmount').value).toFixed(2));
        const remarks = modal.querySelector('#editOtherRemarks').value;
        const statusEl = modal.querySelector('#editOtherStatus');
        
        // 数据验证
        if (!date || isNaN(amount) || amount <= 0) {
            statusEl.textContent = '请填写完整的交易信息';
            return;
        }
        
        // 格式化日期
        const formattedDate = formatDate(date);
        
        // 查找要编辑的交易记录
        const transactionIndex = currentOtherInvestments.findIndex(item => item.id === transactionId);
        if (transactionIndex === -1) {
            alert('未找到该交易记录');
            return;
        }
        
        // 更新交易记录
        const updatedTransaction = {
            ...currentOtherInvestments[transactionIndex],
            date: formattedDate,
            amount,
            remarks
        };
        
        // 保存到数据库
        await window.dbManager.save(STORES.OTHER, updatedTransaction);
        
        // 更新本地数据
        currentOtherInvestments[transactionIndex] = updatedTransaction;
        
        // 更新全局window对象
        window.otherInvestments = currentOtherInvestments;
        
        // 重新渲染表格
        renderOtherTable();
        
        // 关闭编辑模态框
        modal.style.display = 'none';
        
        // 关闭详情模态框
        const detailsModal = document.getElementById('otherDetailsModal');
        if (detailsModal) {
            detailsModal.style.display = 'none';
        }
        
        alert('交易记录编辑成功！');
    } catch (error) {
        console.error('编辑交易记录失败:', error);
        alert('编辑交易记录失败，请检查输入数据格式是否正确');
    }
}

// 删除交易记录
async function deleteOtherTransaction(transactionId) {
    if (confirm('确定要删除这条交易记录吗？')) {
        try {
            // 从数据库删除
            await window.dbManager.delete(STORES.OTHER, transactionId);
            
            // 重新从数据库加载所有数据，确保数据一致性
            await loadOtherInvestments();
            
            // 关闭详情模态框
            const detailsModal = document.getElementById('otherDetailsModal');
            if (detailsModal) {
                detailsModal.style.display = 'none';
            }
            
            // 重新渲染表格和汇总信息
            renderOtherTable();
            
            alert('交易记录删除成功！');
        } catch (error) {
            console.error('删除交易记录失败:', error);
            alert('删除交易记录失败，请重试');
        }
    }
}

// 关闭编辑交易记录模态框
function closeEditTransactionModal() {
    const modal = document.getElementById('editOtherModal');
    if (modal) {
        modal.style.display = 'none';
    }
    // 清理全局变量
    delete window.currentEditingTransactionId;
}

// 确保全局作用域可以访问这些函数
window.initOther = initOther;
window.renderOtherTable = renderOtherTable;
window.loadOtherInvestments = loadOtherInvestments;

// 导出其它资产数据
function exportOtherData() {
    if (!currentOtherInvestments || currentOtherInvestments.length === 0) {
        alert('没有其它资产数据可以导出');
        return;
    }
    
    // 准备导出数据
    const exportData = [];
    
    currentOtherInvestments.forEach(investment => {
        // 根据交易类型确定操作类型
        const typeText = investment.transactionType === 'buy' ? '购买' : '赎回';
        
        exportData.push({
            '投资类型': investment.type,
            '投资名称': investment.name,
            '交易平台': investment.platform,
            '资产灵活性': investment.flexibility || '-',
            '交易类型': typeText,
            '投资金额': investment.amount,
            '日期': investment.date,
            '备注': investment.remarks || '-',
            '交易ID': investment.id
        });
    });
    
    if (exportData.length === 0) {
        alert('没有可导出的交易记录');
        return;
    }
    
    // 创建工作簿和工作表
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '其它资产数据');
    
    // 导出为Excel文件
    const fileName = `其它资产数据_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

window.exportOtherData = exportOtherData;
window.showOtherDetails = showOtherDetails;
window.buyOther = buyOther;
window.partialRedeemOther = partialRedeemOther;
window.fullRedeemOther = fullRedeemOther;
window.editOtherTransaction = editOtherTransaction;
window.deleteOtherTransaction = deleteOtherTransaction;
window.closeEditTransactionModal = closeEditTransactionModal;
window.editGroupRemarks = editGroupRemarks;