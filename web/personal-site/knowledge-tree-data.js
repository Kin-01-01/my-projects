/* ============================================================
   零度栈 · 知识树数据端口（接口契约）
   ------------------------------------------------------------
   渲染层（index.html 内嵌区块 / knowledge-tree.html）只通过本端口读取数据，不内置任何
   业务数据。打通方式：在渲染页用 <script src> 引入本文件，
   渲染层读取 window.ZeroStack.knowledgeTree 即可。
   如需换数据源（后端 API / CMS），只要保证导出同结构对象，
   渲染层无需改动。

   节点字段：
     name    : 显示名（必填）
     children: 子节点数组（有则为分支，无则为叶子）
     status  : 'learning' 表示正在学习（整条分支高亮）；缺省为未学习
     href    : 叶子节点点击跳转的笔记页（缺省 content.html#showcase）
   ============================================================ */
(function () {
  "use strict";
  window.ZeroStack = window.ZeroStack || {};

  var NOTES = "content.html#showcase";
  function leaf(name, href) { return { name: name, href: href || NOTES }; }

  window.ZeroStack.knowledgeTree = {
    name: "计算机科学",
    children: [
      {
        name: "编程基础",
        children: [
          { name: "Python", status: "learning" },
          { name: "C / C++" },
          { name: "Java" },
          { name: "Go" },
          { name: "编程范式", children: [ leaf("面向对象"), leaf("函数式"), leaf("泛型与元编程") ] }
        ]
      },
      {
        name: "数据结构与算法",
        children: [
          { name: "线性结构", children: [ leaf("数组"), leaf("链表"), leaf("栈"), leaf("队列") ] },
          { name: "树与图", children: [ leaf("二叉树"), leaf("堆"), leaf("并查集"), leaf("最短路径") ] },
          { name: "哈希", children: [ leaf("哈希表"), leaf("一致性哈希") ] },
          { name: "排序与查找", children: [ leaf("快排"), leaf("归并"), leaf("二分") ] },
          { name: "动态规划" },
          { name: "算法设计", children: [ leaf("分治"), leaf("贪心"), leaf("回溯") ] }
        ]
      },
      {
        name: "计算机组成原理",
        children: [
          { name: "数据表示", children: [ leaf("原码补码"), leaf("浮点") ] },
          { name: "CPU 与指令集", children: [ leaf("流水线"), leaf("SIMD") ] },
          { name: "存储层次", children: [ leaf("缓存"), leaf("虚拟内存") ] },
          { name: "总线与 I/O" }
        ]
      },
      {
        name: "操作系统",
        children: [
          { name: "进程与线程" },
          { name: "内存管理", children: [ leaf("分页"), leaf("分段"), leaf("内存映射") ] },
          { name: "文件系统" },
          { name: "并发与锁", children: [ leaf("互斥"), leaf("死锁"), leaf("无锁") ] },
          { name: "调度" }
        ]
      },
      {
        name: "计算机网络",
        children: [
          { name: "TCP / IP", children: [ leaf("三次握手"), leaf("拥塞控制") ] },
          { name: "HTTP / HTTPS", children: [ leaf("TLS"), leaf("REST") ] },
          { name: "DNS" },
          { name: "网络安全基础", children: [ leaf("对称加密"), leaf("非对称加密") ] }
        ]
      },
      {
        name: "数据库",
        status: "learning",
        children: [
          { name: "SQL" },
          { name: "关系模型与范式", children: [ leaf("1NF-3NF"), leaf("BCNF") ] },
          { name: "索引与事务", children: [ leaf("B+ 树"), leaf("ACID"), leaf("隔离级别") ] },
          { name: "NoSQL", children: [ leaf("文档型"), leaf("KV 存储"), leaf("列族") ] }
        ]
      },
      {
        name: "Web 前端",
        status: "learning",
        children: [
          { name: "HTML / CSS" },
          { name: "JavaScript", children: [ leaf("原型链"), leaf("事件循环"), leaf("异步") ] },
          { name: "框架", children: [ leaf("React"), leaf("Vue") ] },
          { name: "工程化", children: [ leaf("打包"), leaf("构建"), leaf("Monorepo") ] },
          { name: "浏览器原理", children: [ leaf("渲染管线"), leaf("重排重绘") ] }
        ]
      },
      {
        name: "后端开发",
        children: [
          { name: "Node.js" },
          { name: "Python 后端", children: [ leaf("Django"), leaf("Flask"), leaf("FastAPI") ] },
          { name: "微服务", children: [ leaf("服务发现"), leaf("网关") ] },
          { name: "API 设计", children: [ leaf("gRPC"), leaf("GraphQL") ] },
          { name: "消息队列", children: [ leaf("Kafka"), leaf("RabbitMQ") ] }
        ]
      },
      {
        name: "移动开发",
        children: [
          { name: "微信小程序", status: "learning" },
          { name: "Android", children: [ leaf("Kotlin"), leaf("Jetpack") ] },
          { name: "iOS", children: [ leaf("Swift"), leaf("SwiftUI") ] },
          { name: "跨端", children: [ leaf("Flutter"), leaf("React Native") ] }
        ]
      },
      {
        name: "机器学习与人工智能",
        children: [
          { name: "数学基础", children: [ leaf("线代"), leaf("概率"), leaf("微积分") ] },
          { name: "机器学习基础", children: [ leaf("监督学习"), leaf("无监督学习"), leaf("评估指标") ] },
          { name: "深度学习", children: [ leaf("CNN"), leaf("RNN"), leaf("Transformer") ] },
          { name: "NLP" },
          { name: "计算机视觉" },
          { name: "强化学习" }
        ]
      },
      {
        name: "数学基础",
        children: [
          { name: "离散数学", children: [ leaf("集合"), leaf("图论"), leaf("逻辑") ] },
          { name: "线性代数" },
          { name: "概率统计" },
          { name: "微积分" }
        ]
      },
      {
        name: "软件工程",
        children: [
          { name: "设计模式", children: [ leaf("创建型"), leaf("结构型"), leaf("行为型") ] },
          { name: "版本控制", children: [ leaf("Git"), leaf("分支策略") ] },
          { name: "测试", children: [ leaf("单元"), leaf("集成"), leaf("E2E") ] },
          { name: "CI / CD" },
          { name: "敏捷开发" }
        ]
      },
      { name: "编译原理", children: [ { name: "词法 / 语法分析" }, { name: "语义分析" }, { name: "代码生成" }, { name: "优化" } ] },
      {
        name: "分布式系统",
        children: [
          { name: "一致性", children: [ leaf("Raft"), leaf("Paxos") ] },
          { name: "容错", children: [ leaf("副本"), leaf("熔断") ] },
          { name: "分布式存储", children: [ leaf("分片"), leaf("一致性哈希") ] }
        ]
      },
      {
        name: "计算机安全",
        children: [
          { name: "密码学基础", children: [ leaf("哈希"), leaf("签名") ] },
          { name: "Web 安全", children: [ leaf("XSS"), leaf("CSRF"), leaf("注入") ] },
          { name: "系统安全" }
        ]
      },
      {
        name: "图形学与游戏",
        children: [ { name: "渲染管线" }, { name: "几何与光照", children: [ leaf("光栅化"), leaf("光线追踪") ] } ]
      }
    ]
  };
})();
