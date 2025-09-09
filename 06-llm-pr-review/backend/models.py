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
from typing import Optional
from pydantic import NonNegativeInt

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    stock: Optional[NonNegativeInt] = None

class CartItemDTO(BaseModel):
    id: int
    product_id: int
    quantity: int
    product: ProductDTO

    class Config:
        from_attributes = True

from pydantic import PositiveInt

class CartItemCreate(BaseModel):
    product_id: PositiveInt
    quantity: PositiveInt
