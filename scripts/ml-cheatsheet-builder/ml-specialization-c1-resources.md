# 吴恩达「机器学习专项课程」第一门课资源清单
## Supervised Machine Learning: Regression and Classification（Coursera / DeepLearning.AI · Stanford, 2022 版）

> 检索范围：GitHub 全站，按 Star 排序 + 关键词（machine-learning-specialization / supervised machine learning regression classification / coursera andrew ng / 中文）。
> 适用课程章节（第一门课共 3 周）：
> - **Week 1**：机器学习概述、监督 vs 无监督、单变量线性回归、模型表示、代价函数、梯度下降
> - **Week 2**：多元线性回归、梯度下降实践（特征缩放/学习率）、特征工程与多项式回归、Sklearn、逻辑回归引入
> - **Week 3**：分类、Sigmoid、决策边界、逻辑回归代价函数与梯度下降、Scikit-Learn 逻辑回归、过拟合与正则化
> 标注语言：EN=英文，中=中文。

---

## 一、笔记总结类（文本资料：知识点 / 公式推导 / 总结）

| 仓库名称 | 作者 | Star | 最近更新 | 链接 | 适用章节 | 内容特点 |
|---|---|---|---|---|---|---|
| machine-learning-specialization | mvarrone | 8 | 2025-12-24 | https://github.com/mvarrone/machine-learning-specialization | W1–W3 全覆盖 | EN；按"概述/监督无监督/回归/梯度下降"等主题拆成 README.md 笔记，结构清晰、纯文本易读，适合通读 |
| ML-specialization-notes | parsabsh | 26 | 2026-08-04 | https://github.com/parsabsh/ML-specialization-notes | W1–W3（全专项） | EN；LaTeX 源码 + 编译好的 PDF 讲义，公式推导完整，适合想看数学细节的人 |
| coursera-andrew-ng-machine-learning-notes | caitlin-leonard | 2 | 2026-09-21 | https://github.com/caitlin-leonard/coursera-andrew-ng-machine-learning-notes | W1–W3（每门课独立 PDF） | EN；`ML_Course1_Detailed_Notes.pdf` 为详尽复习笔记，2026 年新建、与现行课程匹配度高 |
| Machine-Learning-Specialization（中文版） | Majiaozhen | 1 | 2026-10-02 | https://github.com/Majiaozhen/Machine-Learning-Specialization | W1–W3（中文） | 中；含中文笔记 + 课件(slides) + 可运行代码，并带 `requirements.txt`，是稀缺的中文一站式资源 |

---

## 二、代码实验类（Jupyter Notebook 作业 / Optional Labs / 参考答案）

| 仓库名称 | 作者 | Star | 最近更新 | 链接 | 适用章节 | 内容特点 |
|---|---|---|---|---|---|---|
| Machine-Learning-Specialization-Coursera | greyhatguy007 | 7991 | 2026-10-04 | https://github.com/greyhatguy007/Machine-Learning-Specialization-Coursera | W1–W3（C1 完整） | EN；本专项最权威星标最高的仓库，C1 含全部 Optional Labs + 编程作业 + 练习测验的 Soln  Notebook；**无统一 requirements.txt**，依赖同仓 `lab_utils_*` 模块，需自行 `pip install numpy matplotlib` |
| Supervised-Machine-Learning-Regression-and-Classification-Coursera-Lab-Answers | yasithWimukthi | 115 | 2026-09-14 | https://github.com/yasithWimukthi/Supervised-Machine-Learning-Regression-and-Classification-Coursera-Lab-Answers | W1–W3（仅第一门课） | EN；**只做第一门课**，专注度高；含 `lab_utils_common.py`/`lab_utils_uni.py`/`data.txt`/`deeplearning.mplstyle` 等运行必需辅助文件，开箱即用程度高；仍**无 requirements.txt** |
| Machine-Learning-Specialization（中文版） | Majiaozhen | 1 | 2026-10-02 | https://github.com/Majiaozhen/Machine-Learning-Specialization | W1–W3（中文） | 中；**唯一带 `requirements.txt` 的候选**，代码与中文笔记同仓，环境最完整 |

> 运行环境小结：除 Majiaozhen 外，其余代码库均**未提供 requirements.txt**，通用依赖为 `numpy`、`matplotlib`、`lab_utils_*`；建议用 `conda` 新建 py3.9+ 环境后按需安装，或克隆 greyhatguy007/yasithWimukthi 仓库以直接使用其自带辅助模块。

---

## 三、习题与答案类（课后测验 / Practice Quiz 解析）

| 仓库名称 | 作者 | Star | 最近更新 | 链接 | 适用章节 | 内容特点 |
|---|---|---|---|---|---|---|
| Coursera-DeepLearning.AI-Stanford-University-Machine-Learning-Specialization | shantanu1109 | 222 | 2026-09-23 | https://github.com/shantanu1109/Coursera-DeepLearning.AI-Stanford-University-Machine-Learning-Specialization | W1–W3（C1） | EN；明确以"Quizes & Lab Assignments 解答"为主，`Course-1-Week-1/2/3` + `Course-1.md` 集中放测验与实验答案 |
| Machine-Learning-Specialization-Coursera | greyhatguy007 | 7991 | 2026-10-04 | https://github.com/greyhatguy007/Machine-Learning-Specialization-Coursera | W1–W3（C1） | EN；除代码外，每周含 `Practice quiz - *` 答案目录，可与代码一并参考 |
| Supervised-Machine-Learning-Regression-and-Classification-Coursera-Lab-Answers | yasithWimukthi | 115 | 2026-09-14 | https://github.com/yasithWimukthi/Supervised-Machine-Learning-Regression-and-Classification-Coursera-Lab-Answers | W1–W3（C1） | EN；Week1/2/week3 下均含 `Practice Quiz - *` 答案目录，第一门课专属 |

---

## 四、已剔除 / 需谨慎的仓库（与"第一门课·新版"不匹配）

| 仓库 | 原因 |
|---|---|
| LiMengyang990726/Coursera-Machine-Learning | MATLAB/Octave，最后更新 2018；对应的是**吴恩达 2011/2014 经典 ML 课程**，非 2022 机器学习专项，语言环境都不匹配 |
| amanchadha/coursera-deep-learning-specialization | 这是**深度学习专项**（Deep Learning Specialization），不是机器学习专项第一门课 |
| Ezward/machinelearningnotes、Prashant47/ML-Foundations | 华盛顿大学 ML 专项，课程结构不同，非本专项 |
| stasSajin/Machine-Learning-Specialization | 最后更新 2019，长期停更，且对应旧版体系 |
| 大量 0–2 Star 的"week1/week2 单周 fork"仓库 | 内容残缺、仅上传自己作业、无笔记无解答，无收录价值 |

---

## 五、稀缺类别 & 后续自查关键词

- **中文笔记类**明显稀缺（仅 Majiaozhen 一个、1 Star、2026 新建）。建议自行检索：
  `吴恩达 机器学习专项 笔记`、`机器学习专项 中文 笔记 Regression Classification`、`Coursera 机器学习 专项 中文 答案`、`site:github.com 吴恩达 机器学习 第一门课`
- **纯习题解析（不含代码）**类也较少，多数仓库把测验答案和代码混在一起。建议检索：
  `machine learning specialization practice quiz answers`、`"Supervised Machine Learning" coursera quiz solution`、`C1_W1 practice quiz regression solution`
- **公式推导 / 手写笔记**类可补充检索：
  `machine learning specialization notes pdf`、`andrew ng ml specialization formula derivation`、`ml specialization week2 gradient descent derivation`

---
*整理时间：2026-10-04。Star 数与更新时间取自检索当时 GitHub API，会随时间变化。*
