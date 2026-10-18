/**
 * utils/syntheticData.ts
 * Deterministic synthetic data generator, analytical Ordinary Least Squares (OLS) solver,
 * and statistical regression loss utilities for Machine Learning visualization stages.
 */

export interface DataPoint {
  id: number
  x: number
  y: number
}

export interface RegressionPreset {
  id: string
  name: string
  description: string
  xLabel: string
  yLabel: string
  xDomain: [number, number]
  yDomain: [number, number]
  points: DataPoint[]
  optimalW: number
  optimalB: number
  optimalMse: number
  optimalMae: number
  optimalR2: number
  meanX: number
  meanY: number
}

export interface ResidualInfo {
  x: number
  y: number
  yHat: number
  residual: number // y - yHat
  squaredError: number // (y - yHat)^2
  absError: number // |y - yHat|
}

export interface LossEvaluation {
  residuals: ResidualInfo[]
  mse: number
  rmse: number
  mae: number
  r2: number
  totalSquaredError: number
  meanX: number
  meanY: number
}

/**
 * Analytical Ordinary Least Squares (OLS) solver for simple linear regression:
 * y_hat = w * x + b
 */
export function solveOLS(points: DataPoint[]): {
  w: number
  b: number
  mse: number
  mae: number
  r2: number
  meanX: number
  meanY: number
} {
  const n = points.length
  if (n === 0) {
    return { w: 0, b: 0, mse: 0, mae: 0, r2: 0, meanX: 0, meanY: 0 }
  }

  let sumX = 0
  let sumY = 0
  for (let i = 0; i < n; i++) {
    sumX += points[i].x
    sumY += points[i].y
  }
  const meanX = sumX / n
  const meanY = sumY / n

  let numerator = 0
  let denominator = 0
  let ssTot = 0

  for (let i = 0; i < n; i++) {
    const dx = points[i].x - meanX
    const dy = points[i].y - meanY
    numerator += dx * dy
    denominator += dx * dx
    ssTot += dy * dy
  }

  const w = denominator !== 0 ? numerator / denominator : 0
  const b = meanY - w * meanX

  let ssRes = 0
  let sumAbs = 0
  for (let i = 0; i < n; i++) {
    const yHat = w * points[i].x + b
    const err = points[i].y - yHat
    ssRes += err * err
    sumAbs += Math.abs(err)
  }

  const mse = ssRes / n
  const mae = sumAbs / n
  const r2 = ssTot !== 0 ? Math.max(0, 1 - ssRes / ssTot) : 1

  return {
    w: Number(w.toFixed(4)),
    b: Number(b.toFixed(4)),
    mse: Number(mse.toFixed(4)),
    mae: Number(mae.toFixed(4)),
    r2: Number(r2.toFixed(4)),
    meanX: Number(meanX.toFixed(4)),
    meanY: Number(meanY.toFixed(4))
  }
}

/**
 * Evaluate loss metrics and individual residuals for any arbitrary (w, b) parameters
 */
export function evaluateRegression(
  points: DataPoint[],
  w: number,
  b: number
): LossEvaluation {
  const n = points.length
  if (n === 0) {
    return {
      residuals: [],
      mse: 0,
      rmse: 0,
      mae: 0,
      r2: 0,
      totalSquaredError: 0,
      meanX: 0,
      meanY: 0
    }
  }

  let sumY = 0
  let sumX = 0
  for (let i = 0; i < n; i++) {
    sumX += points[i].x
    sumY += points[i].y
  }
  const meanX = sumX / n
  const meanY = sumY / n

  let ssTot = 0
  let ssRes = 0
  let sumAbs = 0

  const residuals: ResidualInfo[] = points.map((p) => {
    const yHat = w * p.x + b
    const residual = p.y - yHat
    const squaredError = residual * residual
    const absError = Math.abs(residual)

    ssTot += (p.y - meanY) * (p.y - meanY)
    ssRes += squaredError
    sumAbs += absError

    return {
      x: p.x,
      y: p.y,
      yHat,
      residual,
      squaredError,
      absError
    }
  })

  const mse = ssRes / n
  const rmse = Math.sqrt(mse)
  const mae = sumAbs / n
  const r2 = ssTot !== 0 ? 1 - ssRes / ssTot : 0

  return {
    residuals,
    mse,
    rmse,
    mae,
    r2,
    totalSquaredError: ssRes,
    meanX,
    meanY
  }
}

// ---------------------------------------------------------------------------
// Deterministic Curated Regression Presets
// ---------------------------------------------------------------------------

const PRESET_1_POINTS: DataPoint[] = [
  { id: 1, x: 1.5, y: 44.0 },
  { id: 2, x: 2.2, y: 51.5 },
  { id: 3, x: 3.0, y: 55.0 },
  { id: 4, x: 3.8, y: 61.0 },
  { id: 5, x: 4.5, y: 64.5 },
  { id: 6, x: 5.2, y: 70.0 },
  { id: 7, x: 6.0, y: 76.5 },
  { id: 8, x: 6.8, y: 79.0 },
  { id: 9, x: 7.5, y: 84.0 },
  { id: 10, x: 8.2, y: 88.5 },
  { id: 11, x: 9.0, y: 94.0 },
  { id: 12, x: 9.6, y: 97.0 }
]

const PRESET_2_POINTS: DataPoint[] = [
  { id: 1, x: 10.0, y: 195.0 },
  { id: 2, x: 12.5, y: 230.0 },
  { id: 3, x: 14.0, y: 220.0 },
  { id: 4, x: 16.5, y: 285.0 },
  { id: 5, x: 18.0, y: 310.0 },
  { id: 6, x: 20.5, y: 340.0 },
  { id: 7, x: 22.0, y: 395.0 },
  { id: 8, x: 24.5, y: 410.0 },
  { id: 9, x: 26.0, y: 460.0 },
  { id: 10, x: 28.5, y: 480.0 },
  { id: 11, x: 31.0, y: 540.0 },
  { id: 12, x: 33.5, y: 590.0 }
]

const PRESET_3_POINTS: DataPoint[] = [
  { id: 1, x: 14.0, y: 65.0 },
  { id: 2, x: 17.0, y: 80.0 },
  { id: 3, x: 20.0, y: 115.0 },
  { id: 4, x: 22.5, y: 130.0 },
  { id: 5, x: 25.0, y: 180.0 },
  { id: 6, x: 27.5, y: 225.0 },
  { id: 7, x: 30.0, y: 270.0 },
  { id: 8, x: 32.5, y: 310.0 },
  { id: 9, x: 35.0, y: 360.0 },
  { id: 10, x: 37.5, y: 395.0 }
]

const PRESET_4_POINTS: DataPoint[] = [
  { id: 1, x: 2.0, y: 48.0 },
  { id: 2, x: 3.0, y: 54.0 },
  { id: 3, x: 4.0, y: 62.0 },
  { id: 4, x: 5.0, y: 70.0 },
  { id: 5, x: 6.0, y: 77.0 },
  { id: 6, x: 7.0, y: 85.0 },
  { id: 7, x: 8.0, y: 92.0 },
  { id: 8, x: 8.5, y: 30.0 } // High-leverage outlier
]

function createPreset(
  id: string,
  name: string,
  description: string,
  xLabel: string,
  yLabel: string,
  xDomain: [number, number],
  yDomain: [number, number],
  points: DataPoint[]
): RegressionPreset {
  const ols = solveOLS(points)
  return {
    id,
    name,
    description,
    xLabel,
    yLabel,
    xDomain,
    yDomain,
    points,
    optimalW: ols.w,
    optimalB: ols.b,
    optimalMse: ols.mse,
    optimalMae: ols.mae,
    optimalR2: ols.r2,
    meanX: ols.meanX,
    meanY: ols.meanY
  }
}

export const REGRESSION_PRESETS: RegressionPreset[] = [
  createPreset(
    'study-hours',
    'Study Hours vs. Exam Score',
    'Linear relationship between dedicated study hours and final exam grades (0-100%).',
    'Study Hours (h)',
    'Exam Score (%)',
    [0, 11],
    [30, 105],
    PRESET_1_POINTS
  ),
  createPreset(
    'house-prices',
    'Area vs. House Price',
    'Real-estate appraisal: Living area in 100 sq ft vs. sale price in thousands of dollars.',
    'Area (100 sq ft)',
    'Price ($1,000s)',
    [8, 36],
    [150, 650],
    PRESET_2_POINTS
  ),
  createPreset(
    'temp-sales',
    'Temperature vs. Beverage Sales',
    'Summer concession sales: Daily peak temperature (°C) vs. iced beverage units sold.',
    'Max Temperature (°C)',
    'Units Sold',
    [10, 42],
    [30, 440],
    PRESET_3_POINTS
  ),
  createPreset(
    'outlier-challenge',
    'Outlier Distortion Challenge',
    'Linear trend contaminated by a single extreme high-leverage outlier. Observe how OLS is dragged down.',
    'Study Hours (h)',
    'Exam Score (%)',
    [0, 10],
    [15, 105],
    PRESET_4_POINTS
  )
]

