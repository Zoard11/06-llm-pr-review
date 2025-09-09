from contextlib import asynccontextmanager
from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import CartItemCreate, CartItemDTO, ProductCreate, ProductDTO, ProductUpdate
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from config import settings
from database import CartItem, Product, create_tables, get_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

origins = [
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/products/", response_model=ProductDTO)
async def create_product(payload: ProductCreate, db: AsyncSession = Depends(get_db)):
    new = Product(**payload.model_dump())
    db.add(new)
    await db.commit()
    await db.refresh(new)
    return new


@app.get("/products/", response_model=list[ProductDTO])
async def list_products(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product))
    products = result.scalars().all()
    return products


@app.get("/products/{id}", response_model=ProductDTO)
async def get_product(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).filter(Product.id == id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.put("/products/{id}", response_model=ProductDTO)
async def update_product(
    id: int, payload: ProductUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Product).filter(Product.id == id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@app.delete("/products/{id}")
async def delete_product(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).filter(Product.id == id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.execute(delete(Product).filter(Product.id == id))
    await db.commit()
    return {"detail": "Product deleted"}


@app.get("/cart/", response_model=List[CartItemDTO])
async def get_cart_items(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CartItem).options(selectinload(CartItem.product)))
    cart_items = result.scalars().all()
    return cart_items


@app.post("/cart/", response_model=CartItemDTO)
async def add_to_cart(
    payload: CartItemCreate, db: AsyncSession = Depends(get_db)
):
    # Check if product exists and has enough stock
    product_result = await db.execute(
        select(Product).filter(Product.id == payload.product_id)
    )
    product = product_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.stock < payload.quantity:
        raise HTTPException(status_code=400, detail="Not enough stock")

    # Check if item is already in cart
    cart_item_result = await db.execute(
        select(CartItem)
        .filter(CartItem.product_id == payload.product_id)
        .options(selectinload(CartItem.product))
    )
    cart_item = cart_item_result.scalar_one_or_none()

    if cart_item:
        # Update quantity
        cart_item.quantity += payload.quantity
        db.add(cart_item)
    else:
        # Create new cart item
        cart_item = CartItem(**payload.model_dump())
        db.add(cart_item)

    # Update product stock
    product.stock -= payload.quantity
    db.add(product)

    await db.commit()
    await db.refresh(cart_item)
    # Eagerly load the product relationship
    result = await db.execute(
        select(CartItem)
        .filter(CartItem.id == cart_item.id)
        .options(selectinload(CartItem.product))
    )
    cart_item = result.scalar_one_or_none()
    return cart_item


@app.delete("/cart/{item_id}", response_model=CartItemDTO)
async def remove_from_cart(item_id: int, db: AsyncSession = Depends(get_db)):
    # Get cart item
    cart_item_result = await db.execute(
        select(CartItem).filter(CartItem.id == item_id)
    )
    cart_item = cart_item_result.scalar_one_or_none()
    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    # Get product
    product_result = await db.execute(
        select(Product).filter(Product.id == cart_item.product_id)
    )
    product = product_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Update product stock
    product.stock += cart_item.quantity

    await db.delete(cart_item)
    await db.commit()

    return cart_item


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
