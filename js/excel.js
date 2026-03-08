// Excel导入导出模块

// 处理文件选择
function handleFileSelect(e) {
    const fileNameDisplay = document.getElementById('fileName');
    const file = e.target.files[0];
    
    if (file) {
        fileNameDisplay.textContent = file.name;
        fileNameDisplay.style.color = '#27ae60';
    } else {
        fileNameDisplay.textContent = '未选择文件';
        fileNameDisplay.style.color = '#666';
    }
}

// 下载Excel模板
function downloadExcelTemplate() {
    // 创建模板数据，调整列名和顺序：将存期时长改为存期时长（月），放在到期日右侧，取消存期单位列
    const templateData = [
        ['存款银行', '利率', '存入金额', '存入日期', '到期日', '存期时长（月）', '利息', '备注']
    ];
    
    // 使用SheetJS创建工作簿
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '定期存款模板');
    
    // 设置列宽
    ws['!cols'] = [
        { wch: 15 }, // 存款银行
        { wch: 8 },  // 利率
        { wch: 12 }, // 存入金额
        { wch: 12 }, // 存入日期
        { wch: 12 }, // 到期日
        { wch: 15 }, // 存期时长（月）
        { wch: 10 }, // 利息
        { wch: 20 }  // 备注
    ];
    
    // 下载文件
    XLSX.writeFile(wb, '定期存款导入模板.xlsx');
}

// 处理Excel导入
async function handleExcelImport() {
    const fileInput = document.getElementById('excelFile');
    const status = document.getElementById('importStatus');
    
    if (!fileInput.files.length) {
        status.textContent = '请先选择Excel文件';
        status.style.color = 'red';
        return;
    }
    
    const file = fileInput.files[0];
    status.textContent = '正在导入...';
    status.style.color = 'orange';
    
    // 使用SheetJS读取文件
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            // 处理导入的数据
            let importedCount = 0;
            
            // 使用async/await处理异步保存
            for (const item of jsonData) {
                // 检查必要字段，支持新的"存期时长（月）"字段名
                if (item['存款银行'] && item['利率'] && (item['存期时长（月）'] || item['存期时长'] || item['到期日']) && item['存入金额'] && item['存入日期']) {
                    try {
                        const bank = item['存款银行'];
                        let rate = item['利率'];
                        // 处理Excel百分比格式字符串，如"2.40%"
                        if (typeof rate === 'string' && rate.includes('%')) {
                            // 去除百分号并转换为数值
                            rate = parseFloat(rate.replace('%', ''));
                        } else {
                            // 处理数值格式
                            rate = parseFloat(rate);
                            // 处理Excel百分比格式数值，当数值小于1时，可能是百分比格式，乘以100转换为正确的百分比数值
                            if (rate < 1 && !isNaN(rate)) {
                                rate *= 100;
                            }
                        }
                        // 修复浮点数精度问题
                        rate = parseFloat(rate.toFixed(2));
                        
                        // 读取存期时长（月），移除存期单位列
                        let periodValue = item['存期时长（月）'] || item['存期时长'];
                        // 确保存期是有效数字
                        periodValue = periodValue ? parseFloat(periodValue) : 0;
                        
                        const amount = parseFloat(parseFloat(item['存入金额']).toFixed(2));
                        let date = item['存入日期'];
                        let expiryDate = item['到期日'];
                        let interest = item['利息'];
                        const remarks = item['备注'] || '';
                        
                        // 格式化日期
                        date = window.formatDate(date);
                        expiryDate = expiryDate ? window.formatDate(expiryDate) : null;
                        
                        let period;
                        // 计算存期和到期日
                        if (periodValue > 0) {
                            // 如果填写了存期（月），直接使用作为月份数
                            period = Math.round(periodValue);
                            
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
                                continue; // 跳过无效日期数据
                            }
                        } else {
                            continue; // 跳过无效数据
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
                        
                        // 直接保存到数据库
                        const response = await fetch('/api/deposits', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(deposit)
                        });
                        
                        if (response.ok) {
                            importedCount++;
                        } else {
                            console.error('保存存款失败:', await response.text());
                        }
                    } catch (error) {
                        console.error('处理导入数据失败:', error);
                    }
                }
            }
            
            // 重新从数据库加载所有数据，避免重复
            await window.loadDeposits();
            
            // 更新界面
            window.renderDepositTable();
            window.renderExpiredDepositTable();
            window.updateBankOptions();
            window.updateSummary();
            
            status.textContent = `成功导入 ${importedCount} 条数据`;
            status.style.color = 'green';
            
            // 清空文件选择
            fileInput.value = '';
            document.getElementById('fileName').textContent = '未选择文件';
            document.getElementById('fileName').style.color = '#666';
        } catch (error) {
            console.error('导入失败:', error);
            status.textContent = '导入失败，请检查文件格式';
            status.style.color = 'red';
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// 导出函数
window.handleFileSelect = handleFileSelect;
window.downloadExcelTemplate = downloadExcelTemplate;
window.handleExcelImport = handleExcelImport;