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
    transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
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
        self.data_frame = pd.read_csv(csv_file)
        self.img_dir = img_dir
        self.transform = transform

        # label_maps.json이 있으면 고정 매핑 사용 (데이터 변경에도 라벨 일관성 유지)
        # 없으면 cat.codes로 fallback (학습 전용 환경)
        if label_maps_path and os.path.exists(label_maps_path):
            with open(label_maps_path, "r", encoding="utf-8") as f:
                label_maps = json.load(f)

            cat_map   = {v: int(k) for k, v in label_maps.get("class_label", {}).items()}
            color_map = {v: int(k) for k, v in label_maps.get("color", {}).items()}
            style_map = {v: int(k) for k, v in label_maps.get("style", {}).items()}

            self.data_frame["category_code"] = self.data_frame["category"].map(cat_map)
            self.data_frame["color_code"]    = self.data_frame["color"].map(color_map)
            self.data_frame["style_code"]    = self.data_frame["style"].map(style_map)

            self.num_categories = len(cat_map)
            self.num_colors     = len(color_map)
            self.num_styles     = len(style_map)
        else:
            # cat.codes는 데이터가 바뀌면 같은 클래스가 다른 숫자로 매핑될 수 있음
            # label_maps.json을 생성해서 사용하는 것을 권장
            self.data_frame["category_code"] = self.data_frame["category"].astype("category").cat.codes
            self.data_frame["color_code"]    = self.data_frame["color"].astype("category").cat.codes
            self.data_frame["style_code"]    = self.data_frame["style"].astype("category").cat.codes

            self.num_categories = len(self.data_frame["category"].unique())
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
