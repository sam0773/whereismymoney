// 定期存款模块
window.currentDeposits = [];
let currentSearchQuery = '';
let summaryVisible = true;

// 初始化存款模块
function initDeposits() {
    // 直接使用window.dbManager，不再重新声明
    
    // 绑定表单事件，实现利息自动计算
    bindDepositFormEvents();
    
    // 绑定搜索框事件
    const searchInput = document.getElementById('depositSearch');
    if (searchInput) {
        searchInput.addEventListener('input', handleDepositSearch);
    }
    
    // 绑定排序按钮事件
    const sortBtns = document.querySelectorAll('.sort-btn');
    sortBtns.forEach(btn => {
        btn.addEventListener('click', () => handleDepositSort(btn));
    });
    
    // 绑定Excel相关事件
    bindExcelEvents();
    
    // 绑定显示/隐藏按钮事件
    const toggleSummaryBtn = document.getElementById('toggleSummary');
    if (toggleSummaryBtn) {
        toggleSummaryBtn.addEventListener('click', toggleSummary);
    }
    
    const toggleAddDepositBtn = document.getElementById('toggleAddDeposit');
    if (toggleAddDepositBtn) {
        toggleAddDepositBtn.addEventListener('click', toggleAddDeposit);
    }
    
    // 初始化存入日期为今天
    const dateInput = document.getElementById('depositDate');
    if (dateInput) {
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        dateInput.value = formattedDate;
    }
    
    // 加载数据并渲染表格
    loadDeposits().then(() => {
        renderDepositTable();
        renderExpiredDepositTable();
        updateBankOptions(); // 更新银行选项列表
    });
}

// 绑定Excel相关事件
function bindExcelEvents() {
    // 文件选择事件
    const excelFileInput = document.getElementById('excelFile');
    if (excelFileInput && window.handleFileSelect) {
        // 先移除可能存在的事件监听器，避免重复绑定
        excelFileInput.removeEventListener('change', window.handleFileSelect);
        excelFileInput.addEventListener('change', window.handleFileSelect);
    }
    
    // 导入数据按钮
    const importExcelBtn = document.getElementById('importExcel');
    if (importExcelBtn && window.handleExcelImport) {
        // 先移除可能存在的事件监听器，避免重复绑定
        importExcelBtn.removeEventListener('click', window.handleExcelImport);
        importExcelBtn.addEventListener('click', window.handleExcelImport);
    }
    
    // 下载模板按钮
    const downloadTemplateBtn = document.getElementById('downloadTemplate');
    if (downloadTemplateBtn && window.downloadExcelTemplate) {
        // 先移除可能存在的事件监听器，避免重复绑定
        downloadTemplateBtn.removeEventListener('click', window.downloadExcelTemplate);
        downloadTemplateBtn.addEventListener('click', window.downloadExcelTemplate);
    }
    
    // 导出数据按钮
    const exportExcelBtn = document.getElementById('exportExcel');
    if (exportExcelBtn) {
        // 先移除可能存在的事件监听器，避免重复绑定
        exportExcelBtn.removeEventListener('click', exportDepositData);
        exportExcelBtn.addEventListener('click', exportDepositData);
    }
    
    // 添加到日历按钮
    const addToCalendarBtn = document.getElementById('addToCalendar');
    if (addToCalendarBtn) {
        // 先移除可能存在的事件监听器，避免重复绑定
        addToCalendarBtn.removeEventListener('click', generateBatchICS);
        addToCalendarBtn.addEventListener('click', generateBatchICS);
    }
}

// 辅助函数：验证日期格式是否正确
function isValidDate(dateStr) {
    if (!dateStr) return false;
    
    // 支持格式：YYYY-MM-DD、YYYYMMDD、YYYYMMD、YYYY/MM/DD、YYYY/M/D
    const isoFormat = /^\d{4}-\d{2}-\d{2}$/;
    const numericFormat = /^\d{7,8}$/;
    const slashFormat = /^\d{4}\/\d{1,2}\/\d{1,2}$/;
    
    if (!isoFormat.test(dateStr) && !numericFormat.test(dateStr) && !slashFormat.test(dateStr)) {
        return false;
    }
    
    return parseDate(dateStr) !== null;
}

// 辅助函数：解析日期字符串为Date对象
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    // 尝试直接解析ISO格式 (YYYY-MM-DD)
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
        return date;
    }
    
    // 处理7位或8位数字格式 (YYYYMMDD 或 YYYYMMD)
    if (/^\d{7,8}$/.test(dateStr)) {
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1; // 月份从0开始
        const day = parseInt(dateStr.substring(6).padStart(2, '0'));
        
        // 验证月份和日期的有效性
        if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
            date = new Date(year, month, day);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
    }
    
    // 处理斜杠格式 (YYYY/MM/DD 或 YYYY/M/D)
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // 月份从0开始
        const day = parseInt(parts[2]);
        
        // 验证月份和日期的有效性
        if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
            date = new Date(year, month, day);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
    }
    
    return null;
}

// 绑定存款表单事件
function bindDepositFormEvents() {
    // 绑定表单提交事件
    const depositForm = document.getElementById('depositForm');
    if (depositForm) {
        depositForm.addEventListener('submit', handleDepositSubmit);
    }
    // 获取表单元素
    const periodInput = document.getElementById('depositPeriod');
    const periodUnitInput = document.getElementById('periodUnit');
    const expiryDateInput = document.getElementById('depositExpiryDate');
    const rateInput = document.getElementById('depositRate');
    const amountInput = document.getElementById('depositAmount');
    const dateInput = document.getElementById('depositDate');
    const interestInput = document.getElementById('depositInterest');
    
    // 事件处理函数：自动计算利息
    function autoCalculateInterest() {
        // 获取输入值
        const rate = parseFloat(rateInput.value);
        const amount = parseFloat(amountInput.value);
        const date = dateInput.value;
        const period = parseFloat(periodInput.value);
        const periodUnit = periodUnitInput.value;
        const expiryDate = expiryDateInput.value;
        
        // 检查必要条件
        if (isNaN(rate) || rate <= 0 || isNaN(amount) || amount <= 0 || !date) {
            return;
        }
        
        let months = 0;
        let isValid = true;
        
        // 计算存期（月）
        if (!isNaN(period) && period > 0) {
            // 如果填写了存期，转换为月
            months = periodUnit === 'year' ? period * 12 : period;
        } else if (expiryDate) {
            // 验证日期格式
            if (!isValidDate(date) || !isValidDate(expiryDate)) {
                isValid = false;
            } else {
                // 如果填写了到期日，计算存期
                const depositDate = parseDate(date);
                const expiryDateObj = parseDate(expiryDate);
                
                if (depositDate && expiryDateObj) {
                    // 计算月份差
                    months = (expiryDateObj.getFullYear() - depositDate.getFullYear()) * 12 + 
                              (expiryDateObj.getMonth() - depositDate.getMonth());
                } else {
                    isValid = false;
                }
            }
        }
        
        if (isValid && months > 0) {
            // 计算利息
            const interest = (amount * rate * months) / (12 * 100);
            // 更新利息输入框
            interestInput.value = parseFloat(interest.toFixed(2));
        } else {
            // 日期格式无效，清空利息
            interestInput.value = '';
        }
    }
    
    // 事件处理函数：根据存期计算到期日
    function calculateExpiryDate() {
        const period = parseFloat(periodInput.value);
        const periodUnit = periodUnitInput.value;
        const date = dateInput.value;
        
        // 验证输入值和日期格式
        if (!isNaN(period) && period > 0 && date && isValidDate(date)) {
            const depositDate = parseDate(date);
            if (depositDate) {
                const expiryDateObj = new Date(depositDate);
                
                // 计算存期（月）
                const months = periodUnit === 'year' ? period * 12 : period;
                expiryDateObj.setMonth(expiryDateObj.getMonth() + months);
                
                // 更新到期日输入框，使用ISO格式
                expiryDateInput.value = expiryDateObj.toISOString().split('T')[0];
                
                // 自动计算利息
                autoCalculateInterest();
            }
        } else {
            // 输入无效，清空到期日和利息
            if (!isValidDate(date)) {
                expiryDateInput.value = '';
                interestInput.value = '';
            }
        }
    }
    
    // 事件处理函数：根据到期日计算存期
    function calculatePeriod() {
        const date = dateInput.value;
        const expiryDate = expiryDateInput.value;
        
        // 验证日期格式
        if (date && expiryDate && isValidDate(date) && isValidDate(expiryDate)) {
            const depositDate = parseDate(date);
            const expiryDateObj = parseDate(expiryDate);
            
            if (depositDate && expiryDateObj) {
                // 计算月份差
                const months = (expiryDateObj.getFullYear() - depositDate.getFullYear()) * 12 + 
                          (expiryDateObj.getMonth() - depositDate.getMonth());
                
                // 更新存期输入框
                periodInput.value = months;
                periodUnitInput.value = 'month';
                
                // 自动计算利息
                autoCalculateInterest();
            }
        } else {
            // 日期格式无效，清空存期和利息
            if (!isValidDate(date) || !isValidDate(expiryDate)) {
                periodInput.value = '';
                interestInput.value = '';
            }
        }
    }
    
    // 绑定事件监听器
    if (periodInput) {
        periodInput.addEventListener('input', () => {
            calculateExpiryDate();
        });
    }
    
    if (periodUnitInput) {
        periodUnitInput.addEventListener('change', () => {
            calculateExpiryDate();
        });
    }
    
    if (expiryDateInput) {
        expiryDateInput.addEventListener('input', () => {
            calculatePeriod();
        });
    }
    
    if (rateInput) {
        rateInput.addEventListener('input', autoCalculateInterest);
    }
    
    if (amountInput) {
        amountInput.addEventListener('input', autoCalculateInterest);
    }
    
    if (dateInput) {
        dateInput.addEventListener('input', () => {
            calculateExpiryDate();
            calculatePeriod();
        });
    }
}

// 加载定期存款数据
async function loadDeposits() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    try {
        const newDepositData = await window.dbManager.getAllByIndex(STORES.DEPOSITS, 'username', currentUser.username);
        currentDeposits = newDepositData;
        window.currentDeposits = currentDeposits;
    } catch (error) {
        console.error('加载定期存款数据失败:', error);
        currentDeposits = [];
        window.currentDeposits = currentDeposits;
    }
}

// 加载所有数据（兼容旧代码）
async function loadData() {
    // 创建需要执行的Promise数组
    const promises = [loadDeposits()];
    // 只有当window.loadFunds存在时才添加到Promise数组（兼容旧版）
    if (window.loadFunds) {
        promises.push(window.loadFunds());
    }
    // 只有当window.loadFund存在时才添加到Promise数组
    if (window.loadFund) {
        promises.push(window.loadFund());
    }
    // 只有当window.loadWealth存在时才添加到Promise数组
    if (window.loadWealth) {
        promises.push(window.loadWealth());
    }
    // 只有当window.loadOtherInvestments存在时才添加到Promise数组
    if (window.loadOtherInvestments) {
        promises.push(window.loadOtherInvestments());
    }
    // 执行所有Promise
    await Promise.all(promises);
}

// 更新银行选项列表
function updateBankOptions() {
    const bankOptions = document.getElementById('bankOptions');
    
    // 检查元素是否存在
    if (!bankOptions) {
        console.warn('Element with id bankOptions not found');
        return;
    }
    
    // 获取所有唯一的银行名称
    const banks = [...new Set(currentDeposits.map(deposit => deposit.bank))];
    
    // 清空现有选项
    bankOptions.innerHTML = '';
    
    // 添加新选项
    banks.forEach(bank => {
        const option = document.createElement('option');
        option.value = bank;
        option.textContent = bank;
        bankOptions.appendChild(option);
    });
}

// 处理定期存款表单提交
async function handleDepositSubmit(e) {
    e.preventDefault();
    
    try {
        // 获取表单数据
        const bank = document.getElementById('depositBank').value;
        const rate = parseFloat(document.getElementById('depositRate').value);
        let periodValue = document.getElementById('depositPeriod').value;
        const periodUnit = document.getElementById('periodUnit').value;
        const amount = parseFloat(document.getElementById('depositAmount').value);
        let date = document.getElementById('depositDate').value;
        let expiryDate = document.getElementById('depositExpiryDate').value;
        let interest = document.getElementById('depositInterest').value;
        const remarks = document.getElementById('depositRemarks').value;
        
        // 数据验证
        if (!bank) {
            alert('请填写存款银行');
            return;
        }
        if (isNaN(rate) || rate <= 0) {
            alert('请填写有效的利率');
            return;
        }
        if (isNaN(amount) || amount <= 0) {
            alert('请填写有效的存入金额');
            return;
        }
        if (!date) {
            alert('请填写存入日期');
            return;
        }
        if (!isValidDate(date)) {
            alert('请填写有效的存入日期，格式为YYYY-MM-DD或YYYYMMDD');
            return;
        }
        if (expiryDate && !isValidDate(expiryDate)) {
            alert('请填写有效的到期日，格式为YYYY-MM-DD或YYYYMMDD');
            return;
        }
        
        // 格式化日期
        date = window.formatDate(date);
        
        let period;
        // 计算存期和到期日
        if (periodValue) {
            // 如果填写了存期，计算到期日
            periodValue = parseFloat(periodValue);
            period = periodUnit === 'year' ? periodValue * 12 : periodValue;
            
            const depositDate = new Date(date);
            const expiryDateObj = new Date(depositDate);
            expiryDateObj.setMonth(expiryDateObj.getMonth() + period);
            expiryDate = expiryDateObj.toISOString().split('T')[0];
        } else if (expiryDate) {
            // 如果填写了到期日，计算存期
            expiryDate = window.formatDate(expiryDate);
            
            // 确保日期有效
            const depositDate = new Date(date);
            const expiryDateObj = new Date(expiryDate);
            
            if (!isNaN(depositDate.getTime()) && !isNaN(expiryDateObj.getTime())) {
                // 计算月份差
                const monthsDiff = (expiryDateObj.getFullYear() - depositDate.getFullYear()) * 12 + 
                                  (expiryDateObj.getMonth() - depositDate.getMonth());
                period = monthsDiff;
            } else {
                alert('请填写有效的日期');
                return;
            }
        } else {
            alert('请填写存期时长或到期日！');
            return;
        }
        
        // 处理利息
        if (!interest) {
            // 如果未填写利息，自动计算
            interest = (amount * rate * period) / (12 * 100);
            interest = parseFloat(interest.toFixed(2));
        } else {
            // 如果填写了利息，使用填写的值
            interest = parseFloat(interest);
        }
        
        // 创建存款对象，添加highlight标记和用户名
        const deposit = {
            bank,
            rate,
            period,
            amount,
            date,
            expiryDate,
            interest,
            remarks,
            highlight: true, // 高亮标记
            username: getCurrentUser().username // 添加用户名，用于数据隔离
        };
        
        // 保存数据到数据库
        const response = await fetch('/api/deposits', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(deposit)
        });
        
        if (response.ok) {
            // 重新从数据库加载所有数据，确保数据一致性
            await window.loadDeposits();
            
            // 更新银行选项列表
            updateBankOptions();
            
            // 重新渲染表格，刷新存款列表
            await renderDepositTable();
            
            // 更新汇总信息
            window.updateSummary();
            // 更新最近动态
            if (window.updateRecentActivities) {
                window.updateRecentActivities();
            }
        }
        
        // 清空表单
        e.target.reset();
        
        // 设置默认日期为今天
        document.getElementById('depositDate').value = new Date().toISOString().split('T')[0];
        
        // 弹出成功提示
        alert('定期存款添加成功！');
    } catch (error) {
        console.error('添加存款失败:', error);
        alert('添加存款失败，请检查输入数据格式是否正确');
    }
}

// 渲染定期存款表格
async function renderDepositTable() {
    const maxAttempts = 50;
    let attempts = 0;
    let tbody = document.getElementById('depositTableBody');
    
    while (!tbody && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10));
        tbody = document.getElementById('depositTableBody');
        attempts++;
    }
    
    if (!tbody) {
        console.warn('Element with id depositTableBody not found after waiting');
        return;
    }
    
    // 创建只包含日期部分的Date对象（当天00:00:00）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 过滤出未到期的存款
    let activeDeposits = currentDeposits.filter(deposit => {
        const expiryDate = new Date(deposit.expiryDate);
        expiryDate.setHours(0, 0, 0, 0);
        return expiryDate > today;
    });
    
    // 应用搜索过滤
    activeDeposits = filterDeposits(activeDeposits);
    // 默认按到期日升序排序
    activeDeposits.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    
    if (activeDeposits.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #999; padding: 20px;">暂无定期存款数据</td></tr>';
    } else {
        tbody.innerHTML = activeDeposits.map(deposit => {
            // 计算剩余天数
            const expiryDate = new Date(deposit.expiryDate);
            expiryDate.setHours(0, 0, 0, 0);
            
            const timeDiff = expiryDate.getTime() - today.getTime();
            // 向下取整计算剩余天数，避免因时间差导致的天数误差
            const remainingDays = Math.floor(timeDiff / (1000 * 3600 * 24));
            
            return `
            <tr class="${deposit.highlight ? 'highlight-row' : ''}">
                <td>${deposit.bank}</td>
                <td class="rate">${deposit.rate}%</td>
                <td>${deposit.period}个月</td>
                <td class="amount">¥${parseFloat(deposit.amount).toFixed(2)}</td>
                <td>${deposit.date}</td>
                <td class="expiry">${deposit.expiryDate}</td>
                <td class="${remainingDays <= 30 ? 'expiry' : ''}">${remainingDays}天</td>
                <td class="transfer-out">¥${parseFloat(deposit.interest).toFixed(2)}</td>
                <td>${deposit.remarks || '-'}</td>
                <td>
                    <button class="btn btn-small btn-edit" onclick="modifyDepositRemarks(${deposit.id})">修改备注</button>
                    <button class="btn btn-small btn-delete" onclick="deleteDeposit(${deposit.id})">删除</button>
                </td>
            </tr>
        `;
        }).join('');
    }
    
    // 自动移除高亮效果
    setTimeout(() => {
        // 移除所有高亮标记并检查是否有实际变化
        let hasChanges = false;
        currentDeposits.forEach(deposit => {
            if (deposit.highlight) {
                delete deposit.highlight;
                hasChanges = true;
            }
        });
        // 只有当有实际变化时才保存数据并重新渲染
        if (hasChanges) {
            saveDepositData();
            renderDepositTable();
            renderExpiredDepositTable();
        }
    }, 10000);
    
    // 更新汇总信息
    updateDepositSummary();
    
    // 渲染已到期列表
    renderExpiredDepositTable();
    
    // 更新到期金额分布图表
    updateDepositExpiryChart();
}

// 渲染已到期列表
async function renderExpiredDepositTable() {
    // 创建只包含日期部分的Date对象（当天00:00:00）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 过滤出已到期的存款
    let expiredDeposits = currentDeposits.filter(deposit => {
        const expiryDate = new Date(deposit.expiryDate);
        expiryDate.setHours(0, 0, 0, 0);
        return expiryDate <= today;
    });
    
    // 应用搜索过滤
    expiredDeposits = filterDeposits(expiredDeposits);
    // 按到期日降序排序，显示最近的记录
    expiredDeposits.sort((a, b) => new Date(b.expiryDate) - new Date(a.expiryDate));
    
    const maxAttempts = 50;
    let attempts = 0;
    let tbody = document.getElementById('expiredDepositTableBody');
    
    while (!tbody && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10));
        tbody = document.getElementById('expiredDepositTableBody');
        attempts++;
    }
    
    if (!tbody) {
        console.warn('Element with id expiredDepositTableBody not found after waiting');
        return;
    }
    
    if (expiredDeposits.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #999; padding: 20px;">暂无已到期存款数据</td></tr>';
        return;
    }
    
    // 默认显示最近10条记录
    const DEFAULT_DISPLAY_COUNT = 10;
    const showAll = window.expiredDepositsShowAll || false;
    const displayDeposits = showAll ? expiredDeposits : expiredDeposits.slice(0, DEFAULT_DISPLAY_COUNT);
    
    // 生成表格行
    const tableRows = displayDeposits.map(deposit => {
        // 计算已到期天数
        const expiryDate = new Date(deposit.expiryDate);
        expiryDate.setHours(0, 0, 0, 0);
        
        const timeDiff = today.getTime() - expiryDate.getTime();
        // 向下取整计算已到期天数
        const expiredDays = Math.floor(timeDiff / (1000 * 3600 * 24));
        
        // 确定行样式：如果已到期天数为0天，添加浅绿色高亮
        const rowClass = `${deposit.highlight ? 'highlight-row' : ''} ${expiredDays === 0 ? 'today-expired' : ''}`;
        
        // 确定天数显示样式：如果已到期天数为0天，使用红色粗体
        const daysDisplay = expiredDays === 0 ? `<span style="color: red; font-weight: bold;">${expiredDays}天</span>` : `${expiredDays}天`;
        
        return `
        <tr class="${rowClass}">
            <td>${deposit.bank}</td>
            <td class="rate">${deposit.rate}%</td>
            <td>${deposit.period}个月</td>
            <td class="amount">¥${parseFloat(deposit.amount).toFixed(2)}</td>
            <td>${deposit.date}</td>
            <td class="expiry">${deposit.expiryDate}</td>
            <td class="expired">${daysDisplay}</td>
            <td class="transfer-out">¥${parseFloat(deposit.interest).toFixed(2)}</td>
            <td>${deposit.remarks || '-'}</td>
            <td>
                ${deposit.confirmed ? '<button class="btn btn-small btn-confirmed" style="width: 60px; cursor: not-allowed;">已确认</button>' : `<button class="btn btn-small btn-confirm" onclick="confirmDeposit(${deposit.id})" style="width: 60px;">确认</button>`}
                <button class="btn btn-small btn-delete" onclick="deleteDeposit(${deposit.id})">删除</button>
            </td>
        </tr>
    `;
    }).join('');
    
    // 生成表格内容，包括展开/收起按钮
    let tableContent = tableRows;
    
    // 如果记录数超过默认显示数量，添加展开/收起按钮
    if (expiredDeposits.length > DEFAULT_DISPLAY_COUNT) {
        // 添加展开/收起按钮作为表格的一部分，使用colspan跨列
        tableContent += `
            <tr class="history-toggle-row">
                <td colspan="10" style="text-align: center; padding: 10px;">
                    <button class="btn btn-small btn-primary" onclick="toggleExpiredDeposits()">
                        ${showAll ? '点击收起' : `点击展开（共${expiredDeposits.length}条记录）`}
                    </button>
                </td>
            </tr>
        `;
    }
    
    // 清理可能存在的旧按钮容器
    const oldToggleBtnContainer = document.getElementById('expiredDepositToggleBtn');
    if (oldToggleBtnContainer) {
        oldToggleBtnContainer.remove();
    }
    
    tbody.innerHTML = tableContent;
}

// 切换定期存款已到期列表的显示状态
async function toggleExpiredDeposits() {
    // 切换显示状态
    window.expiredDepositsShowAll = !window.expiredDepositsShowAll;
    
    // 重新渲染表格
    renderExpiredDepositTable();
}

// 保存定期存款数据
async function saveDepositData() {
    try {
        for (let i = 0; i < currentDeposits.length; i++) {
            const deposit = currentDeposits[i];
            const result = await window.dbManager.save(STORES.DEPOSITS, deposit);
            // 如果返回了id，保存到deposit对象中
            if (result && result.id) {
                currentDeposits[i].id = result.id;
            }
        }
    } catch (error) {
        console.error('保存定期存款数据失败:', error);
        throw error;
    }
}

// 创建并显示存款删除确认弹窗
function showDeleteDepositConfirmModal() {
    // 创建模态框元素
    let modal = document.getElementById('deleteDepositConfirmModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'deleteDepositConfirmModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>确认删除</h2>
                <p>警告：删除后将无法恢复，确定要删除这条定期存款记录吗？</p>
                <div class="form-group" style="margin: 15px 0; display: flex; flex-direction: column;">
                    <label for="deleteDepositInput" style="margin: 0 0 5px 0; display: inline-block; white-space: nowrap;">请输入 "确认删除" 以确认删除:</label>
                    <input type="text" id="deleteDepositInput" placeholder="请输入确认文本" style="width: 100%; padding: 10px; box-sizing: border-box; font-size: 14px;">
                </div>
                <div id="deleteDepositStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="deleteDepositConfirmBtn" class="btn btn-danger">确认删除</button>
                    <button id="deleteDepositCancelBtn" class="btn btn-secondary">取消</button>
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
        
        // 调整弹窗内容样式，确保文字完整显示
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            // 增加弹窗最大宽度，确保提示文本能在一行显示
            modalContent.style.maxWidth = '600px';
            modalContent.style.width = '90%';
            // 确保padding足够，内容不拥挤
            modalContent.style.padding = '30px';
        }
    }
    
    // 重置模态框内容
    document.getElementById('deleteDepositInput').value = '';
    document.getElementById('deleteDepositStatus').textContent = '';
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 返回Promise，等待用户确认
    return new Promise((resolve) => {
        const confirmBtn = document.getElementById('deleteDepositConfirmBtn');
        const cancelBtn = document.getElementById('deleteDepositCancelBtn');
        
        // 确认按钮事件
        const handleConfirm = () => {
            const input = document.getElementById('deleteDepositInput').value;
            const statusEl = document.getElementById('deleteDepositStatus');
            
            if (input !== '确认删除') {
                statusEl.textContent = '输入错误，请重新输入';
                return;
            }
            
            modal.style.display = 'none';
            resolve(true);
        };
        
        // 取消按钮事件
        const handleCancel = () => {
            modal.style.display = 'none';
            resolve(false);
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

// 确认定期存款到期
async function confirmDeposit(id) {
    try {
        // 更新本地数据
        const deposit = currentDeposits.find(d => d.id === id);
        if (deposit) {
            deposit.confirmed = 1;
            
            // 使用dbManager保存数据到数据库
            await window.dbManager.save(STORES.DEPOSITS, deposit);
        }
        
        // 更新界面
        renderDepositTable();
        renderExpiredDepositTable();
        window.updateSummary();
    } catch (error) {
        console.error('确认定期存款失败:', error);
        alert('确认失败，请重试！');
    }
}

// 创建并显示存款修改备注弹窗
function showEditDepositRemarksModal(id) {
    // 创建模态框元素
    let modal = document.getElementById('editDepositRemarksModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editDepositRemarksModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>修改备注</h2>
                <div style="margin: 15px 0;">
                    <label for="editDepositRemarks" style="margin: 0 0 5px 0; display: block;">备注:</label>
                    <textarea id="editDepositRemarks" placeholder="请输入备注" style="width: 100%; padding: 10px; box-sizing: border-box; font-size: 14px; min-height: 100px; border: 1px solid #ddd; border-radius: 4px;"></textarea>
                </div>
                <div id="editDepositRemarksStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="editDepositRemarksConfirmBtn" class="btn btn-primary">确认修改</button>
                    <button id="editDepositRemarksCancelBtn" class="btn btn-secondary">取消</button>
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
    
    // 查找存款记录
    const deposit = currentDeposits.find(d => d.id === id);
    if (!deposit) return;
    
    // 设置表单值
    document.getElementById('editDepositRemarks').value = deposit.remarks || '';
    document.getElementById('editDepositRemarksStatus').textContent = '';
    
    // 保存当前编辑的存款ID
    window.currentEditingDepositId = id;
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 返回Promise，等待用户确认
    return new Promise((resolve) => {
        const confirmBtn = document.getElementById('editDepositRemarksConfirmBtn');
        const cancelBtn = document.getElementById('editDepositRemarksCancelBtn');
        
        // 确认按钮事件
        const handleConfirm = () => {
            const remarks = document.getElementById('editDepositRemarks').value;
            modal.style.display = 'none';
            resolve(remarks);
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

// 修改存款备注
async function modifyDepositRemarks(id) {
    // 显示修改备注弹窗
    const newRemarks = await showEditDepositRemarksModal(id);
    if (newRemarks === null) {
        return;
    }
    
    try {
        // 更新本地数据
        const deposit = currentDeposits.find(d => d.id === id);
        if (deposit) {
            deposit.remarks = newRemarks;
            
            // 使用dbManager保存数据到数据库
            await window.dbManager.save(STORES.DEPOSITS, deposit);
        }
        
        // 更新界面
        renderDepositTable();
        renderExpiredDepositTable();
    } catch (error) {
        console.error('修改存款备注失败:', error);
        alert('修改失败，请重试！');
    }
}

// 删除定期存款
async function deleteDeposit(id) {
    // 显示二次确认弹窗
    const confirmed = await showDeleteDepositConfirmModal();
    if (!confirmed) {
        return;
    }
    
    try {
        // 调用API删除
        await fetch(`/api/deposits/${id}`, {
            method: 'DELETE'
        });
        
        // 从当前数据数组中删除
        currentDeposits = currentDeposits.filter(deposit => deposit.id !== id);
        
        // 更新界面
        renderDepositTable();
        renderExpiredDepositTable();
        updateBankOptions();
        window.updateSummary();
    } catch (error) {
        console.error('删除定期存款失败:', error);
        alert('删除失败，请重试！');
    }
}

// 处理存款搜索
function handleDepositSearch(e) {
    currentSearchQuery = e.target.value.toLowerCase();
    renderDepositTable();
    renderExpiredDepositTable();
}

// 过滤存款数据
function filterDeposits(deposits) {
    if (!currentSearchQuery) return deposits;
    
    return deposits.filter(deposit => {
        return deposit.bank.toLowerCase().includes(currentSearchQuery) ||
               deposit.remarks?.toLowerCase().includes(currentSearchQuery) ||
               deposit.amount.toString().includes(currentSearchQuery) ||
               deposit.rate.toString().includes(currentSearchQuery);
    });
}

// 处理表格排序
function handleDepositSort(btn) {
    const column = btn.getAttribute('data-column');
    const order = btn.getAttribute('data-order');
    const tableId = btn.closest('table').id;
    let deposits;
    
    if (tableId === 'depositTable') {
        deposits = currentDeposits.filter(deposit => new Date(deposit.expiryDate) > new Date());
    } else {
        deposits = currentDeposits.filter(deposit => new Date(deposit.expiryDate) <= new Date());
    }
    
    // 排序
    deposits.sort((a, b) => {
        let aVal, bVal;
        
        switch (column) {
            case 'bank':
                aVal = a.bank.toLowerCase();
                bVal = b.bank.toLowerCase();
                break;
            case 'rate':
                aVal = parseFloat(a.rate);
                bVal = parseFloat(b.rate);
                break;
            case 'period':
                aVal = parseInt(a.period);
                bVal = parseInt(b.period);
                break;
            case 'amount':
                aVal = parseFloat(a.amount);
                bVal = parseFloat(b.amount);
                break;
            case 'date':
                aVal = new Date(a.date);
                bVal = new Date(b.date);
                break;
            case 'expiryDate':
                aVal = new Date(a.expiryDate);
                bVal = new Date(b.expiryDate);
                break;
            case 'remainingDays':
                const today = new Date();
                aVal = Math.ceil((new Date(a.expiryDate).getTime() - today.getTime()) / (1000 * 3600 * 24));
                bVal = Math.ceil((new Date(b.expiryDate).getTime() - today.getTime()) / (1000 * 3600 * 24));
                break;
            case 'expiredDays':
                const now = new Date();
                aVal = Math.ceil((now.getTime() - new Date(a.expiryDate).getTime()) / (1000 * 3600 * 24));
                bVal = Math.ceil((now.getTime() - new Date(b.expiryDate).getTime()) / (1000 * 3600 * 24));
                break;
            case 'interest':
                aVal = parseFloat(a.interest);
                bVal = parseFloat(b.interest);
                break;
            case 'remarks':
                aVal = (a.remarks || '').toLowerCase();
                bVal = (b.remarks || '').toLowerCase();
                break;
            default:
                return 0;
        }
        
        if (aVal < bVal) return order === 'asc' ? -1 : 1;
        if (aVal > bVal) return order === 'asc' ? 1 : -1;
        return 0;
    });
    
    // 更新表格
    if (tableId === 'depositTable') {
        // 过滤出未到期的存款
        const activeDeposits = deposits.filter(deposit => new Date(deposit.expiryDate) > new Date());
        const tbody = document.getElementById('depositTableBody');
        renderTableBody(tbody, activeDeposits, 'active');
    } else {
        // 过滤出已到期的存款
        const expiredDeposits = deposits.filter(deposit => new Date(deposit.expiryDate) <= new Date());
        const tbody = document.getElementById('expiredDepositTableBody');
        renderTableBody(tbody, expiredDeposits, 'expired');
    }
}

// 渲染表格体
function renderTableBody(tbody, deposits, type) {
    if (!tbody) {
        console.warn('Table body element not found');
        return;
    }
    
    if (deposits.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #999; padding: 20px;">暂无${type === 'active' ? '定期存款' : '已到期存款'}数据</td></tr>`;
        return;
    }
    
    const today = new Date();
    
    // 处理已到期列表的展开/收起逻辑
    let displayDeposits = deposits;
    let tableContent = '';
    
    // 默认显示最近10条记录，仅对已到期列表生效
    if (type === 'expired') {
        const DEFAULT_DISPLAY_COUNT = 10;
        const showAll = window.expiredDepositsShowAll || false;
        displayDeposits = showAll ? deposits : deposits.slice(0, DEFAULT_DISPLAY_COUNT);
    }
    
    // 生成表格行
        const tableRows = displayDeposits.map(deposit => {
            let days;
            if (type === 'active') {
                // 计算剩余天数
                const expiryDate = new Date(deposit.expiryDate);
                const timeDiff = expiryDate.getTime() - today.getTime();
                days = Math.ceil(timeDiff / (1000 * 3600 * 24));
            } else {
                // 计算已到期天数
                const expiryDate = new Date(deposit.expiryDate);
                const timeDiff = today.getTime() - expiryDate.getTime();
                days = Math.ceil(timeDiff / (1000 * 3600 * 24));
            }
            
            // 确定行样式：如果是已到期列表且已到期天数为0天，添加浅绿色高亮
            const rowClass = `${deposit.highlight ? 'highlight-row' : ''} ${type === 'expired' && days === 0 ? 'today-expired' : ''}`;
            
            // 确定天数显示样式：如果是已到期列表且已到期天数为0天，使用红色粗体
            let daysDisplay;
            if (type === 'expired' && days === 0) {
                daysDisplay = `<span style="color: red; font-weight: bold;">${days}天</span>`;
            } else {
                daysDisplay = `${days}天`;
            }
            
            // 确认按钮HTML，只在已到期列表显示
            let confirmButton = '';
            if (type === 'expired') {
                confirmButton = deposit.confirmed ? 
                    '<button class="btn btn-small btn-confirmed" style="width: 60px; cursor: not-allowed;">已确认</button>' : 
                    `<button class="btn btn-small btn-confirm" onclick="confirmDeposit(${deposit.id})" style="width: 60px;">确认</button>`;
            }
            
            return `
            <tr class="${rowClass}">
                <td>${deposit.bank}</td>
                <td class="rate">${deposit.rate}%</td>
                <td>${deposit.period}个月</td>
                <td class="amount">¥${parseFloat(deposit.amount).toFixed(2)}</td>
                <td>${deposit.date}</td>
                <td class="expiry">${deposit.expiryDate}</td>
                <td class="${type === 'active' && days <= 30 ? 'expiry' : ''}">${daysDisplay}</td>
                <td class="amount">¥${parseFloat(deposit.interest).toFixed(2)}</td>
                <td>${deposit.remarks || '-'}</td>
                <td>
                    ${type === 'active' ? '<button class="btn btn-small btn-edit" onclick="modifyDepositRemarks(' + deposit.id + ')">修改备注</button>' : ''}
                    ${confirmButton}
                    <button class="btn btn-small btn-delete" onclick="deleteDeposit(${deposit.id})">删除</button>
                </td>
            </tr>
        `;
        }).join('');
    
    tableContent = tableRows;
    
    // 如果是已到期列表且记录数超过默认显示数量，添加展开/收起按钮
    if (type === 'expired' && deposits.length > 10) {
        // 添加展开/收起按钮作为表格的一部分，使用colspan跨列
        tableContent += `
            <tr class="history-toggle-row">
                <td colspan="10" style="text-align: center; padding: 10px;">
                    <button class="btn btn-small btn-primary" onclick="toggleExpiredDeposits()">
                        ${window.expiredDepositsShowAll ? '点击收起' : `点击展开（共${deposits.length}条记录）`}
                    </button>
                </td>
            </tr>
        `;
    }
    
    tbody.innerHTML = tableContent;
}

// 添加到日历
function addToCalendar(id) {
    const deposit = currentDeposits.find(d => d.id === id);
    if (!deposit) return;
    
    const event = {
        title: `${deposit.bank} ${parseFloat(deposit.amount)}元定期存款到期`,
        description: `利率: ${deposit.rate}%\n存期: ${deposit.period}个月\n到期金额: ${(parseFloat(deposit.amount) + parseFloat(deposit.interest)).toFixed(2)}元`,
        startDate: deposit.expiryDate,
        endDate: deposit.expiryDate
    };
    
    // 生成ics文件内容
    const icsContent = generateICS(event);
    
    // 创建下载链接并触发下载
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `定期存款提醒.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 生成ICS文件内容
function generateICS(event) {
    const dtstamp = new Date().toISOString().replace(/[-:]|\.\d+/g, '');
    const uid = event.uid || `${dtstamp}_${Math.random().toString(36).substr(2, 9)}@whereismymoney`;
    
    // 使用带具体时间的格式，设置为到期日当天
    const dateParts = event.startDate.split('-');
    const year = dateParts[0];
    const month = dateParts[1];
    const day = dateParts[2];
    const eventDate = `${year}${month}${day}`;
    
    // 计算前一天的日期
    const prevDate = new Date(year, month - 1, day - 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
    const prevDay = String(prevDate.getDate()).padStart(2, '0');
    const prevEventDate = `${prevYear}${prevMonth}${prevDay}`;
    
    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//WhereIsMyMoney//Non-Prod//CN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtstamp}Z
DTSTART:${eventDate}T090000
DTEND:${eventDate}T100000
SUMMARY:${event.title}
DESCRIPTION:${event.description}
STATUS:CONFIRMED
BEGIN:VALARM
TRIGGER;VALUE=DATE-TIME:${prevEventDate}T200000
ACTION:DISPLAY
DESCRIPTION:${event.title}
END:VALARM
BEGIN:VALARM
TRIGGER;VALUE=DATE-TIME:${eventDate}T090000
ACTION:DISPLAY
DESCRIPTION:${event.title}
END:VALARM
END:VEVENT
END:VCALENDAR`;
}

// 批量生成ICS文件
function generateBatchICS() {
    // 获取所有未到期的存款
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeDeposits = currentDeposits.filter(deposit => {
        const expiryDate = new Date(deposit.expiryDate);
        expiryDate.setHours(0, 0, 0, 0);
        return expiryDate > today;
    });
    
    if (activeDeposits.length === 0) {
        alert('暂无未到期的定期存款');
        return;
    }
    
    // 生成ICS文件头部
    const dtstamp = new Date().toISOString().replace(/[-:]|\.\d+/g, '');
    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//WhereIsMyMoney//Non-Prod//CN
`;
    
    // 为每条存款生成一个日程，包含两个提醒
    activeDeposits.forEach((deposit, index) => {
        // 生成唯一的UID
        const uid = `${dtstamp}_${index}_${Math.random().toString(36).substr(2, 9)}@whereismymoney`;
        
        // 创建事件对象，只包含银行名称和存款金额
        const event = {
            title: `${deposit.bank} ${parseFloat(deposit.amount).toFixed(2)}元定期存款到期`,
            description: `${deposit.bank} ${parseFloat(deposit.amount).toFixed(2)}元定期存款到期`,
            startDate: deposit.expiryDate,
            uid: uid
        };
        
        // 直接生成事件内容，避免处理ICS文件头部和尾部
        const dateParts = event.startDate.split('-');
        const year = dateParts[0];
        const month = dateParts[1];
        const day = dateParts[2];
        const eventDate = `${year}${month}${day}`;
        
        // 计算前一天的日期
        const prevDate = new Date(year, month - 1, day - 1);
        const prevYear = prevDate.getFullYear();
        const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
        const prevDay = String(prevDate.getDate()).padStart(2, '0');
        const prevEventDate = `${prevYear}${prevMonth}${prevDay}`;
        
        // 生成事件的ICS内容
        const eventContent = `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtstamp}Z
DTSTART:${eventDate}T090000
DTEND:${eventDate}T100000
SUMMARY:${event.title}
DESCRIPTION:${event.description}
STATUS:CONFIRMED
BEGIN:VALARM
TRIGGER;VALUE=DATE-TIME:${prevEventDate}T200000
ACTION:DISPLAY
DESCRIPTION:${event.title}
END:VALARM
BEGIN:VALARM
TRIGGER;VALUE=DATE-TIME:${eventDate}T090000
ACTION:DISPLAY
DESCRIPTION:${event.title}
END:VALARM
END:VEVENT`;
        
        icsContent += eventContent + '\n';
    });
    
    // 添加ICS文件尾部
    icsContent += 'END:VCALENDAR';
    
    // 创建下载链接并触发下载
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '定期存款提醒.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 导出存款数据为Excel
function exportDepositData() {
    if (currentDeposits.length === 0) {
        alert('没有数据可以导出');
        return;
    }
    
    // 准备导出数据，按照存款列表字段顺序
    const exportData = currentDeposits.map(deposit => {
        // 计算剩余天数
        const today = new Date();
        const expiryDate = new Date(deposit.expiryDate);
        const timeDiff = expiryDate.getTime() - today.getTime();
        const remainingDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        return {
            '存款银行': deposit.bank,
            '利率 (%)': deposit.rate,
            '存期 (月)': deposit.period,
            '存入金额': deposit.amount,
            '存入日期': deposit.date,
            '到期日': deposit.expiryDate,
            '剩余天数': remainingDays,
            '利息': deposit.interest,
            '备注': deposit.remarks || ''
        };
    });
    
    // 创建工作簿和工作表
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '定期存款数据');
    
    // 设置列宽
    ws['!cols'] = [
        { wch: 15 }, // 存款银行
        { wch: 10 }, // 利率 (%)
        { wch: 10 }, // 存期 (月)
        { wch: 12 }, // 存入金额
        { wch: 12 }, // 存入日期
        { wch: 12 }, // 到期日
        { wch: 10 }, // 剩余天数
        { wch: 12 }, // 利息
        { wch: 20 }  // 备注
    ];
    
    // 下载文件
    XLSX.writeFile(wb, '定期存款数据_' + new Date().toISOString().split('T')[0] + '.xlsx');
}

// 切换显示/隐藏汇总信息
function toggleSummary() {
    const summaryContent = document.getElementById('summaryContent');
    const toggleBtn = document.getElementById('toggleSummary');
    
    summaryVisible = !summaryVisible;
    
    if (summaryVisible) {
        summaryContent.style.display = 'block';
        toggleBtn.textContent = '隐藏';
    } else {
        summaryContent.style.display = 'none';
        toggleBtn.textContent = '显示';
    }
}

// 切换显示/隐藏添加存款表单
function toggleAddDeposit() {
    const addDepositContent = document.getElementById('addDepositContent');
    const toggleBtn = document.getElementById('toggleAddDeposit');
    
    if (addDepositContent.style.display === 'none') {
        addDepositContent.style.display = 'block';
        toggleBtn.textContent = '隐藏';
        
        // 设置默认日期为今天
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        const depositDateInput = document.getElementById('depositDate');
        if (depositDateInput) {
            depositDateInput.value = formattedDate;
        }
        
        // 初始化其他输入框
        const periodInput = document.getElementById('depositPeriod');
        const expiryDateInput = document.getElementById('depositExpiryDate');
        const interestInput = document.getElementById('depositInterest');
        
        if (periodInput) periodInput.value = '';
        if (expiryDateInput) expiryDateInput.value = '';
        if (interestInput) interestInput.value = '';
    } else {
        addDepositContent.style.display = 'none';
        toggleBtn.textContent = '显示';
    }
}

// 更新存款汇总信息
function updateDepositSummary() {
    // 获取当前日期
    const today = new Date();
    
    // 确保使用全局变量
    const deposits = window.currentDeposits || [];
    
    // 计算定期存款总金额，只计算未到期的存款
    const activeDeposits = deposits.filter(deposit => new Date(deposit.expiryDate) > today);
    const depositTotalAmount = activeDeposits.reduce((total, deposit) => total + (Number(deposit.amount) || 0), 0);
    
    // 只计算已到期存款的利息，确保利息为数字类型
    const expiredDeposits = deposits.filter(deposit => new Date(deposit.expiryDate) <= today);
    const depositTotalInterest = expiredDeposits.reduce((total, deposit) => total + (Number(deposit.interest) || 0), 0);
    
    // 计算近30天到期的存款
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);
    const upcomingExpiredDeposits = deposits.filter(deposit => {
        const expiryDate = new Date(deposit.expiryDate);
        return expiryDate >= today && expiryDate <= thirtyDaysLater;
    });
    const upcomingExpiredCount = upcomingExpiredDeposits.length;
    const upcomingExpiredAmount = upcomingExpiredDeposits.reduce((total, deposit) => total + (Number(deposit.amount) || 0), 0);
    
    // 更新UI - 检查元素是否存在，避免空指针错误
    
    // 更新存款汇总部分
    const totalAmountEl = document.getElementById('totalAmount');
    if (totalAmountEl) {
        totalAmountEl.textContent = `¥${depositTotalAmount.toFixed(2)}`;
    }
    
    const totalInterestEl = document.getElementById('totalInterest');
    if (totalInterestEl) {
        totalInterestEl.textContent = `¥${depositTotalInterest.toFixed(2)}`;
    }
    
    // 更新近30天到期的存款统计
    // 1. 先移除已有的近30天到期元素（如果存在）
    const existingThirtyDaysExpiry = document.querySelector('.thirty-days-expiry');
    if (existingThirtyDaysExpiry) {
        existingThirtyDaysExpiry.remove();
    }
    
    // 2. 创建新的近30天到期元素
    const thirtyDaysExpiryEl = document.createElement('div');
    thirtyDaysExpiryEl.className = 'summary-row total-row interest-row thirty-days-expiry';
    thirtyDaysExpiryEl.innerHTML = `
        <span class="summary-label">近30天到期:</span>
        <span class="summary-value">${upcomingExpiredCount}笔 ¥${upcomingExpiredAmount.toFixed(2)}</span>
    `;
    
    // 3. 添加到DOM中
    // 找到已到手利息元素的父容器
    const totalInterestParent = totalInterestEl ? totalInterestEl.closest('.summary-row') : null;
    if (totalInterestParent) {
        // 在已到手利息下方添加近30天到期的统计
        totalInterestParent.insertAdjacentElement('afterend', thirtyDaysExpiryEl);
    } else {
        // 如果没有已到手利息元素，直接添加到summaryContent中
        const summaryContent = document.getElementById('summaryContent');
        if (summaryContent) {
            summaryContent.appendChild(thirtyDaysExpiryEl);
        }
    }
    
    // 更新银行汇总
    const bankSummaryEl = document.getElementById('bankSummary');
    if (bankSummaryEl) {
        // 按银行分组，只统计未到期的存款
        const bankMap = new Map();
        activeDeposits.forEach(deposit => {
            if (bankMap.has(deposit.bank)) {
                bankMap.get(deposit.bank).push(deposit);
            } else {
                bankMap.set(deposit.bank, [deposit]);
            }
        });
        
        // 生成银行汇总HTML
        let bankSummaryHTML = '';
        bankMap.forEach((bankDeposits, bank) => {
            const bankTotal = bankDeposits.reduce((total, deposit) => total + (Number(deposit.amount) || 0), 0);
            const bankCount = bankDeposits.length;
            // 计算占比，避免除以0
            const percentage = depositTotalAmount > 0 ? ((bankTotal / depositTotalAmount) * 100).toFixed(0) : '0';
            
            bankSummaryHTML += `
                <div class="summary-row bank-row">
                    <span class="summary-label">${bank}：</span>
                    <span class="summary-value">${bankCount}笔 ¥${bankTotal.toFixed(2)} (${percentage}%)</span>
                </div>
            `;
        });
        
        bankSummaryEl.innerHTML = bankSummaryHTML;
    }
}

// 初始化到期金额分布图表
let depositExpiryChart = null;

// 生成未来5年到期金额分布图表
function initDepositExpiryChart() {
    // 检查echarts是否已加载
    if (typeof echarts === 'undefined') {
        setTimeout(initDepositExpiryChart, 500);
        return;
    }
    
    const chartDom = document.getElementById('depositExpiryChart');
    if (chartDom) {
        // 先销毁旧实例（如果存在）
        if (depositExpiryChart) {
            depositExpiryChart.dispose();
        }
        // 初始化新实例
        depositExpiryChart = echarts.init(chartDom, null, {
            renderer: 'canvas',
            passiveRemove: true
        });
        
        // 更新图表数据
        updateDepositExpiryChart();
        
        // 添加窗口大小变化事件监听器
        window.addEventListener('resize', function() {
            setTimeout(function() {
                if (depositExpiryChart) {
                    depositExpiryChart.resize();
                }
            }, 50);
        });
    }
}

// 更新到期金额分布图表
function updateDepositExpiryChart() {
    if (!depositExpiryChart) return;
    
    const today = new Date();
    const deposits = window.currentDeposits || [];
    
    // 生成未来5年的月份列表（YYYY-MM格式）
    const months = [];
    const monthMap = new Map();
    
    for (let i = 0; i < 60; i++) {
        const date = new Date(today);
        date.setMonth(date.getMonth() + i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.push(monthKey);
        monthMap.set(monthKey, 0);
    }
    
    // 按银行分组统计每个月的到期金额
    const bankData = {};
    // 使用与总览资产分布图相同的颜色
    const bankColors = [
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
    ];
    
    // 统计每个银行每个月的到期金额
    deposits.forEach(deposit => {
        const expiryDate = new Date(deposit.expiryDate);
        const expiryMonth = `${expiryDate.getFullYear()}-${String(expiryDate.getMonth() + 1).padStart(2, '0')}`;
        
        // 只统计未来3年内的到期数据
        if (monthMap.has(expiryMonth)) {
            const bank = deposit.bank;
            if (!bankData[bank]) {
                bankData[bank] = new Map([...monthMap]);
            }
            bankData[bank].set(expiryMonth, (bankData[bank].get(expiryMonth) || 0) + parseFloat(deposit.amount || 0));
        }
    });
    
    // 准备图表数据
    const series = [];
    let colorIndex = 0;
    
    for (const [bank, dataMap] of Object.entries(bankData)) {
        series.push({
            name: bank,
            type: 'bar',
            stack: 'total',
            data: months.map(month => dataMap.get(month)),
            itemStyle: {
                color: bankColors[colorIndex % bankColors.length]
            }
        });
        colorIndex++;
    }
    
    // 格式化月份显示，只显示年月（YYYY-MM）
    const formattedMonths = months.map(month => {
        return month;
    });
    
    // 配置图表选项
    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            },
            formatter: function(params) {
                let result = `${params[0].axisValue}<br/>`;
                let total = 0;
                
                params.forEach(param => {
                    if (param.value > 0) {
                        result += `${param.marker} ${param.seriesName}: ¥${param.value.toFixed(2)}<br/>`;
                        total += param.value;
                    }
                });
                
                result += `总计: ¥${total.toFixed(2)}`;
                return result;
            }
        },
        legend: {
            type: 'scroll',
            orient: 'horizontal',
            bottom: '0%',
            formatter: '{name}',
            textStyle: {
                fontSize: 11
            },
            itemGap: 8,
            pageIconSize: 10,
            pageTextStyle: {
                fontSize: 10
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '20%', // 确保横坐标标签完整显示
            top: '8%', // 减小顶部边距，减少标题与图表之间的空隙
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: formattedMonths,
            axisLabel: {
                interval: 3, // 每隔3个月份显示一个标签，减少密集度
                rotate: 60, // 增加旋转角度，提高可读性
                fontSize: 9, // 略微减小字体大小
                formatter: function(value) {
                    // 简化显示：只显示年份后两位和月份
                    const [year, month] = value.split('-');
                    return `${year.slice(2)}-${month}`;
                }
            }
        },
        yAxis: {
            type: 'value',
            name: '金额 (元)',
            axisLabel: {
                formatter: '¥{value}'
            },
            // 优化纵坐标动态调整
            scale: true, // 启用缩放，使坐标轴范围适应数据
            boundaryGap: [0, '10%'], // 调整坐标轴两端的空白
            axisTick: {
                alignWithLabel: true // 刻度与标签对齐
            }
        },
        series: series
    };
    
    depositExpiryChart.setOption(option);
}

// 修复：直接在原initDeposits函数末尾添加图表初始化
// 确保在initDeposits函数末尾调用图表初始化
const originalInitDeposits = initDeposits;
function initDepositsWithChart() {
    originalInitDeposits();
    initDepositExpiryChart();
}

// 重新定义initDeposits函数，添加图表初始化
initDeposits = initDepositsWithChart;

// 导出函数
window.currentDeposits = currentDeposits;
window.isValidDate = isValidDate;
window.loadData = loadData;
window.loadDeposits = loadDeposits;
window.updateBankOptions = updateBankOptions;
window.handleDepositSubmit = handleDepositSubmit;
window.renderDepositTable = renderDepositTable;
window.renderExpiredDepositTable = renderExpiredDepositTable;
window.saveDepositData = saveDepositData;
window.deleteDeposit = deleteDeposit;
window.handleDepositSearch = handleDepositSearch;
window.filterDeposits = filterDeposits;
window.handleDepositSort = handleDepositSort;
window.renderTableBody = renderTableBody;
window.addToCalendar = addToCalendar;
window.generateICS = generateICS;
window.exportDepositData = exportDepositData;
window.toggleSummary = toggleSummary;
window.toggleAddDeposit = toggleAddDeposit;
window.initDeposits = initDeposits;
window.updateDepositSummary = updateDepositSummary;
window.initDepositExpiryChart = initDepositExpiryChart;
window.updateDepositExpiryChart = updateDepositExpiryChart;