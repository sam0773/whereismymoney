const crypto = require('crypto');

// PBKDF2配置
const PBKDF2_ITERATIONS = 10000;
const PBKDF2_KEY_LENGTH = 64;
const PBKDF2_DIGEST = 'sha512';

/**
 * 生成随机盐值
 * @returns {string} 生成的盐值
 */
function generateSalt() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * 使用PBKDF2算法生成密码哈希
 * @param {string} password 原始密码
 * @param {string} salt 盐值
 * @returns {string} 格式化的哈希值，格式为 "iterations:salt:hash"
 */
function hashPassword(password, salt) {
    const iterations = PBKDF2_ITERATIONS;
    const hash = crypto.pbkdf2Sync(
        password,
        salt,
        iterations,
        PBKDF2_KEY_LENGTH,
        PBKDF2_DIGEST
    ).toString('hex');
    
    return `${iterations}:${salt}:${hash}`;
}

/**
 * 验证密码
 * @param {string} password 输入的密码
 * @param {string} storedPassword 存储的密码（可能是明文或哈希值）
 * @returns {object} 包含验证结果和是否需要更新密码的对象
 */
function verifyPassword(password, storedPassword) {
    // 检查是否是哈希密码（格式：iterations:salt:hash）
    const isHashed = storedPassword.includes(':');
    
    if (!isHashed) {
        // 旧版本明文密码验证
        const isValid = password === storedPassword;
        return {
            isValid,
            needsUpdate: isValid // 如果验证通过，需要更新为哈希密码
        };
    }
    
    // 解析哈希密码
    const [iterations, salt, hash] = storedPassword.split(':');
    
    // 生成输入密码的哈希
    const inputHash = crypto.pbkdf2Sync(
        password,
        salt,
        parseInt(iterations),
        PBKDF2_KEY_LENGTH,
        PBKDF2_DIGEST
    ).toString('hex');
    
    return {
        isValid: inputHash === hash,
        needsUpdate: false
    };
}

/**
 * 生成完整的密码哈希（包含盐值生成）
 * @param {string} password 原始密码
 * @returns {string} 格式化的哈希值
 */
function createPasswordHash(password) {
    const salt = generateSalt();
    return hashPassword(password, salt);
}

module.exports = {
    createPasswordHash,
    verifyPassword
};
