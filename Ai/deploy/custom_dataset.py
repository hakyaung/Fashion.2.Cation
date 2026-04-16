import os
import pandas as pd
from PIL import Image
from torch.utils.data import Dataset
import torchvision.transforms as transforms

# ==========================================
# 1. 마법의 데이터 증강 (Transforms)
# ==========================================
# 🏋️‍♂️ 훈련용(Train): 모델을 빡세게 굴리는 '매운맛' 변환
train_transform = transforms.Compose([
    transforms.RandomResizedCrop(224, scale=(0.8, 1.0)), 
    transforms.RandomHorizontalFlip(p=0.5),              
    transforms.RandomRotation(degrees=15),               
    transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2), 
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# 📝 검증용(Val): 실전 테스트를 위한 '순한맛' 변환
val_transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224), 
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# ==========================================
# 2. 멀티태스크 데이터셋 배식기 개조 완료!
# ==========================================
class FashionDataset(Dataset):
    def __init__(self, csv_file, img_dir, transform=None):
        self.data_frame = pd.read_csv(csv_file)
        self.img_dir = img_dir
        self.transform = transform
        
        # 🌟 핵심: 3개의 정답(Label)을 모두 숫자로 변환해서 저장
        self.data_frame['category_code'] = self.data_frame['category'].astype('category').cat.codes
        self.data_frame['color_code'] = self.data_frame['color'].astype('category').cat.codes
        self.data_frame['style_code'] = self.data_frame['style'].astype('category').cat.codes
        
        self.labels_category = self.data_frame['category_code'].tolist()
        self.labels_color = self.data_frame['color_code'].tolist()
        self.labels_style = self.data_frame['style_code'].tolist()

        # 🌟 나중에 모델 머리(Head) 크기를 정할 때 쓰려고 정답 종류 개수 저장
        self.num_categories = len(self.data_frame['category'].unique())
        self.num_colors = len(self.data_frame['color'].unique())
        self.num_styles = len(self.data_frame['style'].unique())

    def __len__(self):
        return len(self.data_frame)

    def __getitem__(self, idx):
        img_name = self.data_frame.iloc[idx]['filename']
        img_path = os.path.join(self.img_dir, img_name)
        image = Image.open(img_path).convert('RGB')
        
        # 🌟 정답 3개를 쏙쏙 뽑아오기
        cat_label = self.labels_category[idx]
        color_label = self.labels_color[idx]
        style_label = self.labels_style[idx]
        
        if self.transform:
            image = self.transform(image)
            
        # 🌟 이미지 1장과 정답 3개 묶음(튜플)을 반환!
        return image, (cat_label, color_label, style_label)