from sqlalchemy import Column, Integer, String, Float
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from config import settings

engine = create_async_engine(settings.database_url, echo=settings.debug)
AsyncSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine, class_=AsyncSession
)

Base = declarative_base()


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    price = Column(Float, nullable=False)
    description = Column(String, nullable=True)
    stock = Column(Integer, nullable=False)

async def get_db():
    """
    Asynchronous dependency that provides a scoped AsyncSession for database operations.
    
    Yields:
        AsyncSession: An async SQLAlchemy session instance tied to AsyncSessionLocal. The session is opened when the generator is entered and closed automatically when the context exits.
    """
    async with AsyncSessionLocal() as session:
        yield session


async def create_tables():
    """
    Create all database tables defined on the declarative Base.
    
    This asynchronous function opens an async engine connection and runs Base.metadata.create_all
    to ensure all ORM tables are created in the bound database. Calling it is safe to run
    multiple times: existing tables are not recreated.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
