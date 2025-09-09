from pydantic import BaseModel
from typing import Optional

class ProductDTO(BaseModel):
    id: int
    name: str
    price: float
    description: Optional[str] = None
    stock: int

    class Config:
        from_attributes = True

class ProductCreate(BaseModel):
    name: str
    price: float
    description: Optional[str] = None
    stock: int

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    stock: Optional[int] = None

class CartItemDTO(BaseModel):
    id: int
    product_id: int
    quantity: int
    product: ProductDTO

    class Config:
        from_attributes = True

class CartItemCreate(BaseModel):
    product_id: int
    quantity: int
