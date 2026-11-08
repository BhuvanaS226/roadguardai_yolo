import argparse
import json
from pathlib import Path

from ultralytics import YOLO


PROJECT_ROOT = Path(__file__).resolve().parent


def _project_path(path: str) -> Path:
    candidate = Path(path)
    if not candidate.is_absolute():
        candidate = PROJECT_ROOT / candidate
    return candidate


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate a YOLO model against a labeled dataset split."
    )
    parser.add_argument(
        "--model",
        default="best.pt",
        help="Model weights path (default: best.pt in the project root).",
    )
    parser.add_argument(
        "--data",
        required=True,
        help="Path to the dataset YAML containing a labeled validation split.",
    )
    parser.add_argument(
        "--imgsz",
        type=int,
        default=640,
        help="Validation image size (default: 640).",
    )
    parser.add_argument(
        "--output",
        default="runs/validation_metrics.json",
        help="Where to save the JSON metrics report.",
    )
    args = parser.parse_args()

    model_path = _project_path(args.model)
    data_path = _project_path(args.data)
    output_path = _project_path(args.output)

    if not model_path.is_file():
        parser.error(f"Model weights not found: {model_path}")
    if not data_path.is_file():
        parser.error(f"Dataset YAML not found: {data_path}")
    if args.imgsz < 1:
        parser.error("--imgsz must be a positive integer.")
    if output_path.resolve() in {model_path.resolve(), data_path.resolve()}:
        parser.error("--output must not overwrite the model weights or dataset YAML.")

    model = YOLO(str(model_path))
    results = model.val(data=str(data_path), split="val", imgsz=args.imgsz)
    box = results.box

    precision = float(box.mp)
    recall = float(box.mr)
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    report = {
        "model": str(model_path),
        "dataset_yaml": str(data_path),
        "split": "val",
        "image_size": args.imgsz,
        "metrics": {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "map50": float(box.map50),
            "map75": float(box.map75),
            "map50_95": float(box.map),
        },
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(f"Validation metrics for {model_path.name} (split: val)")
    print(f"Precision:       {precision:.4f}")
    print(f"Recall:          {recall:.4f}")
    print(f"F1:              {f1:.4f}")
    print(f"mAP@0.5:         {box.map50:.4f}")
    print(f"mAP@0.75:        {box.map75:.4f}")
    print(f"mAP@0.5:0.95:    {box.map:.4f}")
    print(f"JSON report:     {output_path}")


if __name__ == "__main__":
    main()
