// 天气服务 (随机模拟版)
export const Weather = {
    current: null,

    async init() {
        // 随机天气类型列表
        const weatherTypes = ['clear', 'cloudy', 'rain', 'snow', 'starry', 'storm'];
        
        // 随机选择一个
        const randomIndex = Math.floor(Math.random() * weatherTypes.length);
        const selectedType = weatherTypes[randomIndex];
        
        console.log('Random Weather Selected:', selectedType);
        
        // 模拟 API 返回结构，但在 Main.js 中我们直接用类型字符串其实更方便，
        // 为了保持兼容性，我们直接返回类型字符串
        return selectedType;
    },

    // 获取天气类型 (现在直接返回类型本身，保留此方法为了兼容旧代码调用)
    getWeatherType(type) {
        return type; 
    }
};
