export interface AnalyticsTopic {
  id: string
  slug: string
  aliases?: string[]
  partId: 'numpy' | 'pandas' | 'statistics'
  partTitle: string
  moduleNumber: number
  moduleTitle: string
  title: string
  shortDesc: string
  tags: string[]
  invariant: string
  shapeFormula: string
  theory: {
    title: string
    concept: string
    practicalInsight: string
  }
  pythonCode: string
  componentName: string
}

export interface AnalyticsPart {
  id: 'numpy' | 'pandas' | 'statistics'
  title: string
  desc: string
  color: string
}

export const ANALYTICS_PARTS: AnalyticsPart[] = [
  {
    id: 'numpy',
    title: 'Part 1: NumPy Foundations',
    desc: 'Vectorized computing, memory strides, and multidimensional tensor mechanics.',
    color: 'brand-blue'
  },
  {
    id: 'pandas',
    title: 'Part 2: Pandas Tabular Processing',
    desc: 'DataFrame indexing, relational joins, hierarchical grouping, and data cleaning.',
    color: 'brand-purple'
  },
  {
    id: 'statistics',
    title: 'Part 3: Statistics & Distributions',
    desc: 'Probability densities, central tendency, outlier fences, and correlations.',
    color: 'brand-amber'
  }
]

export const ANALYTICS_TOPICS: AnalyticsTopic[] = [
  // --- Part 1: NumPy Foundations ---
  {
    id: '01',
    slug: 'scalars-vectors-matrices',
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 1,
    moduleTitle: 'Array Basics',
    title: '01 • Scalars, Vectors, Matrices & 6D Tensors',
    shortDesc: 'Spatially nested hierarchy from 0D scalars up to 6D hyper-lattices of volumetric tensors.',
    tags: ['NumPy', 'ndim', 'shape', '3D Volume', '4D Batch', '5D Video', '6D Lattice'],
    invariant: '0D () → 1D (4,) → 2D (3, 4) → 3D (2, 3, 4) → 4D (2, 2, 3, 4) → 5D → 6D',
    shapeFormula: 'shape: (2, 2, 2, 2, 3, 4) • ndim: 6 • 192 elements',
    theory: {
      title: 'Nested Dimensionality: From Points to 6D Lattices',
      concept: 'Dimensionality represents orthogonal degrees of indexing freedom. A scalar is rank-0 (). A vector extends along axis 0. A matrix adds axis 1. A 3D tensor stacks sheets along depth axis 0. Higher dimensions naturally emerge as nested arrays of volumes: 4D batches an array of volumes (B, D, H, W), 5D forms a planar grid of volumes (B, T, C, H, W), and 6D constructs a cubic lattice of volumes.',
      practicalInsight: 'Real-world pipelines frequently exceed 3D: 4D models batched images in PyTorch (B, C, H, W); 5D represents video clips (Batch, Frames, Channels, Height, Width) or MRI scans; 6D models multi-camera perception in robotics (Cameras, Episodes, Timesteps, Channels, H, W).'
    },
    pythonCode: `# 0D to 6D High-Dimensional Tensors in NumPy
import numpy as np

# 4D: Batched video frames or spectrograms
T4 = np.zeros((2, 2, 3, 4))
print("4D Batch Shape:", T4.shape, "ndim:", T4.ndim) # (2, 2, 3, 4), 4

# 5D: Video dataset (Batch, Frames, Channels, Height, Width)
T5 = np.zeros((2, 2, 2, 3, 4))
print("5D Video Shape:", T5.shape, "ndim:", T5.ndim) # (2, 2, 2, 3, 4), 5

# 6D: Multi-camera autonomous driving perception stream
T6 = np.zeros((2, 2, 2, 2, 3, 4))
print("6D Lattice Shape:", T6.shape, "ndim:", T6.ndim) # 192 elements, ndim: 6`,
    componentName: 'Stage01Tensors'
  },
  {
    id: '02',
    slug: 'shape-ndim-axis',
    aliases: ['02_shape_ndim_axis', 'strides-memory-layout'],
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 1,
    moduleTitle: 'Array Basics',
    title: '02 • Shape, ndim & Axis Mechanics',
    shortDesc: 'Visualize axis directions and dimensional reduction: Axis 0 collapses rows (downward); Axis 1 collapses columns (across).',
    tags: ['NumPy', 'Shape', 'ndim', 'Axis 0', 'Axis 1', 'Reduction'],
    invariant: 'np.sum(arr, axis=0) → (4,) • np.sum(arr, axis=1) → (3,)',
    shapeFormula: '(3, 4) with axis=0 (rows) & axis=1 (cols)',
    theory: {
      title: 'Axis Orientation & Dimensional Collapsing',
      concept: 'In NumPy, an axis represents a specific direction along which elements are indexed or reduced. When an operation specifies axis=k, that dimension is eliminated by aggregating along it: axis=0 traverses down rows (collapsing rows into a column sum vector), while axis=1 traverses across columns (collapsing columns into a row sum vector).',
      practicalInsight: 'Keeping track of reduction axes is essential in batch processing: computing batch loss mean(loss, axis=0) averages across training samples, while softmax(logits, axis=-1) normalizes across output class probabilities.'
    },
    pythonCode: `import numpy as np

# Create a 3x4 matrix
arr = np.array([
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12]
])

print("Original shape:", arr.shape) # (3, 4)
print("Dimensions:", arr.ndim)       # 2

# Axis 0: Collapse down rows -> shape (4,)
sum_axis0 = np.sum(arr, axis=0)
print("Sum axis 0 (columns preserved):", sum_axis0) # [15, 18, 21, 24]

# Axis 1: Collapse across columns -> shape (3,)
sum_axis1 = np.sum(arr, axis=1)
print("Sum axis 1 (rows preserved):", sum_axis1)    # [10, 26, 42]`,
    componentName: 'Stage02ShapeAxis'
  },
  {
    id: '03',
    slug: 'indexing-slicing',
    aliases: ['03_indexing_slicing', 'broadcasting-rules'],
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 1,
    moduleTitle: 'Array Basics',
    title: '03 • Indexing, Strided Slicing & Views',
    shortDesc: 'Interactive arr[start:stop:step] slicing with real-time base buffer mutation vs deep copy demonstration.',
    tags: ['NumPy', 'Indexing', 'Slicing', 'Strides', 'View vs Copy', 'RAM Buffer'],
    invariant: 'view[slice] shares buffer • copy() allocates new RAM',
    shapeFormula: 'arr[start:stop:step] → view shape',
    theory: {
      title: 'Zero-Copy Slices vs Memory Allocation',
      concept: 'Basic slicing arr[start:stop:step] in NumPy creates an array view that references the original buffer without copying data (base pointer with adjusted offset and strides). In contrast, advanced indexing (boolean masks or integer arrays) and explicit .copy() allocate new memory.',
      practicalInsight: 'Mutating a slice in-place (e.g. view[:] = 0) alters the parent array, which can cause subtle side-effects in production pipelines. Use .copy() when downstream mutations must be isolated.'
    },
    pythonCode: `import numpy as np

arr = np.arange(20).reshape(4, 5)
print("Original Array:\\n", arr)

# Slicing creates a VIEW (shares underlying RAM buffer)
view = arr[1:3, 1:4]
print("Slice Shape:", view.shape) # (2, 3)

# In-place mutation affects base array:
view[0, 0] = 99
print("Base arr[1, 1] changed to:", arr[1, 1]) # 99

# Explicit COPY allocates independent memory:
clone = arr[1:3, 1:4].copy()
clone[0, 0] = 777
print("Base arr[1, 1] remains:", arr[1, 1])   # 99 (unaffected!)`,
    componentName: 'Stage03IndexingSlicing'
  },
  {
    id: '04',
    slug: 'matrix-transpose',
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 4,
    moduleTitle: 'Array Manipulation',
    title: '04 • Matrix Transpose (X → Xᵀ)',
    shortDesc: 'Continuous 180° spatial rotation around the main diagonal axis (i = j).',
    tags: ['NumPy', 'Transpose', 'Stride', 'Diagonal'],
    invariant: 'Xᵀ[j, i] = X[i, j]',
    shapeFormula: 'X: (4, 3) → Xᵀ: (3, 4)',
    theory: {
      title: 'Reflection Across the Main Diagonal',
      concept: 'Transposition reflects elements across the line i = j. Diagonal entries remain unchanged, while row vectors become column vectors.',
      practicalInsight: 'In linear models and covariance estimation, XᵀX produces a square symmetric (d × d) feature matrix. In Pandas, df.T swaps index and columns.'
    },
    pythonCode: `import numpy as np

X = np.array([
    [12, 45, 28],
    [34, 62, 19],
    [51, 88, 30],
    [27, 53, 42]
])

X_T = X.T
assert X_T.shape == (3, 4)
assert (X_T.T == X).all()`,
    componentName: 'Stage04Transpose'
  },
  {
    id: '05',
    slug: 'tensor-reshaping',
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 5,
    moduleTitle: 'Array Manipulation',
    title: '05 • Reshape, Flatten & Squeeze',
    shortDesc: 'Reinterpreting 1D linear buffer order into altered dimension topologies.',
    tags: ['NumPy', 'Reshape', 'Ravel', 'Squeeze'],
    invariant: '∏ old_shape = ∏ new_shape = N',
    shapeFormula: '(2, 6) → (3, 4) → (12,) → (1, 3, 4, 1)',
    theory: {
      title: 'Conservation of Element Count',
      concept: 'Reshaping does not alter the underlying sequence of elements in memory; it modifies the view shape and strides metadata if contiguous.',
      practicalInsight: 'Flattening before fully connected layers (e.g., x.view(batch_size, -1) in PyTorch) transforms spatial feature maps into linear prediction inputs.'
    },
    pythonCode: `import numpy as np

arr = np.arange(12)
grid = arr.reshape(3, 4)
flat = grid.ravel()

# Squeezing removes unit dimensions
expanded = grid[np.newaxis, :, :, np.newaxis]
print(expanded.shape)         # (1, 3, 4, 1)
print(np.squeeze(expanded).shape)  # (3, 4)`,
    componentName: 'StagePlaceholder'
  },
  {
    id: '06',
    slug: 'einsum-notation',
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 6,
    moduleTitle: 'Universal Functions & Linear Math',
    title: '06 • Einstein Summation (einsum)',
    shortDesc: 'Compact index notation unifying dot products, matrix multiplies, traces, and batched contractions.',
    tags: ['NumPy', 'Einsum', 'Contraction', 'Linear Math'],
    invariant: 'C[i, k] = ∑ⱼ A[i, j] B[j, k] ⇔ "ij,jk->ik"',
    shapeFormula: '"ij,jk->ik" • (M, K) × (K, N) → (M, N)',
    theory: {
      title: 'Repeated Indices Imply Summation',
      concept: 'Indices appearing on the left side but omitted on the right are summed over. Indices appearing on both sides are preserved along output axes.',
      practicalInsight: 'Attention mechanisms in Transformers use einsum("bhqk,bhkd->bhqd") to compute multi-head scaled dot-product attention in a single clear line.'
    },
    pythonCode: `import numpy as np

A = np.random.randn(4, 5)
B = np.random.randn(5, 3)

# Matrix multiplication via einsum
C = np.einsum('ij,jk->ik', A, B)
assert np.allclose(C, A @ B)

# Diagonal extraction
diag = np.einsum('ii->i', A[:4, :4])`,
    componentName: 'StagePlaceholder'
  },

  // --- Part 2: Pandas Tabular Processing ---
  {
    id: '07',
    slug: 'series-dataframe-anatomy',
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 7,
    moduleTitle: 'Tabular Anatomy',
    title: '07 • Series & DataFrame Anatomy',
    shortDesc: 'Decomposing 2D tables into index labels, column names, typed blocks, and NumPy buffers.',
    tags: ['Pandas', 'Series', 'DataFrame', 'Index'],
    invariant: 'DataFrame = { col: Series(values, index=Index) }',
    shapeFormula: '(N_rows, M_cols) with Index & dtypes',
    theory: {
      title: 'Labeled Homogeneous & Heterogeneous Arrays',
      concept: 'A Series is a 1D labeled array with uniform dtype. A DataFrame is a 2D labeled dictionary of Series, sharing a common Row Index.',
      practicalInsight: 'Under the hood, Pandas groups columns of the same dtype into 2D memory blocks (BlockManager) to execute vector operations efficiently.'
    },
    pythonCode: `import pandas as pd

df = pd.DataFrame({
    'feature_A': [1.2, 3.4, 2.1],
    'category': ['X', 'Y', 'X'],
    'target': [0, 1, 0]
}, index=['sample_1', 'sample_2', 'sample_3'])

print(df.dtypes)
print(df.index)
print(df.columns)`,
    componentName: 'StagePlaceholder'
  },
  {
    id: '08',
    slug: 'indexing-loc-iloc',
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 8,
    moduleTitle: 'Tabular Anatomy',
    title: '08 • Indexing: loc vs iloc & Boolean Masks',
    shortDesc: 'Label-based lookup versus integer-position indexing with boolean slice filtering.',
    tags: ['Pandas', 'loc', 'iloc', 'Boolean Mask'],
    invariant: 'df.loc[label, col_label] vs df.iloc[int_pos, int_col]',
    shapeFormula: 'df[mask] → subset (K ≤ N, M)',
    theory: {
      title: 'Coordinate Selection Protocols',
      concept: '`loc` queries index labels and includes endpoint slices [a:b]. `iloc` queries 0-indexed integer coordinates and excludes the endpoint [a:b).',
      practicalInsight: 'Avoid chained assignment `df[cond]["col"] = val` which may trigger SettingWithCopyWarning; always use `df.loc[cond, "col"] = val`.'
    },
    pythonCode: `import pandas as pd

df = pd.DataFrame({'age': [23, 45, 31], 'income': [50, 95, 72]}, index=['a', 'b', 'c'])

# Label-based slice (includes 'b')
print(df.loc['a':'b', 'age'])

# Position-based slice (excludes 2)
print(df.iloc[0:2, 0])

# Boolean mask filtering
filtered = df.loc[df['income'] > 60]`,
    componentName: 'StagePlaceholder'
  },
  {
    id: '09',
    slug: 'vector-dot-product',
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 9,
    moduleTitle: 'Universal Functions & Linear Math',
    title: '09 • Vector Dot Product (Weighted Sum)',
    shortDesc: 'Pairwise element multiplication collapsing into a scalar accumulator register.',
    tags: ['Linear Math', 'Dot Product', 'Projection', 'Weights'],
    invariant: 'x · w = ∑ (xᵢ × wᵢ) ∈ ℝ',
    shapeFormula: '(N,) · (N,) → ()',
    theory: {
      title: 'Element-wise Product + Sum Reduction',
      concept: 'The inner product multiplies corresponding elements and sums the products. Geometrically, it measures alignment: x · w = ||x|| ||w|| cos(θ).',
      practicalInsight: 'The core operation of every artificial neuron (ŷ = w·x + b) and linear regression prediction is a vector dot product.'
    },
    pythonCode: `import numpy as np

x = np.array([2, 3, 1, 4])
w = np.array([3, 1, 2, 2])

result = x @ w           # Recommended operator: 2*3 + 3*1 + 1*2 + 4*2 = 19
assert result == (x * w).sum()
print(f"Dot product = {result}")`,
    componentName: 'Stage09DotProduct'
  },
  {
    id: '10',
    slug: 'merge-join-types',
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 10,
    moduleTitle: 'Data Merging & Joining',
    title: '10 • Relational Merges: Inner, Left & Outer',
    shortDesc: 'Venn-diagram intersection, left-retention, and full outer joins on common primary keys.',
    tags: ['Pandas', 'Merge', 'Join', 'SQL'],
    invariant: '|A ∩ B| ≤ |A| + |B|',
    shapeFormula: 'merge(A, B, on="id", how="inner|left|outer")',
    theory: {
      title: 'Key-Based Record Alignment',
      concept: 'Inner joins only keep keys found in both tables. Left joins preserve all left rows and fill missing right matches with NaN. Outer joins retain all rows from both.',
      practicalInsight: 'Check for duplicated keys in merge tables prior to joining to prevent silent exponential row explosion in production pipelines.'
    },
    pythonCode: `import pandas as pd

left = pd.DataFrame({'user_id': [1, 2, 3], 'name': ['Alice', 'Bob', 'Charlie']})
right = pd.DataFrame({'user_id': [2, 3, 4], 'score': [88, 92, 79]})

# Inner join: keys 2 and 3
inner = pd.merge(left, right, on='user_id', how='inner')

# Left join: keys 1, 2, 3
left_join = pd.merge(left, right, on='user_id', how='left')`,
    componentName: 'StagePlaceholder'
  },
  {
    id: '11',
    slug: 'groupby-split-apply-combine',
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 11,
    moduleTitle: 'Aggregation & Reshaping',
    title: '11 • GroupBy: Split-Apply-Combine',
    shortDesc: 'Partitioning rows by categorical keys, computing aggregate statistics, and combining results.',
    tags: ['Pandas', 'GroupBy', 'Aggregation', 'Split-Apply-Combine'],
    invariant: 'df.groupby(keys).agg(fn) → summary table',
    shapeFormula: '(N, M) → (K_groups, P_metrics)',
    theory: {
      title: 'The Split-Apply-Combine Paradigm',
      concept: 'Rows are segregated into distinct sub-tables by key (Split). An aggregation function (mean, sum, std) executes over each group (Apply). The results assemble into a single index (Combine).',
      practicalInsight: 'Use `df.groupby("dept")["salary"].transform("mean")` to compute group statistics without collapsing rows, enabling within-group normalization.'
    },
    pythonCode: `import pandas as pd

df = pd.DataFrame({
    'dept': ['Sales', 'IT', 'Sales', 'IT', 'HR'],
    'salary': [50000, 75000, 62000, 80000, 48000]
})

agg_df = df.groupby('dept')['salary'].agg(['count', 'mean', 'max'])
print(agg_df)`,
    componentName: 'StagePlaceholder'
  },
  {
    id: '12',
    slug: 'pivot-melt-tidy',
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 12,
    moduleTitle: 'Aggregation & Reshaping',
    title: '12 • Pivoting & Melting (Tidy Data)',
    shortDesc: 'Morphing between wide tables with repeated columns and long tidy tables with key-value pairs.',
    tags: ['Pandas', 'Pivot', 'Melt', 'Tidy Data'],
    invariant: 'pivot(wide) ↔ melt(long)',
    shapeFormula: '(N, M) ⇄ (N × K, 3)',
    theory: {
      title: 'Wide vs Long Representations',
      concept: '`pivot_table` turns unique column values into horizontal header columns. `melt` unpivots columns back into vertical variable and value columns.',
      practicalInsight: 'Tidy data where every variable forms a column and every observation forms a row is essential for Seaborn, Plotly, and scikit-learn models.'
    },
    pythonCode: `import pandas as pd

# Wide table
wide = pd.DataFrame({
    'id': ['A', 'B'],
    'quarter_1': [100, 200],
    'quarter_2': [150, 250]
})

# Melt to Long / Tidy
long_df = wide.melt(id_vars='id', var_name='quarter', value_name='revenue')

# Pivot back to Wide
wide_again = long_df.pivot(index='id', columns='quarter', values='revenue')`,
    componentName: 'StagePlaceholder'
  },
  {
    id: '13',
    slug: 'missing-data-imputation',
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 13,
    moduleTitle: 'Data Cleaning',
    title: '13 • Missing Values: Detection & Imputation',
    shortDesc: 'Locating NaN holes in tabular matrices and applying mean, median, forward-fill, and indicator masks.',
    tags: ['Pandas', 'Missing Data', 'Imputation', 'NaN'],
    invariant: 'df.isna().sum() → imputed_df',
    shapeFormula: 'mask = df.isna() • sum(mask)',
    theory: {
      title: 'Mechanisms of Missingness',
      concept: 'Missing Completely at Random (MCAR), Missing at Random (MAR), or Not at Random (MNAR). Different mechanisms require different strategies: drop, fill, or model.',
      practicalInsight: 'Always fit imputation parameters (like mean/median) strictly on the training set to prevent data leakage into validation or test folds.'
    },
    pythonCode: `import pandas as pd
import numpy as np

s = pd.Series([10, np.nan, 30, np.nan, 50])

print(s.isna().sum())       # 2 missing
print(s.fillna(s.median())) # Impute with median (30.0)
print(s.ffill())            # Forward fill: [10, 10, 30, 30, 50]`,
    componentName: 'StagePlaceholder'
  },

  // --- Part 3: Statistics & Distributions ---
  {
    id: '14',
    slug: 'central-tendency-dispersion',
    partId: 'statistics',
    partTitle: 'Part 3: Statistics & Distributions',
    moduleNumber: 14,
    moduleTitle: 'Descriptive Statistics',
    title: '14 • Central Tendency & Dispersion',
    shortDesc: 'Mean, median, and mode balance points contrasting against variance and standard deviation spread.',
    tags: ['Statistics', 'Mean', 'Median', 'Variance', 'Std Dev'],
    invariant: 'σ² = (1/N) ∑ (xᵢ - μ)²',
    shapeFormula: 'x ∈ ℝᴺ → (μ, median, σ²)',
    theory: {
      title: 'Center of Mass vs Spread',
      concept: 'The mean is the physical center of mass (sensitive to outliers). The median is the 50th percentile (robust). Variance measures average squared distance from the mean.',
      practicalInsight: 'When data is skewed (like income or user session duration), the median is a far more realistic indicator of typical value than the mean.'
    },
    pythonCode: `import numpy as np
from scipy import stats

data = np.array([12, 15, 14, 18, 19, 100]) # 100 is an outlier

print("Mean:", np.mean(data))      # 29.67 (dragged by outlier)
print("Median:", np.median(data))  # 16.5  (resistant)
print("Std Dev:", np.std(data))    # 31.64`,
    componentName: 'StagePlaceholder'
  },
  {
    id: '15',
    slug: 'normal-distribution-clt',
    partId: 'statistics',
    partTitle: 'Part 3: Statistics & Distributions',
    moduleNumber: 15,
    moduleTitle: 'Probability Models',
    title: '15 • Normal Distribution & Central Limit Theorem',
    shortDesc: 'Gaussian bell curve geometry, empirical 68-95-99.7 rule, and sample mean convergence.',
    tags: ['Statistics', 'Gaussian', 'CLT', 'Z-Score'],
    invariant: 'f(x) = (1 / σ√(2π)) exp(-0.5 ((x-μ)/σ)²)',
    shapeFormula: 'X ~ 𝒩(μ, σ²) • Z = (X - μ) / σ',
    theory: {
      title: 'The Universal Bell Curve',
      concept: 'Under the Central Limit Theorem, the distribution of the sum (or average) of independent random variables approaches a normal distribution as N grows, regardless of initial shape.',
      practicalInsight: 'Z-score normalization z = (x - μ) / σ centers features at mean 0 with unit variance, stabilizing neural network gradient optimization.'
    },
    pythonCode: `import numpy as np

# Simulating Central Limit Theorem
# Uniform random variables -> Sample means are Gaussian!
samples = [np.mean(np.random.uniform(0, 10, size=50)) for _ in range(5000)]
print(f"Mean of means: {np.mean(samples):.2f}") # ~5.00
print(f"Std of means:  {np.std(samples):.2f}")  # ~0.41 (10 / sqrt(12 * 50))`,
    componentName: 'StagePlaceholder'
  },
  {
    id: '16',
    slug: 'covariance-correlation',
    partId: 'statistics',
    partTitle: 'Part 3: Statistics & Distributions',
    moduleNumber: 16,
    moduleTitle: 'Bivariate Analysis',
    title: '16 • Covariance & Pearson/Spearman Correlation',
    shortDesc: 'Bivariate scatter direction, joint dispersion, and unitless [-1, +1] relationship strength.',
    tags: ['Statistics', 'Covariance', 'Correlation', 'Pearson'],
    invariant: 'r = Cov(X, Y) / (σₓ σᵧ) ∈ [-1, +1]',
    shapeFormula: 'Σ = (1/N) (X - μ)ᵀ(X - μ)',
    theory: {
      title: 'Direction and Strength of Linear Association',
      concept: 'Positive covariance means Y tends to increase when X increases. Pearson r normalizes covariance to [-1, 1]. Spearman r computes Pearson on ranked values for monotonic curves.',
      practicalInsight: 'Multicollinearity (r > 0.85 between two features) inflates parameter variance in regression models, making coefficient interpretations unreliable.'
    },
    pythonCode: `import numpy as np

x = np.array([1, 2, 3, 4, 5, 6])
y = np.array([2, 5, 7, 9, 11, 14])

cov_matrix = np.cov(x, y)
r = np.corrcoef(x, y)[0, 1]
print(f"Pearson r: {r:.4f}") # ~0.997`,
    componentName: 'StagePlaceholder'
  },
  {
    id: '17',
    slug: 'boxplots-iqr-outliers',
    partId: 'statistics',
    partTitle: 'Part 3: Statistics & Distributions',
    moduleNumber: 17,
    moduleTitle: 'Exploratory Data Analysis',
    title: '17 • Quantiles, IQR & Outlier Fences',
    shortDesc: 'Tukey box-and-whisker decomposition: Q1, Median, Q3, and the 1.5 × IQR outlier thresholds.',
    tags: ['Statistics', 'Boxplot', 'IQR', 'Outliers', 'EDA'],
    invariant: 'IQR = Q3 - Q1 • Fences: [Q1 - 1.5×IQR, Q3 + 1.5×IQR]',
    shapeFormula: 'Outlier if x < Lower or x > Upper',
    theory: {
      title: 'Non-Parametric Dispersion and Thresholds',
      concept: 'The Interquartile Range (IQR) spans the middle 50% of sorted data. Values falling beyond 1.5 × IQR from the quartiles are flagged as potential outliers.',
      practicalInsight: 'Tree-based models (Random Forests, XGBoost) are inherently invariant to monotonic transformations and outliers, whereas linear models are strongly biased by them.'
    },
    pythonCode: `import numpy as np

data = np.array([10, 12, 14, 15, 16, 18, 19, 21, 22, 55]) # 55 is outlier

q1 = np.percentile(data, 25)
q3 = np.percentile(data, 75)
iqr = q3 - q1

lower_fence = q1 - 1.5 * iqr
upper_fence = q3 + 1.5 * iqr
outliers = data[(data < lower_fence) | (data > upper_fence)]
print("Outliers detected:", outliers) # [55]`,
    componentName: 'StagePlaceholder'
  },
  {
    id: '18',
    slug: 'probability-density-cdf',
    partId: 'statistics',
    partTitle: 'Part 3: Statistics & Distributions',
    moduleNumber: 18,
    moduleTitle: 'Probability Models',
    title: '18 • Probability Density (PDF) vs Cumulative (CDF)',
    shortDesc: 'Area under continuous curves, probability integration, and quantile inversion.',
    tags: ['Statistics', 'PDF', 'CDF', 'Integration'],
    invariant: 'P(a ≤ X ≤ b) = ∫ₐᵇ f(x) dx = F(b) - F(a)',
    shapeFormula: 'F(x) = P(X ≤ x) ∈ [0, 1]',
    theory: {
      title: 'Density vs Cumulative Probability',
      concept: 'The height of a PDF at point x is not a probability, but probability density. The cumulative distribution function (CDF) represents cumulative accumulated area from -∞ to x.',
      practicalInsight: 'The Kolmogorov-Smirnov test compares empirical sample CDFs against theoretical distributions to test goodness-of-fit without binning artifacts.'
    },
    pythonCode: `from scipy import stats

# Standard Normal Distribution
dist = stats.norm(loc=0, scale=1)

# Probability between -1 and +1 std dev
prob_1_sigma = dist.cdf(1) - dist.cdf(-1)
print(f"P(-1 <= X <= 1): {prob_1_sigma:.4f}") # 0.6827 (68.3%)`,
    componentName: 'StagePlaceholder'
  }
]

