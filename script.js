// 我的财富 JavaScript

// 引入SheetJS库
const script = document.createElement('script');
script.src = 'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js';
document.head.appendChild(script);

// 数据存储配置
const DB_NAME = 'MyWealthDB';
const DB_VERSION = 1;
const STORES = {
    USERS: 'users',
    DEPOSITS: 'deposits',
    FUNDS: 'funds',
    USER_SESSION: 'userSession'
};

// 当前登录用户会话
const CURRENT_USER_KEY = 'currentUser'; // 当前登录用户
const LOGIN_STATUS_KEY = 'loginStatus';

// DOM 元素
let currentDeposits = [];
let currentFunds = [];
let summaryVisible = true;
let currentSearchQuery = '';

// IndexedDB 操作封装
class DBManager {
    constructor() {
        this.db = null;
        this.initDB();
    }

    // 初始化数据库
    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            // 数据库升级或创建
            request.onupgradeneeded = (event) => {
                this.db = event.target.result;

                // 创建用户存储
                if (!this.db.objectStoreNames.contains(STORES.USERS)) {
                    const usersStore = this.db.createObjectStore(STORES.USERS, { keyPath: 'username' });
                    usersStore.createIndex('role', 'role', { unique: false });
                }

                // 创建定期存款存储
                if (!this.db.objectStoreNames.contains(STORES.DEPOSITS)) {
                    const depositsStore = this.db.createObjectStore(STORES.DEPOSITS, { keyPath: 'id', autoIncrement: true });
                    depositsStore.createIndex('username', 'username', { unique: false });
                    depositsStore.createIndex('bank', 'bank', { unique: false });
                    depositsStore.createIndex('date', 'date', { unique: false });
                    depositsStore.createIndex('expiryDate', 'expiryDate', { unique: false });
                }

                // 创建理财存储
                if (!this.db.objectStoreNames.contains(STORES.FUNDS)) {
                    const fundsStore = this.db.createObjectStore(STORES.FUNDS, { keyPath: 'id', autoIncrement: true });
                    fundsStore.createIndex('username', 'username', { unique: false });
                    fundsStore.createIndex('platform', 'platform', { unique: false });
                    fundsStore.createIndex('date', 'date', { unique: false });
                }

                // 创建用户会话存储
                if (!this.db.objectStoreNames.contains(STORES.USER_SESSION)) {
                    this.db.createObjectStore(STORES.USER_SESSION, { keyPath: 'key' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB打开失败:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // 获取数据库连接
    async getDB() {
        if (!this.db) {
            await this.initDB();
        }
        return this.db;
    }

    // 执行事务
    async transaction(storeNames, mode, callback) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeNames, mode);
            const result = callback(transaction);

            transaction.oncomplete = () => resolve(result);
            transaction.onerror = (event) => reject(event.target.error);
        });
    }

    // 获取存储对象
    async getStore(storeName, mode = 'readonly') {
        const db = await this.getDB();
        const transaction = db.transaction(storeName, mode);
        return transaction.objectStore(storeName);
    }

    // 保存数据
    async save(storeName, data) {
        const store = await this.getStore(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // 获取数据
    async get(storeName, key) {
        const store = await this.getStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // 获取所有数据
    async getAll(storeName) {
        const store = await this.getStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // 根据索引获取数据
    async getAllByIndex(storeName, indexName, value) {
        const store = await this.getStore(storeName);
        const index = store.index(indexName);
        return new Promise((resolve, reject) => {
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // 删除数据
    async delete(storeName, key) {
        const store = await this.getStore(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // 根据索引删除数据
    async deleteByIndex(storeName, indexName, value) {
        const store = await this.getStore(storeName, 'readwrite');
        const index = store.index(indexName);
        return new Promise((resolve, reject) => {
            const request = index.openCursor(value);
            const keysToDelete = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    keysToDelete.push(cursor.primaryKey);
                    cursor.continue();
                } else {
                    // 批量删除
                    Promise.all(keysToDelete.map(key => {
                        return new Promise((resolveDelete, rejectDelete) => {
                            const deleteRequest = store.delete(key);
                            deleteRequest.onsuccess = () => resolveDelete();
                            deleteRequest.onerror = () => rejectDelete(deleteRequest.error);
                        });
                    })).then(() => resolve()).catch(reject);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    // 清空存储
    async clear(storeName) {
        const store = await this.getStore(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// 初始化DBManager实例
const dbManager = new DBManager();

// 初始化页面
function init() {
    // 立即执行初始化，不等待SheetJS加载完成
    // 因为SheetJS只用于Excel导入导出功能，不影响核心功能
    (async () => {
        try {
            // 等待数据库初始化完成
            await dbManager.initDB();
            
            // 初始化管理员账号
            await initAdminAccount();
            
            // 检查登录状态
            await checkLoginStatus();
            
            // 绑定事件
            bindEvents();
            
            // 绑定登录相关事件
            bindLoginEvents();
        } catch (error) {
            console.error('初始化失败:', error);
            alert('初始化失败，应用可能无法正常工作');
        }
    })();
}

// 初始化管理员账号
async function initAdminAccount() {
    try {
        // 添加调试日志
        console.log('开始初始化管理员账号');
        
        // 获取所有用户
        let users = await getUsers();
        console.log('当前用户列表:', users);
        
        // 检查是否已存在管理员账号
        const adminExists = users.some(user => user.username === 'admin' && user.role === 'admin');
        console.log('管理员账号是否存在:', adminExists);
        
        if (!adminExists) {
            // 创建默认管理员账号
            const adminUser = {
                username: 'admin',
                password: 'admin123',
                role: 'admin',
                createdAt: new Date().toISOString()
            };
            console.log('创建管理员账号:', adminUser);
            
            // 保存到IndexedDB
            await dbManager.save(STORES.USERS, adminUser);
            console.log('管理员账号创建成功');
            
            // 验证管理员账号是否创建成功
            users = await getUsers();
            console.log('创建后的用户列表:', users);
        }
    } catch (error) {
        console.error('初始化管理员账号失败:', error);
        alert('初始化管理员账号失败: ' + error.message);
    }
}

// 获取所有用户列表
async function getUsers() {
    try {
        // 添加调试日志
        console.log('开始获取用户列表');
        
        const users = await dbManager.getAll(STORES.USERS);
        console.log('获取到的用户列表:', users);
        
        return users;
    } catch (error) {
        console.error('获取用户列表失败:', error);
        alert('获取用户列表失败: ' + error.message);
        return [];
    }
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

// 绑定登录相关事件
function bindLoginEvents() {
    // 登录表单提交
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // 注册按钮点击
    document.getElementById('registerBtn').addEventListener('click', handleRegister);
    
    // 修改密码表单提交
    document.getElementById('changePasswordForm').addEventListener('submit', handleChangePassword);
    
    // 退出登录按钮点击
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // 用户名点击事件
    document.getElementById('currentUser').addEventListener('click', showUserSettings);
    
    // 关闭用户设置按钮点击
    document.getElementById('closeSettings').addEventListener('click', function() {
        document.getElementById('userSettingsModal').style.display = 'none';
    });
    
    // 设置选项卡切换
    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            switchSettingsTab(tab);
        });
    });
    
    // 删除数据按钮事件
    document.getElementById('deleteAllDeposits').addEventListener('click', function() {
        handleDeleteData('deposit');
    });
    
    document.getElementById('deleteAllFunds').addEventListener('click', function() {
        handleDeleteData('fund');
    });
    
    // 清空数据库按钮事件
    document.getElementById('clearDatabaseBtn').addEventListener('click', clearDatabase);
}

// 显示用户设置
async function showUserSettings() {
    // 更新用户信息
    updateUserInfoDisplay();
    
    // 如果是管理员，显示用户列表选项卡和清空数据库按钮
    const currentUser = getCurrentUser();
    const userListTabBtn = document.getElementById('userListTabBtn');
    const clearDatabaseSection = document.getElementById('clearDatabaseSection');
    
    if (currentUser && currentUser.role === 'admin') {
        userListTabBtn.style.display = 'inline-block';
        clearDatabaseSection.style.display = 'block';
        // 更新用户列表
        await updateUserList();
    } else {
        userListTabBtn.style.display = 'none';
        clearDatabaseSection.style.display = 'none';
    }
    
    // 显示用户设置模态框
    document.getElementById('userSettingsModal').style.display = 'flex';
    
    // 默认显示用户信息选项卡
    switchSettingsTab('userInfo');
}

// 切换设置选项卡
async function switchSettingsTab(tabName) {
    // 移除所有选项卡按钮的active类
    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 隐藏所有选项卡内容
    document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 激活当前选项卡
    const activeBtn = document.querySelector(`.settings-tab-btn[data-tab="${tabName}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    const activeContent = document.getElementById(tabName);
    if (activeContent) {
        activeContent.classList.add('active');
    }
    
    // 如果切换到用户列表，更新用户列表
    if (tabName === 'userList') {
        await updateUserList();
    }
}

// 更新用户信息显示
function updateUserInfoDisplay() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const userInfoContent = document.getElementById('userInfoContent');
    userInfoContent.innerHTML = `
        <div class="user-info-item">
            <span class="user-info-label">用户名:</span>
            <span class="user-info-value">${currentUser.username}</span>
        </div>
        <div class="user-info-item">
            <span class="user-info-label">角色:</span>
            <span class="user-info-value">${currentUser.role === 'admin' ? '管理员' : '普通用户'}</span>
        </div>
        <div class="user-info-item">
            <span class="user-info-label">创建时间:</span>
            <span class="user-info-value">${new Date(currentUser.createdAt).toLocaleString()}</span>
        </div>
    `;
}

// 更新用户列表
async function updateUserList() {
    try {
        const users = await getUsers();
        const userListContent = document.getElementById('userListContent');
        
        // 生成用户列表HTML
        const userListHTML = users.map((user, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${user.username}</td>
                <td>${user.role === 'admin' ? '管理员' : '普通用户'}</td>
                <td>${new Date(user.createdAt).toLocaleString()}</td>
            </tr>
        `).join('');
        
        userListContent.innerHTML = userListHTML;
    } catch (error) {
        console.error('更新用户列表失败:', error);
    }
}

// 检查登录状态
async function checkLoginStatus() {
    // 添加调试日志
    console.log('开始检查登录状态');
    
    const loginStatus = localStorage.getItem(LOGIN_STATUS_KEY);
    const currentUser = getCurrentUser();
    
    console.log('登录状态:', loginStatus);
    console.log('当前用户:', currentUser);
    
    // 只有当登录状态为true且当前用户存在时，才显示系统内容
    if (loginStatus === 'true' && currentUser) {
        // 已登录，显示系统内容
        console.log('用户已登录，显示系统内容');
        document.getElementById('loginModal').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
        document.querySelector('.user-info').style.display = 'flex';
        
        // 加载数据
        await loadData();
        renderDepositTable();
        renderFundTable();
        updateBankOptions();
        updatePlatformOptions();
        updateSummary();
        updateUserInfo();
    } else {
        // 未登录或当前用户不存在，显示登录模态框
        console.log('用户未登录，显示登录模态框');
        document.getElementById('loginModal').style.display = 'flex';
        document.querySelector('.container').style.display = 'none';
        document.querySelector('.user-info').style.display = 'none';
        // 清除无效的登录状态
        localStorage.setItem(LOGIN_STATUS_KEY, 'false');
        localStorage.removeItem(CURRENT_USER_KEY);
    }
    
    console.log('登录状态检查完成');
}

// 更新用户信息显示
function updateUserInfo() {
    const user = getCurrentUser();
    document.getElementById('currentUser').textContent = `欢迎，${user.username}${user.role === 'admin' ? ' (管理员)' : ''}`;
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const status = document.getElementById('loginStatus');
    
    // 清除之前的状态
    status.textContent = '';
    
    // 添加调试日志
    console.log('登录尝试:', username, password);
    
    try {
        // 获取所有用户
        const users = await getUsers();
        console.log('获取到的用户列表:', users);
        
        // 查找用户
        const user = users.find(user => user.username === username);
        console.log('找到的用户:', user);
        
        if (!user) {
            console.log('用户不存在:', username);
            status.textContent = '用户不存在，请先注册';
            return;
        }
        
        // 简单的密码验证（实际应用中应该使用加密）
        if (user.password === password) {
            console.log('登录成功:', username);
            
            // 设置登录状态
            localStorage.setItem(LOGIN_STATUS_KEY, 'true');
            setCurrentUser(user);
            
            // 显示系统内容
            document.getElementById('loginModal').style.display = 'none';
            document.querySelector('.container').style.display = 'block';
            document.querySelector('.user-info').style.display = 'flex';
            
            // 加载数据
            await loadData();
            renderDepositTable();
            renderFundTable();
            updateBankOptions();
            updatePlatformOptions();
            updateSummary();
            updateUserInfo();
            
            // 清空表单
            e.target.reset();
        } else {
            console.log('密码错误:', username);
            status.textContent = '用户名或密码错误';
        }
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
        const users = await getUsers();
        if (users.some(user => user.username === username)) {
            status.textContent = '用户已存在';
            return;
        }
        
        // 保存用户信息（实际应用中应该使用加密）
        const newUser = {
            username,
            password,
            role: 'user', // 默认普通用户角色
            createdAt: new Date().toISOString()
        };
        
        // 保存到IndexedDB
        await dbManager.save(STORES.USERS, newUser);
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
    
    if (newPassword !== confirmPassword) {
        status.textContent = '两次输入的新密码不一致';
        return;
    }
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
        status.textContent = '用户不存在';
        return;
    }
    
    try {
        const users = await getUsers();
        const userIndex = users.findIndex(user => user.username === currentUser.username);
        if (userIndex === -1) {
            status.textContent = '用户不存在';
            return;
        }
        
        const user = users[userIndex];
        if (user.password !== oldPassword) {
            status.textContent = '旧密码错误';
            return;
        }
        
        // 更新密码
        user.password = newPassword;
        
        // 保存到IndexedDB
        await dbManager.save(STORES.USERS, user);
        
        // 同时更新当前登录用户的密码
        setCurrentUser(user);
        
        status.textContent = '密码修改成功';
        status.style.color = 'green';
        
        // 清空表单并关闭模态框
        setTimeout(() => {
            document.getElementById('changePasswordForm').reset();
            document.getElementById('userSettingsModal').style.display = 'none';
            status.textContent = '';
            status.style.color = 'red';
        }, 1500);
    } catch (error) {
        console.error('修改密码失败:', error);
        status.textContent = '修改密码失败，请重试';
    }
}

// 处理退出登录
function handleLogout() {
    localStorage.setItem(LOGIN_STATUS_KEY, 'false');
    localStorage.removeItem(CURRENT_USER_KEY);
    checkLoginStatus();
}

// 处理删除数据
async function handleDeleteData(dataType) {
    // 显示确认弹窗，要求用户输入确认删除
    const confirmText = prompt('该操作不可逆，请输入"确认删除"以继续：');
    
    if (confirmText === '确认删除') {
        try {
            if (dataType === 'deposit') {
                // 删除所有定期存款数据
                await dbManager.deleteByIndex(STORES.DEPOSITS, 'username', getCurrentUser().username);
                currentDeposits = [];
                // 更新界面
                renderDepositTable();
                renderExpiredDepositTable();
                updateBankOptions();
                updateSummary();
                alert('所有定期存款数据已成功删除！');
            } else if (dataType === 'fund') {
                // 删除所有理财数据
                await dbManager.deleteByIndex(STORES.FUNDS, 'username', getCurrentUser().username);
                currentFunds = [];
                // 更新界面
                renderFundTable();
                updatePlatformOptions();
                alert('所有理财数据已成功删除！');
            }
        } catch (error) {
            console.error('删除数据失败:', error);
            alert('删除数据失败，请重试！');
        }
    } else {
        alert('删除操作已取消。');
    }
}

// 清空整个数据库（仅管理员可用）
async function clearDatabase() {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
        alert('只有管理员才能执行此操作！');
        return;
    }
    
    // 显示确认弹窗，要求用户输入确认删除
    const confirmText = prompt('该操作不可逆，将清空所有用户的所有数据，请输入"确认清空"以继续：');
    
    if (confirmText === '确认清空') {
        try {
            console.log('开始清空数据库...');
            
            // 清空所有存储对象
            console.log('正在清空USERS存储...');
            await dbManager.clear(STORES.USERS);
            console.log('正在清空DEPOSITS存储...');
            await dbManager.clear(STORES.DEPOSITS);
            console.log('正在清空FUNDS存储...');
            await dbManager.clear(STORES.FUNDS);
            console.log('正在清空USER_SESSION存储...');
            await dbManager.clear(STORES.USER_SESSION);
            
            // 清空localStorage中的用户会话数据
            console.log('正在清空localStorage...');
            localStorage.removeItem(CURRENT_USER_KEY);
            localStorage.removeItem(LOGIN_STATUS_KEY);
            localStorage.removeItem('USERS_KEY'); // 兼容旧版本的数据存储
            localStorage.removeItem('DEPOSITS_KEY'); // 兼容旧版本的数据存储
            localStorage.removeItem('FUNDS_KEY'); // 兼容旧版本的数据存储
            
            // 清空当前页面的全局变量
            console.log('正在清空全局变量...');
            currentDeposits = [];
            currentFunds = [];
            
            // 重新初始化管理员账号
            console.log('正在重新初始化管理员账号...');
            await initAdminAccount();
            
            // 强制刷新页面，确保所有数据都已清除
            console.log('正在强制刷新页面...');
            location.reload(true); // 使用true参数强制从服务器重新加载页面
            
            // 显示成功提示（页面刷新后不会显示，但保留以防刷新失败）
            alert('数据库已成功清空！');
        } catch (error) {
            console.error('清空数据库失败:', error);
            alert('清空数据库失败，请重试！');
        }
    } else {
        alert('清空操作已取消。');
    }
}

// 为控制台提供清空数据库的快捷方式
window.clearDatabase = clearDatabase;



// 加载数据
async function loadData() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    try {
        // 加载定期存款数据
        currentDeposits = await dbManager.getAllByIndex(STORES.DEPOSITS, 'username', currentUser.username);
        
        // 加载理财数据
        currentFunds = await dbManager.getAllByIndex(STORES.FUNDS, 'username', currentUser.username);
    } catch (error) {
        console.error('加载数据失败:', error);
        currentDeposits = [];
        currentFunds = [];
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
    
    // 定期存款表单提交
    document.getElementById('depositForm').addEventListener('submit', handleDepositSubmit);
    
    // 理财表单提交
    document.getElementById('fundForm').addEventListener('submit', handleFundSubmit);
    
    // Excel导入相关事件
    document.getElementById('importExcel').addEventListener('click', handleExcelImport);
    document.getElementById('excelFile').addEventListener('change', handleFileSelect);
    document.getElementById('downloadTemplate').addEventListener('click', downloadExcelTemplate);
    
    // 显示/隐藏功能
    document.getElementById('toggleSummary').addEventListener('click', toggleSummary);
    document.getElementById('toggleAddDeposit').addEventListener('click', toggleAddDeposit);
    
    // 日期输入事件
    document.getElementById('depositDate').addEventListener('input', handleDateInput);
    document.getElementById('depositExpiryDate').addEventListener('input', handleDateInput);
    document.getElementById('fundDate').addEventListener('input', handleDateInput);
    
    // 存期和到期日联动计算
    document.getElementById('depositPeriod').addEventListener('input', calculateExpiryDate);
    document.getElementById('periodUnit').addEventListener('change', calculateExpiryDate);
    document.getElementById('depositDate').addEventListener('change', calculateExpiryDate);
    document.getElementById('depositExpiryDate').addEventListener('change', calculatePeriod);
    
    // 利率或金额变化时自动计算利息
    document.getElementById('depositRate').addEventListener('input', calculateInterest);
    document.getElementById('depositAmount').addEventListener('input', calculateInterest);
    document.getElementById('depositPeriod').addEventListener('input', calculateInterest);
    document.getElementById('periodUnit').addEventListener('change', calculateInterest);
    
    // 表头排序事件
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('sort-btn')) {
            handleSort(e.target);
        }
    });
    
    // 导出数据按钮事件
    document.getElementById('exportExcel').addEventListener('click', exportDepositData);
    
    // 搜索功能
    document.getElementById('depositSearch').addEventListener('input', handleDepositSearch);
    
    // 设置默认日期为今天
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('depositDate').value = today;
    document.getElementById('fundDate').value = today;
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
}

// 保存定期存款数据
async function saveDepositData() {
    try {
        // 清空当前用户的所有定期存款
        await dbManager.deleteByIndex(STORES.DEPOSITS, 'username', getCurrentUser().username);
        
        // 保存所有定期存款
        for (const deposit of currentDeposits) {
            await dbManager.save(STORES.DEPOSITS, deposit);
        }
    } catch (error) {
        console.error('保存定期存款数据失败:', error);
        throw error;
    }
}

// 保存理财数据
async function saveFundData() {
    try {
        // 清空当前用户的所有理财数据
        await dbManager.deleteByIndex(STORES.FUNDS, 'username', getCurrentUser().username);
        
        // 保存所有理财数据
        for (const fund of currentFunds) {
            await dbManager.save(STORES.FUNDS, fund);
        }
    } catch (error) {
        console.error('保存理财数据失败:', error);
        throw error;
    }
}

// 格式化日期函数（将8位数字转换为YYYY-MM-DD）
function formatDate(dateStr) {
    // 如果已经是YYYY-MM-DD格式，直接返回
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }
    // 如果是8位数字，转换为YYYY-MM-DD
    if (/^\d{8}$/.test(dateStr)) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return `${year}-${month}-${day}`;
    }
    // 其他情况，尝试直接转换
    try {
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0];
    } catch (e) {
        return dateStr;
    }
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
    const depositDate = new Date(formatDate(depositDateInput.value));
    
    const expiryDate = new Date(depositDate);
    expiryDate.setMonth(expiryDate.getMonth() + period);
    const expiryDateStr = expiryDate.toISOString().split('T')[0];
    
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
    
    const depositDate = new Date(formatDate(depositDateInput.value));
    const expiryDate = new Date(formatDate(expiryDateInput.value));
    
    // 计算月份差
    const monthsDiff = (expiryDate.getFullYear() - depositDate.getFullYear()) * 12 + 
                      (expiryDate.getMonth() - depositDate.getMonth());
    
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
        
        // 格式化日期
        date = formatDate(date);
        
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
            expiryDate = formatDate(expiryDate);
            const depositDate = new Date(date);
            const expiryDateObj = new Date(expiryDate);
            
            // 计算月份差
            const monthsDiff = (expiryDateObj.getFullYear() - depositDate.getFullYear()) * 12 + 
                              (expiryDateObj.getMonth() - depositDate.getMonth());
            period = monthsDiff;
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
            id: Date.now(),
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
        
        // 添加到数据数组
        currentDeposits.push(deposit);
        
        // 保存数据到IndexedDB
        await saveDepositData();
        
        // 更新银行选项列表
        updateBankOptions();
        
        // 重新渲染表格，刷新存款列表
        renderDepositTable();
        
        // 更新汇总信息
        updateSummary();
        
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

// 处理理财表单提交
async function handleFundSubmit(e) {
    e.preventDefault();
    
    try {
        // 获取表单数据
        const platform = document.getElementById('fundPlatform').value;
        const name = document.getElementById('fundName').value;
        let date = document.getElementById('fundDate').value;
        const amount = parseFloat(document.getElementById('fundAmount').value);
        
        // 格式化日期
        date = formatDate(date);
        
        // 创建理财对象，添加用户名
        const fund = {
            id: Date.now(),
            platform,
            name,
            date,
            amount,
            username: getCurrentUser().username // 添加用户名，用于数据隔离
        };
        
        // 添加到数据数组
        currentFunds.push(fund);
        
        // 保存数据到IndexedDB
        await saveFundData();
        
        // 更新购买平台选项列表
        updatePlatformOptions();
        
        // 重新渲染表格
        renderFundTable();
        
        // 清空表单
        e.target.reset();
        
        // 设置默认日期为今天
        document.getElementById('fundDate').value = new Date().toISOString().split('T')[0];
        
        alert('理财添加成功！');
    } catch (error) {
        console.error('添加理财失败:', error);
        alert('添加理财失败，请检查输入数据格式是否正确');
    }
}

// 渲染定期存款表格
function renderDepositTable() {
    const today = new Date();
    // 过滤出未到期的存款
    let activeDeposits = currentDeposits.filter(deposit => new Date(deposit.expiryDate) >= today);
    // 应用搜索过滤
    activeDeposits = filterDeposits(activeDeposits);
    // 默认按到期日升序排序
    activeDeposits.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    const tbody = document.getElementById('depositTableBody');
    
    if (activeDeposits.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #999; padding: 20px;">暂无定期存款数据</td></tr>';
    } else {
        tbody.innerHTML = activeDeposits.map(deposit => {
            // 计算剩余天数
            const expiryDate = new Date(deposit.expiryDate);
            const timeDiff = expiryDate.getTime() - today.getTime();
            const remainingDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
            
            return `
            <tr class="${deposit.highlight ? 'highlight-row' : ''}">
                <td>${deposit.bank}</td>
                <td class="rate">${deposit.rate}%</td>
                <td>${deposit.period}个月</td>
                <td class="amount">¥${deposit.amount.toFixed(2)}</td>
                <td>${deposit.date}</td>
                <td class="expiry">${deposit.expiryDate}</td>
                <td class="${remainingDays <= 30 ? 'expiry' : ''}">${remainingDays}天</td>
                <td class="amount">¥${deposit.interest.toFixed(2)}</td>
                <td>${deposit.remarks || '-'}</td>
                <td>
                    <button class="btn btn-small btn-calendar" onclick="addToCalendar(${deposit.id})">添加到日历</button>
                    <button class="btn btn-small btn-delete" onclick="deleteDeposit(${deposit.id})">删除</button>
                </td>
            </tr>
        `;
        }).join('');
    }
    
    // 自动移除高亮效果
    setTimeout(() => {
        // 移除所有高亮标记
        currentDeposits.forEach(deposit => {
            if (deposit.highlight) {
                delete deposit.highlight;
            }
        });
        // 保存数据并重新渲染
        saveDepositData();
        renderDepositTable();
        renderExpiredDepositTable();
    }, 10000);
    
    // 更新汇总信息
    updateSummary();
    
    // 渲染已到期列表
    renderExpiredDepositTable();
}

// 渲染已到期列表
function renderExpiredDepositTable() {
    const today = new Date();
    // 过滤出已到期的存款
    let expiredDeposits = currentDeposits.filter(deposit => new Date(deposit.expiryDate) < today);
    // 应用搜索过滤
    expiredDeposits = filterDeposits(expiredDeposits);
    // 默认按到期日升序排序
    expiredDeposits.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    const tbody = document.getElementById('expiredDepositTableBody');
    
    if (expiredDeposits.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #999; padding: 20px;">暂无已到期存款数据</td></tr>';
        return;
    }
    
    tbody.innerHTML = expiredDeposits.map(deposit => {
        // 计算已到期天数
        const expiryDate = new Date(deposit.expiryDate);
        const timeDiff = today.getTime() - expiryDate.getTime();
        const expiredDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        return `
        <tr class="${deposit.highlight ? 'highlight-row' : ''}">
            <td>${deposit.bank}</td>
            <td class="rate">${deposit.rate}%</td>
            <td>${deposit.period}个月</td>
            <td class="amount">¥${deposit.amount.toFixed(2)}</td>
            <td>${deposit.date}</td>
            <td class="expiry">${deposit.expiryDate}</td>
            <td class="expiry">${expiredDays}天</td>
            <td class="amount">¥${deposit.interest.toFixed(2)}</td>
            <td>${deposit.remarks || '-'}</td>
            <td>
                <button class="btn btn-small btn-delete" onclick="deleteDeposit(${deposit.id})">删除</button>
            </td>
        </tr>
    `;
    }).join('');
}

// 渲染理财表格
function renderFundTable(funds = currentFunds) {
    const tbody = document.getElementById('fundTableBody');
    
    if (funds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999; padding: 20px;">暂无理财数据</td></tr>';
        return;
    }
    
    tbody.innerHTML = funds.map(fund => `
        <tr>
            <td>${fund.platform}</td>
            <td>${fund.name}</td>
            <td>${fund.date}</td>
            <td class="amount">¥${fund.amount.toFixed(2)}</td>
            <td>
                <button class="btn btn-small btn-delete" onclick="deleteFund(${fund.id})">删除</button>
            </td>
        </tr>
    `).join('');
}

//// 更新银行选项列表
function updateBankOptions() {
    const bankOptions = document.getElementById('bankOptions');
    
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

//// 更新购买平台选项列表
function updatePlatformOptions() {
    const platformOptions = document.getElementById('platformOptions');
    
    // 获取所有唯一的购买平台名称
    const platforms = [...new Set(currentFunds.map(fund => fund.platform))];
    
    // 清空现有选项
    platformOptions.innerHTML = '';
    
    // 添加新选项
    platforms.forEach(platform => {
        const option = document.createElement('option');
        option.value = platform;
        option.textContent = platform;
        platformOptions.appendChild(option);
    });
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
    // 创建模板数据，只保留表头，移除示例数据
    const templateData = [
        ['存款银行', '利率', '存期时长', '存期单位', '存入金额', '存入日期', '到期日', '利息', '备注']
    ];
    
    // 使用SheetJS创建工作簿
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '定期存款模板');
    
    // 设置列宽
    ws['!cols'] = [
        { wch: 15 }, // 存款银行
        { wch: 8 },  // 利率
        { wch: 10 }, // 存期时长
        { wch: 8 },  // 存期单位
        { wch: 12 }, // 存入金额
        { wch: 12 }, // 存入日期
        { wch: 12 }, // 到期日
        { wch: 10 }, // 利息
        { wch: 20 }  // 备注
    ];
    
    // 下载文件
    XLSX.writeFile(wb, '定期存款导入模板.xlsx');
}

// 处理Excel导入
function handleExcelImport() {
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
            jsonData.forEach(item => {
                // 检查必要字段
                if (item['存款银行'] && item['利率'] && (item['存期时长'] || item['到期日']) && item['存入金额'] && item['存入日期']) {
                    const bank = item['存款银行'];
                    let rate = parseFloat(item['利率']);
                    // 处理Excel百分比格式，当数值小于1时，可能是百分比格式，乘以100转换为正确的百分比数值
                    if (rate < 1 && !isNaN(rate)) {
                        rate = rate * 100;
                    }
                    // 处理浮点数精度问题，保留两位小数
                    rate = parseFloat(rate.toFixed(2));
                    const periodValue = parseFloat(item['存期时长'] || 0);
                    const periodUnit = item['存期单位'] || '月';
                    const amount = parseFloat(item['存入金额']);
                    let date = item['存入日期'];
                    let expiryDate = item['到期日'];
                    const remarks = item['备注'] || '';
                    
                    // 格式化日期
                    if (typeof date === 'number') {
                        // Excel日期转换
                        date = XLSX.SSF.format('yyyy-mm-dd', date);
                    } else {
                        date = formatDate(date.toString());
                    }
                    
                    let period;
                    // 计算存期和到期日
                    if (periodValue) {
                        // 如果填写了存期，计算到期日
                        period = periodUnit === '年' ? periodValue * 12 : periodValue;
                        
                        const depositDate = new Date(date);
                        const expiryDateObj = new Date(depositDate);
                        expiryDateObj.setMonth(expiryDateObj.getMonth() + period);
                        expiryDate = expiryDateObj.toISOString().split('T')[0];
                    } else if (expiryDate) {
                        // 如果填写了到期日，计算存期
                        if (typeof expiryDate === 'number') {
                            expiryDate = XLSX.SSF.format('yyyy-mm-dd', expiryDate);
                        } else {
                            expiryDate = formatDate(expiryDate.toString());
                        }
                        const depositDate = new Date(date);
                        const expiryDateObj = new Date(expiryDate);
                        
                        // 计算月份差
                        const monthsDiff = (expiryDateObj.getFullYear() - depositDate.getFullYear()) * 12 + 
                                          (expiryDateObj.getMonth() - depositDate.getMonth());
                        period = monthsDiff;
                    } else {
                        return;
                    }
                    
                    // 计算利息（如果未提供）
                    const calculatedInterest = (amount * rate * period) / (12 * 100);
                    const finalInterest = item['利息'] ? parseFloat(item['利息']) : parseFloat(calculatedInterest.toFixed(2));
                    
                    // 创建存款对象，添加用户名
                    const deposit = {
                        id: Date.now() + Math.random(),
                        bank,
                        rate,
                        period,
                        amount,
                        date,
                        expiryDate,
                        interest: finalInterest,
                        remarks,
                        highlight: true, // 高亮标记
                        username: getCurrentUser().username // 添加用户名，用于数据隔离
                    };
                    
                    // 添加到数据数组
                    currentDeposits.push(deposit);
                    importedCount++;
                }
            });
            
            // 保存数据到IndexedDB
            await saveDepositData();
            
            // 更新界面
            updateBankOptions();
            renderDepositTable();
            updateSummary();
            
            status.textContent = `成功导入 ${importedCount} 条记录`;
            status.style.color = 'green';
            
            // 清空文件输入
            fileInput.value = '';
            document.getElementById('fileName').textContent = '未选择文件';
            document.getElementById('fileName').style.color = '#666';
            
            // 3秒后自动清除提示信息
            setTimeout(() => {
                status.textContent = '';
            }, 3000);
        } catch (error) {
            console.error('导入失败:', error);
            status.textContent = '导入失败，请检查文件格式';
            status.style.color = 'red';
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// 切换汇总信息显示/隐藏
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

// 切换添加存款模块显示/隐藏
function toggleAddDeposit() {
    const addDepositContent = document.getElementById('addDepositContent');
    const toggleBtn = document.getElementById('toggleAddDeposit');
    const isVisible = addDepositContent.style.display !== 'none';
    
    if (isVisible) {
        addDepositContent.style.display = 'none';
        toggleBtn.textContent = '显示';
    } else {
        addDepositContent.style.display = 'block';
        toggleBtn.textContent = '隐藏';
    }
}

// 处理存款搜索
function handleDepositSearch(e) {
    currentSearchQuery = e.target.value.toLowerCase();
    renderDepositTable();
}

// 搜索过滤函数
function filterDeposits(deposits) {
    if (!currentSearchQuery) return deposits;
    
    return deposits.filter(deposit => {
        const searchText = currentSearchQuery.toLowerCase();
        return (
            deposit.bank.toLowerCase().includes(searchText) ||
            deposit.rate.toString().includes(searchText) ||
            deposit.amount.toString().includes(searchText) ||
            deposit.date.includes(searchText) ||
            deposit.expiryDate.includes(searchText) ||
            deposit.remarks.toLowerCase().includes(searchText)
        );
    });
}

// 更新存款汇总信息
function updateSummary() {
    // 获取当前日期
    const today = new Date();
    
    // 过滤出未到期的存款
    const activeDeposits = currentDeposits.filter(deposit => new Date(deposit.expiryDate) >= today);
    
    // 过滤出已到期的存款
    const expiredDeposits = currentDeposits.filter(deposit => new Date(deposit.expiryDate) < today);
    
    // 计算总金额（仅统计未到期数据）
    const totalAmount = activeDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);
    document.getElementById('totalAmount').textContent = `¥${totalAmount.toFixed(2)}`;
    
    // 计算已到手利息（仅统计已到期数据）
    const totalInterest = expiredDeposits.reduce((sum, deposit) => sum + deposit.interest, 0);
    document.getElementById('totalInterest').textContent = `¥${totalInterest.toFixed(2)}`;
    
    // 按银行分组汇总（仅统计未到期数据）
    const bankSummary = {};
    activeDeposits.forEach(deposit => {
        if (!bankSummary[deposit.bank]) {
            bankSummary[deposit.bank] = 0;
        }
        bankSummary[deposit.bank] += deposit.amount;
    });
    
    // 修改汇总行的样式
    const totalRows = document.querySelectorAll('.total-row');
    totalRows.forEach(row => {
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
    });
    
    // 渲染银行汇总
    const bankSummaryElement = document.getElementById('bankSummary');
    bankSummaryElement.innerHTML = Object.entries(bankSummary)
        .map(([bank, amount]) => {
            // 计算百分比
            const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
            return `
            <div class="summary-row" style="display: flex; justify-content: space-between; align-items: center;">
                <span class="summary-label">${bank}:</span>
                <div style="flex: 1; display: flex; justify-content: flex-end; align-items: center;">
                    <span class="summary-percentage" style="font-weight: bold; color: #3498db; margin-right: 15px;">${percentage.toFixed(1)}%</span>
                    <span class="summary-value">¥${amount.toFixed(2)}</span>
                </div>
            </div>
        `;
        })
        .join('');
}

// 处理日期输入，实时转换8位数字为日期格式
function handleDateInput(e) {
    const input = e.target;
    const value = input.value;
    
    // 如果输入的是8位数字，自动转换为YYYY-MM-DD格式
    if (/^\d{8}$/.test(value)) {
        const year = value.substring(0, 4);
        const month = value.substring(4, 6);
        const day = value.substring(6, 8);
        input.value = `${year}-${month}-${day}`;
    }
}

// 处理排序
let currentSortColumn = null;
let currentSortOrder = 'asc';

function handleSort(btn) {
    const column = btn.getAttribute('data-column');
    const order = btn.getAttribute('data-order');
    
    // 确定是哪个表格的排序
    const tableId = btn.closest('table').id;
    
    // 应用排序
    let sortedDeposits = [...currentDeposits];
    
    sortedDeposits.sort((a, b) => {
        let aVal, bVal;
        
        // 处理剩余天数和已到期天数的排序
        if (column === 'remainingDays' || column === 'expiredDays') {
            const today = new Date();
            const aExpiry = new Date(a.expiryDate);
            const bExpiry = new Date(b.expiryDate);
            const aTimeDiff = aExpiry.getTime() - today.getTime();
            const bTimeDiff = bExpiry.getTime() - today.getTime();
            
            if (column === 'remainingDays') {
                aVal = Math.ceil(aTimeDiff / (1000 * 3600 * 24));
                bVal = Math.ceil(bTimeDiff / (1000 * 3600 * 24));
            } else {
                // 已到期天数
                aVal = Math.ceil(-aTimeDiff / (1000 * 3600 * 24));
                bVal = Math.ceil(-bTimeDiff / (1000 * 3600 * 24));
            }
        } else {
            aVal = a[column];
            bVal = b[column];
            
            // 日期类型转换
            if (column === 'date' || column === 'expiryDate') {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            }
            
            // 字符串类型转换为小写进行比较
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
        }
        
        if (order === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
    
    // 根据表格ID渲染对应的数据
    if (tableId === 'depositTable') {
        // 存款列表只显示未到期数据
        const today = new Date();
        const activeDeposits = sortedDeposits.filter(deposit => new Date(deposit.expiryDate) >= today);
        
        const tbody = document.getElementById('depositTableBody');
        if (activeDeposits.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #999; padding: 20px;">暂无定期存款数据</td></tr>';
        } else {
            tbody.innerHTML = activeDeposits.map(deposit => {
                // 计算剩余天数
                const expiryDate = new Date(deposit.expiryDate);
                const timeDiff = expiryDate.getTime() - today.getTime();
                const remainingDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
                
                return `
                <tr class="${deposit.highlight ? 'highlight-row' : ''}">
                    <td>${deposit.bank}</td>
                    <td class="rate">${deposit.rate}%</td>
                    <td>${deposit.period}个月</td>
                    <td class="amount">¥${deposit.amount.toFixed(2)}</td>
                    <td>${deposit.date}</td>
                    <td class="expiry">${deposit.expiryDate}</td>
                    <td class="${remainingDays <= 30 ? 'expiry' : ''}">${remainingDays}天</td>
                    <td class="amount">¥${deposit.interest.toFixed(2)}</td>
                    <td>${deposit.remarks || '-'}</td>
                    <td>
                        <button class="btn btn-small btn-calendar" onclick="addToCalendar(${deposit.id})">添加到日历</button>
                        <button class="btn btn-small btn-delete" onclick="deleteDeposit(${deposit.id})">删除</button>
                    </td>
                </tr>
            `;
            }).join('');
        }
    } else if (tableId === 'expiredDepositTable') {
        // 已到期列表只显示已到期数据
        const today = new Date();
        const expiredDeposits = sortedDeposits.filter(deposit => new Date(deposit.expiryDate) < today);
        
        const tbody = document.getElementById('expiredDepositTableBody');
        if (expiredDeposits.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #999; padding: 20px;">暂无已到期存款数据</td></tr>';
        } else {
            tbody.innerHTML = expiredDeposits.map(deposit => {
                // 计算已到期天数
                const expiryDate = new Date(deposit.expiryDate);
                const timeDiff = today.getTime() - expiryDate.getTime();
                const expiredDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
                
                return `
                <tr class="${deposit.highlight ? 'highlight-row' : ''}">
                    <td>${deposit.bank}</td>
                    <td class="rate">${deposit.rate}%</td>
                    <td>${deposit.period}个月</td>
                    <td class="amount">¥${deposit.amount.toFixed(2)}</td>
                    <td>${deposit.date}</td>
                    <td class="expiry">${deposit.expiryDate}</td>
                    <td class="expiry">${expiredDays}天</td>
                    <td class="amount">¥${deposit.interest.toFixed(2)}</td>
                    <td>${deposit.remarks || '-'}</td>
                    <td>
                        <button class="btn btn-small btn-delete" onclick="deleteDeposit(${deposit.id})">删除</button>
                    </td>
                </tr>
            `;
            }).join('');
        }
    }
    
    // 更新排序按钮样式
    updateSortButtonStyles(column, order);
}

// 更新排序按钮样式
function updateSortButtonStyles(column, order) {
    // 移除所有排序按钮的高亮
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.style.backgroundColor = '';
        btn.style.color = '';
        btn.style.fontWeight = '';
    });
    
    // 高亮当前排序按钮
    const activeBtns = document.querySelectorAll(`.sort-btn[data-column="${column}"]`);
    activeBtns.forEach(btn => {
        if (btn.getAttribute('data-order') === order) {
            btn.style.backgroundColor = '#3498db';
            btn.style.color = 'white';
            btn.style.fontWeight = 'bold';
        }
    });
}

// 删除定期存款
async function deleteDeposit(id) {
    const confirmText = prompt('请输入"确认删除"以删除这条定期存款记录:');
    if (confirmText === '确认删除') {
        try {
            currentDeposits = currentDeposits.filter(deposit => deposit.id !== id);
            await saveDepositData();
            renderDepositTable();
            updateSummary();
            alert('删除成功！');
        } catch (error) {
            console.error('删除定期存款失败:', error);
            alert('删除失败，请重试！');
        }
    }
}

// 删除理财
async function deleteFund(id) {
    const confirmText = prompt('请输入"确认删除"以删除这条理财记录:');
    if (confirmText === '确认删除') {
        try {
            currentFunds = currentFunds.filter(fund => fund.id !== id);
            await saveFundData();
            renderFundTable();
            updatePlatformOptions();
            alert('删除成功！');
        } catch (error) {
            console.error('删除理财失败:', error);
            alert('删除失败，请重试！');
        }
    }
}

// 添加到手机日历
function addToCalendar(depositId) {
    const deposit = currentDeposits.find(d => d.id === depositId);
    if (!deposit) return;
    
    // 格式化日期
    const startDate = new Date(deposit.expiryDate);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);
    
    // 创建事件标题和描述
    const title = `${deposit.bank}定期存款到期`;
    const description = `银行：${deposit.bank}\n金额：¥${deposit.amount.toFixed(2)}\n利率：${deposit.rate}%\n存期：${deposit.period}个月\n利息：¥${deposit.interest.toFixed(2)}\n备注：${deposit.remarks || '无'}`;
    
    // 尝试使用 Web Share API
    if (navigator.share) {
        navigator.share({
            title: title,
            text: description,
            url: window.location.href
        }).catch(err => {
            console.log('分享失败:', err);
            // 回退到创建 ICS 文件
            createICSFile(deposit, title, description, startDate, endDate);
        });
    } else {
        // 创建 ICS 文件
        createICSFile(deposit, title, description, startDate, endDate);
    }
}

// 创建 ICS 文件
function createICSFile(deposit, title, description, startDate, endDate) {
    // 格式化日期为 ICS 格式
    const formatICSDate = (date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//我的财富//NONSGML v1.0//EN
BEGIN:VEVENT
UID:${deposit.id}@licai-system
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:${title}
DESCRIPTION:${description}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
    
    // 创建下载链接
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', init);
