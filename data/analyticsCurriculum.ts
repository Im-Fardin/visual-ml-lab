export interface AnalyticsTopic {
  id: string
  slug: string
  aliases?: string[]
  partId: 'numpy' | 'pandas' | 'preprocessing' | 'statistics'
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
  id: 'numpy' | 'pandas' | 'preprocessing' | 'statistics'
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
    id: 'preprocessing',
    title: 'Part 3: Feature Engineering & Preprocessing',
    desc: 'Feature scaling, categorical encoding, and leakage-free dataset partitioning.',
    color: 'brand-emerald'
  },
  {
    id: 'statistics',
    title: 'Part 4: Statistics & Distributions',
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
    aliases: ['28_melt_wide_to_long'],
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
    slug: 'stack-unstack-multiindex',
    aliases: ['29_stack_unstack_multiindex'],
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 13,
    moduleTitle: 'Reshaping & Hierarchical Indexing',
    title: '29 • stack & unstack: Hierarchical MultiIndex Rotations',
    shortDesc: 'Pivoting levels between the row index and column index in hierarchical multi-level tables.',
    tags: ['Pandas', 'MultiIndex', 'stack', 'unstack', 'Hierarchical', 'Level Rotation'],
    invariant: 'stack(): moves column level to innermost row index • unstack(): moves row level to column headers',
    shapeFormula: 'stack(level) -> MultiIndex Rows • unstack(level) -> MultiIndex Columns',
    theory: {
      title: 'Hierarchical Level Transposition',
      concept: 'stack() pushes a level from column headers downward into the row MultiIndex, increasing row depth and narrowing table width. unstack() does the exact opposite: it lifts an inner row MultiIndex level up into the column headers, widening the table.',
      practicalInsight: 'MultiIndex levels provide a powerful mechanism to represent N-dimensional hypercubes within a 2D tabular structure without losing relational metadata.'
    },
    pythonCode: `import pandas as pd

# MultiIndex columns
cols = pd.MultiIndex.from_tuples([
    ('2023', 'Revenue'), ('2023', 'Profit'),
    ('2024', 'Revenue'), ('2024', 'Profit')
], names=['Year', 'Metric'])

df = pd.DataFrame([[100, 20, 130, 28], [80, 15, 95, 22]], index=['US', 'EU'], columns=cols)
print("Original MultiIndex Columns:\\n", df)

# Stack year column level into rows
stacked = df.stack(level='Year')
print("\\nAfter df.stack(level='Year'):\\n", stacked)

# Unstack back to wide matrix
unstacked = stacked.unstack(level='Year')
print("\\nAfter df.unstack(level='Year'):\\n", unstacked)`,
    componentName: 'Stage29StackUnstackMultiIndex'
  },
  {
    id: '30',
    slug: 'time-series-resample',
    aliases: ['30_time_series_resample'],
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 14,
    moduleTitle: 'Time-Series & Window Analytics',
    title: '30 • Time-Series: DatetimeIndex Resampling & Gap Filling',
    shortDesc: 'Frequency conversion on DatetimeIndex: Downsampling with aggregate reductions vs Upsampling with forward-fill interpolation.',
    tags: ['Pandas', 'resample', 'DatetimeIndex', 'Downsampling', 'Upsampling', 'ffill', 'Time Series'],
    invariant: 'Downsample: Groups timestamps into frequency intervals • Upsample: Expands time grid and fills NaNs',
    shapeFormula: 'df.resample(rule).agg() -> Resampled DataFrame',
    theory: {
      title: 'Temporal Resampling & Frequency Mechanics',
      concept: 'resample() is essentially a time-aware groupby operating on a DatetimeIndex. Downsampling collapses high-frequency timestamps into coarser intervals (e.g., Daily to Weekly) using aggregation. Upsampling increases temporal resolution (e.g., Daily to 12-Hour), introducing gap intervals requiring forward-fill (ffill), backfill (bfill), or linear interpolation.',
      practicalInsight: 'Temporal alignment requires strict avoidance of lookahead bias in machine learning pipelines: when upsampling feature streams, always use ffill() rather than bfill() or future-looking interpolations to prevent data leakage.'
    },
    pythonCode: `import pandas as pd
import numpy as np

dates = pd.date_range('2024-01-01', periods=7, freq='D')
df = pd.DataFrame({'power_kw': [42.5, 48.0, 39.2, 55.8, 62.1, 51.4, 46.7]}, index=dates)

# 1. Downsampling to 3-day mean bins
downsampled = df.resample('3D').mean()
print("3-Day Downsampled Mean:\\n", downsampled)

# 2. Upsampling to 12-hour frequency with forward-fill
upsampled = df.iloc[:3].resample('12h').ffill()
print("\\n12-Hour Upsampled with ffill():\\n", upsampled)`,
    componentName: 'Stage30TimeSeriesResample'
  },
  {
    id: '31',
    slug: 'rolling-window',
    aliases: ['31_rolling_window'],
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 14,
    moduleTitle: 'Time-Series & Window Analytics',
    title: '31 • Rolling Windows: Moving Statistics & Min-Periods Constraints',
    shortDesc: 'Sliding causal window brackets, moving mean/std calculations, initial NaN propagation, and min_periods relaxation.',
    tags: ['Pandas', 'rolling', 'Moving Average', 'Window', 'min_periods', 'NaN'],
    invariant: 'rolling(W) requires W preceding samples by default, yielding W-1 initial NaNs unless min_periods=1',
    shapeFormula: 's.rolling(window=W, min_periods=P).mean() -> Smoothed Series',
    theory: {
      title: 'Sliding Window Invariants & Causal Smoothing',
      concept: 'df.rolling(W) computes moving statistics over a sliding bracket of length W. Because operations are causal, early timesteps lack sufficient historical samples, producing W - 1 initial NaNs. Setting min_periods=1 relaxes this constraint, computing statistics immediately with whatever observations are currently available.',
      practicalInsight: 'Rolling calculations serve as foundational feature engineering primitives for trend detection, volatility estimation, and algorithmic signal smoothing in quantitative trading.'
    },
    pythonCode: `import pandas as pd

prices = pd.Series([100, 104, 102, 110, 108, 115, 120, 118])

# 1. Standard rolling 3-period mean (produces 2 initial NaNs)
rolling_mean = prices.rolling(window=3).mean()
print("Rolling 3-Period Mean (Default min_periods=3):\\n", rolling_mean)

# 2. Rolling mean with min_periods=1 (no initial NaNs)
rolling_no_nans = prices.rolling(window=3, min_periods=1).mean()
print("\\nRolling Mean with min_periods=1:\\n", rolling_no_nans)`,
    componentName: 'Stage31RollingWindow'
  },
  {
    id: '32',
    slug: 'memory-optimization-categorical',
    aliases: ['32_memory_optimization_categorical'],
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 15,
    moduleTitle: 'High-Performance Data Engineering',
    title: '32 • Memory Optimization: Categorical Dtypes & RAM Compaction',
    shortDesc: 'Replacing bloated 64-bit Python string object pointers with compact 8-bit integer dictionary codes, slashing memory footprints by 85%+.',
    tags: ['Pandas', 'category', 'astype', 'Memory Optimization', 'Dtypes', 'RAM'],
    invariant: 'object dtype: 64-bit ptr + heap PyObject (86B/row) • category: int8 code (1B/row) + shared dictionary',
    shapeFormula: 's.astype("category") -> 80-90% RAM reduction on low-cardinality strings',
    theory: {
      title: 'String Object Bloat vs. Dictionary Encoding',
      concept: 'In standard Pandas, text columns use dtype="object", where each row holds a 64-bit pointer pointing to an individual PyUnicodeObject on the Python heap (~86 bytes per cell). Categorical encoding (astype("category")) creates a shared lookup dictionary of unique values and represents each cell with a compact integer code (int8 = 1 byte).',
      practicalInsight: 'Converting repetitive text columns (state, department, status, category) to categorical dtypes can shrink 10 GB datasets down to 1.5 GB, allowing large-scale data science pipelines to run entirely in RAM without swapping.'
    },
    pythonCode: `import pandas as pd
import numpy as np

# Create repeated text series
cities = pd.Series(['New York', 'London', 'Tokyo', 'New York', 'London'] * 20000)

print("Object Dtype Memory:", cities.memory_usage(deep=True) / 1024, "KB")

# Convert to category
cat_cities = cities.astype('category')
print("Categorical Memory:", cat_cities.memory_usage(deep=True) / 1024, "KB")

# Inspect underlying codes and categories
print("Internal Codes (int8):", cat_cities.cat.codes.head(5).values)
print("Shared Categories:", cat_cities.cat.categories.values)`,
    componentName: 'Stage32MemoryCategorical'
  },
  {
    id: '33',
    slug: 'chunking-large-files',
    aliases: ['33_chunking_large_files'],
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 15,
    moduleTitle: 'High-Performance Data Engineering',
    title: '33 • Out-of-Core Processing: chunksize Streaming Generators',
    shortDesc: 'Processing datasets larger than physical RAM by streaming bounded chunk slices from disk into memory with running accumulators.',
    tags: ['Pandas', 'chunksize', 'read_csv', 'Out-of-Core', 'Generators', 'MemoryError'],
    invariant: 'Peak RAM remains bounded at O(chunksize) rather than exploding to O(N)',
    shapeFormula: 'pd.read_csv(file, chunksize=N) -> TextFileReader Generator',
    theory: {
      title: 'Bounded Streaming vs. Monolithic File Ingestion',
      concept: 'Ingesting massive CSV files via pd.read_csv() causes Out-Of-Memory (OOM) crashes if the dataset exceeds available RAM. Passing chunksize=N returns an iterable TextFileReader generator that yields DataFrames of N rows at a time, allowing continuous batch aggregation with constant memory consumption.',
      practicalInsight: 'Combine chunksize streaming with filtering to process massive event logs: filter relevant rows inside the chunk loop and append only the filtered subsets into a final collected DataFrame.'
    },
    pythonCode: `import pandas as pd

total_sales = 0
total_transactions = 0

# Stream 1000 rows at a time with constant RAM
for chunk in pd.read_csv('massive_transactions.csv', chunksize=1000):
    total_sales += chunk['amount'].sum()
    total_transactions += len(chunk)
    # Chunk memory is automatically freed by Python garbage collector!

print(f"Total Processed: \${total_sales:,.2f} across {total_transactions:,} rows")`,
    componentName: 'Stage33ChunkingLargeFiles'
  },
  {
    id: '34',
    slug: 'row-vs-columnar-parquet',
    aliases: ['34_row_vs_columnar_parquet'],
    partId: 'pandas',
    partTitle: 'Part 2: Pandas Tabular Processing',
    moduleNumber: 15,
    moduleTitle: 'High-Performance Data Engineering',
    title: '34 • Row vs. Columnar Storage: Parquet Projection Pushdown & Compression',
    shortDesc: 'Comparing full-scan row formats (CSV) against columnar storage (Apache Parquet) with column projection pushdown and Snappy compression.',
    tags: ['Pandas', 'Parquet', 'CSV', 'Columnar', 'Projection Pushdown', 'Snappy', 'Arrow'],
    invariant: 'CSV: 100% full file disk scan • Parquet: Reads ONLY the queried column byte blocks from disk',
    shapeFormula: 'pd.read_parquet(file, columns=[col]) -> Skips 85%+ disk I/O',
    theory: {
      title: 'Columnar File Architecture & Projection Pushdown',
      concept: 'CSV files store data in row-major order: every single line must be read from disk and parsed to access any individual field. Apache Parquet stores data column-by-column in binary blocks. Projection pushdown allows the engine to seek directly to the byte offset of requested columns, bypassing all other columns completely.',
      practicalInsight: 'Switching production data lakes from CSV/JSON to Parquet typically cuts disk storage by 75% and query execution time by 10x-50x due to vectorized column decoding and bypassed disk I/O.'
    },
    pythonCode: `import pandas as pd

# Ingestion benchmark:
# 1. CSV: Full table scan reading all columns
# df_csv = pd.read_csv('large_dataset.csv')

# 2. Parquet: Reads ONLY the required columns directly from disk
df_parquet = pd.read_parquet('large_dataset.parquet', columns=['salary', 'department'])

print("Parquet Columns Loaded:", list(df_parquet.columns))
print("Memory Usage:", df_parquet.memory_usage(deep=True).sum() / 1024, "KB")`,
    componentName: 'Stage34RowVsColumnarParquet'
  },
  {
    id: '35',
    slug: 'feature-scaling-standard-minmax',
    aliases: ['35_feature_scaling_standard_minmax'],
    partId: 'preprocessing',
    partTitle: 'Part 3: Feature Engineering & Preprocessing',
    moduleNumber: 16,
    moduleTitle: 'Feature Scaling & Normalization',
    title: '35 • Feature Scaling: StandardScaler vs. MinMaxScaler vs. RobustScaler',
    shortDesc: 'Contrasting mean-variance standardization (z-score), bounded min-max compression [0, 1], and median-IQR outlier resilience.',
    tags: ['Preprocessing', 'StandardScaler', 'MinMaxScaler', 'RobustScaler', 'Outliers', 'Feature Scaling'],
    invariant: 'Standard: z=(x-μ)/σ • MinMax: (x-min)/(max-min) squashes under outliers • Robust: (x-Q2)/IQR preserves resolution',
    shapeFormula: 'X_scaled = scaler.fit_transform(X) -> Matrix(N, M)',
    theory: {
      title: 'Geometric Distortion & Outlier Vulnerability in Feature Scaling',
      concept: 'Distance-based algorithms (KNN, SVM, K-Means) and gradient-based optimizers (Logistic Regression, Neural Networks) are severely biased when features possess disparate scales. StandardScaler centers features at μ=0 with unit variance, but extreme outliers inflate σ and drag μ. MinMaxScaler compresses features strictly into [0, 1], causing extreme outliers to squash all legitimate variance into a narrow sliver near 0. RobustScaler subtracts the median (Q2) and divides by the Interquartile Range (IQR = Q3 - Q1), making it impervious to outlier distortion.',
      practicalInsight: 'Never use MinMaxScaler on unbounded real-world features prone to extreme anomalies (e.g., transaction amounts, server latency). Prefer RobustScaler when outliers cannot be safely trimmed, or StandardScaler when data is approximately Gaussian.'
    },
    pythonCode: `from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler
import numpy as np

# Housing sq ft with extreme outlier
X = np.array([[1200], [1450], [1600], [1750], [1900], [2100], [15000]])

# 1. StandardScaler (Outlier drags mean and inflates std)
z_scaled = StandardScaler().fit_transform(X)

# 2. MinMaxScaler (Outlier lands at 1.0; squashes normal houses into [0.0, 0.065])
mm_scaled = MinMaxScaler().fit_transform(X)

# 3. RobustScaler (Median=1750, IQR=650; normal houses preserve spread)
rob_scaled = RobustScaler().fit_transform(X)

print("MinMax Normal Range:", mm_scaled[:6].min(), "to", mm_scaled[:6].max())
print("Robust Normal Range:", rob_scaled[:6].min(), "to", rob_scaled[:6].max())`,
    componentName: 'Stage35FeatureScaling'
  },
  {
    id: '36',
    slug: 'categorical-encoding',
    aliases: ['36_categorical_encoding'],
    partId: 'preprocessing',
    partTitle: 'Part 3: Feature Engineering & Preprocessing',
    moduleNumber: 17,
    moduleTitle: 'Categorical Transformations',
    title: '36 • Categorical Encoding: Ordinal vs. One-Hot & The Dummy Variable Trap',
    shortDesc: 'Converting qualitative attributes into numerical arrays, understanding orthogonal basis vectors, and dropping baseline dummies.',
    tags: ['Preprocessing', 'OneHotEncoder', 'OrdinalEncoder', 'Dummy Variable Trap', 'Multicollinearity', 'get_dummies'],
    invariant: 'Ordinal implies monotonic order (A < B < C) • One-Hot creates orthogonal basis vectors • drop="first" prevents singular design matrices',
    shapeFormula: 'OneHot(K categories, drop=None) -> (N, K) • OneHot(drop="first") -> (N, K-1)',
    theory: {
      title: 'Categorical Vector Spaces & Multicollinearity',
      concept: 'Machine learning models require numerical matrices. Ordinal encoding maps qualitative categories to integer ranks, which is mathematically sound ONLY when an intrinsic hierarchy exists (Bronze < Silver < Gold). For nominal variables (Paris, Tokyo, London), ordinal encoding introduces artificial false distance relationships. One-Hot encoding expands nominal categories into K orthogonal binary basis vectors. When a model includes a bias intercept, the K columns sum to 1, causing perfect multicollinearity (The Dummy Variable Trap); dropping the first column (drop="first") restores full rank without information loss.',
      practicalInsight: 'Tree-based models (Random Forests, LightGBM) can handle high-cardinality ordinal encodings without ill effects, whereas linear models and neural networks require One-Hot or Target encoding to avoid imposing artificial geometric topology.'
    },
    pythonCode: `import pandas as pd
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder

df = pd.DataFrame({
    'Tier': ['Bronze', 'Silver', 'Gold', 'Platinum'],
    'City': ['London', 'Paris', 'Tokyo', 'Paris']
})

# 1. Ordinal Encoding for hierarchical data
ord_enc = OrdinalEncoder(categories=[['Bronze', 'Silver', 'Gold', 'Platinum']])
df['Tier_Rank'] = ord_enc.fit_transform(df[['Tier']])

# 2. One-Hot with drop='first' to prevent Dummy Variable Trap
ohe = OneHotEncoder(drop='first', sparse_output=False)
city_encoded = ohe.fit_transform(df[['City']])
print("One-Hot (drop='first', K-1 columns):\\n", city_encoded)`,
    componentName: 'Stage36CategoricalEncoding'
  },
  {
    id: '37',
    slug: 'train-test-split-leakage',
    aliases: ['37_train_test_split_leakage'],
    partId: 'preprocessing',
    partTitle: 'Part 3: Feature Engineering & Preprocessing',
    moduleNumber: 18,
    moduleTitle: 'Dataset Validation & Partitioning',
    title: '37 • Dataset Partitioning: Stratification & The Data Leakage Sin',
    shortDesc: 'Partitioning feature matrices, enforcing balanced target stratification, and upholding the statistical firewall between train and test sets.',
    tags: ['Preprocessing', 'train_test_split', 'Stratification', 'Data Leakage', 'fit_transform', 'Statistical Firewall'],
    invariant: 'Transformers must fit() ONLY on X_train; they must merely transform() X_test and X_val',
    shapeFormula: 'train_test_split(X, y, test_size=0.2, stratify=y) -> X_train, X_test, y_train, y_test',
    theory: {
      title: 'The Statistical Firewall & Out-of-Sample Integrity',
      concept: 'Data leakage occurs when information from outside the training dataset is used to create or fit the model. Fitting any transformer (scaler, imputer, encoder, PCA) on the entire dataset before splitting leaks the test distribution (mean, standard deviation, category vocabulary) into the training pipeline, leading to dangerously optimistic offline metrics and catastrophic real-world failures. Stratification ensures class balance is strictly preserved across partitions for imbalanced targets.',
      practicalInsight: 'Always wrap preprocessing and estimators into an sklearn Pipeline. Pipelines automatically fit transformers exclusively on training folds during cross-validation, guaranteeing an airtight statistical firewall.'
    },
    pythonCode: `from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import numpy as np

X = np.array([[45], [120], [80], [210], [65], [140], [95], [4800], [5200], [3900]])
y = np.array([0, 0, 0, 0, 0, 0, 0, 1, 1, 1]) # Imbalanced (30% fraud)

# 1. Split FIRST with stratification
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)

# 2. Fit scaler EXCLUSIVELY on training data
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train) # Computes μ_train ONLY

# 3. Transform test data with frozen training parameters
X_test_scaled = scaler.transform(X_test)
print("Airtight statistical firewall preserved!")`,
    componentName: 'Stage37TrainTestSplitLeakage'
  }
]



