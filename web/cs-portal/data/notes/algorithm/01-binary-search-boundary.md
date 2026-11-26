# 二分查找：真正的难点是边界

二分的思想一分钟能讲完，但写对很难。难点从来不在"折半"，而在**区间到底是闭的还是开的、循环条件带不带等号、mid 要不要加一**。

这篇笔记的目标：把闭区间写法固定成一套**可以机械套用的模板**，不再靠感觉。

## 先明确一件事

二分的本质不是"有序数组里找数"，而是：**在一个具有二段性的区间上，找到分界点。**

- 左半段全部不满足条件，右半段全部满足条件（或反过来）→ 就可以二分。

理解这一点，"找第一个 ≥ target 的位置"这种变体就不会懵了。

## 模板：闭区间 [left, right]

```python
def binary_search(nums, target):
    left, right = 0, len(nums) - 1      # 闭区间：[left, right] 内都是候选
    while left <= right:                # 区间非空就继续
        mid = left + (right - left) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            left = mid + 1              # mid 已排除，新区间 [mid+1, right]
        else:
            right = mid - 1             # mid 已排除，新区间 [left, mid-1]
    return -1
```

三个关键点，每一个都有理由：

### 1. 为什么是 `left <= right` 而不是 `<`？

因为区间是**闭**的。`left == right` 时区间 `[left, left]` 里还有**一个**元素没检查，所以必须继续循环。写成 `<` 会漏掉最后一个元素。

### 2. 为什么 `mid` 用 `left + (right - left) // 2`？

两种写法都可以：

```python
mid = (left + right) // 2            # 直观，但 left + right 可能溢出
mid = left + (right - left) // 2     # 不会溢出，推荐
```

Python 的整数不会溢出，两种都行。但换成 C / Java 就必须用后一种——`left + right` 超过 `int` 最大值时结果会变成负数，然后数组越界。**养成习惯用第二种。**

### 3. 为什么是 `mid + 1` / `mid - 1` 而不是 `mid`？

这是最容易出错的地方。既然 `nums[mid]` 已经判断过不等于 `target`，它就不该再留在候选区间里。留在里面只有一个后果：**区间不缩小，死循环。**

如果你写成 `left = mid`，当 `left + 1 == right` 且 `nums[mid] < target` 时，`left` 不变，区间大小永远卡在 2，程序就跑死了。

## 变体：找左右边界

实战里更常见的是「找第一个 ≥ target 的位置」，而不是「找到就行」。

### 左边界（第一个 ≥ target）

```python
def lower_bound(nums, target):
    left, right = 0, len(nums)      # 注意：right 取 len，是开区间边界
    while left < right:
        mid = left + (right - left) // 2
        if nums[mid] < target:
            left = mid + 1
        else:
            right = mid             # mid 可能就是答案，不能排除
    return left                     # 第一个 >= target 的下标
```

这套写法用的是**左闭右开** `[left, right)`，对应地：

- `right` 初始化为 `len(nums)`（不是 `len - 1`）
- 循环条件是 `left < right`（区间为空时退出）
- `right = mid` 而不是 `mid - 1`——因为 `nums[mid] >= target` 时，`mid` **有可能是答案**，不能丢掉

### 两种写法的对照

| | 闭区间 `[l, r]` | 左闭右开 `[l, r)` |
|---|---|---|
| 初始 right | `len - 1` | `len` |
| 循环条件 | `left <= right` | `left < right` |
| 缩左边界 | `left = mid + 1` | `left = mid + 1` |
| 缩右边界 | `right = mid - 1` | `right = mid` |
| 适用场景 | 精确查找 | 找边界 |
| 循环结束 | — | `left == right`，即答案位置 |

**建议：不要两套混着用。** 挑一套，写熟，所有变体都在同一套里推导。混用是 bug 的主要来源。

## 我踩过的三个坑

**坑 1：数组有重复元素时，普通二分找到的不一定是第一个。**

要在重复数组里找目标值的范围，必须用 `lower_bound` + `upper_bound`，不能只找到一个就返回。

**坑 2：`while low < high` 配合 `high = mid - 1` 会漏答案。**

循环条件和边界更新方式必须配套。上面那张表里的两列不能交叉使用。

**坑 3：答案不在数组里时，返回值要单独判断。**

`lower_bound` 返回 `left`，但如果 `left == len(nums)`，说明所有元素都小于 `target`，没有答案。调用方必须检查：

```python
idx = lower_bound(nums, target)
if idx == len(nums) or nums[idx] != target:
    return -1
return idx
```

## 复杂度

- 时间：**O(log n)** —— 每次区间砍半
- 空间：**O(1)** —— 迭代版本；递归版本是 O(log n) 的栈空间

## 自测

1. 闭区间写法里 `left == right` 时还需要循环吗？——需要，区间里还有一个元素。
2. `right = mid` 和 `right = mid - 1` 怎么选？——`mid` 可能是答案就用 `mid`，已经排除就用 `mid - 1`。
3. 为什么推荐 `left + (right - left) // 2`？——防止两数相加溢出。
4. 二分的本质是什么？——在具有二段性的区间上找分界点。

---

**下一步**：把这套模板套到「旋转排序数组」和「找峰值」上，检验是否真的理解了二段性。
