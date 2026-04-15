const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 创建数据库连接
const dbPath = path.join(__dirname, 'data', 'database.db');
console.log('尝试连接数据库:', dbPath);
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('数据库连接失败:', err.message);
        console.error('错误码:', err.code);
        console.error('错误堆栈:', err.stack);
    } else {
        console.log('已成功连接到SQLite数据库');
        console.log('数据库路径:', dbPath);
        initDatabase();
    }
});

// 初始化数据库表
function initDatabase() {
    // 创建用户表
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            createdAt TEXT NOT NULL
        )
    `, (err) => {
        if (err) {
            console.error('创建用户表失败:', err.message);
        }
    });

    // 创建定期存款表
    db.run(`
        CREATE TABLE IF NOT EXISTS deposits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            bank TEXT NOT NULL,
            rate REAL NOT NULL,
            period INTEGER NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            expiryDate TEXT NOT NULL,
            interest REAL NOT NULL,
            remarks TEXT,
            highlight INTEGER DEFAULT 0,
            confirmed INTEGER DEFAULT 0,
            FOREIGN KEY (username) REFERENCES users(username)
        )
    `, (err) => {
        if (err) {
            console.error('创建定期存款表失败:', err.message);
        }
    });

    // 创建理财表
    db.run(`
        CREATE TABLE IF NOT EXISTS wealth (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            platform TEXT NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT '活期',
            riskLevel TEXT,
            transactionType TEXT NOT NULL DEFAULT 'buy', -- buy: 购买, redeem: 赎回
            redeemType TEXT NOT NULL DEFAULT 'partial', -- partial: 部分赎回, full: 全部赎回
            date TEXT NOT NULL,
            expiryDate TEXT,
            amount REAL NOT NULL,
            redeemedAmount REAL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active', -- active: 持有中, redeemed: 已赎回
            FOREIGN KEY (username) REFERENCES users(username)
        )
    `, (err) => {
        if (err) {
            console.error('创建理财表失败:', err.message);
        }
    });

    // 创建基金表
    db.run(`
        CREATE TABLE IF NOT EXISTS fund (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            platform TEXT NOT NULL,
            fundCode TEXT,
            name TEXT NOT NULL,
            transactionType TEXT NOT NULL DEFAULT 'buy',
            redeemType TEXT NOT NULL DEFAULT 'partial',
            date TEXT NOT NULL,
            expiryDate TEXT,
            amount REAL NOT NULL,
            redeemedAmount REAL DEFAULT 0,
            shares REAL,
            status TEXT NOT NULL DEFAULT 'active',
            fundCategory TEXT,
            fundType TEXT,
            fundRiskLevel TEXT,
            FOREIGN KEY (username) REFERENCES users(username)
        )
    `, (err) => {
        if (err) {
            console.error('创建基金表失败:', err.message);
        }
    });
    
    // 如果表已存在，添加新字段
    // 修复：SQLite不支持ALTER TABLE ... IF EXISTS语法，移除IF EXISTS子句
    db.run('ALTER TABLE wealth ADD COLUMN type TEXT DEFAULT "活期"', (err) => {
        if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
            console.error('添加type字段失败:', err.message);
        }
    });
    
    // 为fund表添加shares字段（用于存储基金份额）
    db.run('ALTER TABLE fund ADD COLUMN shares REAL', (err) => {
        if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
            console.error('添加shares字段失败:', err.message);
        }
    });
    
    db.run('ALTER TABLE wealth ADD COLUMN expiryDate TEXT', (err) => {
        if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
            console.error('添加expiryDate字段失败:', err.message);
        }
    });
    
    db.run('ALTER TABLE wealth ADD COLUMN transactionType TEXT DEFAULT "buy"', (err) => {
        if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
            console.error('添加transactionType字段失败:', err.message);
        }
    });
    
    db.run('ALTER TABLE wealth ADD COLUMN redeemType TEXT DEFAULT "partial"', (err) => {
        if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
            console.error('添加redeemType字段失败:', err.message);
        }
    });
    
    db.run('ALTER TABLE wealth ADD COLUMN redeemedAmount REAL DEFAULT 0', (err) => {
        if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
            console.error('添加redeemedAmount字段失败:', err.message);
        }
    });
    
    db.run('ALTER TABLE wealth ADD COLUMN status TEXT DEFAULT "active"', (err) => {
        if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
            console.error('添加status字段失败:', err.message);
        }
    });
    
    db.run('ALTER TABLE wealth ADD COLUMN riskLevel TEXT', (err) => {
        if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
            console.error('添加riskLevel字段失败:', err.message);
        }
    });
    
    // 为fund表添加新字段
    db.run('ALTER TABLE fund ADD COLUMN fundCode TEXT', (err) => {
        if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
            console.error('添加fundCode字段失败:', err.message);
        }
    });
    
    db.run('ALTER TABLE fund ADD COLUMN fundCategory TEXT', (err) => {
        if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
            console.error('添加fundCategory字段失败:', err.message);
        }
    });
    
    db.run('ALTER TABLE fund ADD COLUMN fundType TEXT', (err) => {
        if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
            console.error('添加fundType字段失败:', err.message);
        }
    });
    
    db.run('ALTER TABLE fund ADD COLUMN fundRiskLevel TEXT', (err) => {
        if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
            console.error('添加fundRiskLevel字段失败:', err.message);
        }
    });
    
    // 为deposits表添加confirmed字段，确保兼容旧数据库
    db.run('ALTER TABLE deposits ADD COLUMN confirmed INTEGER DEFAULT 0', (err) => {
        if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
            console.error('添加confirmed字段失败:', err.message);
        }
    });
    
    // 创建银证转账表
    db.run(`
        CREATE TABLE IF NOT EXISTS bankSecuritiesTransfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            broker TEXT NOT NULL,
            type TEXT NOT NULL, -- 银行转证券, 证券转银行
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            remarks TEXT,
            isFullTransfer INTEGER DEFAULT 0,
            FOREIGN KEY (username) REFERENCES users(username)
        )
    `, (err) => {
        if (err) {
            console.error('创建银证转账表失败:', err.message);
        }
    });

    // 创建其它资产表
    db.run(`
        CREATE TABLE IF NOT EXISTS other (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            expectedReturn REAL NOT NULL DEFAULT 0,
            remarks TEXT,
            platform TEXT,
            flexibility TEXT,
            transactionType TEXT NOT NULL DEFAULT 'buy',
            redeemType TEXT NOT NULL DEFAULT 'partial',
            status TEXT NOT NULL DEFAULT 'active',
            FOREIGN KEY (username) REFERENCES users(username)
        )
    `, (err) => {
        if (err) {
            console.error('创建其它资产表失败:', err.message);
        }
    });
    
    // 为所有表添加软删除字段
    const tables = ['deposits', 'wealth', 'fund', 'bankSecuritiesTransfers', 'other'];
    tables.forEach(table => {
        // 添加deleteFlag字段，0表示未删除，1表示已删除
        db.run(`ALTER TABLE ${table} ADD COLUMN deleteFlag INTEGER DEFAULT 0`, (err) => {
            if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
                console.error(`为${table}表添加deleteFlag字段失败:`, err.message);
            }
        });
        
        // 添加deleteDate字段，记录删除时间
        db.run(`ALTER TABLE ${table} ADD COLUMN deleteDate TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
                console.error(`为${table}表添加deleteDate字段失败:`, err.message);
            }
        });
    });
    
    // 为现有表添加缺少的字段
    // 修复：SQLite不支持ALTER TABLE ... IF EXISTS语法，移除IF EXISTS子句
    db.run('ALTER TABLE other ADD COLUMN transactionType TEXT DEFAULT "buy"', (err) => {
        if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
            console.error('添加transactionType字段失败:', err.message);
        }
    });
    
    db.run('ALTER TABLE other ADD COLUMN redeemType TEXT DEFAULT "partial"', (err) => {
        if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
            console.error('添加redeemType字段失败:', err.message);
        }
    });
    
    db.run('ALTER TABLE other ADD COLUMN status TEXT DEFAULT "active"', (err) => {
        if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
            console.error('添加status字段失败:', err.message);
        }
    });

    // 创建用户设置表（页面设置）
    db.run(`
        CREATE TABLE IF NOT EXISTS userSettings (
            username TEXT PRIMARY KEY,
            shareManagementEnabled INTEGER DEFAULT 1, -- 非货币基金份额管理开关
            currentAmountQueryEnabled INTEGER DEFAULT 1, -- 联网查询当前金额开关
            FOREIGN KEY (username) REFERENCES users(username)
        )
    `, (err) => {
        if (err) {
            console.error('创建用户设置表失败:', err.message);
        }
    });
    
    // 初始化管理员账号
    initAdminAccount();
}

// 导入密码工具函数
const { createPasswordHash, verifyPassword } = require('./utils/passwordUtils');

// 初始化管理员账号
function initAdminAccount() {
    // 使用事务确保原子性操作
    db.serialize(() => {
        // 先确保users表存在
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    username TEXT PRIMARY KEY,
                    password TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'user',
                    createdAt TEXT NOT NULL
                )
            `, (err) => {
            if (err) {
                console.error('创建/检查users表失败:', err.message);
                return;
            }
            
            // 检查是否已存在管理员角色的用户
            db.get('SELECT * FROM users WHERE role = ?', ['admin'], (err, adminUser) => {
                if (err) {
                    console.error('查询管理员角色失败:', err.message);
                    return;
                }
                
                if (adminUser) {
                    // 已存在管理员角色的用户，不做任何修改
                    console.log('系统中已存在管理员角色的用户，保持不变');
                    return;
                }
                
                // 检查是否已存在admin账号
                db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, existingAdmin) => {
                    if (err) {
                        console.error('查询admin账号失败:', err.message);
                        return;
                    }
                    
                    if (existingAdmin) {
                        // 已存在admin账号，但不是管理员角色，更新其角色为admin
                        db.run('UPDATE users SET role = ? WHERE username = ?', ['admin', 'admin'], (err) => {
                            if (err) {
                                console.error('更新admin账号角色失败:', err.message);
                            } else {
                                console.log('已将admin账号更新为管理员角色');
                            }
                        });
                        return;
                    }
                    
                    // 新创建管理员账号，使用默认密码哈希
                    let adminPassword = 'admin123';
                    let hashedPassword = createPasswordHash(adminPassword);
                    let createdAt = new Date().toISOString();
                    
                    const newAdminUser = {
                        username: 'admin',
                        password: hashedPassword,
                        role: 'admin',
                        createdAt: createdAt
                    };
                    
                    // 插入管理员账号
                    db.run('INSERT INTO users (username, password, role, createdAt) VALUES (?, ?, ?, ?)', 
                        [newAdminUser.username, newAdminUser.password, newAdminUser.role, newAdminUser.createdAt],
                        (err) => {
                            if (err) {
                                console.error('创建管理员账号失败:', err.message);
                            } else {
                                console.log('管理员账号初始化成功: admin/admin123');
                            }
                        }
                    );
                });
            });
        });
    });
}

module.exports = db;