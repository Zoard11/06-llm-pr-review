from contextlib import asynccontextmanager
from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import ProductCreate, ProductDTO, ProductUpdate
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import Product, create_tables, get_db



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
async def create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db)
):
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
async def get_product(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Product).filter(Product.id == id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@app.put("/products/{id}", response_model=ProductDTO)
async def update_product(
    id: int,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db)
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
async def delete_product(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Product).filter(Product.id == id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.execute(delete(Product).filter(Product.id == id))
    await db.commit()
    return {"detail": "Product deleted"}



if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
