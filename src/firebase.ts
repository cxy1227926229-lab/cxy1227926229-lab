import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, off, Database } from 'firebase/database';

// Firebase配置
// 注意：这是一个示例配置，实际使用时需要替换为您自己的Firebase项目配置
// 获取配置：Firebase Console -> Project Settings -> General -> Your apps -> Firebase SDK snippet
const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyReplaceWithYourOwn",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com/",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// 初始化Firebase
let app: ReturnType<typeof initializeApp> | null = null;
let database: Database | null = null;

// 初始化Firebase（如果配置有效）
try {
  // 检查配置是否有效（不是默认值）
  if (firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('DummyKey')) {
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
    console.log('✅ Firebase已初始化');
  } else {
    console.warn('⚠️ Firebase配置未设置，将使用本地存储模式');
  }
} catch (error) {
  console.error('Firebase初始化失败:', error);
}

export { database, ref, onValue, set, off };

