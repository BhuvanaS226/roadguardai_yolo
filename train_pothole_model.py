import os
import shutil
from pathlib import Path

from ultralytics import YOLO


PROJECT_ROOT = Path(__file__).resolve().parent
DATASET_CANDIDATES = [
    PROJECT_ROOT / "datasets" / "road_damage_balanced" / "data.yaml",
    PROJECT_ROOT / "datasets" / "data.yaml",
    PROJECT_ROOT / "datasets" / "road_damage_combined" / "data.yaml",
    PROJECT_ROOT / "datasets" / "road_damage_rdd2020" / "data.yaml",
]


def find_dataset_yaml() -> Path:
    for candidate in DATASET_CANDIDATES:
        if candidate.exists():
            return candidate
    raise FileNotFoundError(
        "No YOLO dataset YAML was found. Please place the dataset under datasets/road_damage_balanced/data.yaml "
        "or update the training script with the correct path."
    )


def main() -> None:
    data_yaml = find_dataset_yaml()
    output_dir = PROJECT_ROOT / "runs" / "detect"
    model_name = "roadguard_pothole"

    print(f"[Train] Using dataset: {data_yaml}")
    print(f"[Train] Output directory: {output_dir}")

    model = YOLO("yolo11n.pt")
    model.train(
        data=str(data_yaml),
        epochs=30,
        imgsz=640,
        batch=8,
        project=str(PROJECT_ROOT),
        name=model_name,
        exist_ok=True,
        pretrained=True,
        seed=42,
    )

    generated_best = output_dir / model_name / "weights" / "best.pt"
    copied_best = PROJECT_ROOT / "best.pt"

    if generated_best.exists():
        shutil.copy2(generated_best, copied_best)
        print(f"[Train] Custom model copied to {copied_best}")
    else:
        print(f"[Train] Warning: expected weights not found at {generated_best}")

    print("[Train] Training finished. The app will prefer the custom model from best.pt if present.")


if __name__ == "__main__":
    main()
