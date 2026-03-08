const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 创建数据库连接
const dbPath = path.join(__dirname, 'data', 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('数据库连接失败:', err.message);
        process.exit(1);
    } else {
        console.log('已成功连接到SQLite数据库');
        queryDatabase();
    }
});

// 查询数据库数据
function queryDatabase() {
    console.log('\n=== 数据库数据检查 ===\n');
    
    // 查询用户表
    console.log('1. 用户表数据:');
    db.all('SELECT username, role FROM users', (err, rows) => {
        if (err) {
            console.error('查询用户表失败:', err.message);
        } else {
            rows.forEach(row => {
                console.log(`   - ${row.username} (${row.role})`);
            });
        }
        
        // 查询理财表中的购买平台
        console.log('\n2. 理财表中的购买平台:');
        db.all('SELECT DISTINCT platform FROM wealth', (err, rows) => {
            if (err) {
                console.error('查询理财表失败:', err.message);
            } else {
                if (rows.length === 0) {
                    console.log('   - 暂无数据');
                } else {
                    rows.forEach(row => {
                        console.log(`   - ${row.platform}`);
                    });
                }
            }
            
            // 查询基金表中的购买平台
            console.log('\n3. 基金表中的购买平台:');
            db.all('SELECT DISTINCT platform FROM fund', (err, rows) => {
                if (err) {
                    console.error('查询基金表失败:', err.message);
                } else {
                    if (rows.length === 0) {
                        console.log('   - 暂无数据');
                    } else {
                        rows.forEach(row => {
                            console.log(`   - ${row.platform}`);
                        });
                    }
                }
                
                // 关闭数据库连接
                db.close((err) => {
                    if (err) {
                        console.error('关闭数据库连接失败:', err.message);
                    } else {
                        console.log('\n数据库连接已关闭');
                    }
                });
            });
        });
    });
}