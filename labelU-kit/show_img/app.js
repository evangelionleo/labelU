class SAM2ImageSegmentation {
    constructor() {
        this.sessionId = null;
        this.currentImage = null;
        this.imageElement = null;
        this.canvas = null;
        this.ctx = null;
        this.points = [];
        this.masks = [];
        this.apiBaseUrl = 'http://localhost:5000'; // SAM2后端API地址
        
        // 多对象标注支持
        this.currentObjectId = 1;
        this.objectsData = {}; // 存储所有对象的数据 {objectId: {points: [], masks: [], bbox: []}}
        
        this.initializeElements();
        this.bindEvents();
        this.updateStatus('应用已加载，请上传图片开始使用');
    }

    initializeElements() {
        // 获取DOM元素
        this.fileInput = document.getElementById('fileInput');
        this.uploadArea = document.getElementById('uploadArea');
        this.imageWorkspace = document.getElementById('imageWorkspace');
        this.uploadedImage = document.getElementById('uploadedImage');
        this.overlayCanvas = document.getElementById('overlayCanvas');
        this.statusDisplay = document.getElementById('statusDisplay');
        this.coordinatesDisplay = document.getElementById('coordinatesDisplay');
        this.resultDisplay = document.getElementById('resultDisplay');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.errorMessage = document.getElementById('errorMessage');
        this.successMessage = document.getElementById('successMessage');
        
        // 按钮元素
        this.startSessionBtn = document.getElementById('startSessionBtn');
        this.clearPointsBtn = document.getElementById('clearPointsBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.nextObjectBtn = document.getElementById('nextObjectBtn');
        this.exportBtn = document.getElementById('exportBtn');
        
        // 对象显示元素
        this.currentObjectDisplay = document.getElementById('currentObjectDisplay');
        
        // 设置canvas上下文
        this.canvas = this.overlayCanvas;
        this.ctx = this.canvas.getContext('2d');
    }

    bindEvents() {
        // 文件上传相关事件
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        this.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        
        // 图片点击事件
        this.uploadedImage.addEventListener('click', this.handleImageClick.bind(this));
        this.uploadedImage.addEventListener('load', this.handleImageLoad.bind(this));
        
        // 按钮事件
        this.startSessionBtn.addEventListener('click', this.startSession.bind(this));
        this.clearPointsBtn.addEventListener('click', this.clearPoints.bind(this));
        this.resetBtn.addEventListener('click', this.resetApplication.bind(this));
        this.nextObjectBtn.addEventListener('click', this.nextObject.bind(this));
        this.exportBtn.addEventListener('click', this.exportAnnotations.bind(this));
    }

    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    processFile(file) {
        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            this.showError('请选择图片文件 (JPG, PNG, GIF)');
            return;
        }

        // 验证文件大小 (10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showError('文件大小不能超过 10MB');
            return;
        }

        this.currentImage = file;
        this.loadImage(file);
        this.updateStatus('图片已加载，点击"开始分割会话"进行初始化');
        this.startSessionBtn.disabled = false;
        this.updateCurrentObjectDisplay();
    }

    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.uploadedImage.src = e.target.result;
            this.imageWorkspace.style.display = 'grid';
            this.hideMessages();
        };
        reader.readAsDataURL(file);
    }

    handleImageLoad() {
        // 设置canvas尺寸与图片匹配
        const rect = this.uploadedImage.getBoundingClientRect();
        this.canvas.width = this.uploadedImage.naturalWidth;
        this.canvas.height = this.uploadedImage.naturalHeight;
        this.canvas.style.width = this.uploadedImage.clientWidth + 'px';
        this.canvas.style.height = this.uploadedImage.clientHeight + 'px';
        
        this.clearCanvas();
        this.updateStatus('图片已加载完成，分辨率: ' + this.canvas.width + 'x' + this.canvas.height);
    }

    async handleImageClick(e) {
        if (!this.sessionId) {
            this.showError('请先点击"开始分割会话"按钮');
            return;
        }

        const rect = this.uploadedImage.getBoundingClientRect();
        const scaleX = this.uploadedImage.naturalWidth / this.uploadedImage.clientWidth;
        const scaleY = this.uploadedImage.naturalHeight / this.uploadedImage.clientHeight;
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        this.updateCoordinates(x, y);
        await this.addPointAndSegment(x, y);
    }

    async startSession() {
        if (!this.currentImage) {
            this.showError('请先上传图片');
            return;
        }

        this.showLoading();
        this.updateStatus('正在上传图片...');

        try {
            // 首先上传图片到服务器
            const formData = new FormData();
            formData.append('file', this.currentImage);

            const uploadResponse = await fetch(`${this.apiBaseUrl}/api/upload`, {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error('图片上传失败');
            }

            const uploadResult = await uploadResponse.json();
            this.updateStatus('图片上传成功，正在初始化分割会话...');

            // 开始分割会话
            const sessionResponse = await fetch(`${this.apiBaseUrl}/api/start_session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image_path: uploadResult.path
                })
            });

            if (!sessionResponse.ok) {
                throw new Error('创建会话失败');
            }

            const sessionResult = await sessionResponse.json();
            this.sessionId = sessionResult.session_id;
            this.updateStatus('分割会话已启动，SessionID: ' + this.sessionId);
            this.showSuccess('会话启动成功！现在可以点击图片进行分割');
            
            this.startSessionBtn.disabled = true;
            this.clearPointsBtn.disabled = false;
            this.nextObjectBtn.disabled = false;
            this.exportBtn.disabled = false;

        } catch (error) {
            this.showError('启动会话失败: ' + error.message);
            this.updateStatus('会话启动失败');
        } finally {
            this.hideLoading();
        }
    }

    async addPointAndSegment(x, y) {
        if (!this.sessionId) {
            this.showError('请先启动分割会话');
            return;
        }

        this.showLoading();
        this.updateStatus('正在进行分割...');

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/add_point`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    point: [x, y],
                    label: 1, // 1表示前景点
                    clear_previous: false
                })
            });

            if (!response.ok) {
                throw new Error('分割请求失败');
            }

            const result = await response.json();
            this.points.push({x, y, label: 1});
            
            // 渲染点
            this.drawPoint(x, y);
            
            if (result.mask) {
                await this.renderMask(result.mask);
                await this.renderBoundingBox(result.bbox);
                this.updateResultDisplay(result);
                this.showSuccess('分割完成！');
            }

            this.updateStatus(`已添加点 (${Math.round(x)}, ${Math.round(y)})，共 ${result.total_points} 个点`);

        } catch (error) {
            this.showError('分割失败: ' + error.message);
            this.updateStatus('分割操作失败');
        } finally {
            this.hideLoading();
        }
    }

    async renderMask(mask) {
        // 解码RLE格式的掩码并渲染
        try {
            const decodedMask = this.decodeMask(mask);
            this.drawMask(decodedMask);
            this.drawBoundingBox(decodedMask);
        } catch (error) {
            console.error('渲染掩码失败:', error);
        }
    }

    decodeMask(mask) {
        // 解码掩码数据（支持RLE和base64格式）
        const [height, width] = mask.size;
        const encodedData = mask.counts;
        
        try {
            // 尝试解码COCO RLE格式（如果是数字字符串）
            if (typeof encodedData === 'string' && !encodedData.includes('=')) {
                // 这是COCO RLE格式
                return this.decodeCocoRLE(encodedData, height, width);
            } else {
                // 这是base64编码的原始数据
                const binaryString = atob(encodedData);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                return {
                    width: width,
                    height: height,
                    data: bytes
                };
            }
        } catch (error) {
            console.error('掩码解码失败:', error);
            // 返回空掩码
            return {
                width: width,
                height: height,
                data: new Uint8Array(width * height)
            };
        }
    }

    decodeCocoRLE(rleString, height, width) {
        // 简化的COCO RLE解码
        try {
            const counts = rleString.split(' ').map(x => parseInt(x));
            const decoded = new Uint8Array(height * width);
            
            let pos = 0;
            let value = 0; // 从0开始（背景）
            
            for (let i = 0; i < counts.length; i++) {
                const count = counts[i];
                for (let j = 0; j < count; j++) {
                    if (pos < decoded.length) {
                        decoded[pos] = value;
                        pos++;
                    }
                }
                value = 1 - value; // 切换0和1
            }
            
            return {
                width: width,
                height: height,
                data: decoded
            };
        } catch (error) {
            console.error('COCO RLE解码失败:', error);
            return {
                width: width,
                height: height,
                data: new Uint8Array(width * height)
            };
        }
    }

    drawMask(decodedMask) {
        // 绘制半透明的分割掩码
        const maskData = decodedMask.data;
        const maskWidth = decodedMask.width;
        const maskHeight = decodedMask.height;
        
        console.log('绘制掩码:', maskWidth, 'x', maskHeight, '数据长度:', maskData.length);
        
        // 创建临时canvas来绘制掩码
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = maskWidth;
        tempCanvas.height = maskHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        // 在临时canvas上绘制掩码
        const tempImageData = tempCtx.createImageData(maskWidth, maskHeight);
        
        for (let i = 0; i < maskData.length; i++) {
            if (maskData[i] > 0) {
                const pixelIndex = i * 4;
                tempImageData.data[pixelIndex] = 0;     // R - 蓝色
                tempImageData.data[pixelIndex + 1] = 150;   // G
                tempImageData.data[pixelIndex + 2] = 255;   // B
                tempImageData.data[pixelIndex + 3] = 120; // A (透明度)
            } else {
                const pixelIndex = i * 4;
                tempImageData.data[pixelIndex + 3] = 0; // 完全透明
            }
        }
        
        tempCtx.putImageData(tempImageData, 0, 0);
        
        // 将临时canvas绘制到主canvas上，支持透明度混合
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.drawImage(tempCanvas, 0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
        
        console.log('掩码绘制完成');
    }

    async renderBoundingBox(bbox) {
        if (!bbox || bbox.length !== 4) return;
        
        // 绘制边界框
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]); // 虚线效果
        
        const [x1, y1, x2, y2] = bbox;
        const width = x2 - x1;
        const height = y2 - y1;
        
        this.ctx.strokeRect(x1, y1, width, height);
        this.ctx.setLineDash([]); // 重置虚线
        
        // 绘制角标
        this.ctx.fillStyle = '#ff0000';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`${width}×${height}`, x1, y1 - 5);
    }

    renderPoint(x, y, isPositive = true) {
        const scaleX = this.canvas.style.width ? 
            this.canvas.clientWidth / this.canvas.width : 1;
        const scaleY = this.canvas.style.height ? 
            this.canvas.clientHeight / this.canvas.height : 1;

        this.ctx.save();
        this.ctx.scale(1, 1); // 使用原始尺寸绘制
        
        // 绘制点
        this.ctx.fillStyle = isPositive ? '#00ff00' : '#ff0000';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, 8, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.stroke();
        
        // 绘制十字标记
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x - 12, y);
        this.ctx.lineTo(x + 12, y);
        this.ctx.moveTo(x, y - 12);
        this.ctx.lineTo(x, y + 12);
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    async clearPoints() {
        if (!this.sessionId) {
            this.showError('请先启动分割会话');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/clear_points`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: this.sessionId
                })
            });

            if (response.ok) {
                // 清除当前对象的数据
                this.points = [];
                this.masks = [];
                
                this.updateCoordinates(null, null);
                this.updateStatus(`已清除对象 #${this.currentObjectId} 的所有点`);
                this.resultDisplay.textContent = '暂无结果';
                this.showSuccess(`已清除对象 #${this.currentObjectId} 的所有点`);
            }
        } catch (error) {
            this.showError('清除点失败: ' + error.message);
        }
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    async nextObject() {
        if (!this.sessionId) {
            this.showError('请先启动分割会话');
            return;
        }

        // 保存当前对象的分割结果（如果有的话）
        if (this.points.length > 0) {
            this.objectsData[this.currentObjectId] = {
                points: [...this.points],
                masks: [...this.masks],
                // 保存当前canvas上已渲染的内容
                rendered: true
            };
        }

        // 清除后端的点数据（重置服务器端状态）
        try {
            await fetch(`${this.apiBaseUrl}/api/clear_points`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: this.sessionId
                })
            });
        } catch (error) {
            console.log('清除后端点数据失败:', error);
        }

        // 切换到下一个对象
        this.currentObjectId++;
        this.points = []; // 只清除标记点，不清除已渲染的视觉内容
        this.masks = [];
        
        // 更新显示
        this.updateCurrentObjectDisplay();
        this.updateCoordinates(null, null);
        this.updateStatus(`开始标注对象 #${this.currentObjectId}，之前的分割结果已保留`);
        this.showSuccess(`切换到对象 #${this.currentObjectId}`);
        
        // 注意：不调用clearCanvas()和redrawAllObjects()，保留已渲染的bbox和掩码
    }

    updateCurrentObjectDisplay() {
        this.currentObjectDisplay.textContent = `对象 #${this.currentObjectId}`;
    }

    redrawAllObjects() {
        // 先清空画布
        this.clearCanvas();
        
        // 重新绘制所有已完成的对象
        Object.keys(this.objectsData).forEach((objectId, index) => {
            const objectData = this.objectsData[objectId];
            if (objectData.points && objectData.points.length > 0) {
                this.drawObjectPoints(objectData.points, index);
            }
        });
        
        // 绘制当前对象的点
        if (this.points.length > 0) {
            this.drawObjectPoints(this.points, Object.keys(this.objectsData).length);
        }
    }

    drawObjectPoints(points, colorIndex) {
        // 为不同对象使用不同颜色
        const colors = ['#00ff00', '#ff0000', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
        const color = colors[colorIndex % colors.length];
        
        points.forEach(point => {
            this.drawPoint(point.x, point.y, color);
        });
    }

    drawPoint(x, y, color = '#00ff00') {
        this.ctx.save();
        
        // 绘制点
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, 8, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.stroke();
        
        // 绘制十字标记
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x - 12, y);
        this.ctx.lineTo(x + 12, y);
        this.ctx.moveTo(x, y - 12);
        this.ctx.lineTo(x, y + 12);
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    resetApplication() {
        this.sessionId = null;
        this.currentImage = null;
        this.points = [];
        this.masks = [];
        
        // 重置多对象数据
        this.currentObjectId = 1;
        this.objectsData = {};
        
        this.imageWorkspace.style.display = 'none';
        this.fileInput.value = '';
        this.startSessionBtn.disabled = true;
        this.clearPointsBtn.disabled = true;
        this.nextObjectBtn.disabled = true;
        this.exportBtn.disabled = true;
        
        this.updateStatus('应用已重置，请重新上传图片');
        this.updateCoordinates(null, null);
        this.updateCurrentObjectDisplay();
        this.resultDisplay.textContent = '暂无结果';
        this.hideMessages();
    }



    updateStatus(message) {
        this.statusDisplay.textContent = message;
        console.log('Status:', message);
    }

    updateCoordinates(x, y) {
        if (x !== null && y !== null) {
            this.coordinatesDisplay.textContent = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;
        } else {
            this.coordinatesDisplay.textContent = '未选择位置';
        }
    }

    updateResultDisplay(result) {
        if (result && result.mask) {
            const [height, width] = result.mask.size;
            const bbox = result.bbox || [0, 0, 0, 0];
            const bboxWidth = bbox[2] - bbox[0];
            const bboxHeight = bbox[3] - bbox[1];
            
            this.resultDisplay.innerHTML = `
                <strong>点击位置:</strong> (${Math.round(result.point[0])}, ${Math.round(result.point[1])})<br>
                <strong>掩码尺寸:</strong> ${width} × ${height}<br>
                <strong>边界框:</strong> ${bboxWidth} × ${bboxHeight}<br>
                <strong>总点数:</strong> ${result.total_points}<br>
                <strong>编码长度:</strong> ${result.mask.counts.length}
            `;
        }
    }

    showLoading() {
        this.loadingIndicator.style.display = 'block';
    }

    hideLoading() {
        this.loadingIndicator.style.display = 'none';
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        this.successMessage.style.display = 'none';
        setTimeout(() => this.hideMessages(), 5000);
    }

    showSuccess(message) {
        this.successMessage.textContent = message;
        this.successMessage.style.display = 'block';
        this.errorMessage.style.display = 'none';
        setTimeout(() => this.hideMessages(), 3000);
    }

    hideMessages() {
        this.errorMessage.style.display = 'none';
        this.successMessage.style.display = 'none';
    }

    async exportAnnotations() {
        if (!this.sessionId || !this.currentImage) {
            this.showError('请先上传图片并开始分割会话');
            return;
        }

        this.showLoading();
        
        try {
            // 保存当前对象的数据（如果有的话）
            if (this.points.length > 0) {
                this.objectsData[this.currentObjectId] = {
                    points: [...this.points],
                    masks: [...this.masks],
                    rendered: true
                };
            }

            // 获取图片的base64编码
            const imageBase64 = await this.getImageBase64();
            
            // 收集所有标注数据
            const annotationData = {
                session_id: this.sessionId,
                image_info: {
                    width: this.canvas.width,
                    height: this.canvas.height,
                    format: this.currentImage.type
                },
                objects: {}
            };

            // 添加所有对象的标注数据
            Object.keys(this.objectsData).forEach(objectId => {
                const objectData = this.objectsData[objectId];
                annotationData.objects[objectId] = {
                    points: objectData.points || [],
                    total_points: (objectData.points || []).length,
                    has_mask: (objectData.masks || []).length > 0
                };
            });

            // 如果当前对象有数据，也添加进去
            if (this.points.length > 0) {
                annotationData.objects[this.currentObjectId] = {
                    points: this.points,
                    total_points: this.points.length,
                    has_mask: this.masks.length > 0
                };
            }

            // 创建CSV格式的数据
            const csvData = this.createCSVData(imageBase64, annotationData);
            
            // 触发下载
            this.downloadCSV(csvData);
            
            this.showSuccess(`成功导出 ${Object.keys(annotationData.objects).length} 个对象的标注数据`);
            
        } catch (error) {
            this.showError('导出失败: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async getImageBase64() {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // 去掉data:image/...;base64,前缀，只保留base64数据
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(this.currentImage);
        });
    }

    createCSVData(imageBase64, annotationData) {
        const header = 'image_base64,annotation_json\n';
        const annotationJson = JSON.stringify(annotationData);
        
        // 转义JSON中的引号
        const escapedJson = annotationJson.replace(/"/g, '""');
        
        const row = `"${imageBase64}","${escapedJson}"\n`;
        
        return header + row;
    }

    downloadCSV(csvData) {
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        
        // 生成文件名（包含时间戳）
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        link.setAttribute('download', `sam2_annotations_${timestamp}.csv`);
        
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new SAM2ImageSegmentation();
});