// 主入口文件
// 本文件只包含初始化和入口函数，具体功能已分离到各个模块文件中

// 初始化DBManager实例
const dbManager = new DBManager();
window.dbManager = dbManager;

// 页面加载完成后执行初始化
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // 等待数据库初始化完成
        await dbManager.initDB();
        
        // 初始化管理员账号 - 由后端处理
        
        // 检查登录状态
        if (window.checkLoginStatus) {
            await window.checkLoginStatus();
        }
        
        // 绑定登录相关事件
        if (window.bindLoginEvents) window.bindLoginEvents();
        
        // 绑定全局事件
        if (window.bindEvents) window.bindEvents();
        
        // 初始化认证模块（总是需要）
        if (window.initAuth) window.initAuth();
    } catch (error) {
        console.error('初始化失败:', error);
        alert('初始化失败，应用可能无法正常工作');
    }
});

// 初始化管理员账号 - 由后端处理
async function initAdminAccount() {
    return Promise.resolve();
}
