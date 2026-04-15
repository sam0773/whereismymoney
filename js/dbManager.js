// 存储常量
const STORES = {
    USERS: 'users',
    DEPOSITS: 'deposits',
    FUNDS: 'funds',
    WEALTH: 'wealth',
    FUND: 'fund',
    BANK_SECURITIES_TRANSFERS: 'bankSecuritiesTransfers',
    OTHER: 'other'
};

// 数据库管理类，负责与后端API通信
class DBManager {
    constructor() {
        this.apiBase = '/api';
    }

    // 初始化数据库（此处为向后兼容，实际由后端处理）
    async initDB() {
        return Promise.resolve();
    }

    // 通用请求方法
    async request(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${this.apiBase}${endpoint}`, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `请求失败: ${response.status}`);
        }
        return response.json();
    }

    // 获取所有数据
    async getAll(storeName) {
        if (storeName === STORES.USERS) {
            return this.request('/users');
        }
        throw new Error(`不支持的存储: ${storeName}`);
    }

    // 根据用户名获取数据
    async getAllByIndex(storeName, indexName, value) {
        if (indexName === 'username') {
            if (storeName === STORES.DEPOSITS) {
                const response = await this.request(`/deposits/${value}`);
                return response;
            } else if (storeName === STORES.WEALTH || storeName === STORES.FUNDS) {
                const response = await this.request(`/wealth/${value}`);
                return response;
            } else if (storeName === STORES.FUND) {
                const response = await this.request(`/fund/${value}`);
                return response;
            } else if (storeName === STORES.BANK_SECURITIES_TRANSFERS) {
                const response = await this.request(`/bankSecuritiesTransfers/${value}`);
                return response;
            } else if (storeName === STORES.OTHER) {
                const response = await this.request(`/other/${value}`);
                return response;
            }
        }
        throw new Error(`不支持的存储或索引: ${storeName}/${indexName}`);
    }

    // 保存数据
    async save(storeName, data) {
        if (storeName === STORES.DEPOSITS) {
            if (data.id) {
                // 更新已有数据
                return this.request(`/deposits/${data.id}`, 'PUT', data);
            } else {
                // 创建新数据
                return this.request('/deposits', 'POST', data);
            }
        } else if (storeName === STORES.WEALTH || storeName === STORES.FUNDS) {
            if (data.id) {
                // 更新已有数据
                return this.request(`/wealth/${data.id}`, 'PUT', data);
            } else {
                // 创建新数据
                return this.request('/wealth', 'POST', data);
            }
        } else if (storeName === STORES.FUND) {
            if (data.id) {
                // 更新已有数据
                return this.request(`/fund/${data.id}`, 'PUT', data);
            } else {
                // 创建新数据
                return this.request('/fund', 'POST', data);
            }
        } else if (storeName === STORES.BANK_SECURITIES_TRANSFERS) {
            if (data.id) {
                // 更新已有数据
                return this.request(`/bankSecuritiesTransfers/${data.id}`, 'PUT', data);
            } else {
                // 创建新数据
                return this.request('/bankSecuritiesTransfers', 'POST', data);
            }
        } else if (storeName === STORES.OTHER) {
            if (data.id) {
                // 更新已有数据
                return this.request(`/other/${data.id}`, 'PUT', data);
            } else {
                // 创建新数据
                return this.request('/other', 'POST', data);
            }
        } else if (storeName === STORES.USERS) {
            // 用户数据特殊处理
            return data;
        }
        throw new Error(`不支持的存储: ${storeName}`);
    }

    // 删除数据
    async delete(storeName, key) {
        if (storeName === STORES.DEPOSITS) {
            return this.request(`/deposits/${key}`, 'DELETE');
        } else if (storeName === STORES.WEALTH || storeName === STORES.FUNDS) {
            return this.request(`/wealth/${key}`, 'DELETE');
        } else if (storeName === STORES.FUND) {
            return this.request(`/fund/${key}`, 'DELETE');
        } else if (storeName === STORES.BANK_SECURITIES_TRANSFERS) {
            return this.request(`/bankSecuritiesTransfers/${key}`, 'DELETE');
        } else if (storeName === STORES.OTHER) {
            return this.request(`/other/${key}`, 'DELETE');
        }
        throw new Error(`不支持的存储: ${storeName}`);
    }

    // 根据索引删除数据
    async deleteByIndex(storeName, indexName, value) {
        if (indexName === 'username') {
            if (storeName === STORES.DEPOSITS) {
                return this.request(`/deposits/user/${value}`, 'DELETE');
            } else if (storeName === STORES.WEALTH || storeName === STORES.FUNDS) {
                return this.request(`/wealth/user/${value}`, 'DELETE');
            } else if (storeName === STORES.FUND) {
                return this.request(`/fund/user/${value}`, 'DELETE');
            } else if (storeName === STORES.BANK_SECURITIES_TRANSFERS) {
                return this.request(`/bankSecuritiesTransfers/user/${value}`, 'DELETE');
            } else if (storeName === STORES.OTHER) {
                return this.request(`/other/user/${value}`, 'DELETE');
            }
        }
        throw new Error(`不支持的存储或索引: ${storeName}/${indexName}`);
    }

    // 清空存储
    async clear(storeName) {
        if (storeName === STORES.USERS) {
            return this.request('/clear-database', 'DELETE');
        }
        throw new Error(`不支持的存储: ${storeName}`);
    }
}

// 导出常量和类
window.DBManager = DBManager;
window.STORES = STORES;