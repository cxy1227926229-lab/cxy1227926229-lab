# Firebase实时同步配置说明

## 快速配置步骤

### 1. 创建Firebase项目

1. 访问 [Firebase Console](https://console.firebase.google.com/)
2. 点击"添加项目"或"创建项目"
3. 输入项目名称（如：ffxiv-roll-tool）
4. 按照提示完成项目创建

### 2. 启用Realtime Database

1. 在Firebase控制台中，点击左侧菜单的"Realtime Database"
2. 点击"创建数据库"
3. 选择位置（建议选择离您最近的区域，如asia-east1）
4. 选择"以测试模式启动"（开发阶段）或配置安全规则（生产环境）

### 3. 获取Firebase配置信息

1. 在Firebase控制台中，点击左侧菜单的"项目设置"（齿轮图标）
2. 滚动到"您的应用"部分
3. 如果没有应用，点击"添加应用" -> 选择"Web"（</>图标）
4. 注册应用后，您会看到Firebase配置信息，类似：

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com/",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### 4. 配置应用

打开 `src/firebase.ts` 文件，将上面的配置信息替换到 `firebaseConfig` 对象中。

### 5. 配置数据库规则（重要）

在Firebase控制台的Realtime Database中，点击"规则"标签，将规则设置为：

```json
{
  "rules": {
    "rollRecords": {
      ".read": true,
      ".write": true
    }
  }
}
```

**注意**：这是开发阶段的开放规则。生产环境建议配置更严格的规则，例如需要身份验证。

### 6. 重新构建和部署

配置完成后，重新构建项目：

```bash
npm install
npm run build
```

然后将构建后的文件部署到GitHub Pages。

## 功能说明

配置Firebase后，系统将实现：

- ✅ **跨设备实时同步**：管理员更新数据后，全国各地的店员都能实时看到最新数据
- ✅ **自动同步**：数据变化会自动同步到云端，所有设备实时更新
- ✅ **离线支持**：数据会同时保存到本地，即使Firebase暂时不可用也能正常工作
- ✅ **手动同步**：可以手动点击同步按钮获取最新数据

## 故障排除

### 如果Firebase未配置

系统会自动降级到本地存储模式，仅支持同一浏览器标签页之间的同步。

### 如果看到"Firebase配置未设置"警告

检查 `src/firebase.ts` 文件中的配置是否正确。

### 如果数据无法同步

1. 检查浏览器控制台是否有错误信息
2. 确认Firebase数据库规则是否正确配置
3. 确认网络连接正常

