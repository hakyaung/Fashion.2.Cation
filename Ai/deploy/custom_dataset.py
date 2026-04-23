import os
import json
import pandas as pd
from PIL import Image
from torch.utils.data import Dataset
import torchvision.transforms as transforms

# ==========================================
# 1. 데이터 증강 (Transforms)
# ==========================================
train_transform = transforms.Compose([
    transforms.RandomResizedCrop(224, scale=(0.8, 1.0)),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomRotation(degrees=15),
    # NOTE: color 라벨이 있는 멀티태스크 학습이라 ColorJitter(saturation/hue) 는
    #       라벨과 입력을 불일치시킴. → 공간 증강만 사용.
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

val_transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# ==========================================
# 2. 멀티태스크 데이터셋
# ==========================================
class FashionDataset(Dataset):
    def __init__(self, csv_file, img_dir, transform=None, label_maps_path: str = None):
        self.data_frame = pd.read_csv(csv_file, encoding="utf-8-sig")
        self.img_dir = img_dir
        self.transform = transform

        # 실제 디스크에 없는 이미지는 제외 (preprocess 단계에서 일부가 빠졌을 수 있음)
        exists_mask = self.data_frame["filename"].apply(
            lambda fn: os.path.exists(os.path.join(img_dir, fn))
        )
        missing = int((~exists_mask).sum())
        if missing:
            print(f"⚠️  누락된 이미지 {missing}개 건너뜀 (총 {len(self.data_frame)}개 중)")
            self.data_frame = self.data_frame[exists_mask].reset_index(drop=True)

        # 우선순위 1: CSV 에 이미 인코딩된 *_code 컬럼이 있으면 그대로 사용.
        #            (final_multitask_data.csv 는 class_code / color_code / style_code 를 포함)
        # 우선순위 2: label_maps.json 기반으로 문자열 컬럼(category/color/style)을 인코딩
        # 우선순위 3: 없으면 cat.codes 로 임시 인코딩 (라벨 일관성 약함)
        code_col_for_category = (
            "class_code" if "class_code" in self.data_frame.columns
            else "category_code" if "category_code" in self.data_frame.columns
            else None
        )
        has_all_codes = (
            code_col_for_category is not None
            and "color_code" in self.data_frame.columns
            and "style_code" in self.data_frame.columns
        )

        if has_all_codes:
            if label_maps_path and os.path.exists(label_maps_path):
                with open(label_maps_path, "r", encoding="utf-8") as f:
                    label_maps = json.load(f)
                self.num_categories = len(label_maps.get("class_label", {})) or (
                    int(self.data_frame[code_col_for_category].max()) + 1
                )
                self.num_colors = len(label_maps.get("color", {})) or (
                    int(self.data_frame["color_code"].max()) + 1
                )
                self.num_styles = len(label_maps.get("style", {})) or (
                    int(self.data_frame["style_code"].max()) + 1
                )
            else:
                self.num_categories = int(self.data_frame[code_col_for_category].max()) + 1
                self.num_colors     = int(self.data_frame["color_code"].max()) + 1
                self.num_styles     = int(self.data_frame["style_code"].max()) + 1

            self.data_frame["category_code"] = self.data_frame[code_col_for_category]
        elif label_maps_path and os.path.exists(label_maps_path):
            with open(label_maps_path, "r", encoding="utf-8") as f:
                label_maps = json.load(f)

            cat_map   = {v: int(k) for k, v in label_maps.get("class_label", {}).items()}
            color_map = {v: int(k) for k, v in label_maps.get("color", {}).items()}
            style_map = {v: int(k) for k, v in label_maps.get("style", {}).items()}

            self.data_frame["category_code"] = self.data_frame["class_label"].map(cat_map)
            self.data_frame["color_code"]    = self.data_frame["color"].map(color_map)
            self.data_frame["style_code"]    = self.data_frame["style"].map(style_map)

            self.num_categories = len(cat_map)
            self.num_colors     = len(color_map)
            self.num_styles     = len(style_map)
        else:
            # cat.codes는 데이터가 바뀌면 같은 클래스가 다른 숫자로 매핑될 수 있음 — label_maps.json 생성 권장
            self.data_frame["category_code"] = self.data_frame["class_label"].astype("category").cat.codes
            self.data_frame["color_code"]    = self.data_frame["color"].astype("category").cat.codes
            self.data_frame["style_code"]    = self.data_frame["style"].astype("category").cat.codes

            self.num_categories = len(self.data_frame["class_label"].unique())
            self.num_colors     = len(self.data_frame["color"].unique())
            self.num_styles     = len(self.data_frame["style"].unique())

        self.labels_category = self.data_frame["category_code"].tolist()
        self.labels_color    = self.data_frame["color_code"].tolist()
        self.labels_style    = self.data_frame["style_code"].tolist()

    def __len__(self):
        return len(self.data_frame)

    def __getitem__(self, idx):
        img_name = self.data_frame.iloc[idx]["filename"]
        img_path = os.path.join(self.img_dir, img_name)
        image = Image.open(img_path).convert("RGB")

        cat_label   = self.labels_category[idx]
        color_label = self.labels_color[idx]
        style_label = self.labels_style[idx]

        if self.transform:
            image = self.transform(image)

        return image, (cat_label, color_label, style_label)
