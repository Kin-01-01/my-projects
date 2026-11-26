# 事件循环：setTimeout 为什么不准时

```js
setTimeout(() => console.log('我应该 0 毫秒后执行'), 0);
// 实际可能要等几十毫秒，甚至更久
```

要解释这件事，得先接受一个前提：**JavaScript 是单线程的，但浏览器不是。**

## 三个角色

| 角色 | 负责什么 |
|---|---|
| **主线程** | 执行 JS 代码、渲染页面、处理 DOM |
| **任务队列** | 存放"该执行了"的回调 |
| **事件循环** | 不停地从队列里取任务，丢给主线程执行 |

关键规则：**主线程同一时刻只能做一件事。** 如果它正在跑一段死循环，那么渲染、点击响应、定时器全都停下来等——页面就"卡死"了。

所以 `setTimeout(fn, 0)` 里的 `0` 从来不是"马上执行"，而是"**至少 0 毫秒后可以排队**"。队排到了才能跑。

```js
setTimeout(() => console.log('timeout'), 0);

// 主线程被占用 1 秒
const start = Date.now();
while (Date.now() - start < 1000) {}

console.log('sync done');
```

输出顺序：

```
sync done      ← 同步代码先跑完
timeout        ← 1 秒之后才轮到定时器回调
```

`while` 循环在主线程里跑了一秒，定时器回调就算早就"到期"了，也只能在队列里干等。

## 宏任务与微任务

任务不是一种，是两种，而且优先级不同。

**微任务（microtask）**
- `Promise.then / catch / finally`
- `queueMicrotask()`
- `MutationObserver`

**宏任务（macrotask）**
- `setTimeout / setInterval`
- `setImmediate`（Node）
- I/O 回调
- UI 渲染（严格说是渲染时机，不完全是任务）

**执行规则**：每执行完一个宏任务，就把**微任务队列清空**，然后才轮到下一个宏任务。

## 一道面试题的完整推演

```js
console.log('1');

setTimeout(() => console.log('2'), 0);

Promise.resolve().then(() => console.log('3'));

console.log('4');
```

输出是 **1 → 4 → 3 → 2**。

逐步走一遍：

| 步骤 | 发生了什么 | 结果 |
|---|---|---|
| 1 | 执行同步代码 `console.log('1')` | 输出 1 |
| 2 | `setTimeout` 回调进入**宏任务队列** | — |
| 3 | `then` 回调进入**微任务队列** | — |
| 4 | 执行同步代码 `console.log('4')` | 输出 4 |
| 5 | 同步代码执行完，清空微任务队列 | 输出 3 |
| 6 | 微任务清空后，取下一个宏任务 | 输出 2 |

**记住一句话：同步代码 → 所有微任务 → 一个宏任务 → 所有微任务 → 下一个宏任务……**

## 微任务可以"饿死"渲染

既然微任务队列要一次性清空，那在微任务里继续产生微任务会怎样？

```js
function loop() {
  Promise.resolve().then(loop);   // 无限产生微任务
}
loop();
```

页面会**完全卡死**——因为微任务队列永远清不空，主线程永远轮不到渲染。

换成 `setTimeout` 递归就不会立刻卡死：

```js
function loop() {
  setTimeout(loop, 0);
}
loop();
```

每次都会先把控制权交回事件循环，浏览器有机会渲染，页面还能响应（虽然也占满 CPU）。

> 这是个很实用的知识：需要长时间跑的分片任务，用 `setTimeout` 或 `requestIdleCallback` 切开，别用微任务。

## 为什么会卡：一个真实场景

```js
// 一千个元素的列表，每个都要绑定事件
list.forEach(item => {
  item.addEventListener('click', handler);
});
```

如果这段代码在同步流程里执行、而且列表还在不断变化，主线程会被反复占用。用户看到的现象就是"滚动卡顿、点击没反应"。

两种解法：

1. **事件委托**：只在父容器上绑一次，用 `event.target` 判断点了谁；
2. **把大任务切片**：用 `requestAnimationFrame` 或 `setTimeout(0)` 分帧处理。

```js
// 事件委托：一个监听器管所有子元素
list.addEventListener('click', (event) => {
  const item = event.target.closest('.item');
  if (!item) return;
  handler.call(item, event);
});
```

## 和渲染的关系

浏览器大概每 16.7ms 要渲染一帧（60fps）。渲染时机在**微任务清空之后、下一个宏任务之前**。

这意味着两件事：

1. **微任务里不要做重活**，会直接推迟这一帧的渲染；
2. 想让改动"下一帧生效"，用 `requestAnimationFrame`：

```js
requestAnimationFrame(() => {
  el.style.transform = 'translateX(100px)';   // 在渲染前执行，动画最顺滑
});
```

## 自测

1. `setTimeout(fn, 0)` 是"立即执行"吗？——不是，"至少 0ms 后可以排队"。
2. 同步代码、微任务、宏任务的执行顺序？——同步 → 清空微任务 → 取一个宏任务 → 再清空微任务。
3. 为什么微任务里的递归会导致页面卡死？——微任务队列清不空，渲染永远排不上。
4. 事件委托为什么性能更好？——监听器数量从 N 个降到 1 个，内存和事件分发开销都下降。

---

**下一步**：搞清楚 `Promise` 和 `async/await` 在事件循环里是怎么被调度的，尤其是 `await` 后面的代码为什么等同于 `.then`。
