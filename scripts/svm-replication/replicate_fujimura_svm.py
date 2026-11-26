# -*- coding: utf-8 -*-
"""
复刻 Fujimura 等 [32] 的核心方法：
    用高斯核 SVM（SVR）从 DFT 特征预测固态电解质室温离子电导率。

论文要点（第二章 2.2.1 / 第一章 1.2.4）：
    - 特征 X：1600 K 扩散率、超离子转变温度、无序结构平均体积（DFT 计算）
    - 标签 y：室温（低温）离子电导率
    - 模型：带高斯核的 SVM → 回归任务用 SVR
    - 样本：95 组高温实验电导率数据

说明：
    论文未附原始数据集，这里用符合 Arrhenius / Nernst-Einstein 物理约束的
    合成数据复刻"方法流程"，目的是理解算法，不是复现论文数值。

运行：Anaconda python replicate_fujimura_svm.py
"""

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.svm import SVR
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import train_test_split, KFold, cross_val_predict, GridSearchCV, learning_curve
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.inspection import permutation_importance

rng = np.random.default_rng(42)
KB = 8.617333262e-5  # 玻尔兹曼常数 eV/K


# ---------------------------------------------------------------------------
# 1. 合成数据集（95 组，物理约束）
# ---------------------------------------------------------------------------
def make_dataset(n=95):
    """生成特征 X 与室温电导率标签 y。

    特征（对应论文）：
        f1 log10(D_1600K)：1600 K 扩散率（ logarithm，跨数量级）
        f2 T_superionic  ：超离子转变温度 (K)
        f3 V_disorder    ：无序结构平均体积 (Å^3/atom)

    标签：
        log10(sigma_300K)：室温离子电导率 (S/cm)
    """
    # 潜在物理变量：活化能 Ea (eV) 与指前因子
    Ea = rng.uniform(0.12, 0.40, n)              # 活化能，越小越易扩散
    logD0 = rng.uniform(-6.5, -4.0, n)           # 指前因子 log10(D0), m^2/s

    # 由 Arrhenius 得到 1600 K 扩散率
    logD1600 = logD0 - Ea / (KB * 1600 * np.log(10))

    # 超离子转变温度与活化能正相关（能垒越高，需要更高温度才进入超离子态）
    T_sp = 300 + Ea * 1400 + rng.normal(0, 25, n)

    # 无序体积：通道越大越利于迁移，弱相关于指前因子
    V_dis = 18 + 2.5 * (logD0 - (-5.75)) + rng.normal(0, 1.2, n)

    X = np.column_stack([logD1600, T_sp, V_dis])

    # 室温电导率：Arrhenius 外推 + 转变温度修正 + Nernst-Einstein 量级
    # 温度低于转变温度时迁移受阻，做指数惩罚
    # 超离子转变是相变：室温电导率在转变温度附近发生非线性跃迁
    # 这正是高斯核比线性核更合适的物理来源
    penalty = 3.0 / (1 + np.exp(-(T_sp - 620) / 50))
    log_sigma = logD0 - 0.5 * Ea / (KB * 300 * np.log(10)) + 4.8 - 1.0 * penalty
    # 加入实验测量噪声
    log_sigma += rng.normal(0, 0.12, n)
    # 限制在快离子导体合理区间 1e-8 ~ 1e-1 S/cm
    log_sigma = np.clip(log_sigma, -8, -1)

    y = log_sigma
    return X, y, Ea


X, y, Ea = make_dataset(95)
feature_names = ["log10(D_1600K)", "T_superionic(K)", "V_disorder(A^3/atom)"]

print("=" * 64)
print("数据集：95 组，特征 =", ", ".join(feature_names))
print("室温电导率 log10(sigma) 范围：%.2f ~ %.2f  (S/cm: %.1e ~ %.1e)"
      % (y.min(), y.max(), 10 ** y.min(), 10 ** y.max()))
print("=" * 64)


# ---------------------------------------------------------------------------
# 2. 划分数据 + 标准化（SVM 对尺度敏感，必须标准化）
# ---------------------------------------------------------------------------
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25, random_state=42)

# 高斯核 SVR：gamma='scale' 自适应，C 控制间隔与误差权衡
svm_rbf = make_pipeline(StandardScaler(), SVR(kernel="rbf", C=100, gamma="scale", epsilon=0.1))
# 对照：线性核
svm_lin = make_pipeline(StandardScaler(), SVR(kernel="linear", C=1, epsilon=0.1))


# ---------------------------------------------------------------------------
# 3. 训练 + 预测 + 评估
# ---------------------------------------------------------------------------
def evaluate(name, model):
    model.fit(X_tr, y_tr)
    pred = model.predict(X_te)
    mae = mean_absolute_error(y_te, pred)
    r2 = r2_score(y_te, pred)
    print(f"[{name}]  测试集 MAE(log) = {mae:.3f}   R2 = {r2:.3f}")
    return pred, mae, r2


print("\n--- 测试集表现（25% 留出） ---")
pred_rbf, mae_rbf, r2_rbf = evaluate("RBF 核 SVR (论文方法)", svm_rbf)
pred_lin, mae_lin, r2_lin = evaluate("线性核 SVR (对照)  ", svm_lin)

# 5 折交叉验证（95 组小样本，CV 比单次留出更可靠）
cv = KFold(n_splits=5, shuffle=True, random_state=42)
cv_pred = cross_val_predict(svm_rbf, X, y, cv=cv)
cv_mae = mean_absolute_error(y, cv_pred)
cv_r2 = r2_score(y, cv_pred)
print(f"\n[RBF 核 SVR] 5 折交叉验证  MAE(log) = {cv_mae:.3f}   R2 = {cv_r2:.3f}")


# ---------------------------------------------------------------------------
# 4. 可视化：预测 vs 真实
# ---------------------------------------------------------------------------
fig, axes = plt.subplots(1, 2, figsize=(11, 4.6))

for ax, pred, title in [
    (axes[0], pred_rbf, f"RBF kernel SVR\nMAE={mae_rbf:.2f}, R2={r2_rbf:.2f}"),
    (axes[1], pred_lin, f"Linear kernel SVR\nMAE={mae_lin:.2f}, R2={r2_lin:.2f}"),
]:
    ax.scatter(y_te, pred, c="#2563eb", edgecolor="k", s=45, alpha=0.85)
    lim = [min(y_te.min(), pred.min()) - 0.3, max(y_te.max(), pred.max()) + 0.3]
    ax.plot(lim, lim, "r--", lw=1.5, label="y=x")
    ax.set_xlim(lim); ax.set_ylim(lim)
    ax.set_xlabel("True log10(sigma_300K)")
    ax.set_ylabel("Predicted log10(sigma_300K)")
    ax.set_title(title)
    ax.legend(); ax.grid(alpha=0.3)

plt.tight_layout()
fig.savefig("D:/workBuddy/2026-11-16-21-44-51/fujimura_svm_result.png", dpi=130)
print("\n图已保存：fujimura_svm_result.png")

# 打印几条预测样本（对数 → 实际电导率）
print("\n--- 测试集前 8 条预测（S/cm） ---")
for i in range(min(8, len(y_te))):
    print(f"  真实 {10**y_te[i]:.2e}   预测 {10**pred_rbf[i]:.2e}")


# ---------------------------------------------------------------------------
# 5. 补充分析：特征重要性 + 超参敏感性 + 学习曲线
# ---------------------------------------------------------------------------
print("\n" + "=" * 64)
print("补充分析")
print("=" * 64)

# 5.1 置换特征重要性：打乱某特征后测试集 MAE 的上升幅度
svm_rbf.fit(X_tr, y_tr)
perm = permutation_importance(svm_rbf, X_te, y_te, n_repeats=30, random_state=42)
print("\n--- 特征重要性（置换法，MAE 上升越大越重要） ---")
for i in np.argsort(perm.importances_mean)[::-1]:
    print(f"  {feature_names[i]:<24} +{perm.importances_mean[i]:.3f} ± {perm.importances_std[i]:.3f}")

# 5.2 超参网格搜索（C, gamma）
grid = GridSearchCV(
    make_pipeline(StandardScaler(), SVR(kernel="rbf", epsilon=0.1)),
    {"svr__C": [1, 10, 100, 1000], "svr__gamma": [0.01, 0.1, 1, "scale"]},
    cv=KFold(5, shuffle=True, random_state=42),
    scoring="neg_mean_absolute_error", n_jobs=-1,
)
grid.fit(X_tr, y_tr)
print(f"\n--- 网格搜索最优：C={grid.best_params_['svr__C']}, gamma={grid.best_params_['svr__gamma']} "
      f"(CV MAE={-grid.best_score_:.3f}) ---")

# 5.3 学习曲线：样本量对模型表现的影响（对应论文的小样本挑战）
sizes, tr_s, va_s = learning_curve(
    grid.best_estimator_, X, y,
    train_sizes=np.linspace(0.2, 1.0, 5),
    cv=KFold(5, shuffle=True, random_state=42), scoring="r2",
)
print("\n--- 学习曲线（训练集样本数 → 验证 R2） ---")
for n, s in zip(sizes, va_s.mean(axis=1)):
    print(f"  {int(n):>3} 组 → R2 = {s:.3f}")

fig2, axes = plt.subplots(1, 2, figsize=(11, 4.2))
order = np.argsort(perm.importances_mean)
axes[0].barh([feature_names[i] for i in order], perm.importances_mean[order],
             xerr=perm.importances_std[order], color="#059669", alpha=0.85)
axes[0].set_xlabel("MAE increase after permutation")
axes[0].set_title("Feature importance (permutation)")
axes[0].grid(axis="x", alpha=0.3)

axes[1].plot(sizes, tr_s.mean(axis=1), "o-", label="train R2", color="#2563eb")
axes[1].plot(sizes, va_s.mean(axis=1), "s-", label="validation R2", color="#dc2626")
axes[1].fill_between(sizes, va_s.mean(axis=1) - va_s.std(axis=1),
                     va_s.mean(axis=1) + va_s.std(axis=1), alpha=0.15, color="#dc2626")
axes[1].set_xlabel("Number of training samples")
axes[1].set_ylabel("R2"); axes[1].set_title("Learning curve")
axes[1].legend(); axes[1].grid(alpha=0.3)
plt.tight_layout()
fig2.savefig("D:/workBuddy/2026-11-16-21-44-51/fujimura_svm_analysis.png", dpi=130)
print("\n分析图已保存：fujimura_svm_analysis.png")
