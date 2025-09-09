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
    """
    Lifespan context manager for the FastAPI application that ensures database tables exist before the app starts.
    
    Called by FastAPI as the app lifespan: runs create_tables() on startup, then yields control to allow the application to run. No explicit shutdown actions are performed.
    """
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
    """
    Create and persist a new Product from a ProductCreate payload.
    
    Parameters:
        payload (ProductCreate): Input data used to construct the Product.
    
    Returns:
        Product: The newly created and refreshed Product ORM instance (including generated fields like id).
    """
    new = Product(**payload.model_dump())
    db.add(new)
    await db.commit()
    await db.refresh(new)
    return new

@app.get("/products/", response_model=list[ProductDTO])
async def list_products(db: AsyncSession = Depends(get_db)):
    """
    Return all Product records from the database.
    
    Retrieves all Product ORM instances via an asynchronous select query and returns them as a list.
    
    Returns:
        list[Product]: A list of Product model instances.
    """
    result = await db.execute(select(Product))
    products = result.scalars().all()
    return products

@app.get("/products/{id}", response_model=ProductDTO)
async def get_product(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve a Product by its ID.
    
    Queries the database for a Product with the given integer ID and returns the mapped Product instance.
    Raises an HTTPException with status 404 if no matching product is found.
    
    Parameters:
        id (int): Primary key of the product to fetch.
    
    Returns:
        Product: The ORM Product instance matching the provided id.
    
    Raises:
        HTTPException: If no product exists with the given id (status_code=404).
    """
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
    """
    Update an existing product with fields provided in the payload.
    
    If the product with the given id does not exist, raises HTTPException(404, "Product not found").
    Only fields present on `payload` (via `model_dump(exclude_unset=True)`) are applied to the stored Product.
    
    Parameters:
        id (int): ID of the product to update.
        payload (ProductUpdate): Partial update data; only supplied fields are written.
    
    Returns:
        Product: The updated ORM Product instance.
    """
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
    """
    Delete a Product by its ID.
    
    Attempts to find and remove the Product with the given `id` from the database. If the product does not exist, raises an HTTP 404.
    
    Parameters:
        id (int): Primary key of the product to delete.
    
    Returns:
        dict: Confirmation message {"detail": "Product deleted"} on successful deletion.
    
    Raises:
        fastapi.HTTPException: 404 if no product with the specified `id` exists.
    """
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
