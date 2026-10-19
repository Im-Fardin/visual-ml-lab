export interface AnalyticsTopic {
  id: string
  slug: string
  aliases?: string[]
  partId: 'numpy' | 'pandas' | 'preprocessing' | 'statistics' | 'machine-learning' | 'ml'
  partTitle: string
  track?: 'data-analysis' | 'machine-learning' | 'deep-learning'
  category?: 'data-analysis' | 'machine-learning' | 'deep-learning'
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
  component?: string
}

export interface AnalyticsPart {
  id: 'numpy' | 'pandas' | 'preprocessing' | 'statistics' | 'machine-learning' | 'ml'
  title: string
  desc: string
  color: string
  track?: 'data-analysis' | 'machine-learning' | 'deep-learning'
}

export const ANALYTICS_PARTS: AnalyticsPart[] = [
  {
    id: 'numpy',
    title: 'Part 1: NumPy Foundations',
    desc: 'Vectorized computing, memory strides, and multidimensional tensor mechanics.',
    color: 'brand-blue',
    track: 'data-analysis'
  },
  {
    id: 'pandas',
    title: 'Part 2: Pandas Tabular Processing',
    desc: 'DataFrame indexing, relational joins, hierarchical grouping, and data cleaning.',
    color: 'brand-purple',
    track: 'data-analysis'
  },
  {
    id: 'preprocessing',
    title: 'Part 3: Feature Engineering & Preprocessing',
    desc: 'Feature scaling, categorical encoding, and leakage-free dataset partitioning.',
    color: 'brand-emerald',
    track: 'data-analysis'
  },
  {
    id: 'statistics',
    title: 'Part 4: Statistics & Distributions',
    desc: 'Probability densities, central tendency, outlier fences, and correlations.',
    color: 'brand-amber',
    track: 'data-analysis'
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
    aliases: ['04_matrix_transpose', 'transpose'],
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 2,
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
    slug: 'reshape-flatten',
    aliases: ['05_reshape_flatten', 'tensor-reshaping'],
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 2,
    moduleTitle: 'Array Manipulation',
    title: '05 • Reshape, Flatten & Memory Strides',
    shortDesc: 'Reshape mechanics, -1 dimension inference, and C-contiguous vs Fortran memory traversal.',
    tags: ['NumPy', 'Reshape', 'Flatten', 'Ravel', 'Strides', 'C vs Fortran Order'],
    invariant: 'arr.size == np.prod(new_shape) • Memory buffer preserved',
    shapeFormula: 'arr.reshape(new_shape) • (12,) → (3, 4) → (2, 2, 3)',
    theory: {
      title: 'Conservation of Elements & Zero-Copy View',
      concept: 'Reshaping alters the dimensional interpretation (shape and strides) without modifying or copying the underlying linear memory buffer in RAM. Dimensions may be inferred automatically using -1 as long as the total element count is strictly conserved.',
      practicalInsight: 'Common Pitfall: If an array is non-contiguous (e.g. after a transpose or strided step slice), arr.reshape() may raise an error or force an implicit copy. Use arr.contiguous().view() in PyTorch or arr.reshape() in NumPy which creates a copy only if memory is disjoint.'
    },
    pythonCode: `import numpy as np

# 12 elements contiguous buffer
arr = np.arange(12)  # shape (12,)
print("Original 1D Buffer:", arr)

# Reshape into (3, 4) in standard C-order (Row-Major)
c_grid = arr.reshape(3, 4, order='C')
print("C-Order (3, 4) Strides:", c_grid.strides)  # (16, 4) bytes

# Reshape in Fortran-order (Column-Major)
f_grid = arr.reshape(3, 4, order='F')
print("F-Order (3, 4) Strides:", f_grid.strides)  # (4, 12) bytes

# Automatic -1 Dimension Inference:
inferred = arr.reshape(2, -1)
print("Inferred Shape (-1 -> 6):", inferred.shape)  # (2, 6)

# Flatten / Ravel returns contiguous 1D array:
flat = inferred.ravel()
assert (flat == arr).all()`,
    componentName: 'Stage05ReshapeFlatten'
  },
  {
    id: '06',
    slug: 'stack-concat-split',
    aliases: ['06_stack_concat_split', 'einsum-notation'],
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 2,
    moduleTitle: 'Array Manipulation',
    title: '06 • Stack, Concatenate & Split',
    shortDesc: 'Concatenating along existing axes, stacking into new outer dimensions, and array splitting.',
    tags: ['NumPy', 'Concatenate', 'Stack', 'Split', 'vsplit', 'hsplit'],
    invariant: 'concat preserves ndim • stack increases ndim: d → d + 1',
    shapeFormula: 'concat([A, B], axis=k) vs stack([A, B], axis=k)',
    theory: {
      title: 'Existing Axis Lengthening vs Dimensional Expansion',
      concept: 'np.concatenate joins arrays along an existing axis, lengthening that dimension while preserving ndim. All other dimensions must match exactly. np.stack creates a brand-new outer axis, increasing the rank (ndim: d → d + 1). np.split conversely divides an array into equal partitions along a specified axis.',
      practicalInsight: 'In deep learning batch construction, use np.stack (or torch.stack) when grouping N independent image matrices (H, W) into a batch (N, H, W). Use np.concatenate when appending new feature columns to existing samples (N, F1 + F2).'
    },
    pythonCode: `import numpy as np

A = np.arange(1, 10).reshape(3, 3)
B = np.arange(10, 19).reshape(3, 3)

# 1. Concatenate along existing axis 0 (rows): preserves ndim=2
c_axis0 = np.concatenate([A, B], axis=0)  # or np.vstack([A, B])
print("Concat axis 0 shape:", c_axis0.shape)  # (6, 3)

# 2. Concatenate along existing axis 1 (cols): preserves ndim=2
c_axis1 = np.concatenate([A, B], axis=1)  # or np.hstack([A, B])
print("Concat axis 1 shape:", c_axis1.shape)  # (3, 6)

# 3. Stack along new outer dimension: increases ndim: 2 -> 3
stacked = np.stack([A, B], axis=0)
print("Stacked shape (new axis):", stacked.shape)  # (2, 3, 3), ndim=3

# 4. Split array into equal partitions
halves = np.vsplit(c_axis0, 2)
assert (halves[0] == A).all() and (halves[1] == B).all()`,
    componentName: 'Stage06StackConcatSplit'
  },

  // --- Part 1: NumPy Foundations (Continued) ---
  {
    id: '07',
    slug: 'vectorization-vs-loop',
    aliases: ['07_vectorization_vs_loop', 'series-dataframe-anatomy'],
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 3,
    moduleTitle: 'Universal Functions',
    title: '07 • Vectorization vs. Python Loops',
    shortDesc: 'Python interpreter overhead and pointer chasing vs. AVX/SIMD hardware vector registers.',
    tags: ['NumPy', 'Vectorization', 'SIMD', 'Performance', 'GIL', 'AVX'],
    invariant: 'SIMD computes N elements per clock cycle • Zero PyObject boxing',
    shapeFormula: 'Loop: O(N) scalar iterations vs SIMD: O(N / K_simd) vector waves',
    theory: {
      title: 'Interpreter Overhead vs Direct Hardware Acceleration',
      concept: 'Standard Python loops iterate over lists of PyObject* pointers, incurring dynamic type-checking, reference count increments, unboxing, and scattered heap memory access for each operation. NumPy universal functions delegate array computations directly to precompiled C/Fortran loops using hardware SIMD (Single Instruction, Multiple Data) execution registers.',
      practicalInsight: 'Python loops can be 15x to 100x slower than vectorized array code. By avoiding Python interpreter bytecodes inside inner loops and utilizing contiguous memory layouts, vectorization enables high-throughput data processing and unlocks multi-threaded BLAS/OpenMP routines without being restricted by the Global Interpreter Lock (GIL).'
    },
    pythonCode: `import numpy as np
import time

N = 100_000
data = list(range(N))
arr = np.arange(N)

# 1. Standard Python Loop (Scalar Pointer Chasing)
t0 = time.perf_counter()
py_result = [x ** 2 for x in data]
t_loop = (time.perf_counter() - t0) * 1000

# 2. NumPy Vectorized SIMD (Hardware Vector Dispatch)
t0 = time.perf_counter()
np_result = arr ** 2
t_simd = (time.perf_counter() - t0) * 1000

print(f"Python Loop: {t_loop:.2f} ms")
print(f"NumPy SIMD:  {t_simd:.2f} ms")
print(f"Speedup:     {t_loop / t_simd:.1f}x faster!")`,
    componentName: 'Stage07VectorizationVsLoop'
  },
  {
    id: '08',
    slug: 'ufunc-elementwise',
    aliases: ['08_ufunc_elementwise', 'indexing-loc-iloc'],
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 3,
    moduleTitle: 'Universal Functions',
    title: '08 • Universal Functions & In-Place Memory',
    shortDesc: 'Mathematical projection of ufuncs and zero-copy in-place array mutation (out=X).',
    tags: ['NumPy', 'ufunc', 'Element-wise', 'In-Place', 'Memory Optimization'],
    invariant: 'np.ufunc(x, out=x) avoids intermediate buffer allocations',
    shapeFormula: 'f(X) → Y where Y.shape == X.shape (element-wise)',
    theory: {
      title: 'Universal Functions & Zero-Copy Output Buffering',
      concept: 'A universal function (ufunc) operates on ndarrays in an element-by-element fashion, supporting type casting, broadcasting, and optional output buffers. By passing the out= parameter, results are written directly into an existing memory buffer, avoiding costly temporary array allocations.',
      practicalInsight: 'In memory-constrained systems and large data pipelines, chained expressions like A = A * 2 + B allocate multiple transient arrays. Using in-place operators like np.multiply(A, 2, out=A) or A *= 2 eliminates GC thrashing and keeps cache lines warm.'
    },
    pythonCode: `import numpy as np

X = np.array([
    [-2, -1, 0, 1],
    [2, 3, -3, 4],
    [1, -2, 2, 0]
], dtype=np.float64)

# 1. Default Allocation (Allocates new output memory buffer)
Y = np.square(X)
print("New Buffer Y shape:", Y.shape)
print("X is preserved:", X[0, 0])  # -2.0

# 2. In-Place Mutation (Zero new bytes allocated)
np.exp(X, out=X)
print("X mutated in-place:", np.round(X[0, 0], 2))  # e^(-2) = 0.14

# 3. Ufunc reductions and accumulations
row_sums = np.add.reduce(Y, axis=1)
print("Row sums via ufunc.reduce:", row_sums)`,
    componentName: 'Stage08UfuncElementwise'
  },
  {
    id: '09',
    slug: 'vector-dot-product',
    aliases: ['09_vector_dot_product', 'vector-dot'],
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 3,
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
    slug: 'aggregation-axis',
    aliases: ['10_aggregation_axis', 'merge-join-types'],
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 4,
    moduleTitle: 'Aggregation & Reductions',
    title: '10 • Statistical Reductions & Axis keepdims',
    shortDesc: 'Multi-dimensional reductions (sum, mean, min, max) across Axis 0 vs Axis 1 and the keepdims invariant.',
    tags: ['NumPy', 'Aggregation', 'Reductions', 'keepdims', 'Axis 0 vs 1', 'Broadcasting'],
    invariant: 'Dimension along axis k collapses to length 1 (keepdims=True) or drops (keepdims=False)',
    shapeFormula: 'np.sum(X, axis=0, keepdims=True) → (1, 4) vs keepdims=False → (4,)',
    theory: {
      title: 'Axis Reductions & Broadcasting Preservation',
      concept: 'An aggregation function collapses all elements along specified axis k into a single aggregate metric. Setting keepdims=True retains the collapsed dimension with length 1, preserving matrix rank and preventing subtle dimension-mismatch errors during downstream array broadcasting.',
      practicalInsight: 'When normalizing feature matrices (e.g. subtracting column means: X - X.mean(axis=0)), using keepdims=True produces shape (1, 4) which broadcasts unambiguously across (3, 4). Omitting keepdims returns shape (4,) which relies on trailing-dimension matching.'
    },
    pythonCode: `import numpy as np

X = np.array([
    [2, 4, 1, 5],
    [3, 1, 4, 2],
    [1, 5, 3, 3]
], dtype=np.float64)

# 1. Axis 0: Collapse rows vertically -> shape (4,) or (1, 4)
col_sums = np.sum(X, axis=0)
col_means_kd = np.mean(X, axis=0, keepdims=True)
print("Col Sums (axis=0):", col_sums)             # [6., 10., 8., 10.]
print("Col Means keepdims:", col_means_kd.shape)   # (1, 4)

# Safe broadcasting with keepdims:
X_centered = X - col_means_kd
print("Centered Matrix Shape:", X_centered.shape)  # (3, 4)

# 2. Axis 1: Collapse cols horizontally -> shape (3,) or (3, 1)
row_sums = np.sum(X, axis=1, keepdims=True)
print("Row Sums keepdims:", row_sums.shape)        # (3, 1)

# 3. Global Scalar Reduction:
total_sum = np.sum(X)
print("Global Sum:", total_sum)                    # 34.0`,
    componentName: 'Stage10AggregationAxis'
  },
  {
    id: '11',
    slug: 'cumulative-vs-reduce',
    aliases: ['11_cumulative_vs_reduce', 'groupby-split-apply-combine'],
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 4,
    moduleTitle: 'Aggregation & Reductions',
    title: '11 • Cumulative Waves vs. Global Reductions',
    shortDesc: 'Shape-preserving prefix accumulation (cumsum/cumprod) vs collapsing scalar reductions (sum/prod).',
    tags: ['NumPy', 'cumsum', 'cumprod', 'reduce', 'accumulate', 'Prefix Sum', 'Time Series'],
    invariant: 'np.cumsum preserves array shape (N,) → (N,) • np.sum collapses (N,) → ()',
    shapeFormula: 'cumsum: y[k] = ∑_{i=0}^k x[i] vs sum: s = ∑_{i=0}^{N-1} x[i]',
    theory: {
      title: 'Prefix Accumulation vs Terminal Collapse',
      concept: 'ufunc.reduce repeatedly applies a binary operator to collapse an array down to a single scalar summary value. In contrast, ufunc.accumulate (and np.cumsum / np.cumprod) records the running intermediate result after each element, maintaining a full temporal history of identical shape.',
      practicalInsight: 'Cumulative operations are standard for financial time-series analysis (e.g. computing total portfolio value from daily percentage returns via np.cumprod(1 + returns)) and cumulative distribution functions (CDF via np.cumsum(pdf)).'
    },
    pythonCode: `import numpy as np

# Daily returns or trade balances
x = np.array([2, 5, 1, 4, 3])
print("Original Sequence:", x)

# 1. Cumulative Prefix Sum (Time-series history preserved)
cumsum_vec = np.cumsum(x)
print("Running Portfolio Balance (cumsum):", cumsum_vec)  # [2, 7, 8, 12, 15]
assert cumsum_vec.shape == x.shape  # (5,) preserved!

# 2. Global Terminal Reduction (Total collapsed to scalar)
final_total = np.sum(x)
print("Terminal Total (sum):", final_total)              # 15
assert final_total == cumsum_vec[-1]

# 3. Cumulative Product (Compound Growth)
growth = np.array([1.05, 1.02, 0.98, 1.04])
compound = np.cumprod(growth)
print("Compound Portfolio Multipliers:", np.round(compound, 3))`,
    componentName: 'Stage11CumulativeVsReduce'
  },
  {
    id: '12',
    slug: 'broadcasting-rules',
    aliases: ['12_broadcasting_rules', 'pivot-melt-tidy'],
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 5,
    moduleTitle: 'Broadcasting Mechanics',
    title: '12 • Broadcasting Rules & Virtual Replication',
    shortDesc: 'Right-to-left trailing dimension alignment, singleton dimension expansion, and zero-copy stride = 0 mechanics.',
    tags: ['NumPy', 'Broadcasting', 'Strides', 'Zero-Copy', 'Trailing Dimensions', 'SIMD'],
    invariant: 'Trailing dimensions match right-to-left • Singleton dimensions stretch with stride = 0',
    shapeFormula: '(3, 1) + (1, 4) → (3, 4) via stride_0',
    theory: {
      title: 'The NumPy Broadcasting Rule Hierarchy',
      concept: 'When operating on two arrays, NumPy compares their shapes element-wise from right to left (trailing dimensions first). Two dimensions are compatible when: 1. They are equal, OR 2. One of them is 1. If an array has fewer dimensions, 1s are prepended to the left.',
      practicalInsight: 'Broadcasting NEVER copies memory buffers in RAM! NumPy creates a new array header whose strides for the broadcasted dimensions are set to 0. This means the CPU repeatedly reads the exact same 8 bytes in L1 cache without memory bandwidth saturation.'
    },
    pythonCode: `import numpy as np

# 1. Compatible: (3, 4) + (1, 4) -> (3, 4)
A = np.ones((3, 4), dtype=np.int32)
B = np.array([[10, 20, 30, 40]], dtype=np.int32)
C = A + B
print("C shape:", C.shape)  # (3, 4)
print("B virtual strides:", B.strides)  # (0, 4) -> zero-stride along expanded axis

# 2. Outer Stretch: (3, 1) + (1, 4) -> (3, 4)
col = np.array([[10], [20], [30]])  # (3, 1)
row = np.array([[1, 2, 3, 4]])      # (1, 4)
grid = col + row
print("Grid shape:", grid.shape)    # (3, 4)

# 3. Incompatible Error: (3, 4) + (3,)
try:
    bad = A + np.array([1, 2, 3])  # Trailing 4 vs 3
except ValueError as e:
    print("Broadcasting failed:", e)`,
    componentName: 'Stage12BroadcastingRules'
  },
  {
    id: '13',
    slug: 'broadcasting-newaxis',
    aliases: ['13_broadcasting_newaxis', 'missing-data-imputation'],
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 5,
    moduleTitle: 'Broadcasting Mechanics',
    title: '13 • Rank-1 Ambiguity & np.newaxis',
    shortDesc: 'Demystifying the 1D (N,) vector ambiguity vs (N, 1) and (1, N) orientations, and building pairwise distance matrices.',
    tags: ['NumPy', 'np.newaxis', 'None', 'Outer Product', 'Pairwise Distance', 'Linear Algebra'],
    invariant: 'arr.T is no-op on (N,) • arr[:, None] creates explicit 2D column vector (N, 1)',
    shapeFormula: 'arr[:, None] * arr[None, :] → (N, N) outer product',
    theory: {
      title: 'The Rank-1 Trap and Explicit Dimensional Axis Injection',
      concept: 'A 1D NumPy array with shape (N,) is a rank-1 vector without row or column orientation. Transposing it (arr.T) is a silent no-op. Using np.newaxis (or None) injects an explicit singleton axis of length 1, turning (N,) into a column vector (N, 1) or row vector (1, N).',
      practicalInsight: 'Injecting new axes powers pairwise distance computation without slow Python nested loops: diff = X[:, None, :] - X[None, :, :] computes all N × N pairwise differences in SIMD vector instructions, essential for k-NN, t-SNE, and Transformer Attention mechanisms.'
    },
    pythonCode: `import numpy as np

# 1. The Rank-1 Trap
x = np.array([10, 20, 30, 40])
print("Original shape:", x.shape)   # (4,)
print("Transpose shape:", x.T.shape) # (4,) -> NO EFFECT!

# 2. Injecting Explicit Axes
col = x[:, np.newaxis]  # shape (4, 1)
row = x[np.newaxis, :]  # shape (1, 4)
print("Column vector:", col.shape)  # (4, 1)
print("Row vector:", row.shape)     # (1, 4)

# 3. Outer Product Multiplication Table
outer = col * row
print("Outer Product Matrix (4x4):\\n", outer)

# 4. Pairwise Euclidean Distance Matrix (ML Application)
# X shape: (N, D) -> pairwise diffs shape: (N, N, D)
coords = np.array([[0, 0], [1, 2], [3, 1], [4, 4]])
pairwise_diff = coords[:, None, :] - coords[None, :, :]
dist_matrix = np.sqrt(np.sum(pairwise_diff ** 2, axis=-1))
print("Pairwise Distances (4x4):\\n", np.round(dist_matrix, 2))`,
    componentName: 'Stage13BroadcastingNewaxis'
  },

  // --- Part 3: Statistics & Distributions ---
  {
    id: '14',
    slug: 'boolean-mask',
    aliases: ['14_boolean_mask', 'central-tendency-dispersion'],
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 6,
    moduleTitle: 'Filtering & Advanced Indexing',
    title: '14 • Boolean Masking & Compaction',
    shortDesc: 'Predicate evaluation, True/False boolean overlay projections, and 2D-to-1D dimensional compaction.',
    tags: ['NumPy', 'Boolean Mask', 'Filtering', 'Predicates', 'Indexing', 'Data Cleaning'],
    invariant: 'mask = arr > thr • arr[mask] collapses (R, C) → (K,) 1D vector',
    shapeFormula: 'arr[arr > threshold] → (K,) where K = ∑ mask',
    theory: {
      title: 'Predicate Evaluation and Dimensionality Collapse',
      concept: 'Boolean array indexing evaluates an element-wise logical condition, producing a boolean mask of identical shape. When indexed by this mask (arr[mask]), NumPy extracts only elements where the mask is True. Because the count of matching items per row is irregular, the result cannot retain rectangular 2D structure and collapses into a flat 1D vector.',
      practicalInsight: 'Boolean indexing is the core mechanism of DataFrame filtering (e.g. df[df["age"] > 25]). Because memory locations are scattered and non-strided, boolean indexing ALWAYS returns a memory COPY, never a view.'
    },
    pythonCode: `import numpy as np

arr = np.array([
    [12, 64, 45, 88],
    [95, 23, 71, 38],
    [52, 16, 83, 30]
])

# 1. Create Boolean Mask (Same shape (3, 4))
mask = arr > 50
print("Mask shape:", mask.shape)
print("Matching Count:", np.sum(mask))  # 6 True elements

# 2. Filter & Flatten to 1D Vector (Shape: (6,))
filtered = arr[mask]
print("Filtered 1D Vector:", filtered)
assert filtered.ndim == 1  # 2D has collapsed to 1D!

# 3. In-place conditional mutation
arr[arr < 30] = 0  # Replaces values under 30 with 0
print("Thresholded Matrix:\\n", arr)`,
    componentName: 'Stage14BooleanMask'
  },
  {
    id: '15',
    slug: 'logical-ops-where',
    aliases: ['15_logical_ops_where', 'normal-distribution-clt'],
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 6,
    moduleTitle: 'Filtering & Advanced Indexing',
    title: '15 • Logical Operators & np.where Multiplexing',
    shortDesc: 'Bitwise combinations (&, |, ~) and branchless ternary conditional routing via np.where(condition, X, Y).',
    tags: ['NumPy', 'np.where', 'Bitwise Operators', 'Ternary', 'Multiplexing', 'SIMD'],
    invariant: 'np.where(cond, A, B) preserves exact shape (R, C) without flattening',
    shapeFormula: 'out[i] = A[i] if cond[i] else B[i]',
    theory: {
      title: 'Ternary Conditional Multiplexing',
      concept: 'In NumPy, Python standard logical keywords (and, or, not) do not work on arrays. Instead, bitwise operators (&, |, ~) must be used with explicit parentheses around each comparison. np.where(condition, x, y) evaluates the condition element-wise, selecting from array x where True and from array y where False, perfectly preserving input dimensionality.',
      practicalInsight: 'np.where maps directly to modern CPU SIMD vector blend instructions (such as VPBLENDVB). Both branches are evaluated without pipeline branch mispredictions, enabling ultra-fast activation functions like ReLU (np.where(x > 0, x, 0)) and data clipping.'
    },
    pythonCode: `import numpy as np

A = np.array([
    [15, 85, 40, 92],
    [74, 10, 65, 33],
    [58, 22, 88, 47]
])

# 1. Bitwise Logical Combination: (A > 20) & (A < 80)
# Note: Parentheses around comparisons are mandatory in NumPy!
in_range = (A > 20) & (A < 80)

# 2. Ternary Routing with np.where
# Preserves shape (3, 4) — no dimensional collapse!
clipped = np.where(in_range, A, 0)
print("Clipped Output (Shape Preserved):\\n", clipped)
assert clipped.shape == A.shape

# 3. Vectorized ReLU Activation (Deep Learning standard)
relu = np.where(A > 50, A, 0)
print("ReLU Output:\\n", relu)`,
    componentName: 'Stage15LogicalOpsWhere'
  },
  {
    id: '16',
    slug: 'fancy-indexing',
    aliases: ['16_fancy_indexing', 'covariance-correlation'],
    partId: 'numpy',
    partTitle: 'Part 1: NumPy Foundations',
    moduleNumber: 6,
    moduleTitle: 'Filtering & Advanced Indexing',
    title: '16 • Fancy Indexing & Memory Duplication',
    shortDesc: 'Integer array coordinate indexing, arbitrary permutations, duplicate gathers, and independent memory copies.',
    tags: ['NumPy', 'Fancy Indexing', 'Integer Arrays', 'Copy vs View', 'Permutation', 'Shuffling'],
    invariant: 'Fancy indexing arr[row_idx, col_idx] ALWAYS returns an independent COPY in RAM',
    shapeFormula: 'arr[rows, cols] → shape of broadcasted index arrays',
    theory: {
      title: 'Integer Array Indexing & Copy Guarantees',
      concept: 'Fancy indexing refers to passing integer arrays (or lists) as indices instead of scalar integers or slices. When coordinate arrays are supplied (arr[rows, cols]), elements at corresponding pairs (rows[i], cols[i]) are extracted. The output shape matches the broadcasted shape of the index arrays.',
      practicalInsight: 'The most critical rule in NumPy: Basic slicing (arr[1:3, :]) ALWAYS creates a view sharing the original memory buffer, whereas fancy indexing ALWAYS allocates an independent new copy in RAM. This makes duplicate element sampling safe from unintended mutations.'
    },
    pythonCode: `import numpy as np

arr = np.array([
    [10, 11, 12, 13],
    [20, 21, 22, 23],
    [30, 31, 32, 33],
    [40, 41, 42, 43]
])

# 1. Coordinate Pairwise Gathering (Diagonal)
diag = arr[[0, 1, 2, 3], [0, 1, 2, 3]]
print("Main Diagonal:", diag)  # [10, 21, 32, 43]

# 2. Arbitrary & Duplicate Sampling
# Cell (2, 3) and (2, 0) sampled; row 2 repeated!
sampled = arr[[0, 2, 2, 3], [1, 3, 0, 2]]
print("Sampled Elements:", sampled)  # [11, 33, 30, 42]

# 3. Row Permutation / Shuffling (e.g., train/test split)
permuted = arr[[3, 0, 2, 1]]
print("Permuted Rows:\\n", permuted)

# 4. Copy Verification
permuted[0, 0] = 999
assert arr[3, 0] == 40  # Original remains completely UNTOUCHED!`,
    componentName: 'Stage16FancyIndexing'
  },
  {
    id: '17',
    slug: 'series-anatomy',
    aliases: ['17_series_anatomy', 'boxplots-iqr-outliers'],
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 7,
    moduleTitle: 'Series & DataFrame Foundations',
    title: '17 • Series Anatomy: Values Spine & Index Rail',
    shortDesc: 'The dual identity of a Pandas Series: contiguous 1D NumPy array storage + immutable hashable Index coordinate rail.',
    tags: ['Pandas', 'Series', 'Index', 'NumPy', 'Data Structure', 'Memory'],
    invariant: 's = pd.Series(values, index) • s.values (ndarray) + s.index (Index)',
    shapeFormula: 's.shape = (N,) • len(s.values) == len(s.index)',
    theory: {
      title: 'Dual Architecture of a Pandas Series',
      concept: 'A Series is not just a labeled array—it is two distinct objects bound together: 1. A contiguous 1D NumPy ndarray holding raw typed data in memory, and 2. An immutable Index object storing coordinate labels. Calling s.values exposes the underlying ndarray with zero copy, while s.index acts as an O(1) hash map coordinate index.',
      practicalInsight: 'Understanding this separation avoids costly memory bloat. Index objects introduce hash table memory overhead. When executing high-throughput numerical operations or passing data to scikit-learn models, extract s.values or s.to_numpy() to strip Pandas metadata overhead.'
    },
    pythonCode: `import pandas as pd
import numpy as np

# 1. Series Construction
s = pd.Series([10, 25, 40, 55], index=['a', 'b', 'c', 'd'])
print("Pandas Series:\\n", s)

# 2. Inspecting the Underlying Components
print("Raw NumPy Values:", s.values)  # [10, 25, 40, 55] (1D ndarray)
print("Index Metadata:", s.index)     # Index(['a', 'b', 'c', 'd'], dtype='object')

# 3. Memory Structure
assert isinstance(s.values, np.ndarray)
assert s.values.dtype == np.int64

# 4. Zero-Copy View
underlying = s.to_numpy()
underlying[0] = 99
print("Mutated Series (shares buffer):", s['a'])  # 99`,
    componentName: 'Stage17SeriesAnatomy'
  },
  {
    id: '18',
    slug: 'series-alignment',
    aliases: ['18_series_alignment', 'probability-density-cdf'],
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 7,
    moduleTitle: 'Series & DataFrame Foundations',
    title: '18 • Automatic Index Alignment & NaN Propagation',
    shortDesc: 'How Pandas aligns data on Index labels before arithmetic, missing key NaN creation, and fill_value=0 recovery.',
    tags: ['Pandas', 'Series', 'Index Alignment', 'NaN', 'fill_value', 'Arithmetic'],
    invariant: 's1 + s2 aligns on Index union • Unmatched keys produce NaN unless fill_value is supplied',
    shapeFormula: 's1 + s2 → Index: s1.index ∪ s2.index',
    theory: {
      title: 'Automatic Index Alignment Mechanics',
      concept: 'Unlike NumPy where element-wise operations pair strictly by integer offset position, Pandas ALWAYS aligns on Index labels first (a full outer join of indices). Elements with matching labels are combined; elements present in only one Series receive np.nan (Not a Number).',
      practicalInsight: 'Unintended NaN propagation is one of the most frequent silent bugs in data pipelines. To add Series without creating NaNs for missing keys, use the explicit method s1.add(s2, fill_value=0) rather than the raw + operator.'
    },
    pythonCode: `import pandas as pd
import numpy as np

s1 = pd.Series({'apples': 3, 'oranges': 5, 'bananas': 2})
s2 = pd.Series({'oranges': 4, 'bananas': 6, 'grapes': 7})

# 1. Standard Addition (Generates NaNs for unmatched keys)
total_naive = s1 + s2
print("Naive Addition (s1 + s2):\\n", total_naive)
# apples: NaN, bananas: 8.0, grapes: NaN, oranges: 9.0

# 2. Safe Addition with fill_value=0
total_safe = s1.add(s2, fill_value=0)
print("\\nSafe Addition (fill_value=0):\\n", total_safe)
# apples: 3.0, bananas: 8.0, grapes: 7.0, oranges: 9.0
assert total_safe.isna().sum() == 0`,
    componentName: 'Stage18SeriesAlignment'
  },
  {
    id: '19',
    slug: 'dataframe-anatomy',
    aliases: ['19_dataframe_anatomy'],
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 7,
    moduleTitle: 'Series & DataFrame Foundations',
    title: '19 • DataFrame Anatomy: Column Dict & BlockManager',
    shortDesc: '2D heterogeneous tabular anatomy: dictionary of homogeneous column Series sharing a unified row Index.',
    tags: ['Pandas', 'DataFrame', 'BlockManager', 'Dtypes', 'Columnar', 'Memory Layout'],
    invariant: "df['col'] is O(1) zero-copy Series reference • df.loc['row'] constructs new Series",
    shapeFormula: 'df.shape = (N_rows, M_cols) • df.columns ∩ df.index',
    theory: {
      title: 'The Columnar Dict Architecture of DataFrames',
      concept: 'A Pandas DataFrame is fundamentally a dictionary of 1D Series objects sharing a common Index. Because each column is stored as an independent homogeneous NumPy array (managed by the internal BlockManager), different columns can hold different data types (int, float, string) without type coercion.',
      practicalInsight: "Accessing a column (df['Age']) is an instantaneous O(1) dictionary pointer lookup with zero memory copy. Conversely, accessing a row (df.loc['ID_01']) must slice across all independent column buffers and construct a new Series on the fly, upcasting all elements to a common dtype (often object). Always vectorize along columns!"
    },
    pythonCode: `import pandas as pd

df = pd.DataFrame({
    'Age': [25, 34, 42, 29],
    'Salary': [65.5, 82.0, 95.2, 71.8],
    'Dept': ['Eng', 'Mkt', 'Eng', 'Sales']
}, index=['ID_01', 'ID_02', 'ID_03', 'ID_04'])

print("DataFrame:\\n", df)
print("\\nColumn Dtypes:\\n", df.dtypes)

# 1. Fast Column Access (O(1) dictionary lookup)
age_series = df['Age']
assert isinstance(age_series, pd.Series)

# 2. Row Slicing (Constructs a new upcasted Series)
row_0 = df.loc['ID_01']
print("\\nRow 0 Series (Upcasted to object):\\n", row_0)
assert row_0.dtype == 'object'`,
    componentName: 'Stage19DataFrameAnatomy'
  },
  {
    id: '20',
    slug: 'loc-vs-iloc',
    aliases: ['20_loc_vs_iloc'],
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 7,
    moduleTitle: 'Series & DataFrame Foundations',
    title: '20 • loc vs iloc: Label Lookup vs Integer Offset',
    shortDesc: 'Demystifying label-based coordinate selection (.loc) vs zero-based integer positional slicing (.iloc) and the endpoint boundary rule.',
    tags: ['Pandas', 'loc', 'iloc', 'Indexing', 'Slicing', 'Boundaries'],
    invariant: 'iloc[start:stop] is exclusive [start, stop) • loc[start:stop] is INCLUSIVE [start, stop]',
    shapeFormula: 'df.iloc[r_pos, c_pos] vs df.loc[r_label, c_label]',
    theory: {
      title: 'Coordinate Labels vs Memory Positions',
      concept: 'Pandas provides two explicit indexers to eliminate ambiguity: .iloc[] targets elements strictly by their physical 0-based integer positional offset (following Python standard half-open intervals where the stop boundary is excluded). .loc[] targets elements by their Index label coordinates (where the stop boundary is INCLUSIVE).',
      practicalInsight: 'When index labels are themselves non-consecutive integers (e.g. user IDs [105, 102, 108]), using df[0:2] creates subtle bugs. Always use .iloc for integer physical positions and .loc for coordinate label matching. Furthermore, never use chained indexing (df["a"]["b"] = x) which triggers SettingWithCopyWarning; use df.loc[row, col] = x instead.'
    },
    pythonCode: `import pandas as pd

# DataFrame with non-consecutive integer row labels
df = pd.DataFrame({
    'name': ['Alice', 'Bob', 'Charlie', 'Diana'],
    'score': [92, 78, 85, 96],
    'active': [True, False, True, True]
}, index=[105, 102, 108, 101])

# 1. iloc: Positional Indexing (Exclusive of stop!)
sub_iloc = df.iloc[0:2, 0:2]
print("iloc[0:2, 0:2] (2 rows, row 2 excluded):\\n", sub_iloc)
assert len(sub_iloc) == 2

# 2. loc: Label Indexing (INCLUSIVE of stop!)
sub_loc = df.loc[105:108, 'name':'score']
print("\\nloc[105:108, 'name':'score'] (3 rows, 108 INCLUDED):\\n", sub_loc)
assert len(sub_loc) == 3

# 3. Avoiding Chained Assignment Warning
# INCORRECT: df.loc[105]['score'] = 95 (Chained indexing!)
# CORRECT:
df.loc[105, 'score'] = 95
print("\\nUpdated score for ID 105:", df.loc[105, 'score'])`,
    componentName: 'Stage20LocVsIloc'
  },
  {
    id: '21',
    slug: 'read-csv-parsing',
    aliases: ['21_read_csv_parsing'],
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 8,
    moduleTitle: 'File Ingestion & Parsers',
    title: '21 • read_csv: Parsing Streams, Delimiters & Types',
    shortDesc: 'Visualizing text stream tokenization, header extraction, automated type inference, and index_col binding during CSV ingestion.',
    tags: ['Pandas', 'read_csv', 'Parsing', 'Dtypes', 'index_col', 'Delimiter'],
    invariant: 'Byte Stream -> Tokens (sep) -> Header Row Promotion -> Type Inference -> DataFrame',
    shapeFormula: 'Raw Stream (Bytes) -> DataFrame(shape=(N, M), dtypes=[...])',
    theory: {
      title: 'The C Parsing Engine & Type Inference Pipeline',
      concept: 'pd.read_csv uses a fast C tokenizer engine to read raw byte streams. It splits text by delimiter (default comma), promotes the first row to column headers (header=0), infers homogenous column types (int64, float64, string, boolean), and binds specified columns to the row index registry (index_col).',
      practicalInsight: 'Automated type inference incurs overhead on massive files. Explicitly passing dtypes={"age": "int32"} cuts memory footprint and ingestion latency. Specifying index_col="name" binds the key column directly without allocating a redundant default RangeIndex(0..N).'
    },
    pythonCode: `import pandas as pd
import io

csv_data = """name,dept,age,salary
Alice,Eng,29,75000
Bob,Mkt,34,62000
Charlie,Eng,41,98000
Diana,Sales,28,58000"""

# 1. Standard ingestion with automated type inference
df = pd.read_csv(io.StringIO(csv_data))
print("Default Ingestion (RangeIndex 0..3):\\n", df)
print("\\nInferred Dtypes:\\n", df.dtypes)

# 2. Ingestion binding 'name' directly as row index
df_indexed = pd.read_csv(io.StringIO(csv_data), index_col='name')
print("\\nWith index_col='name':\\n", df_indexed)
print("\\nIndex:", df_indexed.index)`,
    componentName: 'Stage21ReadCsvParsing'
  },
  {
    id: '22',
    slug: 'conditional-selection',
    aliases: ['22_conditional_selection'],
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 9,
    moduleTitle: 'Selection & Axis Apply',
    title: '22 • Conditional Selection: Boolean Predicates & Mask Filtering',
    shortDesc: 'Filter tabular records using relational operators, bitwise & and | with mandatory parentheses, and observe row index preservation.',
    tags: ['Pandas', 'Boolean Mask', 'Filtering', 'Selection', 'Bitwise', 'reset_index'],
    invariant: 'df[condition] retains original row index labels unless reset_index(drop=True) is called',
    shapeFormula: 'df[mask] -> Filtered DF (K <= N rows, preserved indices)',
    theory: {
      title: 'Predicate Vectorization and Index Retention',
      concept: 'Evaluating comparison operators on a Series produces a Boolean Series with the identical row index. Applying this boolean mask to the DataFrame (df[mask]) extracts rows where the mask is True. Crucially, Pandas preserves the original row indices instead of renumbering them.',
      practicalInsight: 'In Python, comparison operators (<, >, ==) have lower precedence than bitwise operators (&, |). Therefore, compound conditions MUST be enclosed in parentheses: (df["Age"] < 30) & (df["Dept"] == "Eng"). Using standard Python "and" / "or" triggers a ValueError because Python cannot evaluate the truth value of an entire Series at once.'
    },
    pythonCode: `import pandas as pd

df = pd.DataFrame({
    'Name': ['Alice', 'Bob', 'Charlie', 'Diana', 'Evan'],
    'Dept': ['Eng', 'Mkt', 'Eng', 'Sales', 'Eng'],
    'Age': [29, 34, 41, 28, 23],
    'Salary': [75000, 62000, 98000, 58000, 52000]
})

# 1. Single condition: Salary > 60k
high_earners = df[df['Salary'] > 60000]
print("High Earners (Indices 0, 1, 2 retained):\\n", high_earners)

# 2. Compound condition: Age < 30 & Dept == 'Eng' (Parentheses required!)
young_eng = df[(df['Age'] < 30) & (df['Dept'] == 'Eng')]
print("\\nYoung Engineers (Indices 0, 4 retained):\\n", young_eng)

# 3. Preserved Index vs reset_index
print("\\nOriginal index retained:", list(young_eng.index))
reset_df = young_eng.reset_index(drop=True)
print("After reset_index(drop=True):", list(reset_df.index))`,
    componentName: 'Stage22ConditionalSelection'
  },
  {
    id: '23',
    slug: 'apply-axis',
    aliases: ['23_apply_axis'],
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 9,
    moduleTitle: 'Selection & Axis Apply',
    title: '23 • apply(axis=0 vs axis=1): Column Vectorization vs Row Iteration',
    shortDesc: 'Contrasting fast compiled column reductions (axis=0) with slow row-by-row Python interpreter iteration (axis=1).',
    tags: ['Pandas', 'apply', 'axis=0', 'axis=1', 'Performance', 'Vectorization'],
    invariant: 'axis=0: function applied down each column • axis=1: function applied across each row (slow Python loop)',
    shapeFormula: 'axis=0 -> Series(len=cols) • axis=1 -> Series(len=rows) or transformed DataFrame',
    theory: {
      title: 'Vectorized Column Operations vs Iterative Row Loops',
      concept: 'df.apply(fn, axis=0) passes each entire column Series to the function, enabling fast C/vectorized processing. df.apply(fn, axis=1) packs each row into a temporary pd.Series and invokes the Python function sequentially in an interpreter loop, forfeiting SIMD optimization.',
      practicalInsight: 'df.apply(axis=1) is essentially a hidden Python for-loop with heavy overhead from Series boxing. Prefer native vectorized operations (df["Total"] = df["A"] + df["B"]) which are 50x-500x faster, or np.vectorize() / numba for complex non-vectorizable custom logic.'
    },
    pythonCode: `import pandas as pd
import numpy as np

df = pd.DataFrame({
    'X': [40, 60, 20, 80],
    'Y': [30, 70, 90, 10],
    'Z': [50, 50, 80, 40]
})

# 1. axis=0: Column-wise reduction (runs down columns)
col_means = df.apply(np.mean, axis=0)
print("Column Means (axis=0):\\n", col_means)

# 2. axis=1: Row-by-row function (runs across rows)
def calc_bonus(row):
    return int((row['X'] * 0.5) + (row['Y'] * 0.3) + (row['Z'] * 0.2))

df['Bonus'] = df.apply(calc_bonus, axis=1)
print("\\nDataFrame with Bonus (axis=1):\\n", df)

# 3. Vectorized alternative (Hundreds of times faster on large data!)
# df['Bonus_Fast'] = (df['X'] * 0.5 + df['Y'] * 0.3 + df['Z'] * 0.2).astype(int)`,
    componentName: 'Stage23ApplyAxis'
  },
  {
    id: '24',
    slug: 'groupby-split-apply-combine',
    aliases: ['24_groupby_split_apply_combine'],
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 10,
    moduleTitle: 'Grouping & Aggregation',
    title: '24 • GroupBy: The Split-Apply-Combine Pattern',
    shortDesc: 'Decomposing tabular datasets into independent key subsets, applying aggregate reductions, and combining into a unified summary DataFrame.',
    tags: ['Pandas', 'groupby', 'Aggregation', 'Split-Apply-Combine', 'as_index'],
    invariant: 'df.groupby(keys) partitions rows into isolated groups, computes reductions in parallel, and recombines results indexed by keys',
    shapeFormula: 'DataFrame(N, M) -> GroupBy -> Reduced DataFrame(K <= N, M_agg)',
    theory: {
      title: 'The Split-Apply-Combine Paradigm',
      concept: 'GroupBy operations partition tabular records into isolated memory buckets according to distinct values in one or more grouping keys (Split). An aggregation or transformation function is evaluated independently on each bucket (Apply). Finally, the subset results are glued back together into a single structured output DataFrame (Combine).',
      practicalInsight: 'By default, df.groupby(as_index=True) elevates the grouping keys into the DataFrame index. Passing as_index=False retains the grouping columns as standard columns, avoiding unnecessary reset_index() calls in downstream pipeline steps.'
    },
    pythonCode: `import pandas as pd

df = pd.DataFrame({
    'Dept': ['Eng', 'Mkt', 'Eng', 'Sales', 'Eng', 'Sales'],
    'Salary': [75000, 62000, 98000, 58000, 88000, 64000],
    'Bonus': [5000, 3000, 8000, 2000, 7000, 2500]
})

# Split-Apply-Combine with multiple aggregations
dept_summary = df.groupby('Dept').agg({
    'Salary': ['mean', 'max'],
    'Bonus': 'sum'
})
print("Grouped Summary:\\n", dept_summary)`,
    componentName: 'Stage24GroupBySplitApplyCombine'
  },
  {
    id: '25',
    slug: 'merge-joins',
    aliases: ['25_merge_joins'],
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 11,
    moduleTitle: 'Relational Joins',
    title: '25 • Relational Merges: Inner, Left, Right & Full Outer Joins',
    shortDesc: 'Aligning heterogeneous DataFrames along common key columns with relational Venn-diagram join semantics.',
    tags: ['Pandas', 'merge', 'Joins', 'Relational', 'how', 'on', 'indicator'],
    invariant: 'Inner: Intersection (A ∩ B) • Left: All Left + Matching Right • Outer: Union (A ∪ B) with NaN padding',
    shapeFormula: 'merge(A, B, on=key, how=...) -> Combined DataFrame',
    theory: {
      title: 'Relational Algebra in Pandas',
      concept: 'pd.merge combines two DataFrames along common key identifiers. How parameter governs row retention: "inner" retains only shared keys, "left" preserves all rows from the primary table, and "outer" performs a full outer union, filling missing attributes with NaNs.',
      practicalInsight: 'Always pass validate="one_to_one", "one_to_many", or "many_to_one" to pd.merge(). This asserts referential integrity and detects catastrophic accidental Cartesian explosions before they exhaust server RAM.'
    },
    pythonCode: `import pandas as pd

left_df = pd.DataFrame({
    'emp_id': [1, 2, 3, 4],
    'name': ['Alice', 'Bob', 'Charlie', 'Diana']
})

right_df = pd.DataFrame({
    'emp_id': [3, 4, 5, 6],
    'dept': ['Eng', 'Sales', 'Product', 'Legal']
})

# Inner vs Left vs Outer Joins
inner = pd.merge(left_df, right_df, on='emp_id', how='inner')
print("Inner Join (Intersection [3, 4]):\\n", inner)

outer = pd.merge(left_df, right_df, on='emp_id', how='outer', indicator=True)
print("\\nOuter Join with _merge indicator:\\n", outer)`,
    componentName: 'Stage25MergeJoins'
  },
  {
    id: '26',
    slug: 'concat-append',
    aliases: ['26_concat_append'],
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 12,
    moduleTitle: 'Stacking & Appending',
    title: '26 • Stacking & Concatenation: Vertical (axis=0) vs Horizontal (axis=1)',
    shortDesc: 'Gluing tabular slabs along rows or columns, managing index duplication, and hierarchical key tagging.',
    tags: ['Pandas', 'concat', 'axis=0', 'axis=1', 'ignore_index', 'keys'],
    invariant: 'axis=0: Appends rows vertically • axis=1: Glues columns horizontally along matching index',
    shapeFormula: 'pd.concat([df1, df2], axis=...) -> Concatenated DataFrame',
    theory: {
      title: 'Axis-Wise Tabular Concatenation',
      concept: 'pd.concat binds multiple Series or DataFrames along a designated axis. Vertical concatenation (axis=0) stacks rows, unioning columns. Horizontal concatenation (axis=1) places tables side-by-side, aligning rows according to their shared index.',
      practicalInsight: 'Repeatedly calling df = pd.concat([df, new_row]) inside a loop causes quadratic memory copying (O(N^2)). Always accumulate rows or slices in a standard Python list and call pd.concat(list_of_dfs) once at the end.'
    },
    pythonCode: `import pandas as pd

q1 = pd.DataFrame({'Sales': [100, 150]}, index=['Jan', 'Feb'])
q2 = pd.DataFrame({'Sales': [200, 220]}, index=['Mar', 'Apr'])

# 1. Vertical concatenation (axis=0)
h1_sales = pd.concat([q1, q2], axis=0)
print("Vertical Concat (axis=0):\\n", h1_sales)

# 2. Horizontal concatenation with keys (axis=1)
costs = pd.DataFrame({'Cost': [60, 90, 120, 130]}, index=['Jan', 'Feb', 'Mar', 'Apr'])
pnl = pd.concat([h1_sales, costs], axis=1)
print("\\nHorizontal Concat (axis=1):\\n", pnl)`,
    componentName: 'Stage26ConcatAppend'
  },
  {
    id: '27',
    slug: 'pivot-table-crosstab',
    aliases: ['27_pivot_table_crosstab'],
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 13,
    moduleTitle: 'Reshaping & Hierarchical Indexing',
    title: '27 • pivot_table & crosstab: Multi-Dimensional Reshaping & Margins',
    shortDesc: 'Reshaping normalized long logs into wide aggregate matrices with cross-tabulated dimensions and margins subtotals.',
    tags: ['Pandas', 'pivot_table', 'crosstab', 'margins', 'aggfunc', 'Reshaping'],
    invariant: 'Long format -> Coordinates (index=Row, columns=Col) -> Aggregation -> Wide 2D Grid with Margins',
    shapeFormula: 'df.pivot_table(index=R, columns=C, values=V, aggfunc=F) -> Matrix(len(R), len(C))',
    theory: {
      title: 'Long-to-Wide Matrix Projection',
      concept: 'pivot_table reorganizes a flat tabular dataset by projecting one categorical column along the row axis and another along the column axis. The intersecting cells contain aggregated summaries of a numerical value column computed via aggfunc (mean, sum, count).',
      practicalInsight: 'Setting margins=True computes row and column subtotals alongside a grand total labeled "All". This replicates classical BI spreadsheet pivot tables directly in vectorized Pandas data pipelines.'
    },
    pythonCode: `import pandas as pd

df = pd.DataFrame({
    'Region': ['East', 'West', 'East', 'West', 'East', 'West'],
    'Product': ['Laptop', 'Phone', 'Phone', 'Laptop', 'Laptop', 'Phone'],
    'Sales': [1200, 600, 700, 1500, 800, 650]
})

# Pivot Table with average sales and margins
pivot = df.pivot_table(
    index='Region',
    columns='Product',
    values='Sales',
    aggfunc='mean',
    margins=True
)
print("Pivot Table:\\n", pivot)`,
    componentName: 'Stage27PivotTableCrosstab'
  },
  {
    id: '28',
    slug: 'melt-wide-to-long',
    aliases: ['28_melt_wide_to_long', 'handle-missing-values'],
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 13,
    moduleTitle: 'Reshaping & Hierarchical Indexing',
    title: '28 • melt: Wide-to-Long Normalization & Tidy Data Unpivoting',
    shortDesc: 'Inverting wide columnar matrices back into normalized, tidy long logs by anchoring id_vars and melting value_vars.',
    tags: ['Pandas', 'melt', 'Tidy Data', 'Normalization', 'id_vars', 'value_vars'],
    invariant: 'Wide columns melted into stacked key-value rows: len(melted) = len(df) * len(value_vars)',
    shapeFormula: 'df.melt(id_vars=[...], value_vars=[...]) -> Long DataFrame',
    theory: {
      title: 'Tidy Data Architecture & The Melt Inversion',
      concept: 'pd.melt performs the inverse of pivot_table. It unpivots wide columns into key-value pairs. Identity variables (id_vars) remain fixed as row anchors, while measurement columns (value_vars) are collapsed into a variable column and a value column.',
      practicalInsight: 'Tidy data mandates that each variable forms a column and each observation forms a row. Plotting libraries like Seaborn, Plotly, and Altair require melted long-format tables for grouped color encodings and facet grids.'
    },
    pythonCode: `import pandas as pd

wide_df = pd.DataFrame({
    'City': ['New York', 'London', 'Tokyo'],
    'Q1': [120, 85, 140],
    'Q2': [150, 92, 165],
    'Q3': [135, 88, 155]
})

# Unpivot from Wide to Long
long_df = wide_df.melt(
    id_vars=['City'],
    value_vars=['Q1', 'Q2', 'Q3'],
    var_name='Quarter',
    value_name='Revenue'
)
print("Melted Long DataFrame:\\n", long_df)`,
    componentName: 'Stage28MeltWideToLong'
  },
  {
    id: '29',
    slug: 'histogram-kde',
    aliases: ['29_histogram_kde', 'feature-scaling', 'stack-unstack-multiindex'],
    partId: 'statistics',
    partTitle: 'Part 4: Statistics & Distributions',
    moduleNumber: 3,
    moduleTitle: 'Visual Statistics & Distributions',
    title: '29 • Histogram vs. KDE: Discrete Bins vs. Continuous Kernel Density Estimation',
    shortDesc: 'Contrasting discrete histogram binning artifacts against smooth Gaussian Kernel Density Estimation (KDE) and bandwidth parameter sensitivity.',
    tags: ['Statistics', 'Histogram', 'KDE', 'Gaussian Kernel', 'Bandwidth', 'Probability Density'],
    invariant: 'Discrete bins suffer boundary artifacts; Gaussian KDE integrates to 1.0 (∫ f̂(x) dx ≈ 1.0)',
    shapeFormula: 'f̂(x) = (1 / nh) Σ K((x - x_i) / h) -> Continuous Probability Density',
    theory: {
      title: 'Kernel Density Estimation & Bandwidth Invariants',
      concept: 'Histograms quantize continuous data into arbitrary discrete bins, making the perceived shape heavily dependent on bin width and origin. Kernel Density Estimation (KDE) centers a smooth Gaussian bell curve (kernel) atop each individual observation. Summing and normalizing these kernels yields a continuous, non-parametric probability density function. The bandwidth h acts as a smoothing scale: small h causes overfitting (spiky noise), while large h over-smooths bimodal features into an unimodal blob.',
      practicalInsight: 'Always verify multimodal features with KDE using Scott or Silverman bandwidth heuristics (h ≈ 1.06 · σ · n^(-1/5)) before assuming normality in feature engineering pipelines.'
    },
    pythonCode: `import numpy as np
from sklearn.neighbors import KernelDensity

# Bimodal sample data (N=40)
X = np.array([
    18, 20, 21, 22, 23, 23, 24, 25, 25, 25, 26, 26, 27, 28, 29, 30, 31, 32, 34, 36,
    54, 56, 58, 60, 61, 62, 63, 64, 65, 65, 66, 66, 67, 68, 69, 70, 72, 74, 76, 78
]).reshape(-1, 1)

# Fit Gaussian KDE with bandwidth h=5.5
kde = KernelDensity(bandwidth=5.5, kernel='gaussian')
kde.fit(X)

# Evaluate log-density across domain [0, 100]
x_grid = np.linspace(0, 100, 200).reshape(-1, 1)
log_density = kde.score_samples(x_grid)
density = np.exp(log_density)

print("KDE Peak Density:", round(float(np.max(density)), 4))
print("Integrated Area:", round(float(np.trapz(density, x_grid.ravel())), 3))`,
    componentName: 'Stage29HistogramKde'
  },
  {
    id: '30',
    slug: 'central-tendency-skewness',
    aliases: ['30_central_tendency_skewness', 'categorical-encoding', 'time-series-resample'],
    partId: 'statistics',
    partTitle: 'Part 4: Statistics & Distributions',
    moduleNumber: 3,
    moduleTitle: 'Visual Statistics & Distributions',
    title: '30 • Central Tendency: Mean, Median, Mode & The Impact of Skewness / Outliers',
    shortDesc: 'Visualizing Mode as the density peak, Median as the 50/50 area bisector, and Mean as the center of mass vulnerable to outlier gravity.',
    tags: ['Statistics', 'Central Tendency', 'Mean', 'Median', 'Mode', 'Skewness', 'Outliers'],
    invariant: 'Mode = argmax f(x) • Median bisects area ∫ f(x)dx = 0.5 • Mean μ = ∫ x·f(x)dx pulled by outliers',
    shapeFormula: 'Right-Skewed: Mode < Median < Mean • Left-Skewed: Mean < Median < Mode',
    theory: {
      title: 'Central Tendency Topology & Skewness Invariants',
      concept: 'Mode represents the most frequent value or global peak of the density curve. Median splits the distribution into two equal 50% probability areas, making it resilient to extreme outliers. Mean represents the gravitational center of mass (expected value); extreme values exert leverage, pulling the mean deep into the long tail. In right-skewed data, Mode < Median < Mean. In left-skewed data, Mean < Median < Mode.',
      practicalInsight: 'When reporting central metrics for skewed features (e.g., household incomes, transaction values, web latency), always report the Median alongside the IQR rather than the Mean and standard deviation, as the Mean creates a misleading representation of the typical sample.'
    },
    pythonCode: `import numpy as np
from scipy import stats

# Right-skewed distribution sample
data = np.random.exponential(scale=20, size=500) + 10

# Calculate central tendency metrics
mean_val = np.mean(data)
median_val = np.median(data)
mode_val = float(stats.mode(np.round(data, 0), keepdims=False).mode)
skewness = stats.skew(data)

print(f"Mode: {mode_val:.1f} | Median: {median_val:.1f} | Mean: {mean_val:.1f}")
print(f"Fisher-Pearson Skewness: {skewness:.2f} (Positive = Right-Skewed)")`,
    componentName: 'Stage30CentralTendencySkewness'
  },
  {
    id: '31',
    slug: 'normal-distribution',
    aliases: ['31_normal_distribution', 'normal-distribution', 'rolling-window'],
    partId: 'statistics',
    partTitle: 'Part 4: Statistics & Distributions',
    moduleNumber: 3,
    moduleTitle: 'Visual Statistics & Distributions',
    title: '31 • Normal Distribution: The Gaussian Bell Curve & The 68–95–99.7 Empirical Rule',
    shortDesc: 'Gaussian probability density function, mean (μ) and standard deviation (σ) parameter dynamics, and empirical standard deviation thresholds.',
    tags: ['Statistics', 'Normal Distribution', 'Gaussian', 'Z-Score', 'Empirical Rule', 'Standard Deviation'],
    invariant: 'Integral area is strictly 1.0 (∫ f(x)dx = 1.0) • 68.27% within ±1σ • 95.45% within ±2σ • 99.73% within ±3σ',
    shapeFormula: 'f(x) = (1 / (σ√(2π))) · e^(-0.5 · ((x - μ) / σ)²)',
    theory: {
      title: 'Gaussian Bell Geometry & The Empirical Rule',
      concept: 'The Normal (Gaussian) distribution is uniquely defined by its mean μ (center of location) and standard deviation σ (dispersion/spread). The total probability area under the curve is mathematically conserved at exactly 1.0. As σ widens the curve, the peak density f(μ) drops inversely proportionally to preserve this invariant. Under the Empirical (68-95-99.7) Rule, approximately 68.3% of observations fall within ±1σ, 95.4% within ±2σ, and 99.7% within ±3σ.',
      practicalInsight: 'Z-score standardization (Z = (x - μ) / σ) maps any Gaussian variable to the standard normal distribution N(0, 1), making diverse features directly comparable across machine learning models like SVMs and Logistic Regression.'
    },
    pythonCode: `import numpy as np
from scipy import stats

# Parameters: Mean = 0, Std Dev = 15
mu, sigma = 0, 15
dist = stats.norm(loc=mu, scale=sigma)

# 1. Peak probability density f(μ)
peak_density = dist.pdf(mu)
print(f"Peak Density at mean: {peak_density:.5f}")

# 2. Empirical Rule verification (±1σ, ±2σ, ±3σ)
p_1sigma = dist.cdf(mu + sigma) - dist.cdf(mu - sigma)
p_2sigma = dist.cdf(mu + 2*sigma) - dist.cdf(mu - 2*sigma)
p_3sigma = dist.cdf(mu + 3*sigma) - dist.cdf(mu - 3*sigma)
print(f"±1σ Area: {p_1sigma*100:.2f}% (Target: 68.27%)")
print(f"±2σ Area: {p_2sigma*100:.2f}% (Target: 95.45%)")
print(f"±3σ Area: {p_3sigma*100:.2f}% (Target: 99.73%)")

# 3. Z-Score Standardization
x_val = 22.5
z_score = (x_val - mu) / sigma
percentile = dist.cdf(x_val) * 100
print(f"x={x_val} -> Z-Score: {z_score:.2f} (Percentile: {percentile:.1f}%)")`,
    componentName: 'Stage31NormalDistribution'
  },
  {
    id: '32',
    slug: 'central-limit-theorem',
    aliases: ['32_central_limit_theorem', 'central-limit-theorem', 'memory-optimization-categorical'],
    partId: 'statistics',
    partTitle: 'Part 4: Statistics & Distributions',
    moduleNumber: 3,
    moduleTitle: 'Visual Statistics & Distributions',
    title: '32 • Central Limit Theorem: The Magic of Sampling & Convergence of Sample Means',
    shortDesc: 'Convergence of sample means to a Gaussian normal distribution N(μ, σ²/N) regardless of parent population shape as sample size N increases.',
    tags: ['Statistics', 'Central Limit Theorem', 'Sampling Distribution', 'Standard Error', 'Convergence', 'Sample Mean'],
    invariant: 'X̄ ~ N(μ, σ²/N) as N → ∞ • Standard Error SE = σ / √N • N ≥ 30 standard convergence threshold',
    shapeFormula: 'SE = σ_pop / √N • Convergence as N ≥ 30',
    theory: {
      title: 'The Central Limit Theorem & Standard Error Convergence',
      concept: 'The Central Limit Theorem (CLT) states that when independent random samples of size N are repeatedly drawn from ANY population with finite variance (whether uniform, skewed, or bimodal), the distribution of the sample means X̄ approaches a normal distribution as N grows. The mean of this sampling distribution equals the true population mean μ, and its standard deviation (Standard Error, SE) shrinks proportionally to 1/√N.',
      practicalInsight: 'CLT is the cornerstone of statistical inference, hypothesis testing (Z-tests and t-tests), A/B testing confidence intervals, and Monte Carlo estimation. It justifies assuming normality in sample means even when raw population metrics are heavily non-normal.'
    },
    pythonCode: `import numpy as np
from scipy import stats

# Parent population: Bimodal or Exponential
np.random.seed(42)
pop_size = 100_000
# Mix of two normal clusters: 30% at 25, 70% at 75
pop = np.concatenate([
    np.random.normal(25, 5, int(pop_size * 0.3)),
    np.random.normal(75, 8, int(pop_size * 0.7))
])
pop_mean = np.mean(pop)
pop_std = np.std(pop)

# Draw K=1000 sample experiments with sample size N=30
N = 30
K = 1000
sample_means = [np.mean(np.random.choice(pop, size=N, replace=True)) for _ in range(K)]

# Theoretical vs Empirical Standard Error
theoretical_se = pop_std / np.sqrt(N)
empirical_se = np.std(sample_means)
print(f"Population Mean: {pop_mean:.2f} | Mean of Means: {np.mean(sample_means):.2f}")
print(f"Theoretical SE: {theoretical_se:.3f} | Empirical SE: {empirical_se:.3f}")`,
    componentName: 'Stage32CentralLimitTheorem'
  },
  {
    id: '33',
    slug: 'pdf-cdf-quantiles',
    aliases: ['33_pdf_cdf_quantiles', 'pdf-cdf-quantiles', 'chunking-large-files', '33_chunking_large_files'],
    partId: 'statistics',
    partTitle: 'Part 4: Statistics & Distributions',
    moduleNumber: 3,
    moduleTitle: 'Visual Statistics & Distributions',
    title: '33 • PDF vs. CDF: Quantiles, Percentiles & Probability Integration',
    shortDesc: 'Dual-plane synchronized probability: Area under the PDF curve maps directly to height on the CDF sigmoid curve, with quantile snaps (Q1, Median, Q3, IQR).',
    tags: ['Statistics', 'Probability', 'PDF', 'CDF', 'Quantiles', 'Percentiles', 'IQR'],
    invariant: 'CDF is the running integral of PDF: F(x) = ∫_{-∞}^x f(t)dt • F(x) ∈ [0, 1] • Area under PDF = CDF height',
    shapeFormula: 'F(x) = ∫_{-∞}^x f(t)dt • Q(p) = F⁻¹(p) • IQR = Q₃ - Q₁',
    theory: {
      title: 'Continuous Probability Topology: Density vs. Cumulative Probability',
      concept: 'For any continuous random variable, the point probability P(X = x) is identically zero. Instead, probability exists only over intervals as the area under the Probability Density Function f(x). The Cumulative Distribution Function F(x) = P(X ≤ x) accumulates this area from -∞ to x. The value of F(x) matches the shaded area of f(x) exactly, reaching 0.5 at the median and asymptotically approaching 1.0.',
      practicalInsight: 'Quantiles Q(p) = F⁻¹(p) map probabilities back to feature values. The Interquartile Range (IQR = Q₃ - Q₁) spans the central 50% of the distribution and forms the bedrock of non-parametric outlier detection (Tukey fences: [Q₁ - 1.5·IQR, Q₃ + 1.5·IQR]).'
    },
    pythonCode: `import numpy as np
from scipy import stats

# Standard Normal Distribution N(0, 1)
dist = stats.norm(loc=0, scale=1)

# 1. Point Density vs Cumulative Probability at x = 0 (Median)
pdf_val = dist.pdf(0.0)
cdf_val = dist.cdf(0.0)
print(f"Density f(0): {pdf_val:.4f} | Cumulative Prob F(0): {cdf_val:.4f}")

# 2. Key Quantiles (Percentiles via Percent Point Function / Quantile Function)
q1 = dist.ppf(0.25)
median = dist.ppf(0.50)
q3 = dist.ppf(0.75)
iqr = q3 - q1

print(f"Q1 (25%): {q1:.3f} | Median (50%): {median:.3f} | Q3 (75%): {q3:.3f}")
print(f"Interquartile Range (IQR): {iqr:.3f}")

# 3. Interval Probability P(-1 <= X <= 1)
p_within_1sigma = dist.cdf(1.0) - dist.cdf(-1.0)
print(f"P(-1 <= X <= 1): {p_within_1sigma*100:.2f}%")`,
    componentName: 'Stage33PdfCdfQuantiles'
  },
  {
    id: '34',
    slug: 'correlation-scatter',
    aliases: ['34_correlation_scatter', 'correlation-scatter', 'row-vs-columnar-parquet', '34_row_vs_columnar_parquet'],
    partId: 'statistics',
    partTitle: 'Part 4: Statistics & Distributions',
    moduleNumber: 3,
    moduleTitle: 'Visual Statistics & Distributions',
    title: '34 • Correlation & Scatter Plots: Pearson r, OLS Regression & Non-Linear Traps',
    shortDesc: 'Visualizing Pearson correlation coefficient r, bivariate dispersion, OLS regression slope vs. correlation, centroid quadrant crosshairs, and non-linear traps.',
    tags: ['Statistics', 'Correlation', 'Pearson r', 'OLS Regression', 'Scatter Plot', 'Outliers', 'Leverage', 'Non-Linear'],
    invariant: 'Pearson r = Cov(X,Y)/(σx·σy) ∈ [-1, +1] • OLS slope β₁ = Cov(X,Y)/Var(X) • r measures linear association only',
    shapeFormula: 'r = Σ(x - x̄)(y - ȳ) / √(Σ(x - x̄)² Σ(y - ȳ)²) • ŷ = β₁x + β₀',
    theory: {
      title: 'Bivariate Linear Association, Quadrant Concordance & Regression Leverage',
      concept: 'Pearson correlation r measures the strength and direction of linear association between two continuous variables. By centering coordinates at the centroid (x̄, Ȳ), each point contributes (x - x̄)(y - Ȳ). Concordant points in quadrants I and III yield positive products, while discordant points in quadrants II and IV yield negative products. Ordinary Least Squares (OLS) minimizes the sum of squared vertical residuals Σ(y - ŷ)².',
      practicalInsight: 'Always inspect scatter plots visually! Pearson r can be severely misled: deterministic non-linear curves (e.g. U-shaped parabolas) can produce r ≈ 0, while a single high-leverage outlier can pivot the OLS line and artificially inflate or collapse r. Use Spearman rank correlation when relationships are monotonic but non-linear.'
    },
    pythonCode: `import numpy as np
from scipy import stats

# Generate bivariate data with specified correlation
r_target = 0.75
cov_matrix = [[1.0, r_target], [r_target, 1.0]]
data = np.random.multivariate_normal([50, 50], cov_matrix, size=100)
x, y = data[:, 0], data[:, 1]

# 1. Pearson Correlation & Two-Tailed Significance
r, p_val = stats.pearsonr(x, y)
print(f"Pearson r: {r:.4f} (p-value: {p_val:.4e})")

# 2. OLS Linear Regression (Slope β₁ & Intercept β₀)
slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
r_squared = r_value ** 2
print(f"OLS Fit: y = {slope:.3f}x + {intercept:.2f} | R² = {r_squared*100:.1f}%")

# 3. Robust Non-Parametric Spearman Rank Correlation
spearman_rho, _ = stats.spearmanr(x, y)
print(f"Spearman rho: {spearman_rho:.4f}")`,
    componentName: 'Stage34CorrelationScatter'
  },
  {
    id: '35',
    slug: 'hypothesis-testing',
    aliases: ['35_hypothesis_testing', 'hypothesis-testing', 'feature-scaling-standard-minmax', '35_feature_scaling_standard_minmax'],
    partId: 'statistics',
    partTitle: 'Part 4: Statistics & Distributions',
    moduleNumber: 3,
    moduleTitle: 'Visual Statistics & Distributions',
    title: '35 • Hypothesis Testing: Null Hypothesis H₀, Alpha Thresholds & The Intuition of p-value',
    shortDesc: 'Visualizing sampling distributions under H₀, Type I error α critical rejection tails, test statistic Z_obs, and the geometric intuition of p-value.',
    tags: ['Statistics', 'Hypothesis Testing', 'p-value', 'Significance', 'Null Hypothesis', 'Type I Error', 'Z-Test', 'Critical Region'],
    invariant: 'p-value = P(Data as extreme | H₀ is true) • If p < α: Reject H₀ • If p ≥ α: Fail to Reject H₀ • Two-tailed Z_crit = ±1.96 for α = 0.05',
    shapeFormula: 'Z = (X̄ - μ₀) / (σ / √n) • Reject H₀ iff |Z| ≥ Z_{1 - α/2} (Two-Tailed)',
    theory: {
      title: 'Null Hypothesis Significance Testing (NHST) & The Geometry of p-value',
      concept: 'Hypothesis testing formalizes decision-making under uncertainty. The Null Hypothesis H₀ serves as the skeptical default (e.g. no treatment effect, μ = μ₀). Under H₀, sample test statistics follow a known sampling distribution (e.g. standard normal N(0, 1)). The significance level α defines the critical rejection region: if the observed test statistic Z_obs falls inside this tail, the result is deemed statistically significant. The p-value quantifies the probability of obtaining a test statistic at least as extreme as Z_obs under the assumption that H₀ is strictly true.',
      practicalInsight: 'A p-value is NOT the probability that H₀ is true, nor does it measure effect size. A tiny p-value can result from a negligible effect if sample size n is large. Always pair p-values with effect size measures (Cohen d) and confidence intervals.'
    },
    pythonCode: `import numpy as np
from scipy import stats

# A/B Testing Experiment: Control vs. Treatment
control = np.array([21.4, 23.1, 19.8, 22.5, 20.9, 21.8, 22.2])
treatment = np.array([24.5, 26.1, 23.8, 25.0, 24.2, 25.7, 24.9])

# 1. Independent Two-Sample t-test (Two-Tailed)
t_stat, p_val = stats.ttest_ind(treatment, control, equal_var=False)
alpha = 0.05

print(f"t-statistic: {t_stat:.4f} | p-value: {p_val:.5f}")

# 2. Decision Logic
if p_val < alpha:
    print(f"Decision: REJECT H0 (Statistically significant at alpha={alpha})")
else:
    print(f"Decision: FAIL TO REJECT H0 (Consistent with random noise at alpha={alpha})")`,
    componentName: 'Stage35HypothesisTesting'
  }
]



