export interface MLTopic {
  id: string
  slug: string
  stageNumber: number
  aliases?: string[]
  moduleId: string
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
  status?: 'live' | 'upcoming'
}

export interface MLModule {
  id: string
  moduleNumber: number
  title: string
  desc: string
  color: string
}

export const ML_MODULES: MLModule[] = [
  {
    id: 'foundations',
    moduleNumber: 1,
    title: 'Module 1: ML Foundations & Optimization',
    desc: 'Empirical loss surfaces, convex geometry of OLS, computational graphs, and gradient descent convergence.',
    color: 'brand-blue'
  },
  {
    id: 'linear-models',
    moduleNumber: 2,
    title: 'Module 2: Classical Linear & Generalized Models',
    desc: 'Logistic classification boundaries, margin bounds in SVM, and regularization penalties (L1/L2).',
    color: 'brand-purple'
  },
  {
    id: 'trees-ensembles',
    moduleNumber: 3,
    title: 'Module 3: Decision Trees & Ensembles',
    desc: 'Information gain, Gini impurity recursive partitioning, Random Forests, and Gradient Boosting.',
    color: 'brand-emerald'
  },
  {
    id: 'unsupervised',
    moduleNumber: 4,
    title: 'Module 4: Unsupervised Learning & Dimensionality',
    desc: 'Voronoi cluster tessellations, centroid relocation, inertia curves, and PCA eigenvector projections.',
    color: 'brand-amber'
  }
]

export const ML_TOPICS: MLTopic[] = [
  {
    id: '36',
    slug: 'manual-regression',
    stageNumber: 36,
    aliases: ['36', '36_manual_regression', 'manual-regression'],
    moduleId: 'foundations',
    moduleNumber: 1,
    moduleTitle: 'ML Foundations & Optimization',
    title: '36 • Manual Regression: Loss Surface, Error Squares & The Geometry of OLS',
    shortDesc: 'Interactive manual parameter exploration (w, b), visualizing geometric squared error areas, centroid pivot invariants, and analytical OLS minimums.',
    tags: ['Machine Learning', 'Linear Regression', 'OLS', 'Loss Function', 'MSE', 'Residuals', 'Convex Optimization'],
    invariant: 'L(w, b) = (1/N)·Σ(yᵢ - (wxᵢ + b))² is strictly convex • OLS line must pass through centroid (X̄, Ȳ) • Global minimum at w*, b*',
    shapeFormula: 'ŷ = wx + b • MSE = (1/N)·Σ eᵢ² • w* = Cov(X,Y)/Var(X) • b* = Ȳ - w*X̄',
    theory: {
      title: 'Loss Surfaces, Error Squares & The Geometry of Linear Fit',
      concept: 'Supervised machine learning seeks model parameters that minimize an empirical loss function. For simple linear regression ŷ = wx + b, Mean Squared Error (MSE) penalizes vertical residuals e_i = y_i - ŷ_i quadratically. When visualized geometrically, each error manifests as a physical square of area e_i²; OLS finds the unique hyperplane that minimizes the total sum of these geometric areas. Because the MSE loss surface is a strictly convex parabolic bowl in (w, b) space, it possesses a single unique global minimum given analytically by the Normal Equation without local minima traps.',
      practicalInsight: 'The regression line is mathematically forced to pass through the dataset centroid (X̄, Ȳ). Tuning slope w rotates the line around the centroid, while tuning bias b shifts the vertical baseline. Visualizing error squares exposes why L2 loss is heavily distorted by extreme outliers compared to L1 (Mean Absolute Error).'
    },
    pythonCode: `import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score

# Sample dataset
X = np.array([1.5, 2.2, 3.0, 3.8, 4.5, 5.2, 6.0, 6.8, 7.5, 8.2, 9.0, 9.6]).reshape(-1, 1)
y = np.array([44.0, 51.5, 55.0, 61.0, 64.5, 70.0, 76.5, 79.0, 84.0, 88.5, 94.0, 97.0])

# 1. Fit Analytical OLS
model = LinearRegression(fit_intercept=True)
model.fit(X, y)

w_opt = model.coef_[0]
b_opt = model.intercept_
y_hat = model.predict(X)

print(f"Optimal Model: y = {w_opt:.3f}x + {b_opt:.2f}")
print(f"Minimum MSE: {mean_squared_error(y, y_hat):.3f} | R² Score: {r2_score(y, y_hat):.3f}")`,
    componentName: 'Stage36ManualRegression',
    status: 'live'
  },
  {
    id: '37',
    slug: 'training-engine',
    stageNumber: 37,
    aliases: ['37', '37_training_engine', 'training-engine'],
    moduleId: 'foundations',
    moduleNumber: 1,
    moduleTitle: 'ML Foundations & Optimization',
    title: '37 • The Live Training Engine: Forward/Backward Passes & Dual Convergence',
    shortDesc: 'Interactive training simulator: computational graph forward/backward passes, batch gradient descent, learning rate stability, and dual Loss vs. Accuracy convergence.',
    tags: ['Machine Learning', 'Gradient Descent', 'Backpropagation', 'Loss Convergence', 'Learning Rate', 'R²', 'Computational Graph'],
    invariant: 'w ← w - α·(∂J/∂w), b ← b - α·(∂J/∂b) • Optimal α guarantees monotonic loss descent to global minimum',
    shapeFormula: '∇w = -(2/N)·Σ x(y - ŷ) • ∇b = -(2/N)·Σ (y - ŷ) • Dual: Loss(t) ↓ vs Accuracy(t) ↑',
    theory: {
      title: 'Automatic Differentiation, Chain Rule & Dual Convergence Dynamics',
      concept: 'Training a machine learning model is an iterative optimization process. In the Forward Pass, input features propagate through linear operations (w·x + b) to yield predictions ŷ and compute scalar loss J(w, b) = (1/N)·Σ (y - ŷ)². In the Backward Pass (Backpropagation), the multivariate Chain Rule propagates gradients backwards: ∂J/∂ŷ = -2(y - ŷ), yielding parameter sensitivities ∂J/∂w = (∂J/∂ŷ)·x and ∂J/∂b = (∂J/∂ŷ)·1. Batch Gradient Descent shifts weights in the opposite direction of the gradient vector by step size α.',
      practicalInsight: 'Learning rate α governs convergence speed and stability. An overly conservative learning rate crawls slowly towards the minimum, while an excessively aggressive learning rate overshoots the quadratic basin, producing numerical instability, exploding loss, and collapsed accuracy.'
    },
    pythonCode: `import torch
import torch.nn as nn
import torch.optim as optim

# 1. Linear Model & Loss Function
model = nn.Linear(in_features=1, out_features=1)
criterion = nn.MSELoss()
optimizer = optim.SGD(model.parameters(), lr=0.025)

# 2. Training Loop with Dual Metrics Tracking
for epoch in range(60):
    # Forward Pass
    y_pred = model(X_tensor)
    loss = criterion(y_pred, y_tensor)
    
    # Backward Pass (Chain Rule Backpropagation)
    optimizer.zero_grad()
    loss.backward()
    
    # Gradient Descent Step
    optimizer.step()
    
    # Dual Evaluation: Loss & R² Accuracy
    r2_score = 1.0 - (loss.item() / torch.var(y_tensor, unbiased=False).item())
    if epoch % 10 == 0:
        print(f"Epoch {epoch:02d} | Loss: {loss.item():.3f} | Accuracy (R²): {r2_score*100:.1f}%")`,
    componentName: 'Stage37TrainingEngine',
    status: 'live'
  }
]

