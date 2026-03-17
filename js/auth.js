// 用户相关常量
const CURRENT_USER_KEY = 'currentUser';
const LOGIN_STATUS_KEY = 'isLoggedIn';

// 初始化认证模块
function initAuth() {
    // 直接使用window.dbManager，不再重新声明
}

// 获取当前登录用户信息
function getCurrentUser() {
    // 继续使用localStorage存储当前会话，因为用户会话不需要持久化
    const currentUserData = localStorage.getItem(CURRENT_USER_KEY);
    return currentUserData ? JSON.parse(currentUserData) : null;
}

// 设置当前登录用户
function setCurrentUser(user) {
    // 继续使用localStorage存储当前会话
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    if (user) {
        localStorage.setItem(LOGIN_STATUS_KEY, 'true');
    } else {
        localStorage.setItem(LOGIN_STATUS_KEY, 'false');
    }
}

// 检查登录状态
async function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem(LOGIN_STATUS_KEY) === 'true';
    const currentUser = getCurrentUser();
    
    if (isLoggedIn && currentUser) {
        try {
            // 显示/隐藏元素 - 检查元素是否存在
            const loginModal = document.getElementById('loginModal');
            if (loginModal) {
                loginModal.style.display = 'none';
            }
            
            const container = document.querySelector('.container');
            if (container) {
                container.style.display = 'block';
            }
            
            const userInfo = document.querySelector('.user-info');
            if (userInfo) {
                userInfo.style.display = 'flex';
            }
            
            // 加载用户信息显示
            updateUserInfo();
            
            // 只在主页（有相关元素）加载数据
            if (container) {
                // 加载所有数据，包括其它资产数据
                if (window.loadAllData) {
                    await window.loadAllData();
                }
                // 更新用户信息，不调用可能找不到DOM元素的渲染函数
                // 选项卡内容会在动态加载时自动更新和渲染
                if (window.updateUserInfo) window.updateUserInfo();
            }
        } catch (error) {
            console.error('检查登录状态失败:', error);
            // 清除无效的登录状态
            localStorage.setItem(LOGIN_STATUS_KEY, 'false');
            localStorage.removeItem(CURRENT_USER_KEY);
            
            // 显示登录模态框 - 检查元素是否存在
            const loginModal = document.getElementById('loginModal');
            if (loginModal) {
                loginModal.style.display = 'flex';
            }
            
            const container = document.querySelector('.container');
            if (container) {
                container.style.display = 'none';
            }
            
            const userInfo = document.querySelector('.user-info');
            if (userInfo) {
                userInfo.style.display = 'none';
            }
        }
    } else {
        // 未登录或当前用户不存在，显示登录模态框
        console.log('用户未登录，显示登录模态框');
        
        // 显示登录模态框 - 检查元素是否存在
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.style.display = 'flex';
        }
        
        const container = document.querySelector('.container');
        if (container) {
            container.style.display = 'none';
        }
        
        const userInfo = document.querySelector('.user-info');
        if (userInfo) {
            userInfo.style.display = 'none';
        }
        
        // 清除无效的登录状态
        localStorage.setItem(LOGIN_STATUS_KEY, 'false');
        localStorage.removeItem(CURRENT_USER_KEY);
        
        // 如果是在设置页面，跳转到登录页面
        if (window.location.pathname.includes('settings.html')) {
            window.location.href = 'index.html';
        }
    }
    
    console.log('登录状态检查完成');
}

// 更新用户信息显示
function updateUserInfo() {
    const user = getCurrentUser();
    const currentUserEl = document.getElementById('currentUser');
    if (currentUserEl) {
        currentUserEl.textContent = `欢迎，${user.username}${user.role === 'admin' ? ' (管理员)' : ''}`;
    }
    
    // 设置修改密码表单中的隐藏用户名字段
    const usernameInput = document.getElementById('changePasswordUsername');
    if (usernameInput) {
        usernameInput.value = user.username;
    }
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const status = document.getElementById('loginStatus');
    
    // 清除之前的状态
    status.textContent = '';
    
    // 添加调试日志（不显示密码）
    console.log('登录尝试:', username, '******');
    
    try {
        // 调用API登录
        const response = await fetch('/api/users/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            status.textContent = errorData.message;
            return;
        }
        
        const user = await response.json();
        console.log('登录成功:', username);
        
        // 设置登录状态
        localStorage.setItem(LOGIN_STATUS_KEY, 'true');
        setCurrentUser(user);
        
        // 显示系统内容
        document.getElementById('loginModal').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
        document.querySelector('.user-info').style.display = 'flex';
        
        // 加载所有数据，包括其它资产数据
        if (window.loadAllData) {
            await window.loadAllData();
        }
        
        // 只更新当前可见选项卡的内容
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab) {
            const tabId = activeTab.id;
            
            // 根据当前选项卡调用对应的渲染函数
            switch (tabId) {
                case 'overview':
                    if (window.updateSummary) window.updateSummary();
                    // 初始化图表
                    if (window.initCharts) {
                        setTimeout(() => {
                            window.initCharts();
                        }, 500);
                    }
                    break;
                case 'deposit':
                    if (window.renderDepositTable) window.renderDepositTable();
                    if (window.updateBankOptions) window.updateBankOptions();
                    break;
                case 'fund':
                    if (window.renderFundTable) window.renderFundTable();
                    if (window.updateFundNameOptions) window.updateFundNameOptions();
                    break;
                case 'wealth':
                    if (window.renderWealthTable) window.renderWealthTable();
                    if (window.updatePlatformOptions) window.updatePlatformOptions();
                    break;
                case 'stock':
                    if (window.renderStockTable) window.renderStockTable();
                    break;
                case 'other':
                    if (window.renderOtherTable) window.renderOtherTable();
                    break;
            }
        }
        
        // 更新用户信息显示
        if (window.updateUserInfo) window.updateUserInfo();
        
        // 清空表单
        e.target.reset();
    } catch (error) {
        console.error('登录失败:', error);
        status.textContent = '登录失败，请重试：' + error.message;
    }
}

// 处理注册
async function handleRegister() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const status = document.getElementById('loginStatus');
    
    if (!username || !password) {
        status.textContent = '请输入用户名和密码';
        return;
    }
    
    try {
        // 调用API注册
        const response = await fetch('/api/users/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            status.textContent = errorData.message;
            return;
        }
        
        status.textContent = '注册成功，请登录';
        status.style.color = 'green';
    } catch (error) {
        console.error('注册失败:', error);
        status.textContent = '注册失败，请重试';
    }
}

// 处理修改密码
async function handleChangePassword(e) {
    e.preventDefault();
    
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const status = document.getElementById('changePasswordStatus');
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
        if (status) {
            status.textContent = '用户未登录';
        }
        return;
    }
    
    // 验证新密码和确认密码是否一致
    if (newPassword !== confirmPassword) {
        if (status) {
            status.textContent = '两次输入的新密码不一致';
        }
        return;
    }
    
    // 验证新密码长度
    if (newPassword.length < 6) {
        if (status) {
            status.textContent = '新密码长度不能少于6位';
        }
        return;
    }
    
    try {
        // 调用API修改密码，包含旧密码
        const response = await fetch(`/api/users/${currentUser.username}/password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ oldPassword, newPassword })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            if (status) {
                status.textContent = errorData.message;
            }
            return;
        }
        
        if (status) {
            status.textContent = '密码修改成功';
            status.style.color = 'green';
        }
        
        // 清空表单
        e.target.reset();
        
        // 如果是在弹窗中，关闭弹窗
        const userSettingsModal = document.getElementById('userSettingsModal');
        if (userSettingsModal) {
            userSettingsModal.style.display = 'none';
        }
    } catch (error) {
        console.error('修改密码失败:', error);
        if (status) {
            status.textContent = '修改密码失败，请重试：' + error.message;
        }
    }
}

// 处理退出登录
function handleLogout() {
    // 清除登录状态
    localStorage.setItem(LOGIN_STATUS_KEY, 'false');
    localStorage.removeItem(CURRENT_USER_KEY);
    
    // 清空当前数据
    window.currentDeposits = [];
    // 兼容旧版理财模块和新版财富管理模块
    window.currentFunds = [];
    window.currentWealth = [];
    
    // 无论在哪个页面，退出后都重定向到登录页
    window.location.href = 'index.html';
}

// 绑定登录相关事件
function bindLoginEvents() {
    // 登录表单提交
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // 注册按钮点击
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
    }
    
    // 修改密码表单提交（仅在表单存在时执行）
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', handleChangePassword);
    }
    
    // 退出登录按钮点击
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // 用户名点击事件 - 跳转到设置页面
    const currentUser = document.getElementById('currentUser');
    if (currentUser) {
        currentUser.addEventListener('click', function() {
            window.location.href = 'settings.html';
        });
    }
    
    // 删除数据按钮事件（仅在按钮存在时执行）
    const deleteAllDepositsBtn = document.getElementById('deleteAllDeposits');
    if (deleteAllDepositsBtn) {
        deleteAllDepositsBtn.addEventListener('click', function() {
            handleDeleteData('deposit');
        });
    }
    
    const deleteAllFundsBtn = document.getElementById('deleteAllFunds');
    if (deleteAllFundsBtn) {
        deleteAllFundsBtn.addEventListener('click', function() {
            handleDeleteData('fund');
        });
    }
    
    // 删除所有数据按钮（仅管理员可见且按钮存在时执行）
    const clearDatabaseBtn = document.getElementById('clearDatabaseBtn');
    if (clearDatabaseBtn) {
        clearDatabaseBtn.addEventListener('click', function() {
            handleDeleteData('all');
        });
    }
}

// 创建并显示二次确认弹窗
function showDeleteConfirmModal(type) {
    const confirmTexts = {
        deposit: '定期存款',
        fund: '理财',
        all: '数据库'
    };
    
    const confirmText = confirmTexts[type];
    if (!confirmText) return Promise.resolve(false);
    
    // 创建模态框元素
    let modal = document.getElementById('deleteConfirmModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'deleteConfirmModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>确认删除</h2>
                <p id="deleteConfirmMessage"></p>
                <div class="form-group">
                    <label for="deleteConfirmInput">请输入 "<span id="requiredText"></span>" 以确认删除:</label>
                    <input type="text" id="deleteConfirmInput" placeholder="请输入确认文本">
                </div>
                <div id="deleteConfirmStatus" style="margin: 15px 0; color: red;"></div>
                <div class="form-actions">
                    <button id="confirmDeleteBtn" class="btn btn-danger">确认删除</button>
                    <button id="cancelDeleteBtn" class="btn btn-secondary">取消</button>
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
    
    // 设置模态框内容
    const messages = {
        deposit: '警告：删除所有定期存款数据，此操作不可恢复！',
        fund: '警告：删除所有理财数据，此操作不可恢复！',
        all: '警告：清空整个数据库，删除所有用户的所有数据，此操作不可恢复！'
    };
    
    document.getElementById('deleteConfirmMessage').textContent = messages[type];
    document.getElementById('requiredText').textContent = confirmText;
    document.getElementById('deleteConfirmInput').value = '';
    document.getElementById('deleteConfirmStatus').textContent = '';
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 返回Promise，等待用户确认
    return new Promise((resolve) => {
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        const cancelBtn = document.getElementById('cancelDeleteBtn');
        
        // 确认按钮事件
        const handleConfirm = () => {
            const input = document.getElementById('deleteConfirmInput').value;
            const statusEl = document.getElementById('deleteConfirmStatus');
            
            if (input !== confirmText) {
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

// 处理数据删除
async function handleDeleteData(type) {
    // 显示二次确认弹窗
    const confirmed = await showDeleteConfirmModal(type);
    if (!confirmed) {
        return;
    }
    
    const currentUser = getCurrentUser();
    let response;
    
    try {
        if (type === 'deposit') {
            response = await fetch(`/api/deposits/user/${currentUser.username}`, {
                method: 'DELETE'
            });
        } else if (type === 'fund') {
            response = await fetch(`/api/funds/user/${currentUser.username}`, {
                method: 'DELETE'
            });
        } else if (type === 'all') {
            if (currentUser.role !== 'admin') {
                alert('只有管理员可以执行此操作');
                return;
            }
            response = await fetch('/api/clear-database', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isAdmin: true })
            });
        }
        
        if (response && response.ok) {
            // 重新加载数据
            await loadData();
            
            // 检查当前页面是否包含存款表格元素，如果是主页面则刷新表格
            if (document.getElementById('depositTableBody')) {
                renderDepositTable();
                // 兼容旧版理财模块和新版财富管理模块
                if (window.renderWealthTable) {
                    window.renderWealthTable();
                } else if (window.renderFundTable) {
                    window.renderFundTable();
                }
                if (window.updateBankOptions) window.updateBankOptions();
                if (window.updatePlatformOptions) window.updatePlatformOptions();
                if (window.updateFundNameOptions) window.updateFundNameOptions();
                if (window.updateSummary) window.updateSummary();
            } else {
                // 如果是在设置页面，重新加载页面或跳转到主页面
                window.location.reload();
            }
            
            alert('数据删除成功');
        } else {
            const errorData = await response.json();
            alert('数据删除失败: ' + errorData.message);
        }
    } catch (error) {
        console.error('删除数据失败:', error);
        alert('数据删除失败: ' + error.message);
    }
}

// 导出函数
window.getCurrentUser = getCurrentUser;
window.setCurrentUser = setCurrentUser;
window.checkLoginStatus = checkLoginStatus;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleChangePassword = handleChangePassword;
window.handleLogout = handleLogout;
window.bindLoginEvents = bindLoginEvents;
window.initAuth = initAuth;