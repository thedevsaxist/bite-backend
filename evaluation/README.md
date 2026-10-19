# Evaluation (stage 10)

Measures the system against objective 4 of the report: food-recognition and calorie-estimation
performance, and response time.

Planned layout:

```
evaluation/
├── dataset/
│   ├── images/          # test meal photos
│   └── labels.json      # per image: expected food items and reference calories
├── run.ts               # sends each image through the analysis pipeline
└── results/             # generated reports (git-ignored)
```

Planned metrics:

- **Recognition:** accuracy, precision, recall and F1 over the expected food items
- **Calories:** mean absolute error (MAE) and mean absolute percentage error (MAPE) against reference values
- **Response time:** median and 95th-percentile time per analysis
