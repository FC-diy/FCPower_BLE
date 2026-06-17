// firmware-upgrade.js
// 固件升级模块

class FirmwareUpgrade {
    constructor() {
        this.selectedFile = null;
        this.fileData = null; // 存储文件数据
        this.chunkSize = 2048; // 2KB
        this.bluetoothManager = null;
        this.isUpgrading = false;
        this.totalChunks = 0;
        this.isDownloading = false;
        this.isSending = false; // 是否正在发送数据
        this.requestQueue = []; // 请求队列
        
        // GitHub仓库配置
        this.githubRepo = 'FC-diy/FCPOWER-BLE-BIN';
        this.githubBranch = 'main';

        // 固件列表配置
        // 添加新固件时，只需在这里添加对应条目，下拉框选项会自动生成
        this.firmwareList = {
            'FCPower-V2.4.bin': { name: 'FCPower V2.4', fileName: 'FCPower-V2.4.bin' },
            'FCPower-V2.5.bin': { name: 'FCPower V2.5', fileName: 'FCPower-V2.5.bin' },
           
        };
    }

    // 设置蓝牙管理器
    setBluetoothManager(manager) {
        this.bluetoothManager = manager;
    }

    // 初始化固件升级模块
    init() {
        // 动态生成固件下拉框选项
        this.populateFirmwareOptions();

        // 添加升级固件按钮事件监听器
        const upgradeBtn = document.getElementById('upgrade-firmware-btn');
        if (upgradeBtn) {
            upgradeBtn.addEventListener('click', () => {
                this.startUpgrade();
            });
        }

        // 添加取消升级按钮事件监听器
        const cancelBtn = document.getElementById('cancel-upgrade-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.cancelUpgrade();
            });
        }

        // 添加下拉框事件监听器
        const firmwareSelect = document.getElementById('firmware-select');
        if (firmwareSelect) {
            firmwareSelect.addEventListener('change', (event) => {
                this.handleFirmwareSelect(event);
            });
        }
    }

    // 动态生成固件下拉框选项
    populateFirmwareOptions() {
        const firmwareSelect = document.getElementById('firmware-select');
        if (!firmwareSelect) {
            console.error('找不到固件选择下拉框元素');
            return;
        }

        // 清空现有选项（保留第一个默认选项）
        firmwareSelect.innerHTML = '<option value="">请选择固件</option>';

        // 遍历固件列表，添加选项
        for (const [key, firmware] of Object.entries(this.firmwareList)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = firmware.name;
            firmwareSelect.appendChild(option);
        }
    }

    // 显示取消升级按钮
    showCancelButton() {
        const cancelBtn = document.getElementById('cancel-upgrade-btn');
        const upgradeBtn = document.getElementById('upgrade-firmware-btn');
        const firmwareSelect = document.getElementById('firmware-select');
        
        if (cancelBtn) cancelBtn.style.display = 'inline-block';
        if (upgradeBtn) upgradeBtn.style.display = 'none';
        if (firmwareSelect) firmwareSelect.disabled = true;
    }

    // 隐藏取消升级按钮
    hideCancelButton() {
        const cancelBtn = document.getElementById('cancel-upgrade-btn');
        const upgradeBtn = document.getElementById('upgrade-firmware-btn');
        const firmwareSelect = document.getElementById('firmware-select');
        
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (upgradeBtn) upgradeBtn.style.display = 'inline-block';
        if (firmwareSelect) firmwareSelect.disabled = false;
    }

    // 处理固件选择
    async handleFirmwareSelect(event) {
        const selectElement = event.target;
        const selectedValue = selectElement.value;

        if (!selectedValue || selectedValue === '') {
            return;
        }

        // 如果已经在下载或升级中，则不处理
        if (this.isDownloading || this.isUpgrading) {
            alert('正在下载固件或升级中，请稍候...');
            selectElement.value = '';
            return;
        }

        this.isDownloading = true;
        
        try {
            // 显示下载提示
            this.updateProgress(-1, 100, '正在下载固件...');
            
            // 从GitHub下载固件
            await this.fetchFirmwareFromGitHub();
            
            // 下载完成
            this.updateProgress(0, 100, '固件已准备好，点击"升级固件"开始升级');
            
        } catch (error) {
            console.error('下载固件失败:', error);
            alert('下载固件失败: ' + error.message);
            selectElement.value = '';
        } finally {
            this.isDownloading = false;
        }
    }

    // 从GitHub下载固件（根据用户选择的固件动态下载）
    async fetchFirmwareFromGitHub() {
        const firmwareSelect = document.getElementById('firmware-select');
        const selectedValue = firmwareSelect ? firmwareSelect.value : '';

        if (!selectedValue || !this.firmwareList[selectedValue]) {
            throw new Error('请先从下拉框选择有效的固件');
        }

        const firmwareInfo = this.firmwareList[selectedValue];
        const fileName = firmwareInfo.fileName;
        const url = `https://raw.githubusercontent.com/${this.githubRepo}/${this.githubBranch}/${fileName}`;
        
        console.log('正在从GitHub下载固件:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`下载失败: ${response.status} ${response.statusText}`);
        }
        
        // 获取二进制数据
        this.fileData = await response.arrayBuffer();
        
        // 计算100字节块的数量
        const chunkSize100 = 100;
        this.totalChunks = Math.ceil(this.fileData.byteLength / chunkSize100);
        
        console.log('固件下载完成');
        console.log('固件大小:', this.fileData.byteLength, '字节');
        console.log('100字节块数量:', this.totalChunks);
        
        // 存储文件名
        this.selectedFile = {
            name: fileName,
            size: this.fileData.byteLength
        };
    }

    // 开始升级
    async startUpgrade() {
        console.log('点击了升级固件按钮');
        console.log('selectedFile:', this.selectedFile);
        console.log('fileData:', this.fileData);
        console.log('bluetoothManager:', this.bluetoothManager);
        console.log('connected:', this.bluetoothManager ? this.bluetoothManager.connected : 'null');
        console.log('isUpgrading:', this.isUpgrading);
        
        if (!this.selectedFile || !this.fileData) {
            alert('请先从下拉框选择固件文件');
            return;
        }

        if (!this.bluetoothManager || !this.bluetoothManager.connected) {
            alert('请先连接蓝牙设备');
            return;
        }

        if (this.isUpgrading) {
            alert('固件升级正在进行中，请稍候...');
            return;
        }

        this.isUpgrading = true;
        
        // 显示取消升级按钮
        this.showCancelButton();

        // 计算100字节块的数量
        const chunkSize = 100;
        const total100ByteChunks = Math.ceil(this.fileData.byteLength / chunkSize);
        
        try {
            console.log('固件大小:', this.fileData.byteLength, '字节');
            console.log('100字节块数量:', total100ByteChunks);

            // 发送升级开始命令（告诉设备100字节块的数量）
            const startCommand = `##${total100ByteChunks}\r\n`;
            console.log('发送升级开始命令:', startCommand);
            
            await this.bluetoothManager.sendData(startCommand);
            console.log('升级开始命令已发送');

            // 更新进度显示
            this.updateProgress(0, this.totalChunks);
            
            // 移除alert，避免阻塞操作
            // alert('固件升级已启动，等待设备请求数据块...');

        } catch (error) {
            console.error('固件升级启动失败:', error);
            alert('固件升级启动失败: ' + error.message);
            this.isUpgrading = false;
            this.hideCancelButton();
        }
    }

    // 处理设备的数据块请求（使用队列机制）
    async handleBinRequest(chunkIndex) {
        if (!this.isUpgrading || !this.fileData) {
            console.error('固件升级未启动或文件数据未加载');
            return;
        }

        // 检查索引是否有效
        if (chunkIndex < 1 || chunkIndex > this.totalChunks) {
            console.error('请求的数据块索引超出范围:', chunkIndex);
            return;
        }

        // 添加到请求队列
        this.requestQueue.push(chunkIndex);
        
        // 如果当前没有正在发送的数据，开始处理队列
        if (!this.isSending) {
            await this.processRequestQueue();
        }
    }

    // 处理请求队列（发送100字节块，每个块都附加CRC32）
    async processRequestQueue() {
        this.isSending = true;
        
        while (this.requestQueue.length > 0) {
            // 获取队列中的第一个请求
            const chunkIndex = this.requestQueue.shift();
            
            // 计算100字节块的数量
            const chunkSize100 = 100;
            const total100ByteChunks = Math.ceil(this.fileData.byteLength / chunkSize100);
            
            try {
                // 计算数据块的起始和结束位置
                const start = (chunkIndex - 1) * chunkSize100;
                const end = Math.min(start + chunkSize100, this.fileData.byteLength);

                const chunk = this.fileData.slice(start, end);
                
                // 判断是否是最后一个块
                const isLastChunk = (chunkIndex >= total100ByteChunks);
                
                // 发送100字节块（每个块都附加CRC32）
                await this.sendChunk100(chunk, chunkIndex, total100ByteChunks, isLastChunk);
                
                // 更新进度
                this.updateProgress(chunkIndex, total100ByteChunks);

                // 检查是否完成
                if (isLastChunk) {
                    this.isUpgrading = false;
                    this.hideCancelButton();
                    alert('固件升级完成！');
                    console.log('固件升级完成');
                }

            } catch (error) {
                console.error('发送数据块失败:', error);
                // 不弹窗，避免干扰升级流程
            }
        }
        
        this.isSending = false;
    }
    
    // 发送100字节块（每个块后面接2字节块号+2字节求和，一次性发送104字节）
    async sendChunk100(chunk, chunkIndex, totalChunks, isLastChunk) {
        if (!this.bluetoothManager || !this.bluetoothManager.characteristic) {
            throw new Error('蓝牙连接已断开');
        }

        // 将ArrayBuffer转换为字节数组
        let chunkArray = new Uint8Array(chunk);
        
        // 如果不足100字节，用0xff补齐
        if (chunkArray.length < 100) {
            const paddedArray = new Uint8Array(100);
            paddedArray.fill(0xFF);
            paddedArray.set(chunkArray);
            chunkArray = paddedArray;
        }
        
        // 计算当前100字节块的求和（2字节表示）
        let sum = 0;
        for (let i = 0; i < chunkArray.length; i++) {
            sum += chunkArray[i];
        }
        sum = sum & 0xFFFF; // 限制在2字节范围内
        
        // 将块号转换为2字节（大端序）
        const chunkNumberBytes = new Uint8Array(2);
        chunkNumberBytes[0] = (chunkIndex >> 8) & 0xFF;
        chunkNumberBytes[1] = chunkIndex & 0xFF;
        
        // 将求和转换为2字节（大端序）
        const sumBytes = new Uint8Array(2);
        sumBytes[0] = (sum >> 8) & 0xFF;
        sumBytes[1] = sum & 0xFF;
        
        // 将100字节数据 + 2字节块号 + 2字节求和组合
        const dataToSend = new Uint8Array(100 + 2 + 2);
        dataToSend.set(chunkArray);
        dataToSend.set(chunkNumberBytes, 100);
        dataToSend.set(sumBytes, 102);
        
        // 调试信息
        console.log(`发送块 ${chunkIndex}: 数据[0]=0x${chunkArray[0].toString(16).padStart(2, '0')}, 数据[99]=0x${chunkArray[99].toString(16).padStart(2, '0')}`);
        console.log(`发送块 ${chunkIndex}: 块号=0x${chunkNumberBytes[0].toString(16).padStart(2, '0')}${chunkNumberBytes[1].toString(16).padStart(2, '0')} (${chunkIndex})`);
        console.log(`发送块 ${chunkIndex}: 求和=0x${sumBytes[0].toString(16).padStart(2, '0')}${sumBytes[1].toString(16).padStart(2, '0')} (${sum})`);
        console.log(`发送100字节块 ${chunkIndex}/${totalChunks} + 2字节块号 + 2字节求和（共104字节）`);
        
        // 直接发送104字节（不分割）
        await this.sendDataInChunks(dataToSend, dataToSend.length);
    }
    
    // 计算整个固件的CRC32（对所有100字节块数据）
    calculateFullCrc32() {
        const chunkSize100 = 100;
        const totalChunks = Math.ceil(this.fileData.byteLength / chunkSize100);
        
        // 创建一个数组存储所有补齐后的100字节块
        const allData = new Uint8Array(totalChunks * chunkSize100);
        
        // 复制并补齐所有数据块
        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize100;
            const end = Math.min(start + chunkSize100, this.fileData.byteLength);
            const chunk = new Uint8Array(this.fileData.slice(start, end));
            
            // 复制到对应位置
            allData.set(chunk, i * chunkSize100);
            
            // 如果不足100字节，补0xFF（已经在初始化时处理了）
        }
        
        // 计算CRC32
        let crc = 0xFFFFFFFF;
        const polynomial = 0xEDB88320;
        
        for (let i = 0; i < allData.length; i++) {
            crc ^= allData[i];
            for (let j = 0; j < 8; j++) {
                crc = (crc >> 1) ^ ((crc & 1) ? polynomial : 0);
            }
        }
        
        // 取反并转换为大端序的字节数组
        crc = ~crc;
        const crcBytes = new Uint8Array(4);
        crcBytes[0] = (crc >> 24) & 0xFF;
        crcBytes[1] = (crc >> 16) & 0xFF;
        crcBytes[2] = (crc >> 8) & 0xFF;
        crcBytes[3] = crc & 0xFF;
        
        return crcBytes;
    }
    
    // 分块发送数据
    async sendDataInChunks(data, chunkSize) {
        const maxRetries = 3;
        
        for (let i = 0; i < data.length; i += chunkSize) {
            const end = Math.min(i + chunkSize, data.length);
            const slice = data.slice(i, end);
            
            let success = false;
            let retries = 0;
            
            while (!success && retries < maxRetries) {
                try {
                    // 检查连接状态
                    if (!this.bluetoothManager.connected) {
                        throw new Error('蓝牙连接已断开');
                    }
                    
                    // 发送数据（直接发送Uint8Array，不经过字符串转换）
                    try {
                        await this.bluetoothManager.characteristic.writeValueWithResponse(slice);
                    } catch (e) {
                        await this.bluetoothManager.characteristic.writeValue(slice);
                    }
                    
                    success = true;
                } catch (error) {
                    retries++;
                    console.warn(`发送失败，重试 ${retries}/${maxRetries}:`, error.message);
                    
                    if (retries < maxRetries) {
                        await this.sleep(50);
                    }
                }
            }
            
            if (!success) {
                // 尝试重新连接蓝牙
                console.log('尝试重新连接蓝牙...');
                if (await this.reconnectBluetooth()) {
                    console.log('重新连接成功，继续发送...');
                    try {
                        await this.bluetoothManager.characteristic.writeValueWithResponse(slice);
                    } catch (e) {
                        await this.bluetoothManager.characteristic.writeValue(slice);
                    }
                } else {
                    throw new Error(`发送失败，已重试 ${maxRetries} 次`);
                }
            }
            
            // 发送每块后延迟，给设备处理时间
            await this.sleep(30);
        }
    }

    // 计算CRC32校验值
    crc32(data) {
        let crc = 0xFFFFFFFF;
        const polynomial = 0xEDB88320;
        
        for (let i = 0; i < data.length; i++) {
            crc ^= data[i];
            for (let j = 0; j < 8; j++) {
                crc = (crc >> 1) ^ ((crc & 1) ? polynomial : 0);
            }
        }
        
        // 取反并转换为大端序的字节数组
        crc = ~crc;
        const crcBytes = new Uint8Array(4);
        crcBytes[0] = (crc >> 24) & 0xFF;
        crcBytes[1] = (crc >> 16) & 0xFF;
        crcBytes[2] = (crc >> 8) & 0xFF;
        crcBytes[3] = crc & 0xFF;
        
        return crcBytes;
    }

    // 取消升级
    async cancelUpgrade() {
        this.isUpgrading = false;
        
        // 清空请求队列，防止继续发送
        this.requestQueue = [];
        
        // 如果正在发送数据，等待发送完成
        if (this.isSending) {
            console.log('等待当前发送完成...');
            while (this.isSending) {
                await this.sleep(10);
            }
        }
        
        // 发送取消命令给设备
        if (this.bluetoothManager && this.bluetoothManager.connected) {
            try {
                const cancelCommand = '##000\r\n';
                console.log('发送取消升级命令:', cancelCommand);
                await this.bluetoothManager.sendData(cancelCommand);
            } catch (error) {
                console.error('发送取消命令失败:', error);
            }
        }
        
        this.hideCancelButton();
        this.updateProgress(0, 100, '固件升级已取消');
        console.log('固件升级已取消');
    }

    // 重新连接蓝牙（重新获取服务和特征）
    async reconnectBluetooth() {
        if (!this.bluetoothManager || !this.bluetoothManager.device) {
            console.error('无法重新连接：没有蓝牙设备');
            return false;
        }

        try {
            // 尝试重新连接GATT服务器
            const server = await this.bluetoothManager.device.gatt.connect();
            console.log('蓝牙GATT服务器重新连接成功');
            
            // 重新获取服务
            const service = await server.getPrimaryService(this.bluetoothManager.SERVICE_UUID);
            console.log('服务重新获取成功');
            
            // 重新获取特征
            this.bluetoothManager.characteristic = await service.getCharacteristic(this.bluetoothManager.CHARACTERISTIC_UUID);
            console.log('特征重新获取成功');
            
            // 重新启用通知
            await this.bluetoothManager.characteristic.startNotifications();
            console.log('通知重新启用成功');
            
            return true;
        } catch (error) {
            console.error('蓝牙重新连接失败:', error);
            return false;
        }
    }

    // 更新进度
    updateProgress(current, total, message) {
        const progressElement = document.getElementById('upgrade-progress');
        if (!progressElement) return;
        
        // 如果提供了自定义消息
        if (message) {
            progressElement.textContent = message;
            return;
        }
        
        // 如果current为-1，表示正在下载
        if (current === -1) {
            progressElement.textContent = '正在下载固件...';
            return;
        }
        
        // 计算进度百分比
        const progress = Math.round((current / total) * 100);
        console.log(`升级进度: ${progress}%`);
        
        // 更新UI显示进度
        progressElement.textContent = `升级进度: ${current}/${total} (${progress}%)`;
    }

    // 休眠函数
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 创建全局实例
const firmwareUpgrade = new FirmwareUpgrade();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    firmwareUpgrade.init();
});
